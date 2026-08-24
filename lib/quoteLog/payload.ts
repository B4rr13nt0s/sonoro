// Arma el body que el navegador manda a /api/quote-log a partir del mismo
// CartItem que ya usa lib/whatsapp — consumidor del carrito, igual que
// WhatsApp (CLAUDE.md § Modelo de conversión), no al revés.
import type { CartItem } from "../cart/index.ts";
import type { QuoteLogRequest } from "./types.ts";

export function buildQuoteLogRequest(params: {
  items: CartItem[];
  ref: string;
  subtotalCents: number;
  userAgent: string;
}): QuoteLogRequest {
  return {
    ref: params.ref,
    items: params.items.map((item) => ({
      sku: item.sku,
      nombre: item.nombreSnapshot,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
    })),
    subtotalCents: params.subtotalCents,
    userAgent: params.userAgent,
  };
}
