import test from "node:test";
import assert from "node:assert/strict";

import { formatQ } from "../../lib/format/precio.ts";
import type { CambioCarrito } from "../../lib/cart/reconcile.ts";
import { avisosDeCambios } from "./avisos.ts";

const precio: CambioCarrito = {
  tipo: "precio_actualizado",
  sku: "COR-124D",
  nombreSnapshot: 'Subwoofer Coronel de 12" COR-124D',
  precioAnteriorCents: 110000,
  precioActualCents: 120000,
};

test("precio actualizado: una frase con los dos precios en formatQ", () => {
  assert.deepEqual(avisosDeCambios([precio], new Set(["COR-124D"])), [
    `El precio de Subwoofer Coronel de 12" COR-124D cambió de ${formatQ(110000)} a ${formatQ(120000)}.`,
  ]);
});

test("precio actualizado de una línea que el cliente ya quitó: sin aviso", () => {
  assert.deepEqual(avisosDeCambios([precio], new Set()), []);
});

test("inactivo o inexistente: la misma frase, aunque la línea ya no esté", () => {
  const cambios: CambioCarrito[] = [
    { tipo: "eliminado_inactivo", sku: "KSL-10P", nombreSnapshot: "Caja KSL-10P" },
    { tipo: "eliminado_no_existe", sku: "VIEJO", nombreSnapshot: "Cable viejo" },
  ];
  assert.deepEqual(avisosDeCambios(cambios, new Set()), [
    "Se quitó Caja KSL-10P del carrito: ya no está a la venta.",
    "Se quitó Cable viejo del carrito: ya no está a la venta.",
  ]);
});

test("conserva el orden de los cambios", () => {
  const quitado: CambioCarrito = {
    tipo: "eliminado_inactivo",
    sku: "KSL-10P",
    nombreSnapshot: "Caja KSL-10P",
  };
  const avisos = avisosDeCambios([quitado, precio], new Set(["COR-124D"]));
  assert.match(avisos[0], /^Se quitó/);
  assert.match(avisos[1], /^El precio/);
});
