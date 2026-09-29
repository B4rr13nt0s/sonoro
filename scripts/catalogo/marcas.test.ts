import test from "node:test";
import assert from "node:assert/strict";

import { colisionesDeSlug } from "./marcas.ts";

test("colisionesDeSlug: sin colisiones, nada", () => {
  assert.deepEqual(
    colisionesDeSlug([
      { nombre: "KBT", slug: "kbt" },
      { nombre: "Memphis", slug: "memphis" },
    ]),
    [],
  );
});

test("colisionesDeSlug: dos grafías con el mismo slug se nombran juntas", () => {
  const motivos = colisionesDeSlug([
    { nombre: "Kicker", slug: "kicker" },
    { nombre: "KICKER", slug: "kicker" },
    { nombre: "Memphis", slug: "memphis" },
  ]);
  assert.equal(motivos.length, 1);
  assert.match(motivos[0], /«Kicker» y «KICKER».*"kicker"/);
});
