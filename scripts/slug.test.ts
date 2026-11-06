import test from "node:test";
import assert from "node:assert/strict";

import { slugificar } from "./slug.ts";

test("slugificar: minúsculas, sin acentos y con guiones", () => {
  assert.equal(slugificar("Cerwin-Vega "), "cerwin-vega");
  assert.equal(slugificar("Tablero gris"), "tablero-gris");
  assert.equal(slugificar("Land Cruiser"), "land-cruiser");
  assert.equal(slugificar("Protegé"), "protege");
  assert.equal(slugificar("CR-V"), "cr-v");
});
