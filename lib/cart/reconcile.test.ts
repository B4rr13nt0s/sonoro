import test from "node:test";
import assert from "node:assert/strict";

import { acumularCambios, motivoParaQuitar, reconcile, type CambioCarrito } from "./reconcile.ts";
import type { Cart, CartItem, CatalogoSku } from "./types.ts";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    sku: "SQ12-D2",
    qty: 1,
    unitPriceCents: 245000,
    currency: "GTQ",
    nombreSnapshot: 'Serie SQ 12" D2',
    imagenSnapshot: null,
    addedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

function carrito(items: CartItem[]): Cart {
  return {
    schemaVersion: 1,
    items,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
  };
}

test("reconcile: sku que ya no existe en el catálogo se elimina y se reporta", () => {
  const { cart, cambios } = reconcile(carrito([item()]), []);
  assert.equal(cart.items.length, 0);
  assert.deepEqual(cambios, [
    { tipo: "eliminado_no_existe", sku: "SQ12-D2", nombreSnapshot: 'Serie SQ 12" D2' },
  ]);
});

test("reconcile: producto activo === false se elimina y se reporta", () => {
  const catalogo: CatalogoSku[] = [
    { sku: "SQ12-D2", activo: false, disponibilidad: "disponible", precioCents: 245000 },
  ];
  const { cart, cambios } = reconcile(carrito([item()]), catalogo);
  assert.equal(cart.items.length, 0);
  assert.deepEqual(cambios, [
    { tipo: "eliminado_inactivo", sku: "SQ12-D2", nombreSnapshot: 'Serie SQ 12" D2' },
  ]);
});

test("reconcile: disponibilidad === 'agotado' quita la línea y lo reporta", () => {
  const catalogo: CatalogoSku[] = [
    { sku: "SQ12-D2", activo: true, disponibilidad: "agotado", precioCents: 245000 },
  ];
  const { cart, cambios } = reconcile(carrito([item()]), catalogo);
  assert.equal(cart.items.length, 0);
  assert.deepEqual(cambios, [
    { tipo: "eliminado_agotado", sku: "SQ12-D2", nombreSnapshot: 'Serie SQ 12" D2' },
  ]);
});

test("reconcile: disponibilidad === 'bajo_pedido' no quita la línea ni cuenta como cambio", () => {
  const catalogo: CatalogoSku[] = [
    { sku: "SQ12-D2", activo: true, disponibilidad: "bajo_pedido", precioCents: 245000 },
  ];
  const { cart, cambios } = reconcile(carrito([item()]), catalogo);
  assert.equal(cart.items.length, 1);
  assert.deepEqual(cambios, []);
});

test("reconcile: precioCents distinto al snapshot se actualiza y se reporta", () => {
  const catalogo: CatalogoSku[] = [
    { sku: "SQ12-D2", activo: true, disponibilidad: "disponible", precioCents: 259000 },
  ];
  const { cart, cambios } = reconcile(carrito([item({ unitPriceCents: 245000 })]), catalogo);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].unitPriceCents, 259000);
  assert.deepEqual(cambios, [
    {
      tipo: "precio_actualizado",
      sku: "SQ12-D2",
      nombreSnapshot: 'Serie SQ 12" D2',
      precioAnteriorCents: 245000,
      precioActualCents: 259000,
    },
  ]);
});

test("reconcile: precio igual al del catálogo no genera cambio", () => {
  const catalogo: CatalogoSku[] = [
    { sku: "SQ12-D2", activo: true, disponibilidad: "disponible", precioCents: 245000 },
  ];
  const { cart, cambios } = reconcile(carrito([item()]), catalogo);
  assert.equal(cart.items.length, 1);
  assert.deepEqual(cambios, []);
});

test("reconcile: carrito con varias líneas mezcla eliminaciones, agotados y precios sin afectarse entre sí", () => {
  const items = [
    item({ sku: "A", nombreSnapshot: "Producto A" }),
    item({ sku: "B", nombreSnapshot: "Producto B", unitPriceCents: 100000 }),
    item({ sku: "C", nombreSnapshot: "Producto C" }),
    item({ sku: "D", nombreSnapshot: "Producto D" }),
  ];
  const catalogo: CatalogoSku[] = [
    { sku: "A", activo: false, disponibilidad: "disponible", precioCents: 245000 },
    { sku: "B", activo: true, disponibilidad: "disponible", precioCents: 120000 },
    { sku: "C", activo: true, disponibilidad: "agotado", precioCents: 245000 },
    // "D" no está en el catálogo.
  ];

  const { cart, cambios } = reconcile(carrito(items), catalogo);

  assert.deepEqual(
    cart.items.map((i) => i.sku),
    ["B"],
  );
  assert.equal(cart.items.find((i) => i.sku === "B")?.unitPriceCents, 120000);

  const tipos = Object.fromEntries(cambios.map((c) => [c.sku, c.tipo]));
  assert.equal(tipos.A, "eliminado_inactivo");
  assert.equal(tipos.B, "precio_actualizado");
  assert.equal(tipos.C, "eliminado_agotado");
  assert.equal(tipos.D, "eliminado_no_existe");
});

test("reconcile: no muta el carrito original (es puro)", () => {
  const original = carrito([item()]);
  const copiaOriginal = structuredClone(original);
  reconcile(original, []);
  assert.deepEqual(original, copiaOriginal);
});

function precio(anterior: number, actual: number, sku = "SQ12-D2"): CambioCarrito {
  return {
    tipo: "precio_actualizado",
    sku,
    nombreSnapshot: sku,
    precioAnteriorCents: anterior,
    precioActualCents: actual,
  };
}

test("acumularCambios: dos cambios de precio del mismo sku se avisan como uno, del primero al último", () => {
  assert.deepEqual(acumularCambios([precio(70000, 80000)], [precio(80000, 90000)]), [
    precio(70000, 90000),
  ]);
});

test("acumularCambios: un precio que volvió al original no deja aviso", () => {
  assert.deepEqual(acumularCambios([precio(70000, 80000)], [precio(80000, 70000)]), []);
});

test("acumularCambios: un producto quitado reemplaza el aviso de precio del mismo sku", () => {
  const quitado: CambioCarrito = {
    tipo: "eliminado_inactivo",
    sku: "SQ12-D2",
    nombreSnapshot: "SQ12-D2",
  };
  assert.deepEqual(acumularCambios([precio(70000, 80000)], [quitado]), [quitado]);
});

test("acumularCambios: skus distintos se conservan en orden", () => {
  assert.deepEqual(acumularCambios([precio(1, 2, "A")], [precio(3, 4, "B")]), [
    precio(1, 2, "A"),
    precio(3, 4, "B"),
  ]);
});

test("motivoParaQuitar: la regla que comparten reconcile() y addItem()", () => {
  const entrada = (o: Partial<CatalogoSku>): CatalogoSku => ({
    sku: "X",
    activo: true,
    disponibilidad: "disponible",
    precioCents: 100,
    ...o,
  });
  assert.equal(motivoParaQuitar(undefined), "eliminado_no_existe");
  assert.equal(motivoParaQuitar(entrada({ activo: false })), "eliminado_inactivo");
  assert.equal(motivoParaQuitar(entrada({ disponibilidad: "agotado" })), "eliminado_agotado");
  assert.equal(motivoParaQuitar(entrada({ disponibilidad: "bajo_pedido" })), null);
  assert.equal(motivoParaQuitar(entrada({})), null);
});
