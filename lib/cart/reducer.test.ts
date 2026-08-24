import test from "node:test";
import assert from "node:assert/strict";

import { cartReducer } from "./reducer.ts";
import { crearCarritoVacio, type Cart } from "./types.ts";

const T0 = "2026-08-21T10:00:00.000Z";
const T1 = "2026-08-21T10:05:00.000Z";

function carritoVacio(): Cart {
  return crearCarritoVacio(T0);
}

const ITEM_A = {
  sku: "SQ12-D2",
  qty: 1,
  unitPriceCents: 245000,
  currency: "GTQ" as const,
  nombreSnapshot: 'Serie SQ 12" D2',
  imagenSnapshot: null,
};

test("add: agrega una línea nueva con addedAt = now de la acción", () => {
  const resultado = cartReducer(carritoVacio(), { type: "add", item: ITEM_A, now: T1 });
  assert.equal(resultado.items.length, 1);
  assert.deepEqual(resultado.items[0], { ...ITEM_A, addedAt: T1 });
  assert.equal(resultado.updatedAt, T1);
});

test("add: mismo sku suma qty en vez de duplicar la línea", () => {
  const conUno = cartReducer(carritoVacio(), { type: "add", item: ITEM_A, now: T0 });
  const conDos = cartReducer(conUno, {
    type: "add",
    item: { ...ITEM_A, qty: 2 },
    now: T1,
  });
  assert.equal(conDos.items.length, 1);
  assert.equal(conDos.items[0].qty, 3);
  assert.equal(conDos.items[0].addedAt, T0); // no se reemplaza el addedAt original
});

test("remove: quita la línea por sku", () => {
  const conItem = cartReducer(carritoVacio(), { type: "add", item: ITEM_A, now: T0 });
  const resultado = cartReducer(conItem, { type: "remove", sku: ITEM_A.sku, now: T1 });
  assert.equal(resultado.items.length, 0);
  assert.equal(resultado.updatedAt, T1);
});

test("setQty: actualiza la cantidad de la línea", () => {
  const conItem = cartReducer(carritoVacio(), { type: "add", item: ITEM_A, now: T0 });
  const resultado = cartReducer(conItem, { type: "setQty", sku: ITEM_A.sku, qty: 5, now: T1 });
  assert.equal(resultado.items[0].qty, 5);
});

test("setQty: qty <= 0 elimina la línea en vez de dejarla en 0", () => {
  const conItem = cartReducer(carritoVacio(), { type: "add", item: ITEM_A, now: T0 });
  const resultado = cartReducer(conItem, { type: "setQty", sku: ITEM_A.sku, qty: 0, now: T1 });
  assert.equal(resultado.items.length, 0);
});

test("clear: vacía el carrito y reinicia createdAt/updatedAt a now", () => {
  const conItem = cartReducer(carritoVacio(), { type: "add", item: ITEM_A, now: T0 });
  const resultado = cartReducer(conItem, { type: "clear", now: T1 });
  assert.deepEqual(resultado, crearCarritoVacio(T1));
});

test("hydrate: reemplaza el carrito completo por el que trae la acción", () => {
  const otro: Cart = {
    schemaVersion: 1,
    items: [{ ...ITEM_A, addedAt: T0 }],
    createdAt: T0,
    updatedAt: T0,
  };
  const resultado = cartReducer(carritoVacio(), { type: "hydrate", cart: otro });
  assert.deepEqual(resultado, otro);
});
