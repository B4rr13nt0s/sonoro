import test from "node:test";
import assert from "node:assert/strict";

import { accionDe, encontrarReferencia } from "./referencia.ts";

const M = { mostrados: ["A", "B", "C"], enfoque: null };

test("referencia: ordinales y números", () => {
  assert.equal(encontrarReferencia("¿cuánto cuesta el primero?", M)?.sku, "A");
  assert.equal(encontrarReferencia("y el segundo?", M)?.sku, "B");
  assert.equal(encontrarReferencia("la tercera", M)?.sku, "C");
  assert.equal(encontrarReferencia("el 3", M)?.sku, "C");
  assert.equal(encontrarReferencia("el número 2", M)?.sku, "B");
  assert.equal(encontrarReferencia("el último", M)?.sku, "C");
});

test("referencia: una posición que no existe no es referencia", () => {
  assert.equal(encontrarReferencia("el quinto", M), null);
  assert.equal(encontrarReferencia("el 4", M), null);
});

test("referencia: «ese» es el enfoque, o el único mostrado; si no, nada", () => {
  assert.equal(encontrarReferencia("agrégalo", { ...M, enfoque: "B" })?.sku, "B");
  assert.equal(encontrarReferencia("¿cuánto cuesta ese?", { mostrados: ["A"] })?.sku, "A");
  assert.equal(encontrarReferencia("me lo llevo", { mostrados: ["A"] })?.sku, "A");
  assert.equal(encontrarReferencia("¿cuánto cuesta ese?", M), null);
});

test("referencia: el resto conserva la pregunta, sin la referencia", () => {
  assert.equal(
    encontrarReferencia("¿cuántos watts tiene el primero?", M)?.resto,
    "cuantos watts tiene",
  );
  assert.equal(encontrarReferencia("y el segundo?", M)?.resto, "");
  assert.equal(encontrarReferencia("agrégalo", { ...M, enfoque: "A" })?.resto, "agregalo");
});

test("referencia: «la» y «lo» sueltos son artículos", () => {
  assert.equal(encontrarReferencia("y de la marca memphis?", { ...M, enfoque: "A" }), null);
  assert.equal(encontrarReferencia("la quiero", { ...M, enfoque: "A" })?.sku, "A");
});

test("referencia: el código de un mostrado", () => {
  const conCodigos = { mostrados: ["MJP1244", "PRX12FT"] };
  assert.equal(encontrarReferencia("¿y el PRX12FT?", conCodigos)?.sku, "PRX12FT");
});

test("referencia: sin mostrados no hay referencia", () => {
  assert.equal(encontrarReferencia("el primero", {}), null);
  assert.equal(encontrarReferencia("ese", { enfoque: null }), null);
});

test("referencia: un número que es medida no es una posición", () => {
  assert.equal(encontrarReferencia("de 2 ohm", M), null);
  assert.equal(encontrarReferencia("y de 10?", M), null);
});

test("acción: carrito, precio o nada", () => {
  for (const t of [
    "agregalo",
    "agregar",
    "agrega",
    "lo quiero",
    "me lo llevo",
    "me llevo",
    "compralo",
    "anadir",
    "anadelo",
  ]) {
    assert.equal(accionDe(t), "carrito", t);
  }
  assert.equal(accionDe("cuanto cuesta"), "precio");
  assert.equal(accionDe("precio"), "precio");
  assert.equal(accionDe("cuantos watts tiene"), null);
  assert.equal(accionDe(""), null);
});
