import test from "node:test";
import assert from "node:assert/strict";

import { reconcile } from "./reconcile.ts";
import type { CatalogoComparable, Seleccion } from "./types.ts";

const T0 = "2026-09-10T10:00:00.000Z";

function seleccion(skus: string[], categoria: string | null = "Subwoofers"): Seleccion {
  return { schemaVersion: 1, categoria, skus, updatedAt: T0 };
}

function producto(sku: string, overrides: Partial<CatalogoComparable> = {}): CatalogoComparable {
  return { sku, categoria: "Subwoofers", activo: true, ...overrides };
}

test("reconcile: todo vigente pasa intacto y en orden", () => {
  const catalogo = [producto("A"), producto("B")];
  const { seleccion: r, cambios } = reconcile(seleccion(["B", "A"]), catalogo);
  assert.deepEqual(r.skus, ["B", "A"]);
  assert.equal(r.categoria, "Subwoofers");
  assert.deepEqual(cambios, []);
});

test("reconcile: un sku que ya no existe sale, y se distingue de uno inactivo", () => {
  const catalogo = [producto("A"), producto("B", { activo: false })];
  const { seleccion: r, cambios } = reconcile(seleccion(["A", "B", "C"]), catalogo);
  assert.deepEqual(r.skus, ["A"]);
  assert.deepEqual(cambios, [
    { tipo: "eliminado_inactivo", sku: "B" },
    { tipo: "eliminado_no_existe", sku: "C" },
  ]);
});

test("reconcile: un producto recategorizado sale, manda el primer sobreviviente", () => {
  // `categoria` no es permanente (CLAUDE.md § Mantenimiento solo declara
  // permanentes sku y slug), así que la selección guardada puede quedar
  // mezclada sin que el usuario haya hecho nada.
  const catalogo = [producto("A"), producto("B", { categoria: "Bocinas" }), producto("C")];
  const { seleccion: r, cambios } = reconcile(seleccion(["A", "B", "C"]), catalogo);
  assert.deepEqual(r.skus, ["A", "C"]);
  assert.equal(r.categoria, "Subwoofers");
  assert.deepEqual(cambios, [{ tipo: "eliminado_otra_categoria", sku: "B" }]);
});

test("reconcile: la categoría se recalcula del catálogo, no se cree la guardada", () => {
  // Guardado dice Subwoofers; el catálogo dice que ese sku hoy es Bocinas.
  const catalogo = [producto("A", { categoria: "Bocinas" })];
  const { seleccion: r } = reconcile(seleccion(["A"], "Subwoofers"), catalogo);
  assert.equal(r.categoria, "Bocinas");
  assert.deepEqual(r.skus, ["A"]);
});

test("reconcile: si caen todos, la categoría vuelve a null", () => {
  const { seleccion: r, cambios } = reconcile(seleccion(["A", "B"]), []);
  assert.deepEqual(r.skus, []);
  assert.equal(r.categoria, null);
  assert.equal(cambios.length, 2);
});

test("reconcile: selección vacía no inventa cambios", () => {
  const { seleccion: r, cambios } = reconcile(seleccion([], null), [producto("A")]);
  assert.deepEqual(r.skus, []);
  assert.equal(r.categoria, null);
  assert.deepEqual(cambios, []);
});

test("reconcile: no muta la selección original (es puro)", () => {
  const original = seleccion(["A", "B"]);
  const copia = structuredClone(original);
  reconcile(original, [producto("A")]);
  assert.deepEqual(original, copia);
});
