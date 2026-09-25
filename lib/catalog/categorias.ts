// Única fuente de verdad para las categorías del sitio — CLAUDE.md § Rutas:
// "Agregar una categoría nueva es un cambio de código, no solo de datos:
// requiere actualizar esta lista y el nav." A diferencia de las marcas (que
// entran y salen según el catálogo importado), las categorías son un enum
// fijo definido por el negocio, así que viven en código, no en
// data/taxonomy.json. scripts/import-catalog.ts usa esta misma lista para
// generar taxonomy.json (con cantidadProductos calculado, 0 si la categoría
// todavía no tiene productos) y SiteHeader.tsx la usa para el nav — ambos
// quedan sincronizados por construcción.
// El ORDEN de esta lista es el del nav y el de taxonomy.json: va de lo que
// más se busca a lo que menos, no alfabético.
export const CATEGORIAS_SITIO = [
  { slug: "bocinas", nombre: "Bocinas" },
  { slug: "subwoofers", nombre: "Subwoofers" },
  { slug: "amplificadores", nombre: "Amplificadores" },
  { slug: "receptores", nombre: "Receptores" },
  { slug: "ecualizadores", nombre: "Ecualizadores" },
  { slug: "kits", nombre: "Kits" },
  { slug: "insonorizacion", nombre: "Insonorización" },
  { slug: "accesorios", nombre: "Accesorios" },
] as const;

// Categoría PRINCIPAL de los productos de la hoja ESPECIALES (sistemas
// completos). Queda FUERA de CATEGORIAS_SITIO a propósito: no tiene página
// propia ni lugar en el nav —una novena categoría no cabe hoy en la barra,
// CLAUDE.md § Patrones—. Esos productos se ven en los listados de sus
// categoriasSecundarias, y en su ficha el breadcrumb muestra «Sistemas» sin
// link, porque no hay página a la cual llevar.
export const CATEGORIA_SISTEMAS = "Sistemas";

// Una categoría lista sus productos principales MÁS los que la traen como
// secundaria (sistemas completos de la hoja ESPECIALES). Es LA regla: la usan
// el adaptador al filtrar, el importador al contar para taxonomy.json y los
// conteos con que proxy.ts valida la paginación — si cada uno la escribiera
// por su cuenta, un listado podría decir «3 páginas» y el proxy dejar pasar 2.
export function perteneceACategoria(
  producto: { categoria: string; categoriasSecundarias?: readonly string[] },
  categoria: string,
): boolean {
  return (
    producto.categoria === categoria ||
    (producto.categoriasSecundarias?.includes(categoria) ?? false)
  );
}
