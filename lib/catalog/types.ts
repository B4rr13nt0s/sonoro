import { z } from "zod";

import { CALIBRES_AWG, IMPEDANCIAS_OHM, MEDIDAS, VALUE_LABELS } from "./labels.ts";

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

// Campos normalizados del producto, ya validados por el importador. Los
// valores de lista salen de lib/catalog/labels.ts —la misma fuente que los
// traduce—, así que un valor aceptado acá siempre tiene cómo mostrarse.
// Estricto: una clave que no es un campo normalizado es un error, no un dato
// extra que se cuela en catalog.json.
function enumDe<T extends Record<string, string>>(tabla: T) {
  return z.enum(Object.keys(tabla) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]]);
}
function numeroDeLista(lista: readonly number[]) {
  return z.number().refine((n) => lista.includes(n), {
    error: `debe ser uno de: ${lista.join(", ")}`,
  });
}
const noNegativo = z.number().nonnegative();

export const AtributosSchema = z.strictObject({
  medida: z.enum(MEDIDAS).optional(),
  potencia_rms_w: noNegativo.optional(),
  impedancia_ohm: numeroDeLista(IMPEDANCIAS_OHM).optional(),
  bobinas: enumDe(VALUE_LABELS.bobinas).optional(),
  configuracion: enumDe(VALUE_LABELS.configuracion).optional(),
  canales: z.number().int().positive().optional(),
  clase: enumDe(VALUE_LABELS.clase).optional(),
  formato: enumDe(VALUE_LABELS.formato).optional(),
  pantalla_pulg: noNegativo.optional(),
  carplay: z.boolean().optional(),
  android_auto: z.boolean().optional(),
  salidas_preamp_pares: z.number().int().nonnegative().optional(),
  salidas_preamp_voltaje: noNegativo.optional(),
  espesor_mm: noNegativo.optional(),
  cobertura_m2: noNegativo.optional(),
  material_insono: enumDe(VALUE_LABELS.material_insono).optional(),
  calibre_awg: numeroDeLista(CALIBRES_AWG).optional(),
  material_conductor: enumDe(VALUE_LABELS.material_conductor).optional(),
  tipo_accesorio: enumDe(VALUE_LABELS.tipo_accesorio).optional(),
  tipo_ecualizador: enumDe(VALUE_LABELS.tipo_ecualizador).optional(),
  bandas: z.number().int().positive().optional(),
  profundidad_mm: noNegativo.optional(),
  sensibilidad_db: noNegativo.optional(),
  capacidad_w: noNegativo.optional(),
  longitud_m: noNegativo.optional(),
});
export type Atributos = z.infer<typeof AtributosSchema>;

