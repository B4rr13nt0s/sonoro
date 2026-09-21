// docs/PLAN.md § 6.4 — Registro de cotizaciones. El navegador solo conoce
// esta forma (ref, items, subtotalCents, userAgent); `token` NUNCA viaja al
// cliente (CLAUDE.md: QUOTE_LOG_TOKEN es variable de servidor) — lo inyecta
// app/api/quote-log/route.ts al reenviar a QUOTE_LOG_URL.
//
// TODOS los campos llevan tope, y no es decoración: /api/quote-log es un
// endpoint ABIERTO —lo tiene que ser, lo llama el navegador de cualquiera
// que cierre un pedido— y lo que pasa por él se escribe en la hoja del
// negocio. Sin topes, un cuerpo de 3.6 MB con 5,000 líneas se reenviaba tal
// cual a Google. Los valores salen del uso real, con aire de sobra:
//
//   ref            SNR-XXXXX, 9 caracteres          → 32
//   sku            el más largo del catálogo, 21    → 64
//   nombre         el más largo del catálogo, 83    → 200
//   items          el mensaje de WhatsApp ya corta  → 60
//                  a ~15 líneas (CLAUDE.md)
//   qty            nadie pide 1,000 de un subwoofer → 999
//   unitPriceCents el producto más caro, Q 70,000   → Q 1,000,000
//   userAgent      los reales rondan 120 caracteres → 400
//
// Un pedido legítimo que roce un tope se pierde del registro, no de la
// venta: el carrito sigue su camino a WhatsApp pase lo que pase (route.ts
// responde 204 siempre). Si algún día el catálogo trae nombres más largos,
// se sube el tope acá, no se quita.
import { z } from "zod";

export const MAX_REF = 32;
export const MAX_SKU = 64;
export const MAX_NOMBRE = 200;
export const MAX_ITEMS = 60;
export const MAX_QTY = 999;
export const MAX_PRECIO_CENTS = 100_000_000;
export const MAX_USER_AGENT = 400;

/**
 * Tope del cuerpo del POST, en bytes. Con los topes de arriba, el cuerpo más
 * grande que puede ser VÁLIDO ronda los 20 KB; 64 KB deja margen para que un
 * cuerpo apenas pasado de la raya se rechace por esquema —no por tamaño— y el
 * corte por bytes quede solo para lo que es claramente un abuso.
 */
export const MAX_BODY_BYTES = 64 * 1024;

export const QuoteLogItemSchema = z.object({
  sku: z.string().max(MAX_SKU),
  nombre: z.string().max(MAX_NOMBRE),
  qty: z.number().int().positive().max(MAX_QTY),
  unitPriceCents: z.number().int().nonnegative().max(MAX_PRECIO_CENTS),
});
export type QuoteLogItem = z.infer<typeof QuoteLogItemSchema>;

export const QuoteLogRequestSchema = z.object({
  ref: z.string().max(MAX_REF),
  items: z.array(QuoteLogItemSchema).max(MAX_ITEMS),
  subtotalCents: z.number().int().nonnegative().max(MAX_PRECIO_CENTS),
  userAgent: z.string().max(MAX_USER_AGENT),
});
export type QuoteLogRequest = z.infer<typeof QuoteLogRequestSchema>;
