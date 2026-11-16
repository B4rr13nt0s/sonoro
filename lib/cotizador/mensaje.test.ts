import test from "node:test";
import assert from "node:assert/strict";

import { ENVIO_POR_COBRAR } from "../cart/envio.ts";
import { formatQ } from "../format/precio.ts";
import {
  MAX_CLIENTE,
  buildQuoteMessage,
  lineaCotizacion,
  type LineaCotizacion,
} from "./mensaje.ts";

const SUB: LineaCotizacion = {
  sku: "TS-W312D4",
  nombre: 'Subwoofer Champion Series 12" TS-W312D4',
  qty: 1,
  unitPriceCents: 88500,
  disponibilidad: "disponible",
};

const BOCINA: LineaCotizacion = {
  sku: "PRX60C",
  nombre: 'Memphis PRX 6.5" PRX60C',
  qty: 2,
  unitPriceCents: 118000,
  disponibilidad: "disponible",
};

test("la línea lleva cantidad, nombre, precio unitario y total", () => {
  assert.equal(
    lineaCotizacion(SUB),
    `1x Subwoofer Champion Series 12" TS-W312D4 — ${formatQ(88500)} c/u — ${formatQ(88500)}`,
  );
  assert.equal(
    lineaCotizacion(BOCINA),
    `2x Memphis PRX 6.5" PRX60C — ${formatQ(118000)} c/u — ${formatQ(236000)}`,
  );
});

test("el precio lleva coma de miles y espacio duro", () => {
  const linea = lineaCotizacion({ ...BOCINA, unitPriceCents: 245000, qty: 3 });
  assert.ok(linea.includes("Q 2,450.00 c/u"));
  assert.ok(linea.endsWith("Q 7,350.00"));
});

test("lo bajo pedido termina con su marca y lo disponible no lleva ninguna", () => {
  assert.ok(lineaCotizacion({ ...SUB, disponibilidad: "bajo_pedido" }).endsWith(" · bajo pedido"));
  assert.ok(!lineaCotizacion(SUB).includes("·"));
});

test("si el nombre no trae el código, se agrega al final del nombre", () => {
  const linea = lineaCotizacion({ ...BOCINA, nombre: 'Bocinas Memphis de 6.5"' });
  assert.ok(linea.startsWith('2x Bocinas Memphis de 6.5" PRX60C — '));
});

test("si el nombre ya trae el código, no se repite, sin importar mayúsculas", () => {
  const linea = lineaCotizacion({ ...SUB, nombre: "Subwoofer champion ts-w312d4" });
  assert.equal(
    linea,
    `1x Subwoofer champion ts-w312d4 — ${formatQ(88500)} c/u — ${formatQ(88500)}`,
  );
});

test("el mensaje completo con cliente", () => {
  const mensaje = buildQuoteMessage({ cliente: "Juan Pérez", lineas: [SUB, BOCINA] });
  assert.equal(
    mensaje,
    [
      "Cotización Sonoro para Juan Pérez:",
      "",
      lineaCotizacion(SUB),
      lineaCotizacion(BOCINA),
      "",
      `Subtotal: ${formatQ(324500)}`,
      "Envío: gratis",
      `Total: ${formatQ(324500)}`,
      "Precios con IVA incluido.",
    ].join("\n"),
  );
});

test("sin cliente o con el cliente en blanco, el encabezado no lo nombra", () => {
  for (const cliente of ["", "   "]) {
    const mensaje = buildQuoteMessage({ cliente, lineas: [SUB] });
    assert.ok(mensaje.startsWith("Cotización Sonoro:\n\n1x "));
  }
});

test("el envío es gratis solo con un subtotal mayor a Q 500.00", () => {
  const justo = buildQuoteMessage({
    cliente: "",
    lineas: [{ ...SUB, unitPriceCents: 50000 }],
  });
  assert.ok(justo.includes(`Envío: ${ENVIO_POR_COBRAR}`));
  const arriba = buildQuoteMessage({
    cliente: "",
    lineas: [{ ...SUB, unitPriceCents: 50001 }],
  });
  assert.ok(arriba.includes("Envío: gratis"));
});

test("el cliente con saltos de línea se colapsa a una sola línea", () => {
  const mensaje = buildQuoteMessage({ cliente: "Ana\nLópez\r\n  Ruiz", lineas: [SUB] });
  assert.equal(mensaje.split("\n")[0], "Cotización Sonoro para Ana López Ruiz:");
});

test("el cliente muy largo se corta a MAX_CLIENTE caracteres", () => {
  assert.equal(MAX_CLIENTE, 80);
  const mensaje = buildQuoteMessage({ cliente: "x".repeat(200), lineas: [SUB] });
  assert.equal(mensaje.split("\n")[0], `Cotización Sonoro para ${"x".repeat(80)}:`);
});

test("sin líneas, el mensaje es vacío", () => {
  assert.equal(buildQuoteMessage({ cliente: "Juan", lineas: [] }), "");
});
