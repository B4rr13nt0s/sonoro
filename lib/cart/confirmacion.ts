// La confirmación de «Agregar al carrito», en un solo lugar: la dicen el botón
// de la ficha (AgregarConCantidad) y la línea del bot en el chat
// (lib/chat/panel.ts). Módulo aparte y sin dependencias para que la ficha no
// arrastre el motor del chat.

/** «Has añadido 1 ítem al carrito.» / «Has añadido 3 ítems al carrito.» */
export function textoAgregado(n: number): string {
  return `Has añadido ${n} ${n === 1 ? "ítem" : "ítems"} al carrito.`;
}
