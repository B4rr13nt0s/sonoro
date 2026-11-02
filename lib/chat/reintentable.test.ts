import test from "node:test";
import assert from "node:assert/strict";

import { crearReintentable } from "./reintentable.ts";

test("devuelve siempre la misma instancia mientras nada falle", () => {
  let creadas = 0;
  const fuente = crearReintentable(() => ({ n: ++creadas }));
  assert.equal(fuente.actual(), fuente.actual());
  assert.equal(creadas, 1);
});

test("tras un fallo la siguiente lectura es una instancia nueva", () => {
  let creadas = 0;
  let fallar: () => void = () => {};
  const fuente = crearReintentable((alFallar) => {
    fallar = alFallar;
    return { n: ++creadas };
  });

  const primera = fuente.actual();
  fallar();
  const segunda = fuente.actual();

  assert.notEqual(primera, segunda);
  assert.equal(segunda.n, 2);
  assert.equal(fuente.actual(), segunda);
});

test("un fallo de una instancia vieja no descarta la nueva", () => {
  let creadas = 0;
  const fallos: (() => void)[] = [];
  const fuente = crearReintentable((alFallar) => {
    fallos.push(alFallar);
    return { n: ++creadas };
  });

  fuente.actual();
  fallos[0]!();
  const nueva = fuente.actual();
  fallos[0]!(); // llega tarde: la instancia 1 ya fue reemplazada
  assert.equal(fuente.actual(), nueva);
  assert.equal(creadas, 2);
});
