import test from "node:test";
import assert from "node:assert/strict";

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

test("buildQuoteLogRequest: mapea CartItem a la forma {sku, nombre, qty, unitPriceCents}", () => {
  const request = buildQuoteLogRequest({
    items: [item()],
    ref: "SNR-A7K2M",
    subtotalCents: 490000,
    userAgent: "Mozilla/5.0 Test",
  });

  assert.deepEqual(request, {
    ref: "SNR-A7K2M",
    items: [{ sku: "SQ12-D2", nombre: 'Serie SQ 12" D2', qty: 2, unitPriceCents: 245000 }],
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
