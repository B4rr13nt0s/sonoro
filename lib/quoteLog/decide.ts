// Decide si hay algo que reenviar a QUOTE_LOG_URL, a partir del body crudo
// del POST a /api/quote-log y las variables de entorno del servidor. Pura
// — no hace fetch, no llama after() — para que route.ts pueda quedar lo
// más delgado posible (parsear con esto, reenviar si toca, responder 204
// siempre) y todo lo demás se pruebe con node --test.
import { MAX_ITEMS, QuoteLogRequestSchema, type QuoteLogRequest } from "./types.ts";

export type QuoteLogDecision = { forward: true; request: QuoteLogRequest } | { forward: false };

export function decideQuoteLogForward(
  rawBody: unknown,
  env: { QUOTE_LOG_URL?: string; QUOTE_LOG_TOKEN?: string },
): QuoteLogDecision {
  // El esquema valida cada elemento ANTES de mirar el tope de `.max()`: con la
  // versión de zod de octubre de 2026 (4.4.3), un POST de 450 KB con 20,000
  // líneas tardaba 1.4 s y reservaba ~420 MB, contra 26 ms de una petición
  // normal. Contar las líneas primero deja el tope donde corresponde (en la
  // puerta) y no depende de que zod lo haga bien.
  if (typeof rawBody === "object" && rawBody !== null && "items" in rawBody) {
    const { items } = rawBody as { items: unknown };
    if (Array.isArray(items) && items.length > MAX_ITEMS) return { forward: false };
  }

  const parseo = QuoteLogRequestSchema.safeParse(rawBody);
  if (!parseo.success) return { forward: false };

  // Sin url o sin token — típicamente un entorno de preview sin secretos
  // configurados. No es un error del cliente, así que tampoco se le
  // comunica como tal (route.ts responde 204 igual).
  if (!env.QUOTE_LOG_URL || !env.QUOTE_LOG_TOKEN) return { forward: false };

  return { forward: true, request: parseo.data };
}
