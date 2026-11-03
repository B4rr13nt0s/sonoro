import test from "node:test";
import assert from "node:assert/strict";

import { crearReintentable } from "./reintentable.ts";

test("devuelve siempre la misma instancia mientras no se descarte", () => {
  let creadas = 0;
  const fuente = crearReintentable(() => ({ n: ++creadas }));
  assert.equal(fuente.actual(), fuente.actual());
  assert.equal(creadas, 1);
});

test("tras descartar, la siguiente lectura es una instancia nueva y estable", () => {
  let creadas = 0;
  const fuente = crearReintentable(() => ({ n: ++creadas }));

  const primera = fuente.actual();
  fuente.descartar();
  const segunda = fuente.actual();

  assert.notEqual(primera, segunda);
  assert.equal(segunda.n, 2);
  assert.equal(fuente.actual(), segunda);
});

test("descartar sin instancia no crea nada", () => {
  let creadas = 0;
  const fuente = crearReintentable(() => ({ n: ++creadas }));
  fuente.descartar();
  assert.equal(creadas, 0);
});
