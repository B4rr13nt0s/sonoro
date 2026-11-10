import test from "node:test";
import assert from "node:assert/strict";

import { enmascarar } from "./enmascarar.ts";

test("enmascarar: oculta una tira de 7 o más dígitos", () => {
  assert.equal(enmascarar("mi cel 52955555"), "mi cel •••••••");
});

test("enmascarar: ignora espacios y guiones entre los dígitos", () => {
  assert.equal(enmascarar("+502 5295-5555"), "+•••••••");
  assert.equal(enmascarar("5295 5555"), "•••••••");
});

test("enmascarar: también con puntos y paréntesis entre los dígitos", () => {
  assert.equal(enmascarar("(502) 5295.5555"), "•••••••");
  assert.equal(enmascarar("5295.5555"), "•••••••");
  assert.equal(enmascarar("+502 (5295) 5555"), "+•••••••");
});

test("enmascarar: deja pasar medidas, precios y códigos (riesgo 3)", () => {
  for (const texto of [
    "sub 12 2 ohm menos de 3000",
    "Q 12,300",
    "1,000 W",
    "SQ12-D2",
    "Q 12,300.00",
    "2,450.00",
  ]) {
    assert.equal(enmascarar(texto), texto);
  }
});

test("enmascarar: otros separadores, la raya larga y los dígitos que no son ASCII", () => {
  for (const telefono of [
    "5295–5555", // raya «–» al pegar desde un procesador de texto
    "5295—5555",
    "5295−5555", // signo menos
    "5295/5555",
    "5295_5555",
    "5295 · 5555",
    "5295 5555", // espacio no separable
    "5295​5555", // ancho cero
    "５２９５５５５５", // ancho completo
    "٥٢٩٥٥٥٥٥", // arábigos
  ]) {
    assert.equal(enmascarar(`mi cel ${telefono} gracias`), "mi cel ••••••• gracias", telefono);
  }
});

test("enmascarar: con los separadores nuevos, lo que no es un teléfono pasa igual", () => {
  for (const texto of ["subwoofer 12/10", "6x9 de 4–6 pulgadas", "SQ12_D2", "12 – 8 ohm"]) {
    assert.equal(enmascarar(texto), texto);
  }
});

test("enmascarar: un rango de años de 8 dígitos se oculta, como ya pasaba con el guion", () => {
  // Costo aceptado de la regla (ver el comentario de enmascarar.ts): «2003-2018»
  // ya se ocultaba y «2003–2018» (la raya que usa el selector) se trata igual.
  assert.equal(enmascarar("corolla 2003-2018"), "corolla •••••••");
  assert.equal(enmascarar("corolla 2003–2018"), "corolla •••••••");
});
