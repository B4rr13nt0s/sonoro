// Registro anónimo del chat. Misma idea que lib/quoteLog/types.ts: el navegador
// solo conoce esta forma; `token` NUNCA viaja al cliente (lo inyecta
// app/api/chat-log/route.ts al reenviar a QUOTE_LOG_URL).
//
// /api/chat-log es un endpoint ABIERTO, así que TODOS los campos llevan tope
// y el esquema es estricto: una clave de más (un `token` ajeno, una `ip`)
// rechaza el cuerpo entero en vez de colarse al reenvío. Los topes salen del
// uso real, con aire de sobra:
//
//   conversacion  8 caracteres [a-z0-9]                → exactamente 8
//   consulta      MAX_CONSULTA del chat                → 200
//   resultados    el catálogo trae ~320 productos      → 1000
//   tema          «categoria:insonorizacion», 24       → 40
//   sku           el más largo del catálogo, 21        → 64
//
// Un evento que roce un tope se pierde del registro, no de la conversación.
import { z } from "zod";

import { MAX_CONSULTA } from "../chat/tipos.ts";

export const MAX_TEMA = 40;
export const MAX_SKU_CHAT = 64;
export const MAX_RESULTADOS = 1000;

/**
 * Tope del cuerpo del POST, en bytes. El cuerpo válido más grande (consulta de
 * 200 caracteres, todo lo demás al tope) ronda 450 bytes en ASCII y ~900 con
 * la consulta toda en emoji de 4 bytes; 4 KB deja aire de sobra y corta lo
 * que es claramente abuso. decide.test.ts comprueba que el válido más grande
 * entra.
 */
export const MAX_BODY_BYTES_CHAT = 4 * 1024;

export const ChatLogRequestSchema = z
  .object({
    tipo: z.literal("chat"),
    conversacion: z.string().regex(/^[a-z0-9]{8}$/),
    evento: z.enum([
      "busqueda",
      "sin_resultados",
      "tema",
      "recomendacion",
      "agregar",
      "whatsapp",
      "vehiculo",
    ]),
    consulta: z.string().max(MAX_CONSULTA).optional(),
    modo: z.enum(["exacta", "aproximada", "cercana", "parcial"]).optional(),
    resultados: z.number().int().min(0).max(MAX_RESULTADOS).optional(),
    tema: z.string().max(MAX_TEMA).optional(),
    sku: z.string().max(MAX_SKU_CHAT).optional(),
    motivo: z.enum(["hablar", "disponibilidad"]).optional(),
  })
  .strict();
export type ChatLogRequest = z.infer<typeof ChatLogRequestSchema>;
