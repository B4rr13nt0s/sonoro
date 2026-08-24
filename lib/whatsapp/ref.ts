// CLAUDE.md § Modelo de conversión: "ID de pedido corto (SNR-XXXXX) visible
// en pantalla y en el mensaje: vendedor y cliente hablan del mismo pedido."
//
// No se guarda en el Cart (CLAUDE.md no lo lista en la estructura de
// CartItem/Cart, y lib/cart no conoce WhatsApp) — se DERIVA de
// `cart.createdAt`, que ya es estable mientras el carrito exista: mismo
// carrito → mismo Ref cada vez que se abre /carrito o se recalcula el
// mensaje. Un `clear()` crea un `createdAt` nuevo, y con él un Ref nuevo —
// exactamente el comportamiento correcto (es un pedido distinto).
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

export function buildOrderRef(createdAt: string): string {
  let n = hashFnv1a(createdAt);
  let codigo = "";
  for (let i = 0; i < LARGO_REF; i++) {
    codigo = ALFABETO[n % ALFABETO.length] + codigo;
    n = Math.floor(n / ALFABETO.length);
  }
  return `SNR-${codigo}`;
}
