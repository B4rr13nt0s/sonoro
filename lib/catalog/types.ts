import { z } from "zod";

// SKU y slug se exportan como constantes: el importador de datos debe importar
// estos mismos patrones en vez de definir los suyos, o la validación defensiva
// del importador y la del esquema se desincronizan.
//
// SKU_REGEX se infiere de los únicos ejemplos que da el proyecto — SQ12-D2, PRX60C
// (CLAUDE.md § Modelo de conversión) y 6X9-2 (docs/PLAN.md § Validaciones
// defensivas) — no hay una regla de formato escrita explícitamente en CLAUDE.md.
// Mayúsculas y dígitos, en uno o más grupos separados por guion.
export const SKU_REGEX = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

// slug: minúsculas, sin acentos, solo guiones como separador. Es lo que hace
// cumplir la regla de inmutabilidad de URL (CLAUDE.md § Esquema de producto).
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
