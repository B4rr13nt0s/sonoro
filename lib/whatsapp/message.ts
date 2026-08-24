// CLAUDE.md § Modelo de conversión — WhatsApp es un CONSUMIDOR del carrito
// (por eso importa de lib/cart, nunca al revés): arma el texto exacto que
// abre wa.me, a partir de los mismos CartItem y el mismo subtotalCents que
// ya usa el resto de la app. No decide envío ni cuota — usa las reglas ya
// fijadas en CLAUDE.md (envío gratis, 6 pagos) tal como las usa /carrito.
import { itemCount, subtotalCents, type CartItem } from "../cart/index.ts";
import { formatQ } from "../format/precio.ts";

// CLAUDE.md § Carrito: "Si el carrito excede ~15 líneas, el mensaje envía
// el Ref y un enlace en vez de la lista completa."
const MAX_LINEAS = 15;

export function buildOrderMessage(params: {
  items: CartItem[];
  ref: string;
  cartUrl: string;
}): string {
  const { items, ref, cartUrl } = params;
  const subtotal = subtotalCents(items);
  // Sin costo de envío que restar o sumar todavía (CLAUDE.md § reglas:
  // "Envíos gratis a todo el país") — total y subtotal coinciden mientras
  // esa política siga vigente.
  const total = subtotal;

  const cuerpo =
    items.length > MAX_LINEAS
      ? [`Carrito con ${itemCount(items)} artículos — ver detalle:`, cartUrl]
      : items.map((item) => formatearLinea(item));

  return [
    "Hola Sonoro, quiero pedir:",
    "",
    ...cuerpo,
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
