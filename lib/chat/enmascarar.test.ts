import test from "node:test";
import assert from "node:assert/strict";

import { enmascarar } from "./enmascarar.ts";

test("enmascarar: oculta una tira de 7 o más dígitos", () => {
  assert.equal(enmascarar("mi cel 52955555"), "mi cel •••••••");
});

test("enmascarar: ignora espacios y guiones entre los dígitos", () => {
  assert.equal(enmascarar("+502 5295-5555"), "+•••••••");
  assert.equal(enmascarar("5295 5555"), "•••••••");
});

test("enmascarar: deja pasar medidas, precios y códigos (riesgo 3)", () => {
  for (const texto of ["sub 12 2 ohm menos de 3000", "Q 12,300", "1,000 W", "SQ12-D2"]) {
    assert.equal(enmascarar(texto), texto);
  }
});
