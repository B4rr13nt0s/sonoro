import test from "node:test";
import assert from "node:assert/strict";

import { decideQuoteLogForward } from "./decide.ts";

const BODY_VALIDO = {
  ref: "SNR-A7K2M",
  items: [{ sku: "SQ12-D2", nombre: 'Serie SQ 12" D2', qty: 1, unitPriceCents: 245000 }],
  subtotalCents: 245000,
  userAgent: "Mozilla/5.0 Test",
};

const ENV_COMPLETO = {
  QUOTE_LOG_URL: "https://script.google.com/macros/s/xyz/exec",
  QUOTE_LOG_TOKEN: "el-token",
};

test("decideQuoteLogForward: body válido + env completo → forward true con el request parseado", () => {
  const decision = decideQuoteLogForward(BODY_VALIDO, ENV_COMPLETO);
  assert.equal(decision.forward, true);
  if (decision.forward) {
    assert.deepEqual(decision.request, BODY_VALIDO);
  }
});

test("decideQuoteLogForward: body inválido (falta ref) → forward false", () => {
  const { ref, ...sinRef } = BODY_VALIDO;
  void ref;
  const decision = decideQuoteLogForward(sinRef, ENV_COMPLETO);
  assert.equal(decision.forward, false);
});

test("decideQuoteLogForward: body no es un objeto (null, string, array) → forward false, no lanza", () => {
  for (const rawBody of [null, "hola", 42, [1, 2, 3], undefined]) {
    const decision = decideQuoteLogForward(rawBody, ENV_COMPLETO);
    assert.equal(
      decision.forward,
      false,
      `body ${JSON.stringify(rawBody)} debería dar forward:false`,
    );
  }
});

test("decideQuoteLogForward: falta QUOTE_LOG_URL → forward false aunque el body sea válido", () => {
  const decision = decideQuoteLogForward(BODY_VALIDO, { QUOTE_LOG_TOKEN: "el-token" });
  assert.equal(decision.forward, false);
});

test("decideQuoteLogForward: falta QUOTE_LOG_TOKEN → forward false aunque el body sea válido", () => {
  const decision = decideQuoteLogForward(BODY_VALIDO, {
    QUOTE_LOG_URL: "https://script.google.com/macros/s/xyz/exec",
  });
  assert.equal(decision.forward, false);
});

test("decideQuoteLogForward: sin QUOTE_LOG_URL ni QUOTE_LOG_TOKEN → forward false", () => {
  const decision = decideQuoteLogForward(BODY_VALIDO, {});
  assert.equal(decision.forward, false);
});

test("decideQuoteLogForward: items con qty no entero o negativo → forward false", () => {
  const decision = decideQuoteLogForward(
    { ...BODY_VALIDO, items: [{ sku: "X", nombre: "X", qty: -1, unitPriceCents: 100 }] },
    ENV_COMPLETO,
  );
  assert.equal(decision.forward, false);
});
