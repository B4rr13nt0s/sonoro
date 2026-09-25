// Qué números de página se dibujan. Lógica pura, sin React ni DOM, para
// poder fijarla con pruebas (paginacion.test.ts) — mismo criterio que
// lib/catalog/orden.ts y components/home/ciclo.ts.
//
// Existe porque /catalogo (todo el catálogo) tiene 14 páginas: listarlas
// todas pedía ~556px de números, que no entran en un teléfono y le metían
// scroll horizontal a la página entera. Con /catalogo/[categoria] no se
// notaba, porque el listado más largo eran 5 páginas.

export type ItemPaginacion = number | "…";

// Productos por página de listado. Vive acá, en un módulo sin dependencias, y
// no en el adaptador: proxy.ts lo necesita para saber cuántas páginas tiene
// un listado, y el adaptador lee el disco.
export const PAGE_SIZE_DEFECTO = 24;

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

/**
 * El número de página que pide la URL (`?page=2`), ya saneado.
 *
 * Devuelve SIEMPRE un entero ≥ 1: lo que no lo sea —`?page=abc`, `?page=0`,
 * `?page=-3`, `?page=1.5`, `?page=1e9`— cae en 1. Existe porque las cuatro
 * rutas de listado repetían `Number(...)` a mano y un decimal se colaba
 * hasta el `slice` del adaptador.
 *
 * Que la página EXISTA es otra pregunta, y se responde después de consultar
 * el catálogo: las rutas devuelven 404 cuando el número pedido pasa del
 * total. Sin eso, `?page=99999` respondía 200 con un listado vacío, que para
 * Google es un espacio infinito de URLs que además se renderizan.
 */
export function parsePagina(valor: string | string[] | undefined): number {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  const numero = Number(crudo);
  if (!Number.isFinite(numero) || numero < 1) return 1;
  return Math.min(Math.trunc(numero), Number.MAX_SAFE_INTEGER);
}
