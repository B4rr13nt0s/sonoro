import test from "node:test";
import assert from "node:assert/strict";

import { evaluarToggle } from "./seleccion.ts";
import { MAX_COMPARAR, type Seleccion } from "./types.ts";

const T0 = "2026-09-10T10:00:00.000Z";

function seleccion(skus: string[], categoria: string | null = "Subwoofers"): Seleccion {
  return { schemaVersion: 1, categoria, skus, updatedAt: T0 };
}

test("toggle: producto nuevo de la misma categoría se agrega", () => {
  const r = evaluarToggle(seleccion(["A"]), { sku: "B", categoria: "Subwoofers" });
  assert.deepEqual(r, { tipo: "agrega" });
});

test("toggle: selección vacía acepta cualquier categoría", () => {
  const r = evaluarToggle(seleccion([], null), { sku: "A", categoria: "Bocinas" });
  assert.deepEqual(r, { tipo: "agrega" });
});

test("toggle: producto ya seleccionado se quita", () => {
  const r = evaluarToggle(seleccion(["A", "B"]), { sku: "A", categoria: "Subwoofers" });
  assert.deepEqual(r, { tipo: "quita" });
});

test("toggle: al llegar al máximo, uno nuevo no entra", () => {
  const llena = seleccion(["A", "B", "C", "D"]);
  assert.equal(llena.skus.length, MAX_COMPARAR);
  const r = evaluarToggle(llena, { sku: "E", categoria: "Subwoofers" });
  assert.deepEqual(r, { tipo: "lleno" });
});

test("toggle: con la selección LLENA, uno ya seleccionado igual se puede quitar", () => {
  // Esto es lo que fija el orden de las comprobaciones. Si "lleno" se
  // comprobara antes que "quita", el botón de una tarjeta ya seleccionada
  // dejaría de funcionar justo cuando el usuario necesita hacer espacio.
  const llena = seleccion(["A", "B", "C", "D"]);
  const r = evaluarToggle(llena, { sku: "C", categoria: "Subwoofers" });
  assert.deepEqual(r, { tipo: "quita" });
});

test("toggle: justo debajo del máximo todavía entra", () => {
  const casiLlena = seleccion(["A", "B", "C"]);
  assert.deepEqual(evaluarToggle(casiLlena, { sku: "D", categoria: "Subwoofers" }), {
    tipo: "agrega",
  });
});

test("toggle: otra categoría ofrece reemplazar, y dice cuál está comparando", () => {
  const r = evaluarToggle(seleccion(["A"]), { sku: "Z", categoria: "Bocinas" });
  assert.deepEqual(r, { tipo: "otra_categoria", categoriaActual: "Subwoofers" });
});

test("toggle: llena Y de otra categoría ofrece reemplazar, no avisa del cupo", () => {
  // Reemplazar vacía la selección, así que el cupo deja de importar: avisar
  // "ya no caben más" cuando la salida es reemplazar sería un callejón.
  const r = evaluarToggle(seleccion(["A", "B", "C", "D"]), { sku: "Z", categoria: "Bocinas" });
  assert.deepEqual(r, { tipo: "otra_categoria", categoriaActual: "Subwoofers" });
});

test("toggle: estado corrupto (categoría sin skus) no pregunta por reemplazar la nada", () => {
  const corrupta = seleccion([], "Subwoofers");
  assert.deepEqual(evaluarToggle(corrupta, { sku: "A", categoria: "Bocinas" }), { tipo: "agrega" });
});

test("toggle: skus sin categoría guardada no bloquea (estado corrupto al revés)", () => {
  const corrupta = seleccion(["A"], null);
  assert.deepEqual(evaluarToggle(corrupta, { sku: "B", categoria: "Bocinas" }), { tipo: "agrega" });
});
