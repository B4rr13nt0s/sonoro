import test from "node:test";
import assert from "node:assert/strict";

import { formatQ } from "../format/precio.ts";
import { buildQuoteLogRequest } from "./payload.ts";
import type { CartItem } from "../cart/index.ts";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    sku: "SQ12-D2",
    qty: 2,
    unitPriceCents: 245000,
    currency: "GTQ",
    nombreSnapshot: 'Serie SQ 12" D2',
    imagenSnapshot: null,
    addedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

test("buildQuoteLogRequest: mapea CartItem a {texto, sku, nombre, qty, unitPriceCents}", () => {
  const request = buildQuoteLogRequest({
    items: [item()],
    ref: "SNR-A7K2M",
    subtotalCents: 490000,
    userAgent: "Mozilla/5.0 Test",
  });

  assert.deepEqual(request, {
    ref: "SNR-A7K2M",
    items: [
      {
        // La misma línea del mensaje de WhatsApp (lib/whatsapp/message.ts).
        texto: `2x Serie SQ 12" D2 (SQ12-D2) — ${formatQ(245000)} c/u`,
        sku: "SQ12-D2",
        nombre: 'Serie SQ 12" D2',
        qty: 2,
        unitPriceCents: 245000,
      },
    ],
    subtotalCents: 490000,
    userAgent: "Mozilla/5.0 Test",
  });
});

test("buildQuoteLogRequest: nunca incluye un campo `token` — el navegador no lo tiene", () => {
  const request = buildQuoteLogRequest({
    items: [item()],
    ref: "SNR-A7K2M",
    subtotalCents: 490000,
    userAgent: "Mozilla/5.0 Test",
  });
  assert.ok(!("token" in request));
});

test("buildQuoteLogRequest: preserva el orden y la cantidad de líneas del carrito", () => {
  const items = [
    item({ sku: "A", nombreSnapshot: "Producto A" }),
    item({ sku: "B", nombreSnapshot: "Producto B" }),
  ];
  const request = buildQuoteLogRequest({
    items,
    ref: "SNR-00000",
    subtotalCents: 0,
    userAgent: "x",
  });
  assert.deepEqual(
    request.items.map((i) => i.sku),
    ["A", "B"],
  );
});

test("buildQuoteLogRequest: marca lo agotado y lo bajo pedido, y deja lo disponible sin campo", () => {
  const request = buildQuoteLogRequest({
    items: [item({ sku: "A" }), item({ sku: "B" }), item({ sku: "C" })],
    ref: "SNR-A7K2M",
    subtotalCents: 1470000,
    userAgent: "Mozilla/5.0 Test",
    disponibilidad: { A: "disponible", B: "agotado", C: "bajo_pedido" },
  });

  assert.deepEqual(
    request.items.map((i) => i.estado),
    [undefined, "agotado", "bajo pedido"],
  );
  assert.ok(!("estado" in request.items[0]));
});

test("buildQuoteLogRequest: recorta el userAgent y el nombre al tope del esquema", async () => {
  const { MAX_NOMBRE, MAX_USER_AGENT, QuoteLogRequestSchema } = await import("./types.ts");
  const request = buildQuoteLogRequest({
    items: [item({ nombreSnapshot: "N".repeat(MAX_NOMBRE + 50) })],
    ref: "SNR-A7K2M",
    subtotalCents: 490000,
    userAgent: "U".repeat(MAX_USER_AGENT + 100),
  });
  assert.equal(request.userAgent.length, MAX_USER_AGENT);
  assert.equal(request.items[0].nombre.length, MAX_NOMBRE);
  assert.equal(QuoteLogRequestSchema.safeParse(request).success, true);
});
