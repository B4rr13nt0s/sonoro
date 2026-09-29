// Arma el body que el navegador manda a /api/quote-log a partir del mismo
// CartItem que ya usa lib/whatsapp — consumidor del carrito, igual que
// WhatsApp (CLAUDE.md § Modelo de conversión), no al revés.
import type { CartItem } from "../cart/index.ts";
import { marcaDisponibilidad } from "../catalog/disponibilidad.ts";
import type { Disponibilidad } from "../catalog/types.ts";
import { formatearLinea } from "../whatsapp/message.ts";
import { MAX_NOMBRE, MAX_TEXTO, MAX_USER_AGENT, type QuoteLogRequest } from "./types.ts";

// `disponibilidad` (por sku) es el mismo mapa que marca las líneas del
// mensaje de WhatsApp (lib/whatsapp/message.ts), y `estado` lleva el mismo
// texto que esa marca, ya armado: la hoja lo copia sin traducir nada. Lo
// disponible no lleva campo, igual que no lleva marca en el mensaje.
//
// Los textos que no controla el sitio se RECORTAN al tope del esquema en vez
// de mandarse enteros: el servidor rechaza el pedido completo si un campo se
// pasa, y un navegador dentro de una app (Instagram, Facebook) puede traer
// un userAgent de más de 400 caracteres. Mejor un origen recortado en la
// hoja que un pedido que no llega.
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
      const estado = marcaDisponibilidad(disponibilidad[item.sku]);
      return {
        texto: formatearLinea(item, disponibilidad[item.sku]).slice(0, MAX_TEXTO),
        sku: item.sku,
        nombre: item.nombreSnapshot.slice(0, MAX_NOMBRE),
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        ...(estado ? { estado } : {}),
      };
    }),
    subtotalCents: params.subtotalCents,
    userAgent: params.userAgent.slice(0, MAX_USER_AGENT),
  };
}
