// docs/PLAN.md § 6.4 — Registro de cotizaciones. El navegador solo conoce
// esta forma (ref, items, subtotalCents, userAgent); `token` NUNCA viaja al
// cliente (CLAUDE.md: QUOTE_LOG_TOKEN es variable de servidor) — lo inyecta
// app/api/quote-log/route.ts al reenviar a QUOTE_LOG_URL.
import { z } from "zod";

export const QuoteLogItemSchema = z.object({
  sku: z.string(),
  nombre: z.string(),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});
export type QuoteLogItem = z.infer<typeof QuoteLogItemSchema>;

export const QuoteLogRequestSchema = z.object({
  ref: z.string(),
  items: z.array(QuoteLogItemSchema),
  subtotalCents: z.number().int().nonnegative(),
  userAgent: z.string(),
});
export type QuoteLogRequest = z.infer<typeof QuoteLogRequestSchema>;
