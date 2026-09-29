// Lo que las cuatro páginas de listado hacen igual con los filtros de la
// URL. Estaba copiado en cada una —primeroDeQuery cuatro veces, la
// resolución de slug de marca a nombre seis— y una copia que cambiara sola
// dejaba a la metadata y a la página diciendo cosas distintas.
//
// Lógica pura, sin disco: se prueba en filtros.test.ts.
import type { Brand } from "./types.ts";

/** El primer valor de un query param: `?marca=a&marca=b` es `a`, igual que parsePagina. */
export function primeroDeQuery(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * El nombre de la marca de un slug de la URL. Un slug que no resuelve a una
 * marca real devuelve el slug CRUDO: filtrar por él no matchea ningún
 * producto, así que el listado sale «sin resultados» en vez de mostrar todo
 * sin filtrar por error (y proxy.ts ya lo respondió con 404).
 */
export function nombreDeMarca(
  marcas: readonly Pick<Brand, "slug" | "nombre">[],
  slug: string | undefined,
): string | undefined {
  if (!slug) return undefined;
  return marcas.find((marca) => marca.slug === slug)?.nombre ?? slug;
}

/**
 * Las marcas que se ofrecen en el filtro de un listado: solo las que tienen
 * productos en él, más la elegida aunque no tenga (así su píldora se sigue
 * viendo). Antes se ofrecían todas, y 35 de las 64 combinaciones
 * categoría × marca llevaban a un listado vacío. El listado vacío sigue
 * existiendo por URL, con 200 y noindex (CLAUDE.md § Rutas); solo deja de
 * ofrecerse.
 */
export function marcasDelFiltro<M extends Pick<Brand, "slug" | "nombre">>(
  marcas: readonly M[],
  productos: readonly { marca: string }[],
  slugElegido: string | undefined,
): M[] {
  const presentes = new Set(productos.map((producto) => producto.marca));
  return marcas.filter((marca) => presentes.has(marca.nombre) || marca.slug === slugElegido);
}
