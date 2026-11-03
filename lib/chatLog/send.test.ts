// Igual que lib/quoteLog/send.test.ts: el registro nunca debe hacerse notar.
import test from "node:test";
import assert from "node:assert/strict";

import { nuevaConversacion, sendChatLog } from "./send.ts";
import { ChatLogRequestSchema } from "./types.ts";

function fetchQueGuarda() {
  const llamadas: [string | URL | Request, RequestInit | undefined][] = [];
  const fetchFalso: typeof fetch = (url, init) => {
    llamadas.push([url, init]);
    return Promise.resolve(new Response(null, { status: 204 }));
  };
  return { llamadas, fetchFalso };
}

test("sendChatLog: hace POST a /api/chat-log con JSON y keepalive", () => {
  const { llamadas, fetchFalso } = fetchQueGuarda();
  sendChatLog("a1b2c3d4", { evento: "agregar", sku: "SQ12-D2" }, fetchFalso);

  assert.equal(llamadas.length, 1);
  const [url, init] = llamadas[0];
  assert.equal(url, "/api/chat-log");
  assert.equal(init?.method, "POST");
  assert.equal(init?.keepalive, true);
  assert.equal((init?.headers as Record<string, string>)["Content-Type"], "application/json");
});

test("sendChatLog: el cuerpo trae tipo «chat», la conversación y cumple el esquema", () => {
  const { llamadas, fetchFalso } = fetchQueGuarda();
  sendChatLog(
    "a1b2c3d4",
    { evento: "busqueda", consulta: "sub 12", modo: "exacta", resultados: 3 },
    fetchFalso,
  );
  const cuerpo = JSON.parse(llamadas[0][1]?.body as string);
  assert.equal(cuerpo.tipo, "chat");
  assert.equal(cuerpo.conversacion, "a1b2c3d4");
  assert.equal(ChatLogRequestSchema.safeParse(cuerpo).success, true);
});

test("sendChatLog: la consulta sale ya enmascarada", () => {
  const { llamadas, fetchFalso } = fetchQueGuarda();
  sendChatLog("a1b2c3d4", { evento: "sin_resultados", consulta: "mi cel 52955555" }, fetchFalso);
  const cuerpo = JSON.parse(llamadas[0][1]?.body as string);
  assert.equal(cuerpo.consulta, "mi cel •••••••");
});

test("sendChatLog: no lanza ni deja una promesa rechazada cuando fetch rechaza", async () => {
  const fetchFalso: typeof fetch = () => Promise.reject(new Error("network down"));
  assert.doesNotThrow(() =>
    sendChatLog("a1b2c3d4", { evento: "whatsapp", motivo: "hablar" }, fetchFalso),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("nuevaConversacion: 8 caracteres [a-z0-9], distintos entre llamadas", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const id = nuevaConversacion();
    assert.match(id, /^[a-z0-9]{8}$/);
    ids.add(id);
  }
  assert.ok(ids.size > 1);
});
