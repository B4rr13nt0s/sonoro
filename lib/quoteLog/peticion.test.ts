import test from "node:test";
import assert from "node:assert/strict";

import { esJson, leerTextoAcotado } from "./peticion.ts";

test("esJson: solo application/json, con o sin parámetros", () => {
  assert.equal(esJson(new Headers({ "content-type": "application/json" })), true);
  assert.equal(esJson(new Headers({ "content-type": "application/json; charset=utf-8" })), true);
  assert.equal(esJson(new Headers({ "content-type": "Application/JSON" })), true);
  // Lo que un POST entre sitios «simple» puede mandar sin preflight.
  for (const tipo of [
    "text/plain",
    "text/plain;charset=UTF-8",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
    "application/jsonp",
    "",
  ]) {
    assert.equal(esJson(new Headers({ "content-type": tipo })), false, tipo);
  }
  assert.equal(esJson(new Headers()), false);
});

function peticion(cuerpo: BodyInit | null): Request {
  return new Request("http://localhost/api/x", { method: "POST", body: cuerpo });
}

test("leerTextoAcotado: lo que cabe se lee entero, también con tildes y emoji", async () => {
  assert.equal(await leerTextoAcotado(peticion('{"a":"ñandú 🎧"}'), 1024), '{"a":"ñandú 🎧"}');
  assert.equal(await leerTextoAcotado(peticion(null), 1024), "");
});

test("leerTextoAcotado: pasa de los bytes (no de los caracteres) y devuelve null", async () => {
  assert.equal(await leerTextoAcotado(peticion("x".repeat(101)), 100), null);
  assert.equal(await leerTextoAcotado(peticion("x".repeat(100)), 100), "x".repeat(100));
  // 30 emoji de 4 bytes = 120 bytes, 30 caracteres «de 2 unidades».
  assert.equal(await leerTextoAcotado(peticion("🎧".repeat(30)), 100), null);
});

test("leerTextoAcotado: un cuerpo por trozos sin content-length se corta al pasarse, sin leerlo entero", async () => {
  let enviados = 0;
  const flujo = new ReadableStream<Uint8Array>({
    pull(controlador) {
      enviados++;
      controlador.enqueue(new TextEncoder().encode("x".repeat(1024)));
      if (enviados > 1000) controlador.close();
    },
  });
  const request = new Request("http://localhost/api/x", {
    method: "POST",
    body: flujo,
    duplex: "half",
  } as RequestInit);
  assert.equal(await leerTextoAcotado(request, 4096), null);
  assert.ok(enviados < 50, `leyó ${enviados} trozos de un cuerpo de ~1 MB`);
});
