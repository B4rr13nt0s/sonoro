import test from "node:test";
import assert from "node:assert/strict";

import { textoAgregado } from "./confirmacion.ts";

test("textoAgregado: la confirmación de «Agregar al carrito», en singular y plural", () => {
  assert.equal(textoAgregado(1), "Has añadido 1 ítem al carrito.");
  assert.equal(textoAgregado(3), "Has añadido 3 ítems al carrito.");
});
