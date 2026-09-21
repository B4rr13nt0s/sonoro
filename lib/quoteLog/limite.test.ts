import test from "node:test";
import assert from "node:assert/strict";

import { crearLimitador, ipDePeticion } from "./limite.ts";

test("deja pasar la ráfaga hasta la capacidad y corta la siguiente", () => {
  const permitir = crearLimitador({ capacidad: 3, porMinuto: 3, ahora: () => 0 });
  assert.deepEqual(
    [permitir("1.1.1.1"), permitir("1.1.1.1"), permitir("1.1.1.1"), permitir("1.1.1.1")],
    [true, true, true, false],
  );
});

test("cada IP tiene su propio cubo", () => {
  const permitir = crearLimitador({ capacidad: 1, porMinuto: 1, ahora: () => 0 });
  assert.equal(permitir("1.1.1.1"), true);
  assert.equal(permitir("1.1.1.1"), false, "la segunda de la misma IP se corta");
  assert.equal(permitir("2.2.2.2"), true, "otra IP no paga por la primera");
});

test("las fichas se recuperan con el tiempo, sin pasar de la capacidad", () => {
  let t = 0;
  const permitir = crearLimitador({ capacidad: 2, porMinuto: 60, ahora: () => t });
  assert.equal(permitir("1.1.1.1"), true);
  assert.equal(permitir("1.1.1.1"), true);
  assert.equal(permitir("1.1.1.1"), false);

  t += 1_000; // una ficha por segundo a 60 por minuto
  assert.equal(permitir("1.1.1.1"), true, "tras un segundo hay una ficha");
  assert.equal(permitir("1.1.1.1"), false);

  t += 3_600_000; // una hora parado no da más que la capacidad
  assert.equal(permitir("1.1.1.1"), true);
  assert.equal(permitir("1.1.1.1"), true);
  assert.equal(permitir("1.1.1.1"), false, "el cubo no acumula más allá de su capacidad");
});

test("el Map no crece sin límite: al llegar al tope se vacía", () => {
  const permitir = crearLimitador({ capacidad: 1, porMinuto: 1, maxClaves: 2, ahora: () => 0 });
  assert.equal(permitir("a"), true);
  assert.equal(permitir("b"), true);
  assert.equal(permitir("a"), false, "«a» sigue sin fichas mientras quepa en el Map");
  // La tercera clave llena el tope y limpia: «a» vuelve a arrancar de cero.
  assert.equal(permitir("c"), true);
  assert.equal(permitir("a"), true, "tras vaciarse, «a» arranca con el cubo lleno");
});

test("ipDePeticion: primera de x-forwarded-for, luego x-real-ip, luego desconocida", () => {
  assert.equal(ipDePeticion(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
  assert.equal(ipDePeticion(new Headers({ "x-forwarded-for": "  8.8.8.8  " })), "8.8.8.8");
  assert.equal(ipDePeticion(new Headers({ "x-real-ip": "7.7.7.7" })), "7.7.7.7");
  assert.equal(ipDePeticion(new Headers()), "desconocida");
  // Cabecera presente pero vacía: no se cuela una clave vacía.
  assert.equal(ipDePeticion(new Headers({ "x-forwarded-for": " , " })), "desconocida");
});
