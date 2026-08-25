// Única fuente de verdad para las categorías del sitio — CLAUDE.md § Rutas:
// "Agregar una categoría nueva es un cambio de código, no solo de datos:
// requiere actualizar esta lista y el nav." A diferencia de las marcas (que
// entran y salen según el catálogo importado), las categorías son un enum
// fijo definido por el negocio, así que viven en código, no en
// data/taxonomy.json. scripts/import-catalog.ts usa esta misma lista para
// generar taxonomy.json (con cantidadProductos calculado, 0 si la categoría
// todavía no tiene productos) y SiteHeader.tsx la usa para el nav — ambos
// quedan sincronizados por construcción.
export const CATEGORIAS_SITIO = [
  { slug: "bocinas", nombre: "Bocinas" },
  { slug: "subwoofers", nombre: "Subwoofers" },
  { slug: "amplificadores", nombre: "Amplificadores" },
  { slug: "receptores", nombre: "Receptores" },
  { slug: "kits", nombre: "Kits" },
  { slug: "insonorizacion", nombre: "Insonorización" },
  { slug: "equalizadores", nombre: "Equalizadores" },
  { slug: "accesorios", nombre: "Accesorios" },
] as const;
