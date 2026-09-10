import test from "node:test";
import assert from "node:assert/strict";

import { SIN_VENTANA_HASTA, paginasVisibles } from "./paginacion.ts";

test("paginación: con pocas páginas se listan todas, sin saltos", () => {
  assert.deepEqual(paginasVisibles(1, 1), [1]);
  // 5 páginas es el caso de /catalogo/bocinas.
  assert.deepEqual(paginasVisibles(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    paginasVisibles(4, SIN_VENTANA_HASTA),
    Array.from({ length: SIN_VENTANA_HASTA }, (_, i) => i + 1),
  );
});

test("paginación: con muchas páginas, ventana alrededor de la actual", () => {
  // 14 páginas es el caso de /catalogo (todo el catálogo, 320 productos).
  assert.deepEqual(paginasVisibles(7, 14), [1, "…", 6, 7, 8, "…", 14]);
});

test("paginación: en los extremos no se pierde el salto al otro extremo", () => {
  assert.deepEqual(paginasVisibles(1, 14), [1, 2, "…", 14]);
  assert.deepEqual(paginasVisibles(14, 14), [1, "…", 13, 14]);
});

test("paginación: un hueco de una sola página va como número, no como «…»", () => {
  // Entre 1 y 3 falta solo la 2: un «…» ahí ocuparía casi lo mismo que el
  // número y escondería una página alcanzable.
  assert.deepEqual(paginasVisibles(3, 14), [1, 2, 3, 4, "…", 14]);
  assert.deepEqual(paginasVisibles(12, 14), [1, "…", 11, 12, 13, 14]);
});

test("paginación: la actual siempre está, y nunca se repite un número", () => {
  for (let total = 1; total <= 30; total += 1) {
    for (let actual = 1; actual <= total; actual += 1) {
      const items = paginasVisibles(actual, total);
      const numeros = items.filter((i): i is number => typeof i === "number");

      assert.ok(numeros.includes(actual), `falta la actual (${actual} de ${total})`);
      assert.ok(numeros.includes(1), `falta la primera (${actual} de ${total})`);
      assert.ok(numeros.includes(total), `falta la última (${actual} de ${total})`);
      assert.equal(new Set(numeros).size, numeros.length, `repetidos (${actual} de ${total})`);
      assert.deepEqual(
        numeros,
        [...numeros].sort((a, b) => a - b),
        `desordenados (${actual} de ${total})`,
      );
      assert.ok(
        numeros.every((n) => n >= 1 && n <= total),
        `fuera de rango (${actual} de ${total})`,
      );
    }
  }
});

test("paginación: nunca dibuja más de 7 números, sea cual sea el total", () => {
  // Es lo que mantiene la fila en un solo renglón en un teléfono.
  for (let total = 1; total <= 500; total += 1) {
    for (const actual of [1, 2, Math.ceil(total / 2), total - 1, total]) {
      if (actual < 1 || actual > total) continue;
      const numeros = paginasVisibles(actual, total).filter((i) => typeof i === "number");
      assert.ok(numeros.length <= 7, `${numeros.length} números con ${actual} de ${total}`);
    }
  }
});
