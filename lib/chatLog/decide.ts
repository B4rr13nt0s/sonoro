// Decide si hay algo que reenviar a QUOTE_LOG_URL, a partir del body crudo del
// POST a /api/chat-log y las variables de entorno del servidor. Pura, como
// lib/quoteLog/decide.ts: route.ts queda delgado y esto se prueba con node --test.
import { enmascarar } from "../chat/enmascarar.ts";
import { ChatLogRequestSchema, type ChatLogRequest } from "./types.ts";

export type ChatLogDecision = { forward: true; request: ChatLogRequest } | { forward: false };

export function decideChatLogForward(
  rawBody: unknown,
  env: { QUOTE_LOG_URL?: string; QUOTE_LOG_TOKEN?: string },
): ChatLogDecision {
  const parseo = ChatLogRequestSchema.safeParse(rawBody);
  if (!parseo.success) return { forward: false };

  // Sin url o sin token —típicamente un preview sin secretos— no es un error
  // del cliente, así que tampoco se le comunica como tal.
  if (!env.QUOTE_LOG_URL || !env.QUOTE_LOG_TOKEN) return { forward: false };

  const request = parseo.data;
  // El navegador ya enmascaró, pero el servidor no confía en el navegador: un
  // cliente alterado puede mandar el teléfono tal cual. Se enmascara otra vez.
  if (request.consulta !== undefined) {
    request.consulta = enmascarar(request.consulta);
  }
  return { forward: true, request };
}
