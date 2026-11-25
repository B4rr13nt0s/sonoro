import test from "node:test";
import assert from "node:assert/strict";

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
      `Total: ${formatQ(324500)}`,
    ].join("\n"),
  );
});

test("sin cliente o con el cliente en blanco, el encabezado no lo nombra", () => {
  for (const cliente of ["", "   "]) {
    const mensaje = buildQuoteMessage({ cliente, lineas: [SUB] });
    assert.ok(mensaje.startsWith("Cotización Sonoro:\n\n1x "));
  }
});

// El pie es solo el total: ni subtotal, ni envío, ni la leyenda del IVA, sea
// cual sea el monto (el envío gratis se decide arriba de Q 500.00, así que se
// prueba a los dos lados de esa raya).
test("el mensaje termina en el total y no dice nada de subtotal, envío ni IVA", () => {
  for (const unitPriceCents of [10000, 50000, 50001, 500000]) {
    for (const mostrarPrecios of [true, false]) {
      const mensaje = buildQuoteMessage({
        cliente: "",
        lineas: [{ ...SUB, unitPriceCents }],
        mostrarPrecios,
      });
      const renglones = mensaje.split("\n");
      assert.equal(renglones.at(-1), `Total: ${formatQ(unitPriceCents)}`);
      assert.ok(!/subtotal/i.test(mensaje), "no debe decir «Subtotal»");
      assert.ok(!/env[ií]o/i.test(mensaje), "no debe decir «Envío»");
      assert.ok(!/IVA/.test(mensaje), "no debe mencionar el IVA");
    }
  }
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

// --- sin precios individuales ----------------------------------------------

test("sin precios individuales, la línea lleva solo cantidad y nombre", () => {
  assert.equal(
    lineaCotizacion(SUB, { mostrarPrecios: false }),
    '1x Subwoofer Champion Series 12" TS-W312D4',
  );
  assert.equal(lineaCotizacion(BOCINA, { mostrarPrecios: false }), '2x Memphis PRX 6.5" PRX60C');
});

test("sin precios individuales, el código se agrega igual si el nombre no lo trae", () => {
  const linea = lineaCotizacion(
    { ...BOCINA, nombre: 'Bocinas Memphis de 6.5"' },
    { mostrarPrecios: false },
  );
  assert.equal(linea, '2x Bocinas Memphis de 6.5" PRX60C');
});

test("sin precios individuales, lo bajo pedido sigue marcado: no es un precio", () => {
  const linea = lineaCotizacion(
    { ...SUB, disponibilidad: "bajo_pedido" },
    { mostrarPrecios: false },
  );
  assert.equal(linea, '1x Subwoofer Champion Series 12" TS-W312D4 · bajo pedido');
});

test("sin precios individuales, el mensaje conserva el total", () => {
  const mensaje = buildQuoteMessage({
    cliente: "Juan Pérez",
    lineas: [SUB, BOCINA],
    mostrarPrecios: false,
  });
  assert.equal(
    mensaje,
    [
      "Cotización Sonoro para Juan Pérez:",
      "",
      lineaCotizacion(SUB, { mostrarPrecios: false }),
      lineaCotizacion(BOCINA, { mostrarPrecios: false }),
      "",
      `Total: ${formatQ(324500)}`,
    ].join("\n"),
  );
  // Ninguna línea de producto lleva «c/u» ni un precio.
  const lineasDeProducto = mensaje.split("\n").filter((l) => /^\d+x /.test(l));
  assert.equal(lineasDeProducto.length, 2);
  for (const l of lineasDeProducto) assert.ok(!l.includes("Q"), `«${l}» lleva un precio`);
});

test("por defecto, y con mostrarPrecios en true, las líneas llevan sus precios", () => {
  const sin = buildQuoteMessage({ cliente: "", lineas: [SUB] });
  const con = buildQuoteMessage({ cliente: "", lineas: [SUB], mostrarPrecios: true });
  assert.equal(sin, con);
  assert.ok(sin.includes("c/u"));
});

test("sin precios individuales y sin líneas, el mensaje sigue vacío", () => {
  assert.equal(buildQuoteMessage({ cliente: "Juan", lineas: [], mostrarPrecios: false }), "");
});

// --- solo el SKU ------------------------------------------------------------

test("con solo SKU, la línea lleva el código en lugar del nombre", () => {
  assert.equal(
    lineaCotizacion(SUB, { soloSku: true }),
    `1x TS-W312D4 — ${formatQ(88500)} c/u — ${formatQ(88500)}`,
  );
  assert.equal(
    lineaCotizacion(BOCINA, { soloSku: true }),
    `2x PRX60C — ${formatQ(118000)} c/u — ${formatQ(236000)}`,
  );
});

test("con solo SKU, el nombre del producto no aparece ni a medias", () => {
  const linea = lineaCotizacion(SUB, { soloSku: true });
  assert.ok(!linea.includes("Subwoofer"));
  assert.ok(!linea.includes("Champion"));
  // El código tal cual lo publica el fabricante, con sus separadores.
  assert.ok(
    lineaCotizacion({ ...SUB, sku: "ACX 165" }, { soloSku: true }).startsWith("1x ACX 165 —"),
  );
});

test("con solo SKU, lo bajo pedido sigue marcado", () => {
  const linea = lineaCotizacion({ ...SUB, disponibilidad: "bajo_pedido" }, { soloSku: true });
  assert.ok(linea.endsWith(" · bajo pedido"));
});

test("con solo SKU y sin precios, la línea es solo cantidad y código", () => {
  assert.equal(lineaCotizacion(SUB, { soloSku: true, mostrarPrecios: false }), "1x TS-W312D4");
  assert.equal(lineaCotizacion(BOCINA, { soloSku: true, mostrarPrecios: false }), "2x PRX60C");
});

test("con solo SKU, el mensaje completo usa los códigos y conserva el total", () => {
  const mensaje = buildQuoteMessage({
    cliente: "Juan Pérez",
    lineas: [SUB, BOCINA],
    soloSku: true,
  });
  assert.equal(
    mensaje,
    [
      "Cotización Sonoro para Juan Pérez:",
      "",
      lineaCotizacion(SUB, { soloSku: true }),
      lineaCotizacion(BOCINA, { soloSku: true }),
      "",
      `Total: ${formatQ(324500)}`,
    ].join("\n"),
  );
});

test("por defecto, y con solo SKU en false, las líneas llevan el nombre", () => {
  const sin = buildQuoteMessage({ cliente: "", lineas: [SUB] });
  const con = buildQuoteMessage({ cliente: "", lineas: [SUB], soloSku: false });
  assert.equal(sin, con);
  assert.ok(sin.includes("Champion Series"));
});

// --- solo precios individuales ----------------------------------------------

test("con solo precios individuales, la línea es una viñeta con el precio unitario", () => {
  assert.equal(
    lineaCotizacion(
      { ...SUB, sku: "PRXE12SFT", nombre: "Cajón PRXE12SFT" },
      { soloPrecioIndividual: true },
    ),
    `- Cajón PRXE12SFT — ${formatQ(88500)}`,
  );
  assert.equal(
    lineaCotizacion(SUB, { soloPrecioIndividual: true, soloSku: true }),
    `- TS-W312D4 — ${formatQ(88500)}`,
  );
});

test("con solo precios individuales y varias unidades, conserva la cantidad y dice c/u", () => {
  assert.equal(
    lineaCotizacion(BOCINA, { soloPrecioIndividual: true, soloSku: true }),
    `- 2x PRX60C — ${formatQ(118000)} c/u`,
  );
});

test("con solo precios individuales, lo bajo pedido sigue marcado", () => {
  const linea = lineaCotizacion(
    { ...SUB, disponibilidad: "bajo_pedido" },
    { soloPrecioIndividual: true, soloSku: true },
  );
  assert.equal(linea, `- TS-W312D4 — ${formatQ(88500)} · bajo pedido`);
});

test("sin precios, solo precios individuales no hace nada", () => {
  assert.equal(
    lineaCotizacion(SUB, { mostrarPrecios: false, soloPrecioIndividual: true, soloSku: true }),
    "1x TS-W312D4",
  );
});

test("con solo precios individuales, el mensaje conserva el total", () => {
  const mensaje = buildQuoteMessage({
    cliente: "",
    lineas: [SUB, BOCINA],
    soloSku: true,
    soloPrecioIndividual: true,
  });
  assert.equal(
    mensaje,
    [
      "Cotización Sonoro:",
      "",
      `- TS-W312D4 — ${formatQ(88500)}`,
      `- 2x PRX60C — ${formatQ(118000)} c/u`,
      "",
      `Total: ${formatQ(324500)}`,
    ].join("\n"),
  );
});
