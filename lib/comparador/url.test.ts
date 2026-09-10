import test from "node:test";
import assert from "node:assert/strict";

import { construirHrefComparar, parsearSkus } from "./url.ts";
import { MAX_COMPARAR } from "./types.ts";

test("parsearSkus: separa por coma y conserva el orden", () => {
  assert.deepEqual(parsearSkus("SQ12-D2,COR-S124D"), ["SQ12-D2", "COR-S124D"]);
});

test("parsearSkus: sin parámetro o vacío devuelve nada, no lanza", () => {
  assert.deepEqual(parsearSkus(undefined), []);
  assert.deepEqual(parsearSkus(""), []);
  assert.deepEqual(parsearSkus(",,,"), []);
});

test("parsearSkus: con el parámetro repetido usa el primero", () => {
  // ?skus=a,b&skus=c — Next entrega un arreglo.
  assert.deepEqual(parsearSkus(["A,B", "C"]), ["A", "B"]);
  assert.deepEqual(parsearSkus([]), []);
});

test("parsearSkus: recorta espacios alrededor pero respeta los internos", () => {
  // Los sku del fabricante llevan espacios internos (ACX 165) y puntos
  // (TNT-3000.1) — se guardan tal cual, sin normalizar.
  assert.deepEqual(parsearSkus(" ACX 165 , TNT-3000.1 "), ["ACX 165", "TNT-3000.1"]);
});

test("parsearSkus: deduplica conservando la primera aparición", () => {
  assert.deepEqual(parsearSkus("A,B,A,C"), ["A", "B", "C"]);
});

test("parsearSkus: corta en el máximo del comparador", () => {
  const muchos = ["A", "B", "C", "D", "E", "F"].join(",");
  const r = parsearSkus(muchos);
  assert.equal(r.length, MAX_COMPARAR);
  assert.deepEqual(r, ["A", "B", "C", "D"]);
});

test("construirHrefComparar: arma la URL compartible y codifica los espacios", () => {
  assert.equal(
    construirHrefComparar(["SQ12-D2", "COR-S124D"]),
    "/comparar?skus=SQ12-D2%2CCOR-S124D",
  );
  assert.equal(construirHrefComparar(["ACX 165"]), "/comparar?skus=ACX+165");
});

test("construirHrefComparar: sin skus deja la ruta limpia", () => {
  assert.equal(construirHrefComparar([]), "/comparar");
});

test("ida y vuelta: lo que arma construirHrefComparar lo entiende parsearSkus", () => {
  // Esta es la garantía que hace compartible el enlace: lo que se copia de la
  // barra de direcciones tiene que volver a leerse igual del otro lado.
  const skus = ["ACX 165", "TNT-3000.1", "SQ12-D2"];
  const href = construirHrefComparar(skus);
  const query = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  assert.deepEqual(parsearSkus(query.get("skus") ?? undefined), skus);
});
