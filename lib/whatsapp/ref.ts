// CLAUDE.md § Modelo de conversión: "ID de pedido corto (SNR-XXXXX) visible
// en pantalla y en el mensaje: vendedor y cliente hablan del mismo pedido."
//
// No se guarda en el Cart (CLAUDE.md no lo lista en la estructura de
// CartItem/Cart, y lib/cart no conoce WhatsApp) — se DERIVA del carrito:
// su `createdAt` MÁS su contenido.
//
// El contenido entró en la cuenta el 24 de septiembre de 2026, porque con
// solo `createdAt` el Ref no identificaba un pedido sino un CARRITO, y un
// carrito vive en el navegador entre pedidos: en la hoja del negocio quedó
// SNR-S8CAM el 25 de agosto con dos pedidos distintos —un receptor de
// Q 4,000 y unas bocinas de Q 975— porque el mismo cliente volvió, cambió
// los productos y el Ref no se movió. Con el contenido adentro, cambiar el
// carrito cambia el Ref, que es lo que el vendedor necesita para hablar de
// UN pedido.
//
// Sigue siendo estable mientras el carrito no cambie: abrir /carrito diez
// veces da el mismo Ref, y quitar y volver a agregar el mismo producto
// también, porque las líneas se ordenan por sku antes de contarlas.
//
// El largo no cambia: cinco caracteres, 36⁵ = 60,466,176 combinaciones. Meter
// más datos en la cuenta no alarga el Ref, solo lo reparte distinto — que es
// justo lo que se pedía.
const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LARGO_REF = 5;

// FNV-1a de 32 bits — determinista, sin dependencias, suficiente para un
// identificador corto que solo necesita ser estable y visualmente distinto
// entre pedidos, no criptográficamente fuerte.
function hashFnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Lo mínimo que identifica una línea del pedido. `CartItem` lo cumple. */
export type LineaDeRef = { sku: string; qty: number; unitPriceCents: number };

/**
 * Las líneas se ordenan por sku en PUNTOS DE CÓDIGO, no con localeCompare:
 * el Ref no puede cambiar entre navegadores ni entre versiones de ICU, o el
 * que ve el cliente dejaría de ser el que ve el vendedor (mismo criterio que
 * lib/catalog/orden.ts).
 */
function firmaDeLineas(items: readonly LineaDeRef[]): string {
  return items
    .map((item) => `${item.sku}:${item.qty}:${item.unitPriceCents}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join("|");
}

export function buildOrderRef(createdAt: string, items: readonly LineaDeRef[] = []): string {
  // El separador impide que un createdAt largo y una firma corta se confundan
  // con el caso al revés.
  let n = hashFnv1a([createdAt, firmaDeLineas(items)].join("~"));
  let codigo = "";
  for (let i = 0; i < LARGO_REF; i++) {
    codigo = ALFABETO[n % ALFABETO.length] + codigo;
    n = Math.floor(n / ALFABETO.length);
  }
  return `SNR-${codigo}`;
}
