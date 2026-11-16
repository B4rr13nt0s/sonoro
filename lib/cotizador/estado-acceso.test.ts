import test from "node:test";
import assert from "node:assert/strict";

import { DURACION_SESION_S, estadoAcceso, firmarSesion } from "./sesion.ts";

const CONTRASENA = "una-contrasena-larga";
const AHORA = 1_800_000_000;

// La decisión que toma la página, aislada para poder probarla: la garantía
// central del diseño es que SIN contraseña utilizable la ruta no existe.

test("sin variable de entorno la ruta está cerrada, aunque llegue una cookie firmada", () => {
  const cookie = firmarSesion(CONTRASENA, AHORA);
  assert.equal(estadoAcceso(undefined, cookie, AHORA), "cerrada");
  assert.equal(estadoAcceso(undefined, undefined, AHORA), "cerrada");
});

test("una contraseña vacía, en blanco o corta también deja la ruta cerrada", () => {
  const cookie = firmarSesion("corta", AHORA);
  for (const env of ["", " ".repeat(20), "corta", "12345678901"]) {
    assert.equal(estadoAcceso(env, cookie, AHORA), "cerrada", `debió cerrar con «${env}»`);
  }
});

test("con contraseña y sin cookie, solo el formulario", () => {
  assert.equal(estadoAcceso(CONTRASENA, undefined, AHORA), "formulario");
  assert.equal(estadoAcceso(CONTRASENA, "", AHORA), "formulario");
});

test("con contraseña y una cookie válida, la herramienta", () => {
  assert.equal(estadoAcceso(CONTRASENA, firmarSesion(CONTRASENA, AHORA), AHORA), "abierta");
});

test("una cookie de otra contraseña o expirada vuelve al formulario", () => {
  const otra = firmarSesion("otra-contrasena-larga", AHORA);
  assert.equal(estadoAcceso(CONTRASENA, otra, AHORA), "formulario");
  const vieja = firmarSesion(CONTRASENA, AHORA);
  assert.equal(estadoAcceso(CONTRASENA, vieja, AHORA + DURACION_SESION_S), "formulario");
});
