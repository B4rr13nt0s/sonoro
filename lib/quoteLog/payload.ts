// Arma el body que el navegador manda a /api/quote-log a partir del mismo
// CartItem que ya usa lib/whatsapp — consumidor del carrito, igual que
// WhatsApp (CLAUDE.md § Modelo de conversión), no al revés.
import type { CartItem } from "../cart/index.ts";
import type { Disponibilidad } from "../catalog/types.ts";
import type { QuoteLogRequest } from "./types.ts";

// `disponibilidad` (por sku) es el mismo mapa que marca las líneas del
// mensaje de WhatsApp (lib/whatsapp/message.ts): lo disponible no lleva
// campo, igual que no lleva marca en el mensaje.
export function buildQuoteLogRequest(params: {
  items: CartItem[];
  ref: string;
  subtotalCents: number;
  userAgent: string;
  disponibilidad?: Readonly<Record<string, Disponibilidad>>;
}): QuoteLogRequest {
  const disponibilidad = params.disponibilidad ?? {};
  return {
    ref: params.ref,
    items: params.items.map((item) => {
      const estado = disponibilidad[item.sku];
      return {
        sku: item.sku,
        nombre: item.nombreSnapshot,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        ...(estado && estado !== "disponible" ? { disponibilidad: estado } : {}),
      };
    }),
    subtotalCents: params.subtotalCents,
    userAgent: params.userAgent,
  };
}
