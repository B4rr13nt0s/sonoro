// CRÍTICO (CLAUDE.md § Modelo de conversión): "si el registro falla, el
// usuario NO debe notarlo." Estos tests existen sobre todo para probar eso
// — que sendQuoteLog nunca deja una promesa rechazada sin manejar, sin
// importar cómo falle el fetch.
import test from "node:test";
import assert from "node:assert/strict";

import { sendQuoteLog } from "./send.ts";
import type { QuoteLogRequest } from "./types.ts";

const PAYLOAD: QuoteLogRequest = {
  ref: "SNR-A7K2M",
  items: [{ sku: "SQ12-D2", nombre: 'Serie SQ 12" D2', qty: 1, unitPriceCents: 245000 }],
  subtotalCents: 245000,
  userAgent: "Mozilla/5.0 Test",
};

test("sendQuoteLog: hace POST a /api/quote-log con el payload, JSON y keepalive", () => {
  const llamadas: [string | URL | Request, RequestInit | undefined][] = [];
  const fetchFalso: typeof fetch = (url, init) => {
    llamadas.push([url, init]);
    return Promise.resolve(new Response(null, { status: 204 }));
  };

  sendQuoteLog(PAYLOAD, fetchFalso);

  assert.equal(llamadas.length, 1);
  const [url, init] = llamadas[0];
  assert.equal(url, "/api/quote-log");
  assert.equal(init?.method, "POST");
  assert.equal(init?.keepalive, true);
  assert.equal((init?.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(init?.body as string), PAYLOAD);
});

test("sendQuoteLog: no lanza ni deja una promesa rechazada sin manejar cuando fetch rechaza", async () => {
  const fetchFalso: typeof fetch = () => Promise.reject(new Error("network down"));

  assert.doesNotThrow(() => sendQuoteLog(PAYLOAD, fetchFalso));

  // Si sendQuoteLog no encadenara .catch(), el rechazo de arriba se
  // convertiría en un unhandledRejection en algún punto de este mismo
  // "tick" — dar una vuelta de microtask es suficiente para que ya se
  // hubiera disparado si el catch no estuviera.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("sendQuoteLog: no lanza cuando fetch resuelve con un status de error", async () => {
  const fetchFalso: typeof fetch = () => Promise.resolve(new Response(null, { status: 500 }));
  assert.doesNotThrow(() => sendQuoteLog(PAYLOAD, fetchFalso));
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("sendQuoteLog: es fire-and-forget — retorna antes de que el fetch resuelva", () => {
  let resuelto = false;
  const fetchFalso: typeof fetch = () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resuelto = true;
        resolve(new Response(null, { status: 204 }));
      }, 50);
    });

  sendQuoteLog(PAYLOAD, fetchFalso);
  assert.equal(resuelto, false); // sendQuoteLog ya retornó sin esperar el fetch
});
