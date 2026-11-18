import test from "node:test";
import assert from "node:assert/strict";

import { fotoDeLinea } from "./foto.ts";

const BLOB = "https://x.public.blob.vercel-storage.com/productos/A_frontal.abc123def456.webp";

test("fotoDeLinea: la foto del catálogo gana sobre el snapshot guardado", () => {
  assert.equal(fotoDeLinea("/productos/A_frontal.jpg", BLOB), BLOB);
});

test("fotoDeLinea: sin foto de catálogo, un snapshot con url de Blob se conserva", () => {
  assert.equal(fotoDeLinea(BLOB, undefined), BLOB);
});

test("fotoDeLinea: un carrito viejo (/productos/…) no da una imagen rota: null", () => {
  assert.equal(fotoDeLinea("/productos/A_frontal.jpg", undefined), null);
  assert.equal(fotoDeLinea("/productos/A_frontal.webp", undefined), null);
});

test("fotoDeLinea: sin snapshot y sin catálogo: null", () => {
  assert.equal(fotoDeLinea(null, undefined), null);
});
