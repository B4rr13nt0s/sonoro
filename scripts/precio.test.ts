import test from "node:test";
import assert from "node:assert/strict";

import { precioACents } from "./precio.ts";

test("precioACents convierte sin imprecisión de punto flotante", () => {
  assert.equal(precioACents("1350.29"), 135029);
  assert.equal(precioACents("0.01"), 1);
  assert.equal(precioACents("99999.99"), 9999999);
  assert.equal(precioACents("4000"), 400000);
  assert.equal(precioACents("4000.5"), 400050);
});
