import test from "node:test";
import assert from "node:assert/strict";

import { marcasDelFiltro, nombreDeMarca, primeroDeQuery } from "./filtros.ts";

const MARCAS = [
  { slug: "kbt", nombre: "KBT" },
  { slug: "memphis", nombre: "Memphis" },
  { slug: "pioneer", nombre: "Pioneer" },
];

test("primeroDeQuery: el primer valor de un param repetido", () => {
  assert.equal(primeroDeQuery(["a", "b"]), "a");
  assert.equal(primeroDeQuery("a"), "a");
  assert.equal(primeroDeQuery(undefined), undefined);
});

test("nombreDeMarca: el nombre, o el slug crudo si no existe", () => {
  assert.equal(nombreDeMarca(MARCAS, "memphis"), "Memphis");
  assert.equal(nombreDeMarca(MARCAS, "no-existe"), "no-existe");
  assert.equal(nombreDeMarca(MARCAS, undefined), undefined);
});

test("marcasDelFiltro: solo las que tienen productos, más la elegida", () => {
  const productos = [{ marca: "KBT" }, { marca: "KBT" }, { marca: "Pioneer" }];
  assert.deepEqual(
    marcasDelFiltro(MARCAS, productos, undefined).map((m) => m.slug),
    ["kbt", "pioneer"],
  );
  assert.deepEqual(
    marcasDelFiltro(MARCAS, productos, "memphis").map((m) => m.slug),
    ["kbt", "memphis", "pioneer"],
  );
});
