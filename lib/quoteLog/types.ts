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
//   items          más líneas que productos activos → 400
//                  tiene el catálogo (320)
//   qty            nadie pide 1,000 de un subwoofer → 999
//   unitPriceCents el producto más caro, Q 70,000   → Q 1,000,000
//   userAgent      los reales rondan 120 caracteres → 400
//   estado         «bajo pedido», 11                → 40
//
// Un pedido legítimo que roce un tope se pierde del registro, no de la
// venta: el carrito sigue su camino a WhatsApp pase lo que pase (route.ts
// responde 204 siempre). Si algún día el catálogo trae nombres más largos,
// se sube el tope acá, no se quita.
import { z } from "zod";

export const MAX_REF = 32;
export const MAX_SKU = 64;
export const MAX_NOMBRE = 200;
// Un carrito no puede tener más líneas que productos a la venta (una por
// sku), y el mensaje de WhatsApp lleva siempre la lista completa. Hasta
// septiembre de 2026 era 60, pensado para un mensaje que cortaba en ~15
// líneas: un carrito de 61 productos salía completo por WhatsApp y se perdía
// ENTERO del registro. decide.test.ts falla si el catálogo pasa este número.
export const MAX_ITEMS = 400;
export const MAX_QTY = 999;
export const MAX_PRECIO_CENTS = 100_000_000;
// El subtotal no puede usar el tope de UN precio: 15 unidades del producto
// de Q 70,000 ya suman Q 1,050,000, y el esquema tiraba el pedido entero del
// registro. Este es el subtotal más grande que permiten los otros topes.
export const MAX_SUBTOTAL_CENTS = MAX_PRECIO_CENTS * MAX_QTY * MAX_ITEMS;
export const MAX_USER_AGENT = 400;
export const MAX_ESTADO = 40;
// La línea ya formateada, la misma del mensaje de WhatsApp: cantidad,
// nombre (hasta 200), código, precio y marca de disponibilidad.
export const MAX_TEXTO = 400;

/**
 * Tope del cuerpo del POST, en bytes. Con los topes de arriba, el cuerpo más
 * grande que puede ser VÁLIDO ronda los 320 KB (400 líneas con todos los
 * campos al tope, `texto` incluido; un pedido real de 320 líneas pesa unos
 * 70 KB); 512 KB deja
 * margen para que un cuerpo apenas pasado de la raya se rechace por esquema
 * —no por tamaño— y el corte por bytes quede solo para lo que es claramente
 * un abuso. decide.test.ts comprueba que el cuerpo válido más grande entra.
 */
export const MAX_BODY_BYTES = 512 * 1024;

export const QuoteLogItemSchema = z.object({
  sku: z.string().max(MAX_SKU),
  nombre: z.string().max(MAX_NOMBRE),
  qty: z.number().int().positive().max(MAX_QTY),
  unitPriceCents: z.number().int().nonnegative().max(MAX_PRECIO_CENTS),
  // La marca de la línea —hoy «bajo pedido»; lo agotado no se puede pedir—
  // tal como sale en el mensaje de WhatsApp, solo en lo que no está
  // disponible: la hoja tiene que
  // mostrar qué líneas esperan confirmación de existencias. Texto con tope y
  // no un enum a propósito: un valor inesperado acá no puede tirar el
  // registro del pedido entero. Opcional para el bundle anterior.
  estado: z.string().max(MAX_ESTADO).optional(),
  // La línea tal como sale en el mensaje de WhatsApp. La hoja la copia en vez
  // de armar la suya: hasta septiembre de 2026 el Apps Script tenía su propio
  // formato («Q 2450.00», sin coma de miles), distinto del que ve el
  // vendedor en WhatsApp, y cada ajuste de formato obligaba a reimplementar el
  // script. Opcional para el bundle anterior: sin él, la hoja arma la línea
  // como antes.
  texto: z.string().max(MAX_TEXTO).optional(),
});
export type QuoteLogItem = z.infer<typeof QuoteLogItemSchema>;

export const QuoteLogRequestSchema = z.object({
  ref: z.string().max(MAX_REF),
  items: z.array(QuoteLogItemSchema).max(MAX_ITEMS),
  subtotalCents: z.number().int().nonnegative().max(MAX_SUBTOTAL_CENTS),
  userAgent: z.string().max(MAX_USER_AGENT),
});
export type QuoteLogRequest = z.infer<typeof QuoteLogRequestSchema>;
