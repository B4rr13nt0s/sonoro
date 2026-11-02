import test from "node:test";
import assert from "node:assert/strict";

import { decideChatLogForward } from "./decide.ts";
import {
  ChatLogRequestSchema,
  MAX_BODY_BYTES_CHAT,
  MAX_RESULTADOS,
  MAX_SKU_CHAT,
  MAX_TEMA,
} from "./types.ts";
import { MAX_CONSULTA } from "../chat/tipos.ts";

const BODY_VALIDO = {
  tipo: "chat",
  conversacion: "a1b2c3d4",
  evento: "busqueda",
  consulta: "sub 12 2 ohm menos de 3000",
  modo: "exacta",
  resultados: 4,
};

const ENV_COMPLETO = {
  QUOTE_LOG_URL: "https://script.google.com/macros/s/xyz/exec",
  QUOTE_LOG_TOKEN: "el-token",
};

test("decideChatLogForward: cuerpo válido + env completo → forward true", () => {
  const decision = decideChatLogForward(BODY_VALIDO, ENV_COMPLETO);
  assert.equal(decision.forward, true);
  if (decision.forward) assert.deepEqual(decision.request, BODY_VALIDO);
});

test("decideChatLogForward: sin URL o sin token → forward false", () => {
  assert.equal(decideChatLogForward(BODY_VALIDO, { QUOTE_LOG_TOKEN: "t" }).forward, false);
  assert.equal(decideChatLogForward(BODY_VALIDO, { QUOTE_LOG_URL: "https://x" }).forward, false);
  assert.equal(decideChatLogForward(BODY_VALIDO, {}).forward, false);
});

test("decideChatLogForward: tipo distinto de «chat» → forward false", () => {
  assert.equal(
    decideChatLogForward({ ...BODY_VALIDO, tipo: "cotizacion" }, ENV_COMPLETO).forward,
    false,
  );
});

test("decideChatLogForward: es estricto — una clave extra rechaza el cuerpo", () => {
  assert.equal(
    decideChatLogForward({ ...BODY_VALIDO, ip: "1.2.3.4" }, ENV_COMPLETO).forward,
    false,
  );
  // Ni siquiera un token ajeno: pisaría el del servidor al reenviar.
  assert.equal(decideChatLogForward({ ...BODY_VALIDO, token: "x" }, ENV_COMPLETO).forward, false);
});

test("decideChatLogForward: consulta de 201 caracteres → forward false; 200 pasa", () => {
  const larga = { ...BODY_VALIDO, consulta: "a".repeat(MAX_CONSULTA + 1) };
  assert.equal(decideChatLogForward(larga, ENV_COMPLETO).forward, false);
  const alLimite = { ...BODY_VALIDO, consulta: "a".repeat(MAX_CONSULTA) };
  assert.equal(decideChatLogForward(alLimite, ENV_COMPLETO).forward, true);
});

test("decideChatLogForward: conversacion con formato inválido → forward false", () => {
  for (const conversacion of ["ABC", "a1b2c3d", "a1b2c3d45", "A1B2C3D4", "a1b2-3d4"]) {
    assert.equal(
      decideChatLogForward({ ...BODY_VALIDO, conversacion }, ENV_COMPLETO).forward,
      false,
      conversacion,
    );
  }
});

test("decideChatLogForward: rechaza evento, modo y motivo fuera del enum y topes de número", () => {
  const casos: [string, Record<string, unknown>][] = [
    ["evento desconocido", { evento: "otro" }],
    ["modo desconocido", { modo: "exactisima" }],
    ["motivo desconocido", { motivo: "queja" }],
    ["resultados negativos", { resultados: -1 }],
    ["resultados fraccionarios", { resultados: 1.5 }],
    ["resultados absurdos", { resultados: MAX_RESULTADOS + 1 }],
    ["tema larguísimo", { tema: "t".repeat(MAX_TEMA + 1) }],
    ["sku larguísimo", { sku: "S".repeat(MAX_SKU_CHAT + 1) }],
  ];
  for (const [etiqueta, extra] of casos) {
    assert.equal(
      decideChatLogForward({ ...BODY_VALIDO, ...extra }, ENV_COMPLETO).forward,
      false,
      etiqueta,
    );
  }
});

test("decideChatLogForward: cuerpos que no son un objeto → forward false, no lanza", () => {
  for (const rawBody of [null, "hola", 42, [1, 2], undefined]) {
    assert.equal(decideChatLogForward(rawBody, ENV_COMPLETO).forward, false);
  }
});

test("decideChatLogForward: enmascara la consulta OTRA VEZ en el servidor", () => {
  const decision = decideChatLogForward(
    { ...BODY_VALIDO, consulta: "mi cel 52955555" },
    ENV_COMPLETO,
  );
  assert.equal(decision.forward, true);
  if (decision.forward) assert.equal(decision.request.consulta, "mi cel •••••••");
});

test("ChatLogRequestSchema: los eventos con pocos campos son válidos", () => {
  const casos = [
    { evento: "tema", tema: "categoria:insonorizacion" },
    { evento: "agregar", sku: "SQ12-D2" },
    { evento: "whatsapp", motivo: "hablar" },
    { evento: "sin_resultados", consulta: "xyz" },
    { evento: "recomendacion", consulta: "cual me conviene" },
  ];
  for (const caso of casos) {
    const r = ChatLogRequestSchema.safeParse({ tipo: "chat", conversacion: "a1b2c3d4", ...caso });
    assert.equal(r.success, true, JSON.stringify(caso));
  }
});

test("MAX_BODY_BYTES_CHAT: el cuerpo válido más grande cabe", () => {
  const mayor = {
    tipo: "chat",
    conversacion: "a1b2c3d4",
    evento: "busqueda",
    // El peor caso en bytes: emoji de 4 bytes (JSON los deja tal cual).
    consulta: "😀".repeat(MAX_CONSULTA / 2),
    modo: "aproximada",
    resultados: MAX_RESULTADOS,
    tema: "t".repeat(MAX_TEMA),
    sku: "S".repeat(MAX_SKU_CHAT),
    motivo: "disponibilidad",
  };
  assert.equal(ChatLogRequestSchema.safeParse(mayor).success, true);
  assert.ok(Buffer.byteLength(JSON.stringify(mayor), "utf8") <= MAX_BODY_BYTES_CHAT);
});
