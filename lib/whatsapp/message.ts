// CLAUDE.md § Modelo de conversión — WhatsApp es un CONSUMIDOR del carrito
// (por eso importa de lib/cart, nunca al revés): arma el texto exacto que
// abre wa.me, a partir de los mismos CartItem y el mismo subtotalCents que
// ya usa el resto de la app. No decide envío ni cuota — usa las reglas ya
// fijadas en CLAUDE.md (envío gratis, 6 pagos) tal como las usa /carrito.
import { subtotalCents, type CartItem } from "../cart/index.ts";
import { formatQ } from "../format/precio.ts";

// El mensaje lleva SIEMPRE la lista completa, sin importar cuántas líneas
// tenga el carrito. Hasta el 25 de septiembre de 2026, con más de 15 líneas
// mandaba el Ref y un enlace a /carrito en vez de la lista — pero el carrito
// vive en el localStorage de cada navegador: el vendedor abría el enlace y
// veía SU carrito, vacío, y el cliente tampoco podía volver a verlo, porque
// «Pedir por WhatsApp» lo vacía. El pedido grande, justo el más valioso,
// llegaba sin productos. Un wa.me con 16 líneas pesa unos 3 KB y WhatsApp
// lo abre sin problema.
export function buildOrderMessage(params: { items: CartItem[]; ref: string }): string {
  const { items, ref } = params;
  const subtotal = subtotalCents(items);
  // Sin costo de envío que restar o sumar todavía (CLAUDE.md § reglas:
  // "Envíos gratis a todo el país") — total y subtotal coinciden mientras
  // esa política siga vigente.
  const total = subtotal;

  return [
    "Hola Sonoro, quiero pedir:",
    "",
    ...items.map((item) => formatearLinea(item)),
    "",
    `Subtotal: ${formatQ(subtotal)}`,
    "Envío: gratis",
    `Total: ${formatQ(total)}`,
    `Ref: ${ref}`,
  ].join("\n");
}

function formatearLinea(item: CartItem): string {
  const precioUnitario = formatQ(item.unitPriceCents);
  const sufijo = item.qty > 1 ? " c/u" : "";
  return `${item.qty}x ${item.nombreSnapshot} (${item.sku}) — ${precioUnitario}${sufijo}`;
}

// Consulta por UN producto, desde la ficha. No todo cliente arma un
// carrito: mucha gente quiere preguntar por una pieza puntual, y hasta
// ahora la ficha solo ofrecía "Agregar al carrito".
//
// Vive acá, junto a buildOrderMessage, y no en el componente: componer el
// texto que abre wa.me es responsabilidad de este módulo — así los dos
// mensajes comparten el mismo lugar, el mismo tono y las mismas pruebas.
//
// Lleva sku y URL a propósito: el sku es el código que el cliente ya ve en
// la ficha como «Código» y el que aparece en la factura del distribuidor
// (CLAUDE.md § Esquema de producto), así que vendedor y cliente hablan del
// mismo producto sin ambigüedad; la URL le deja al vendedor abrir la ficha
// sin buscarla.
export function buildProductInquiryMessage(params: {
  nombre: string;
  sku: string;
  url: string;
}): string {
  return [
    "Hola Sonoro, quiero consultar sobre:",
    `${params.nombre} (${params.sku})`,
    params.url,
  ].join("\n");
}