export const ProductoSchema = z
  .object({
    sku: z.string().regex(SKU_REGEX), // canónico, inmutable. VISIBLE como «Código»
    slug: z.string().regex(SLUG_REGEX), // URL, inmutable una vez publicado
    nombre: z.string(),
    marca: z.string(),
    // La PRINCIPAL: define la URL canónica, el breadcrumb y los campos
    // obligatorios. Los productos de la hoja ESPECIALES llevan «Sistemas».
    categoria: z.string(),
    // Solo ESPECIALES: las categorías en cuyo listado también aparece (un
    // sistema completo sale entre los subwoofers y entre las bocinas). No
    // cambia su URL — cada producto tiene una sola.
    categoriasSecundarias: z.array(z.string()).min(1).optional(),
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
    // Los valores normalizados de donde salieron las specs generadas. Todavía
    // no los lee ninguna pantalla; son la materia prima de filtros y
    // comparador. Ausente en los productos de ESPECIALES.
    atributos: AtributosSchema.optional(),
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

// Misma forma que Brand — data/taxonomy.json la emite igual. Tipo aparte
// (no un alias de Brand) porque una categoría y una marca no son la misma
// noción de dominio aunque hoy compartan estructura.
export const CategoriaSchema = z.object({
  nombre: z.string(),
  slug: z.string(),
  cantidadProductos: z.number().int().nonnegative(),
});
export type Categoria = z.infer<typeof CategoriaSchema>;
export const CategoriasSchema = z.array(CategoriaSchema);

// "relevancia" NO es un puntaje guardado ni un campo del producto: es el
// comparador de lib/catalog/orden.ts (destacado → precio descendente → sku).
// Ojo con el homónimo: la "relevancia" de /buscar es otra cosa, un puntaje de
// coincidencia de texto que depende de la consulta y vive en
// components/catalog/SearchExperience.tsx.
export const OrdenSchema = z.enum(["relevancia", "precio_asc", "precio_desc"]);
export type Orden = z.infer<typeof OrdenSchema>;

// El orden con el que abre un listado si nadie pidió otro. Vive acá y no
// suelto en cada página porque lib/catalog/href.ts lo necesita para OMITIRLO
// de la URL: el default no se escribe como query param, así que /marcas/kbt
// se mantiene limpia y el canonical no se fragmenta.
export const ORDEN_DEFECTO: Orden = "relevancia";

// Lee el query param `orden` y lo resuelve a un valor válido. Cualquier cosa
// que no sea del enum —ausente, basura, un valor viejo— cae en el default
// en vez de romper: son URLs que puede escribir cualquiera.
export function parseOrden(valor: string | string[] | undefined): Orden {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  const parseo = OrdenSchema.safeParse(crudo);
  return parseo.success ? parseo.data : ORDEN_DEFECTO;
}

// Filtros de listProducts. CLAUDE.md § Rutas menciona query params como
// ?marca=memphis&precio_max=200000 y paginación con ?page=2 — estos campos
// son la traducción directa de eso. No están definidos campo por campo en
// CLAUDE.md; es la forma mínima que cubre lo que Rutas ya describe.
//
// `orden` es opcional y SIN default aquí a propósito: si el adaptador
// asumiera un orden por defecto, cambiaría el orden de listados que no piden
// orden explícito (p. ej. "Los más vendidos" en el inicio). ORDEN_DEFECTO es
// el orden con el que abre una PÁGINA de listado, y son esas páginas las que
// lo pasan explícito; sin `orden`, listProducts devuelve el orden del
// catálogo tal como venía.
//
// `activo` sigue el mismo criterio — SIN default aquí, cada llamador dice
// qué quiere. Toda página de cara al cliente (catálogo, marca, inicio,
// /buscar) debe pasar `activo: true` explícito: un producto con
// activo=false salió de venta (CLAUDE.md § Mantenimiento del catálogo) y no
// debe aparecer en ningún listado ni en resultados de búsqueda. Hay
// exactamente TRES llamadores que a propósito NO filtran (necesitan el
// catálogo completo, inactivos incluidos):
//   - generateStaticParams de app/producto/[slug]/page.tsx: si no
//     pre-renderiza la página del producto inactivo, proxy.ts no tiene qué
//     reescribir a 410 y la URL cae en un 404 genérico en vez de la
//     página "ya no disponible".
//   - CartProvider en app/layout.tsx: reconcile() (lib/cart/reconcile.ts)
//     necesita distinguir "el sku ya no existe" de "el sku existe pero
//     está inactivo" para reportarle al usuario la razón correcta por la
//     que se quitó una línea de su carrito — con el catálogo ya filtrado,
//     ambos casos se ven idénticos.
//   - app/comparar/page.tsx: por lo mismo, para poder decir "ya no está
//     disponible" en vez de "no está en el catálogo" cuando un sku del
//     enlace compartido salió de venta.
export type ProductFilters = {
  categoria?: string;
  marca?: string;
  disponibilidad?: Disponibilidad;
  destacado?: boolean;
  activo?: boolean;
  precioMinCents?: number;
  precioMaxCents?: number;
  orden?: Orden;
  page?: number; // 1-indexado, default 1
  pageSize?: number; // default: ver adapters/static.ts
};

// Contrato que cualquier fuente del catálogo debe cumplir. Hoy lo implementa
// adapters/static.ts (JSON local); una fuente remota futura implementa el
// mismo contrato — lib/catalog/index.ts cambia una línea, ningún componente
// se entera (CLAUDE.md § Fuente de verdad).
export interface CatalogAdapter {
  getProduct(slug: string): Promise<Producto | null>;
  listProducts(
    filters: ProductFilters,
  ): Promise<{ items: Producto[]; total: number; page: number; pageSize: number }>;
  listBrands(): Promise<Brand[]>;
  listCategories(): Promise<Categoria[]>;
}
