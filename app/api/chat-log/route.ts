import { after } from "next/server";

import { decideChatLogForward } from "@/lib/chatLog/index.ts";
import { MAX_BODY_BYTES_CHAT } from "@/lib/chatLog/types.ts";
import { forwardQuoteLog } from "@/lib/quoteLog/index.ts";
import { crearLimitador, ipDePeticion } from "@/lib/quoteLog/limite.ts";

// Registro anónimo del chat (spec docs/superpowers/specs/2026-11-02-chatbot-design.md
// § Registro). Es una copia de app/api/quote-log/route.ts —léela para el porqué
// de cada decisión— que reenvía al MISMO Apps Script (QUOTE_LOG_URL), el cual
// escribe estos eventos en la hoja «Chat». Sin variables de entorno nuevas.
//
// SIEMPRE responde 204: cuerpo mal formado, demasiado grande, pasado de
// frecuencia, sin QUOTE_LOG_URL/TOKEN en este entorno o con el reenvío
// fallando, nada cambia la respuesta. El registro es secundario a la
// conversación y no puede bloquearla ni delatarse ante el cliente.
//
// ENDPOINT ABIERTO: lo llama el navegador de cualquiera. Antes de mirar el
// cuerpo hay dos filtros baratos —frecuencia por IP y tamaño— y después el
// esquema estricto de lib/chatLog/types.ts. El limitador es una instancia
// PROPIA (no el de quote-log): un chat conversador no debe gastar las fichas
// con las que se registran los pedidos. Un evento por mensaje, así que 30 por
// minuto de ráfaga y de recarga.
//
// No se guarda IP, user agent ni identificador persistente: la IP solo sirve
// aquí, en memoria, para el limitador.
//
// El reenvío corre en after() para no demorar el 204 (ver forward.ts).

const permitir = crearLimitador({ capacidad: 30, porMinuto: 30 });

export async function POST(request: Request) {
  if (!permitir(ipDePeticion(request.headers))) {
    return new Response(null, { status: 204 });
  }

  // Content-Length es lo que DICE el cliente: corta temprano lo que ya se
  // declara enorme. El corte real es el largo del texto ya leído.
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_BODY_BYTES_CHAT) {
    return new Response(null, { status: 204 });
  }

  let rawBody: unknown = null;
  try {
    const texto = await request.text();
    // Bytes, no caracteres: un cuerpo de puros emoji pesa cuatro veces su
    // largo en JS.
    if (Buffer.byteLength(texto, "utf8") <= MAX_BODY_BYTES_CHAT) {
      rawBody = JSON.parse(texto);
    }
  } catch {
    // No es JSON válido, o se cortó la conexión: decideChatLogForward
    // también lo rechazaría.
  }

  const decision = decideChatLogForward(rawBody, {
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
