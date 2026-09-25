import test from "node:test";
import assert from "node:assert/strict";

import { buildLlmsTxt } from "./llms.ts";

const texto = buildLlmsTxt({
  categorias: [{ nombre: "Subwoofers", slug: "subwoofers", cantidadProductos: 55 }],
  marcas: [{ nombre: "Memphis", slug: "memphis", cantidadProductos: 1 }],
  totalProductos: 320,
});

test("buildLlmsTxt: abre con el H1 del proyecto y su resumen", () => {
  const [h1, , resumen] = texto.split("\n");
  assert.equal(h1, "# Sonoro");
  assert.match(resumen, /^> /);
});

test("buildLlmsTxt: categorías y marcas salen del catálogo, con URL absoluta", () => {
  assert.match(texto, /- \[Subwoofers\]\(https?:\/\/[^)]+\/catalogo\/subwoofers\): 55 productos\./);
  assert.match(texto, /- \[Memphis\]\(https?:\/\/[^)]+\/marcas\/memphis\): 1 producto\./);
  assert.match(texto, /los 320 productos a la venta/);
});

test("buildLlmsTxt: la frase de envíos va siempre con sus restricciones", () => {
  assert.match(
    texto,
    /Envíos gratis a todo el país\. Aplican restricciones según destino y volumen del pedido\./,
  );
});
