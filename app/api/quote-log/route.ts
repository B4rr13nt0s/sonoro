import { after } from "next/server";

import { decideQuoteLogForward, forwardQuoteLog } from "@/lib/quoteLog/index.ts";

// docs/PLAN.md § 6.4 — Registro de cotizaciones (reenvía a Sheets/Airtable
// vía QUOTE_LOG_URL): "demanda real, productos cotizados que no cierran,
// ticket promedio [...] acumula las preguntas reales que harán útil al
// chatbot."
//
// SIEMPRE responde 204 — cuerpo mal formado, sin QUOTE_LOG_URL/TOKEN
// configurados en este entorno, o el reenvío mismo fallando, ninguno de
// los tres cambia la respuesta. El registro es secundario al cierre de la
// venta por WhatsApp (CLAUDE.md § Modelo de conversión) y CRÍTICAMENTE no
// puede bloquearlo ni delatarse ante el usuario si algo sale mal.
//
// El reenvío corre dentro de after() (docs de Next: "schedule work to be
// executed after a response is finished") para no demorar el 204 ni
// arriesgarse a que la función se apague antes de que termine el fetch —
// justo lo que decideQuoteLogForward/forwardQuoteLog (lib/quoteLog/) dejan
// fuera de este archivo para poder probarse con node --test, porque
// after() exige el contexto de petición real de Next y no se puede invocar
// directamente en un test.
export async function POST(request: Request) {
  let rawBody: unknown = null;
  try {
    rawBody = await request.json();
  } catch {
    // Cuerpo no es JSON válido — decideQuoteLogForward también lo
    // rechazaría, pero ni siquiera vale la pena intentar parsearlo.
  }

  const decision = decideQuoteLogForward(rawBody, {
    QUOTE_LOG_URL: process.env.QUOTE_LOG_URL,
    QUOTE_LOG_TOKEN: process.env.QUOTE_LOG_TOKEN,
  });

  if (decision.forward) {
    const url = process.env.QUOTE_LOG_URL as string;
    const token = process.env.QUOTE_LOG_TOKEN as string;
    after(() => forwardQuoteLog({ url, token, request: decision.request }));
  }

  return new Response(null, { status: 204 });
}
