// Qué números de página se dibujan. Lógica pura, sin React ni DOM, para
// poder fijarla con pruebas (paginacion.test.ts) — mismo criterio que
// lib/catalog/orden.ts y components/home/ciclo.ts.
//
// Existe porque /catalogo (todo el catálogo) tiene 14 páginas: listarlas
// todas pedía ~556px de números, que no entran en un teléfono y le metían
// scroll horizontal a la página entera. Con /catalogo/[categoria] no se
// notaba, porque el listado más largo eran 5 páginas.

export type ItemPaginacion = number | "…";

// Páginas a cada lado de la actual. Con 1, el caso más ancho son cinco
// números (primera, actual±1, última) y dos «…»: entra en una sola fila en
// un teléfono de 375px.
export const VENTANA = 1;

// Debajo de este total se listan todas: con siete o menos, una ventana no
// ahorra nada y solo agrega puntos suspensivos.
export const SIN_VENTANA_HASTA = 7;

export function paginasVisibles(paginaActual: number, totalPaginas: number): ItemPaginacion[] {
  if (totalPaginas <= SIN_VENTANA_HASTA) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice + 1);
  }

  // Primera y última siempre: son los dos saltos que la gente busca, y sin
  // ellas no hay forma de llegar al final de un listado largo.
  const visibles = new Set<number>([1, totalPaginas]);
  for (let pagina = paginaActual - VENTANA; pagina <= paginaActual + VENTANA; pagina += 1) {
    if (pagina >= 1 && pagina <= totalPaginas) visibles.add(pagina);
  }

  const items: ItemPaginacion[] = [];
  let anterior = 0;
  for (const pagina of [...visibles].sort((a, b) => a - b)) {
    // Un «…» que representa UNA sola página ocupa casi lo mismo que el
    // número y esconde información: si el hueco es de una, va el número.
    if (anterior && pagina - anterior === 2) items.push(anterior + 1);
    else if (anterior && pagina - anterior > 2) items.push("…");
    items.push(pagina);
    anterior = pagina;
  }
  return items;
}
