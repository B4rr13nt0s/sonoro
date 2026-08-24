import test from "node:test";
import assert from "node:assert/strict";

import { buildOrderMessage } from "./message.ts";
import { formatQ } from "../format/precio.ts";
import type { CartItem } from "../cart/index.ts";

function item(overrides: Partial<CartItem>): CartItem {
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

// formatQ() usa un espacio duro (U+00A0) entre "Q" y la cifra
// (lib/format/precio.ts) — se construyen las líneas esperadas llamándolo,
// no tipeándolas a mano, para no comparar un espacio normal contra uno duro.
const LINEA_1 = `1x Serie SQ 12" D2 (SQ12-D2) — ${formatQ(245000)}`;
const LINEA_2 = `2x Memphis PRX 6.5" (PRX60C) — ${formatQ(118000)} c/u`;

test("buildOrderMessage: formato exacto de CLAUDE.md § Modelo de conversión", () => {
  const items = [
    item({ sku: "SQ12-D2", qty: 1, nombreSnapshot: 'Serie SQ 12" D2', unitPriceCents: 245000 }),
    item({ sku: "PRX60C", qty: 2, nombreSnapshot: 'Memphis PRX 6.5"', unitPriceCents: 118000 }),
  ];

  const mensaje = buildOrderMessage({
    items,
    ref: "SNR-A7K2M",
    cartUrl: "https://sonoro.gt/carrito",
  });

  const esperado = [
    "Hola Sonoro, quiero pedir:",
    "",
    LINEA_1,
    LINEA_2,
    "",
    `Subtotal: ${formatQ(481000)}`,
    "Envío: gratis",
    `Total: ${formatQ(481000)}`,
    "Ref: SNR-A7K2M",
  ].join("\n");

  assert.equal(mensaje, esperado);
});

test("buildOrderMessage: qty === 1 no lleva sufijo 'c/u'", () => {
  const mensaje = buildOrderMessage({
    items: [item({ qty: 1 })],
    ref: "SNR-00000",
    cartUrl: "https://sonoro.gt/carrito",
  });
  assert.ok(mensaje.includes(LINEA_1));
  assert.ok(!mensaje.includes("c/u"));
});

test("buildOrderMessage: qty > 1 sí lleva sufijo 'c/u'", () => {
  const mensaje = buildOrderMessage({
    items: [item({ qty: 3 })],
    ref: "SNR-00000",
    cartUrl: "https://sonoro.gt/carrito",
  });
  assert.ok(mensaje.includes("3x "));
  assert.ok(mensaje.includes("c/u"));
});

test("buildOrderMessage: subtotal y total coinciden (envío gratis) y suman por qty × precio", () => {
  const items = [
    item({ qty: 2, unitPriceCents: 100000 }),
    item({ sku: "OTRO", qty: 1, unitPriceCents: 50000 }),
  ];
  const mensaje = buildOrderMessage({
    items,
    ref: "SNR-00000",
    cartUrl: "https://sonoro.gt/carrito",
  });
  // 2*1000 + 1*500 = 2500.00
  assert.ok(mensaje.includes(`Subtotal: ${formatQ(250000)}`));
  assert.ok(mensaje.includes(`Total: ${formatQ(250000)}`));
});

test("buildOrderMessage: más de 15 líneas envía el ref y un enlace, no la lista completa", () => {
  const items = Array.from({ length: 16 }, (_, i) => item({ sku: `SKU-${i}`, qty: 1 }));
  const cartUrl = "https://sonoro.gt/carrito";
  const mensaje = buildOrderMessage({ items, ref: "SNR-A7K2M", cartUrl });

  assert.ok(mensaje.includes(cartUrl), "debe incluir el enlace al carrito");
  assert.ok(mensaje.includes("Ref: SNR-A7K2M"), "debe incluir el ref");
  assert.ok(!mensaje.includes("(SKU-0)"), "no debe listar las líneas individuales");
  assert.ok(!mensaje.includes("(SKU-15)"));
});

test("buildOrderMessage: exactamente 15 líneas SÍ lista todo (el límite es 'excede', no 'alcanza')", () => {
  const items = Array.from({ length: 15 }, (_, i) => item({ sku: `SKU-${i}`, qty: 1 }));
  const mensaje = buildOrderMessage({
    items,
    ref: "SNR-A7K2M",
    cartUrl: "https://sonoro.gt/carrito",
  });
  assert.ok(mensaje.includes("(SKU-0)"));
  assert.ok(mensaje.includes("(SKU-14)"));
});
