import test from "node:test";
import assert from "node:assert/strict";

import { buildProductJsonLd } from "./product.ts";
import type { Producto } from "../catalog/index.ts";

function producto(overrides: Partial<Producto> = {}): Producto {
  return {
    sku: "SQ12-D2",
    slug: "sonoro-sq12-d2",
    nombre: 'Serie SQ 12" D2',
    marca: "Sonoro",
    categoria: "Subwoofers",
    descripcionCorta: "Subwoofer de 12 pulgadas doble bobina 2 ohm",
    specsDestacadas: [
      { etiqueta: "Tamaño", valor: '12"' },
      { etiqueta: "Impedancia", valor: "2 Ω" },
      { etiqueta: "Potencia RMS", valor: "500W" },
    ],
    specsFicha: [
      { etiqueta: "Tamaño", valor: '12"' },
      { etiqueta: "Impedancia", valor: "2 Ω" },
      { etiqueta: "Potencia RMS", valor: "500W" },
      { etiqueta: "Potencia máxima", valor: "1000W" },
    ],
    precioCents: 245000,
    moneda: "GTQ",
    disponibilidad: "disponible",
    imagenes: [],
    destacado: false,
    activo: true,
    ...overrides,
  };
}

test("buildProductJsonLd: price es un decimal plano, sin símbolo ni coma de miles", () => {
  const jsonLd = buildProductJsonLd(producto({ precioCents: 245000 }));
  assert.equal(jsonLd.offers.price, "2450.00");
});

test("buildProductJsonLd: price de un monto sobre mil también es decimal plano", () => {
  const jsonLd = buildProductJsonLd(producto({ precioCents: 1230050 }));
  assert.equal(jsonLd.offers.price, "12300.50");
});

test("buildProductJsonLd: priceCurrency es la moneda del producto (GTQ)", () => {
  const jsonLd = buildProductJsonLd(producto());
  assert.equal(jsonLd.offers.priceCurrency, "GTQ");
});

test("buildProductJsonLd: mapea disponible -> InStock", () => {
  const jsonLd = buildProductJsonLd(producto({ disponibilidad: "disponible" }));
  assert.equal(jsonLd.offers.availability, "https://schema.org/InStock");
});

test("buildProductJsonLd: mapea bajo_pedido -> BackOrder", () => {
  const jsonLd = buildProductJsonLd(producto({ disponibilidad: "bajo_pedido" }));
  assert.equal(jsonLd.offers.availability, "https://schema.org/BackOrder");
});

test("buildProductJsonLd: mapea agotado -> OutOfStock", () => {
  const jsonLd = buildProductJsonLd(producto({ disponibilidad: "agotado" }));
  assert.equal(jsonLd.offers.availability, "https://schema.org/OutOfStock");
});

test("buildProductJsonLd: sin imagenes no incluye el campo `image` (no fabrica una foto)", () => {
  const jsonLd = buildProductJsonLd(producto({ imagenes: [] }));
  assert.ok(!("image" in jsonLd));
});

test("buildProductJsonLd: con imagenes, `image` trae URLs absolutas", () => {
  const jsonLd = buildProductJsonLd(
    producto({ imagenes: [{ url: "/fotos/sq12-d2.jpg", alt: "Serie SQ 12 D2" }] }),
  );
  assert.deepEqual(jsonLd.image, ["http://localhost:3000/fotos/sq12-d2.jpg"]);
});

test("buildProductJsonLd: sku, name y brand vienen del producto tal cual", () => {
  const jsonLd = buildProductJsonLd(producto({ sku: "SQ12-D2", nombre: "X", marca: "Sonoro" }));
  assert.equal(jsonLd.sku, "SQ12-D2");
  assert.equal(jsonLd.name, "X");
  assert.deepEqual(jsonLd.brand, { "@type": "Brand", name: "Sonoro" });
});
