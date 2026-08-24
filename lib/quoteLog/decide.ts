// Decide si hay algo que reenviar a QUOTE_LOG_URL, a partir del body crudo
// del POST a /api/quote-log y las variables de entorno del servidor. Pura
// — no hace fetch, no llama after() — para que route.ts pueda quedar lo
// más delgado posible (parsear con esto, reenviar si toca, responder 204
// siempre) y todo lo demás se pruebe con node --test.
import { QuoteLogRequestSchema, type QuoteLogRequest } from "./types.ts";

export type QuoteLogDecision = { forward: true; request: QuoteLogRequest } | { forward: false };

export function decideQuoteLogForward(
  rawBody: unknown,
  env: { QUOTE_LOG_URL?: string; QUOTE_LOG_TOKEN?: string },
): QuoteLogDecision {
  const parseo = QuoteLogRequestSchema.safeParse(rawBody);
  if (!parseo.success) return { forward: false };

  // Sin url o sin token — típicamente un entorno de preview sin secretos
  // configurados. No es un error del cliente, así que tampoco se le
  // comunica como tal (route.ts responde 204 igual).
  if (!env.QUOTE_LOG_URL || !env.QUOTE_LOG_TOKEN) return { forward: false };

  return { forward: true, request: parseo.data };
}
