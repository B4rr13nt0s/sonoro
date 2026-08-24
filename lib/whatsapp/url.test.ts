import test from "node:test";
import assert from "node:assert/strict";

import { buildWhatsAppUrl } from "./url.ts";

test("buildWhatsAppUrl: arma un enlace wa.me con el número y el texto codificado", () => {
  const url = buildWhatsAppUrl("50247705202", "Hola Sonoro");
  assert.equal(url, "https://wa.me/50247705202?text=Hola%20Sonoro");
});

test("buildWhatsAppUrl: descarta espacios, signos y guiones del número", () => {
  const url = buildWhatsAppUrl("+502 4770-5202", "x");
  assert.ok(url.startsWith("https://wa.me/50247705202?"));
});

test("buildWhatsAppUrl: codifica saltos de línea y caracteres especiales del mensaje", () => {
  const url = buildWhatsAppUrl("50247705202", "línea 1\nlínea 2 — Q 2,450.00");
  const texto = new URL(url).searchParams.get("text");
  assert.equal(texto, "línea 1\nlínea 2 — Q 2,450.00");
});
