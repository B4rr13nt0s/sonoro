import { z } from "zod";

// SKU y slug se exportan como constantes: el importador de datos debe importar
// estos mismos patrones en vez de definir los suyos, o la validación defensiva
// del importador y la del esquema se desincronizan.
//
// El sku es el código del fabricante tal como lo publica cada marca, sin
// normalizar — no una convención propia de Sonoro. Admite mayúsculas, dígitos,
// y espacio, punto o guion como separadores internos (nunca dobles, ni al
// inicio ni al final). Debe coincidir exactamente con el código que aparece en
// la factura del distribuidor y en las publicaciones del fabricante, porque
// viaja tal cual al cliente como «Código» y en los mensajes de WhatsApp.
export const SKU_REGEX = /^[A-Z0-9]+([ .\-][A-Z0-9]+)*$/;

// slug: minúsculas, sin acentos, solo guiones como separador. Es lo que hace
// cumplir la regla de inmutabilidad de URL (CLAUDE.md § Esquema de producto).
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Detecta valores de sku corrompidos por coerción de tipos de una hoja de
// cálculo (fecha o notación científica) — separado de SKU_REGEX a propósito:
// "2024-06-09" cumple la FORMA de SKU_REGEX (dígitos y guiones) y aun así es
// un valor corrompido. La regex valida forma; esta función detecta corrupción.
// Ninguna sustituye a la otra.
const FORMATOS_MANGEADOS = [
  /^\d{4}-\d{2}-\d{2}$/, // fecha ISO: 2024-06-09
  /^\d{1,2}-[A-Za-z]{3}$/, // fecha corta: 9-Jun
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // fecha con barras: 9/6/2024
  /^\d+(\.\d+)?E[+-]?\d+$/, // notación científica: 1.2E+05
];

export function pareceValorMangeado(sku: string): boolean {
  return FORMATOS_MANGEADOS.some((regex) => regex.test(sku));
}

// Spec: arreglo ORDENADO de {etiqueta, valor}, no objeto — el orden es decisión
// editorial y debe preservarse (CLAUDE.md § Esquema de producto).
export const SpecSchema = z.object({
  etiqueta: z.string(),
  valor: z.string(),
});
export type Spec = z.infer<typeof SpecSchema>;

export const MonedaSchema = z.literal("GTQ");
export type Moneda = z.infer<typeof MonedaSchema>;

export const DisponibilidadSchema = z.enum(["disponible", "bajo_pedido", "agotado"]);
export type Disponibilidad = z.infer<typeof DisponibilidadSchema>;

// Forma mínima inferida — CLAUDE.md no define los campos de Imagen.
export const ImagenSchema = z.object({
  url: z.string(),
  alt: z.string(),
});
export type Imagen = z.infer<typeof ImagenSchema>;

export const ProductoSchema = z
  .object({
    sku: z.string().regex(SKU_REGEX), // canónico, inmutable. VISIBLE como «Código»
    slug: z.string().regex(SLUG_REGEX), // URL, inmutable una vez publicado
    nombre: z.string(),
    marca: z.string(),
    categoria: z.string(),
    descripcionCorta: z.string(),
    // Ordenado. Exactamente 3 (Tamaño/Impedancia/Potencia RMS en SQ12-D2) — el
    // "Código" que se ve junto a ellos en la ficha se deriva de sku, no vive aquí.
    specsDestacadas: z.array(SpecSchema).length(3),
    // Ordenado. Ficha técnica completa: 4 a 10 filas — contrato de la hoja del
    // catálogo.
    specsFicha: z.array(SpecSchema).min(4).max(10),
    precioCents: z.number().int().nonnegative(), // entero, centavos, IVA incluido
    precioAntesCents: z.number().int().nonnegative().optional(),
    moneda: MonedaSchema,
    disponibilidad: DisponibilidadSchema,
    imagenes: z.array(ImagenSchema), // [] es válido → dispara placeholder
    garantiaMeses: z.number().int().positive().optional(), // sin duración definida aún
    destacado: z.boolean(),
    activo: z.boolean(),
  })
  .refine((p) => p.precioAntesCents === undefined || p.precioAntesCents > p.precioCents, {
    message: "precioAntesCents debe ser mayor que precioCents",
    path: ["precioAntesCents"],
  });
export type Producto = z.infer<typeof ProductoSchema>;

// Arreglo completo — lo usa el adaptador estático para validar
// data/catalog.json en cuanto lo lee, no solo su forma de fila individual.
export const CatalogoSchema = z.array(ProductoSchema);

// { nombre, slug, cantidadProductos } — la misma forma que emite
// scripts/import-catalog.ts en data/brands.json.
export const BrandSchema = z.object({
  nombre: z.string(),
  slug: z.string(),
  cantidadProductos: z.number().int().nonnegative(),
});
export type Brand = z.infer<typeof BrandSchema>;
export const BrandsSchema = z.array(BrandSchema);

// Filtros de listProducts. CLAUDE.md § Rutas menciona query params como
// ?marca=memphis&precio_max=200000 y paginación con ?page=2 — estos campos
// son la traducción directa de eso. No están definidos campo por campo en
// CLAUDE.md; es la forma mínima que cubre lo que Rutas ya describe.
export type ProductFilters = {
  categoria?: string;
  marca?: string;
  disponibilidad?: Disponibilidad;
  destacado?: boolean;
  precioMinCents?: number;
  precioMaxCents?: number;
  page?: number; // 1-indexado, default 1
  pageSize?: number; // default: ver adapters/static.ts
};

// Contrato que cualquier fuente del catálogo debe cumplir. Hoy lo implementa
// adapters/static.ts (JSON local); una fuente remota futura implementa el
// mismo contrato — lib/catalog/index.ts cambia una línea, ningún componente
// se entera (CLAUDE.md § Fuente de verdad).
export interface CatalogAdapter {
  getProduct(slug: string): Promise<Producto | null>;
  listProducts(filters: ProductFilters): Promise<{ items: Producto[]; total: number }>;
  listBrands(): Promise<Brand[]>;
}
