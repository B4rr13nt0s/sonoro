import { after } from "next/server";

import { decideQuoteLogForward, forwardQuoteLog } from "@/lib/quoteLog/index.ts";
import { crearLimitador, ipDePeticion } from "@/lib/quoteLog/limite.ts";
import { MAX_BODY_BYTES } from "@/lib/quoteLog/types.ts";

// docs/PLAN.md § 6.4 — Registro de cotizaciones (reenvía a Sheets/Airtable
// vía QUOTE_LOG_URL): "demanda real, productos cotizados que no cierran,
// ticket promedio [...] acumula las preguntas reales que harán útil al
// chatbot."
//
// SIEMPRE responde 204 — cuerpo mal formado, demasiado grande, pasado de
// frecuencia, sin QUOTE_LOG_URL/TOKEN configurados en este entorno, o el
// reenvío mismo fallando, ninguno cambia la respuesta. El registro es
// secundario al cierre de la venta por WhatsApp (CLAUDE.md § Modelo de
// conversión) y CRÍTICAMENTE no puede bloquearlo ni delatarse ante el
// usuario si algo sale mal. Un 429 tampoco: el navegador que cierra un
// pedido no tiene nada que hacer con esa información, y devolverla solo le
// diría a quien abusa cuándo cambiar de IP.
//
// El reenvío corre dentro de after() (docs de Next: "schedule work to be
// executed after a response is finished") para no demorar el 204 ni
// arriesgarse a que la función se apague antes de que termine el fetch —
// justo lo que decideQuoteLogForward/forwardQuoteLog (lib/quoteLog/) dejan
// fuera de este archivo para poder probarse con node --test, porque
// after() exige el contexto de petición real de Next y no se puede invocar
// directamente en un test.
//
// ESTE ENDPOINT ES ABIERTO y no puede dejar de serlo: lo llama el navegador
// de cualquiera que cierre un pedido, sin sesión ni token. Lo que pasa por
// aquí se escribe en la hoja del negocio, así que antes de mirar el cuerpo
// hay dos filtros baratos —frecuencia por IP y tamaño— y después el esquema,
// que ya trae topes campo por campo (lib/quoteLog/types.ts). El tope de
// verdad, si algún día hace falta, es una regla de Vercel Firewall: corre
// antes que esta función y no se puede saltar rotando instancias.

const permitir = crearLimitador();

export async function POST(request: Request) {
  if (!permitir(ipDePeticion(request.headers))) {
    return new Response(null, { status: 204 });
  }

  // Content-Length es lo que DICE el cliente: sirve para cortar temprano lo
  // que ya se declara enorme, no para confiar. El corte real es el largo del
  // texto ya leído, más abajo.
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  let rawBody: unknown = null;
  try {
    const texto = await request.text();
    // Bytes, no caracteres: un cuerpo de puros emoji pesa cuatro veces su
    // largo en JS.
    if (Buffer.byteLength(texto, "utf8") <= MAX_BODY_BYTES) {
      rawBody = JSON.parse(texto);
    }
  } catch {
    // Cuerpo no es JSON válido, o se cortó la conexión leyéndolo —
    // decideQuoteLogForward también lo rechazaría.
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
