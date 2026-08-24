import test from "node:test";
import assert from "node:assert/strict";

import { forwardQuoteLog } from "./forward.ts";
import type { QuoteLogRequest } from "./types.ts";

const REQUEST: QuoteLogRequest = {
  ref: "SNR-A7K2M",
  items: [{ sku: "SQ12-D2", nombre: 'Serie SQ 12" D2', qty: 1, unitPriceCents: 245000 }],
  subtotalCents: 245000,
  userAgent: "Mozilla/5.0 Test",
};

test("forwardQuoteLog: hace POST a QUOTE_LOG_URL con el token inyectado y el resto del payload", async () => {
  const llamadas: [string | URL | Request, RequestInit | undefined][] = [];
  const fetchFalso: typeof fetch = (url, init) => {
    llamadas.push([url, init]);
    return Promise.resolve(new Response(null, { status: 200 }));
  };

  await forwardQuoteLog({
    url: "https://script.google.com/macros/s/xyz/exec",
    token: "el-token-secreto",
    request: REQUEST,
    fetchImpl: fetchFalso,
  });

  assert.equal(llamadas.length, 1);
  const [url, init] = llamadas[0];
  assert.equal(url, "https://script.google.com/macros/s/xyz/exec");
  assert.equal(init?.method, "POST");
  assert.deepEqual(JSON.parse(init?.body as string), { token: "el-token-secreto", ...REQUEST });
});

test("forwardQuoteLog: nunca lanza cuando el fetch rechaza (red caída)", async () => {
  const fetchFalso: typeof fetch = () => Promise.reject(new Error("network down"));
  await assert.doesNotReject(() =>
    forwardQuoteLog({ url: "https://x.test", token: "t", request: REQUEST, fetchImpl: fetchFalso }),
  );
});

test("forwardQuoteLog: nunca lanza cuando la respuesta no es 2xx", async () => {
  const fetchFalso: typeof fetch = () => Promise.resolve(new Response("error", { status: 500 }));
  await assert.doesNotReject(() =>
    forwardQuoteLog({ url: "https://x.test", token: "t", request: REQUEST, fetchImpl: fetchFalso }),
  );
});

test("forwardQuoteLog: nunca lanza si el fetch mismo lanza de forma síncrona", async () => {
  const fetchFalso: typeof fetch = () => {
    throw new Error("boom");
  };
  await assert.doesNotReject(() =>
    forwardQuoteLog({ url: "https://x.test", token: "t", request: REQUEST, fetchImpl: fetchFalso }),
  );
});
