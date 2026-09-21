import test from "node:test";
import assert from "node:assert/strict";

import { decideQuoteLogForward } from "./decide.ts";
import { MAX_ITEMS, MAX_NOMBRE, MAX_QTY, MAX_REF, MAX_USER_AGENT } from "./types.ts";

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

// Los topes existen porque este endpoint es abierto y lo que pasa por él se
// escribe en la hoja del negocio (ver types.ts).
test("decideQuoteLogForward: rechaza lo que se pasa de los topes", () => {
  const casos: [string, unknown][] = [
    ["ref larguísima", { ...BODY_VALIDO, ref: "R".repeat(MAX_REF + 1) }],
    ["userAgent larguísimo", { ...BODY_VALIDO, userAgent: "U".repeat(MAX_USER_AGENT + 1) }],
    [
      "nombre larguísimo",
      {
        ...BODY_VALIDO,
        items: [{ ...BODY_VALIDO.items[0], nombre: "N".repeat(MAX_NOMBRE + 1) }],
      },
    ],
    [
      "demasiadas líneas",
      {
        ...BODY_VALIDO,
        items: Array.from({ length: MAX_ITEMS + 1 }, () => BODY_VALIDO.items[0]),
      },
    ],
    ["qty absurda", { ...BODY_VALIDO, items: [{ ...BODY_VALIDO.items[0], qty: MAX_QTY + 1 }] }],
    [
      "precio absurdo",
      { ...BODY_VALIDO, items: [{ ...BODY_VALIDO.items[0], unitPriceCents: 100_000_001 }] },
    ],
  ];

  for (const [etiqueta, body] of casos) {
    assert.equal(
      decideQuoteLogForward(body, ENV_COMPLETO).forward,
      false,
      `${etiqueta} debería dar forward:false`,
    );
  }
});

test("decideQuoteLogForward: el cliente no puede colar su propio token", () => {
  // forwardQuoteLog arma el body como { token, ...request }: si una clave
  // ajena sobreviviera al esquema, pisaría el token del servidor. Zod las
  // descarta, y esta prueba es la que fija ese comportamiento.
  const decision = decideQuoteLogForward(
    { ...BODY_VALIDO, token: "token-del-atacante", extra: "basura" },
    ENV_COMPLETO,
  );
  assert.equal(decision.forward, true);
  if (decision.forward) {
    assert.deepEqual(decision.request, BODY_VALIDO);
  }
});

test("decideQuoteLogForward: un pedido en el límite exacto sí pasa", () => {
  const alLimite = {
    ref: "R".repeat(MAX_REF),
    items: Array.from({ length: MAX_ITEMS }, () => ({
      sku: "SQ12-D2",
      nombre: "N".repeat(MAX_NOMBRE),
      qty: MAX_QTY,
      unitPriceCents: 100_000_000,
    })),
    subtotalCents: 100_000_000,
    userAgent: "U".repeat(MAX_USER_AGENT),
  };
  assert.equal(decideQuoteLogForward(alLimite, ENV_COMPLETO).forward, true);
});
