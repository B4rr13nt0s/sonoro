import test from "node:test";
import assert from "node:assert/strict";

import { formatQ, calcularCuotaCents } from "./precio.ts";

const ESPACIO_DURO = "\u00A0";

test("formatQ: cero", () => {
  assert.equal(formatQ(0), `Q${ESPACIO_DURO}0.00`);
});

test("formatQ: menos de mil", () => {
  assert.equal(formatQ(8950), `Q${ESPACIO_DURO}89.50`);
});

test("formatQ: exactamente mil (aparece el separador de miles)", () => {
  assert.equal(formatQ(100000), `Q${ESPACIO_DURO}1,000.00`);
});

test("formatQ: millones", () => {
  assert.equal(formatQ(150000000), `Q${ESPACIO_DURO}1,500,000.00`);
});

test("formatQ: .00 vs .50", () => {
  assert.equal(formatQ(245000), `Q${ESPACIO_DURO}2,450.00`);
  assert.equal(formatQ(8950), `Q${ESPACIO_DURO}89.50`);
});

test("formatQ usa espacio duro U+00A0, no un espacio normal", () => {
  const resultado = formatQ(245000);
  const separador = resultado.charAt(1);

  assert.equal(separador.codePointAt(0), 0x00a0);
  assert.notEqual(separador.codePointAt(0), 0x20);
  assert.notEqual(resultado, "Q 2,450.00"); // esta cadena lleva espacio normal
});

test("calcularCuotaCents: Q 2,450.00 entre 6 pagos redondea hacia arriba al centavo", () => {
  assert.equal(calcularCuotaCents(245000, 6), 40834); // Q 408.34
});
