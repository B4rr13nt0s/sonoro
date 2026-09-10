import test from "node:test";
import assert from "node:assert/strict";

import { comparadorReducer } from "./reducer.ts";
import { crearSeleccionVacia, type Seleccion } from "./types.ts";

const T0 = "2026-09-10T10:00:00.000Z";
const T1 = "2026-09-10T10:05:00.000Z";

function seleccion(skus: string[], categoria: string | null = "Subwoofers"): Seleccion {
  return { schemaVersion: 1, categoria, skus, updatedAt: T0 };
}

test("agregar: guarda el sku y fija la categoría de la selección", () => {
  const r = comparadorReducer(crearSeleccionVacia(T0), {
    type: "agregar",
    sku: "A",
    categoria: "Subwoofers",
    now: T1,
  });
  assert.deepEqual(r.skus, ["A"]);
  assert.equal(r.categoria, "Subwoofers");
  assert.equal(r.updatedAt, T1);
});

test("agregar: conserva el orden en que se eligieron", () => {
  let r = comparadorReducer(crearSeleccionVacia(T0), {
    type: "agregar",
    sku: "A",
    categoria: "Subwoofers",
    now: T0,
  });
  r = comparadorReducer(r, { type: "agregar", sku: "B", categoria: "Subwoofers", now: T1 });
  assert.deepEqual(r.skus, ["A", "B"]);
});

test("agregar inválido no muta NADA, ni siquiera updatedAt", () => {
  // Un updatedAt que se mueve sin que cambie la selección dispara el efecto
  // de guardado y escribe en localStorage sin motivo.
  const llena = seleccion(["A", "B", "C", "D"]);
  const r = comparadorReducer(llena, {
    type: "agregar",
    sku: "E",
    categoria: "Subwoofers",
    now: T1,
  });
  assert.equal(r, llena, "debería devolver la MISMA referencia");
});

test("agregar de otra categoría no mezcla", () => {
  const actual = seleccion(["A"]);
  const r = comparadorReducer(actual, { type: "agregar", sku: "Z", categoria: "Bocinas", now: T1 });
  assert.equal(r, actual);
});

test("quitar: saca el sku y deja el resto en orden", () => {
  const r = comparadorReducer(seleccion(["A", "B", "C"]), { type: "quitar", sku: "B", now: T1 });
  assert.deepEqual(r.skus, ["A", "C"]);
  assert.equal(r.categoria, "Subwoofers");
});

test("quitar el último devuelve la categoría a null", () => {
  // Si la categoría se quedara pegada, el siguiente producto de otra
  // categoría preguntaría "¿reemplazar?" contra una selección vacía.
  const r = comparadorReducer(seleccion(["A"]), { type: "quitar", sku: "A", now: T1 });
  assert.deepEqual(r.skus, []);
  assert.equal(r.categoria, null);
});

test("quitar un sku que no está no muta nada", () => {
  const actual = seleccion(["A"]);
  assert.equal(comparadorReducer(actual, { type: "quitar", sku: "Z", now: T1 }), actual);
});

test("reemplazar: vacía y arranca de nuevo con el producto de la otra categoría", () => {
  const r = comparadorReducer(seleccion(["A", "B"]), {
    type: "reemplazar",
    sku: "Z",
    categoria: "Bocinas",
    now: T1,
  });
  assert.deepEqual(r.skus, ["Z"]);
  assert.equal(r.categoria, "Bocinas");
  assert.equal(r.updatedAt, T1);
});

test("vaciar: deja la selección como recién creada", () => {
  const r = comparadorReducer(seleccion(["A", "B"]), { type: "vaciar", now: T1 });
  assert.deepEqual(r, crearSeleccionVacia(T1));
});

test("hidratar: reemplaza el estado completo", () => {
  const guardada = seleccion(["X", "Y"], "Bocinas");
  const r = comparadorReducer(crearSeleccionVacia(T0), { type: "hidratar", seleccion: guardada });
  assert.deepEqual(r, guardada);
});

test("el reducer es puro: no muta la selección que recibe", () => {
  const original = seleccion(["A"]);
  const copia = structuredClone(original);
  comparadorReducer(original, { type: "agregar", sku: "B", categoria: "Subwoofers", now: T1 });
  comparadorReducer(original, { type: "quitar", sku: "A", now: T1 });
  assert.deepEqual(original, copia);
});
