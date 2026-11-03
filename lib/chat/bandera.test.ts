import test from "node:test";
import assert from "node:assert/strict";

import { chatHabilitado } from "./bandera.ts";

test("chatHabilitado solo vale true con «true»", () => {
  assert.equal(chatHabilitado("true"), true);
});

test("chatHabilitado es false con cualquier otro valor", () => {
  for (const valor of [undefined, "false", "TRUE", "1", "", " true", "yes"]) {
    assert.equal(chatHabilitado(valor), false, String(valor));
  }
});
