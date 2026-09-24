import test from "node:test";
import assert from "node:assert/strict";

import { buildOrderRef } from "./ref.ts";

test("buildOrderRef: tiene forma SNR-XXXXX", () => {
  const ref = buildOrderRef("2026-08-21T10:00:00.000Z");
  assert.match(ref, /^SNR-[0-9A-Z]{5}$/);
});

test("buildOrderRef: es determinista — mismo createdAt, mismo ref", () => {
  const a = buildOrderRef("2026-08-21T10:00:00.000Z");
  const b = buildOrderRef("2026-08-21T10:00:00.000Z");
  assert.equal(a, b);
});

test("buildOrderRef: createdAt distinto produce ref distinto", () => {
  const a = buildOrderRef("2026-08-21T10:00:00.000Z");
  const b = buildOrderRef("2026-08-21T10:00:00.001Z");
  assert.notEqual(a, b);
});

const CREADO = "2026-08-21T10:00:00.000Z";
const SUB = { sku: "SQ12-D2", qty: 1, unitPriceCents: 245000 };
const BOCINA = { sku: "PRX60C", qty: 2, unitPriceCents: 118000 };

// El caso que obligó a meter el contenido en la cuenta: el mismo carrito, con
// otros productos, es OTRO pedido. En la hoja del negocio quedó SNR-S8CAM
// repetido el 25 de agosto por esto mismo.
test("buildOrderRef: mismo carrito con otros productos da ref distinto", () => {
  assert.notEqual(buildOrderRef(CREADO, [SUB]), buildOrderRef(CREADO, [BOCINA]));
});

test("buildOrderRef: cambiar la cantidad cambia el ref", () => {
  assert.notEqual(buildOrderRef(CREADO, [SUB]), buildOrderRef(CREADO, [{ ...SUB, qty: 2 }]));
});

test("buildOrderRef: cambiar el precio cambia el ref", () => {
  assert.notEqual(
    buildOrderRef(CREADO, [SUB]),
    buildOrderRef(CREADO, [{ ...SUB, unitPriceCents: 250000 }]),
  );
});

// Quitar un producto y volver a agregarlo lo deja al final de la lista: si el
// orden contara, el cliente vería un Ref nuevo sin haber cambiado su pedido.
test("buildOrderRef: el orden de las líneas no cambia el ref", () => {
  assert.equal(buildOrderRef(CREADO, [SUB, BOCINA]), buildOrderRef(CREADO, [BOCINA, SUB]));
});

test("buildOrderRef: mismo contenido en carritos distintos da refs distintos", () => {
  assert.notEqual(buildOrderRef(CREADO, [SUB]), buildOrderRef("2026-09-24T10:00:00.000Z", [SUB]));
});

test("buildOrderRef: sigue midiendo lo mismo con muchas líneas", () => {
  const muchas = Array.from({ length: 40 }, (_, i) => ({
    sku: `SKU-${i}`,
    qty: i + 1,
    unitPriceCents: 100000 + i,
  }));
  assert.match(buildOrderRef(CREADO, muchas), /^SNR-[0-9A-Z]{5}$/);
});
