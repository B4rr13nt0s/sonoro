import test from "node:test";
import assert from "node:assert/strict";

import {
  COOKIE_COTIZADOR,
  DURACION_SESION_S,
  LARGO_MINIMO_CONTRASENA,
  contrasenaConfigurada,
  contrasenaCorrecta,
  firmarSesion,
  sesionValida,
} from "./sesion.ts";

const CONTRASENA = "una-contrasena-larga";
const AHORA = 1_800_000_000;

test("las constantes de la sesión son las del diseño", () => {
  assert.equal(COOKIE_COTIZADOR, "cotizador");
  assert.equal(DURACION_SESION_S, 7 * 24 * 60 * 60);
  assert.equal(LARGO_MINIMO_CONTRASENA, 12);
});

test("una cookie firmada con la contraseña es válida antes de expirar", () => {
  const cookie = firmarSesion(CONTRASENA, AHORA);
  assert.match(cookie, /^\d+\.[0-9a-f]{64}$/);
  assert.equal(cookie.split(".")[0], String(AHORA + DURACION_SESION_S));
  assert.equal(sesionValida(cookie, CONTRASENA, AHORA), true);
  assert.equal(sesionValida(cookie, CONTRASENA, AHORA + DURACION_SESION_S - 1), true);
});

test("la cookie expira al llegar a su fecha", () => {
  const cookie = firmarSesion(CONTRASENA, AHORA);
  assert.equal(sesionValida(cookie, CONTRASENA, AHORA + DURACION_SESION_S), false);
  assert.equal(sesionValida(cookie, CONTRASENA, AHORA + DURACION_SESION_S + 1), false);
});

test("una cookie firmada con otra contraseña no vale (contraseña rotada)", () => {
  const cookie = firmarSesion("otra-contrasena-larga", AHORA);
  assert.equal(sesionValida(cookie, CONTRASENA, AHORA), false);
});

test("un hex alterado, aunque siga siendo hex válido, no vale", () => {
  const cookie = firmarSesion(CONTRASENA, AHORA);
  const [expira, hex] = cookie.split(".");
  const primero = hex[0] === "0" ? "1" : "0";
  assert.equal(sesionValida(`${expira}.${primero}${hex.slice(1)}`, CONTRASENA, AHORA), false);
});

test("un expira alterado con el hex original no vale", () => {
  const [expira, hex] = firmarSesion(CONTRASENA, AHORA).split(".");
  const masLejos = String(Number(expira) + 1_000_000);
  assert.equal(sesionValida(`${masLejos}.${hex}`, CONTRASENA, AHORA), false);
});

test("las cookies mal formadas se rechazan sin lanzar", () => {
  const hexValido = firmarSesion(CONTRASENA, AHORA).split(".")[1];
  const malas: Array<string | undefined> = [
    undefined,
    "",
    "abc",
    "123.",
    ".abc",
    "1.2.3",
    `NaN.${"0".repeat(64)}`,
    `99999999999999999999.${hexValido}`,
    `${AHORA + DURACION_SESION_S}.${hexValido.slice(1)}`,
    `${AHORA + DURACION_SESION_S}.${hexValido}0`,
  ];
  for (const mala of malas) {
    assert.equal(sesionValida(mala, CONTRASENA, AHORA), false, `debió rechazar ${String(mala)}`);
  }
});

test("sin contraseña configurada ninguna cookie vale", () => {
  const cookie = firmarSesion(CONTRASENA, AHORA);
  assert.equal(sesionValida(cookie, null, AHORA), false);
});

test("una contraseña ausente, vacía o corta se trata como no configurada", () => {
  assert.equal(contrasenaConfigurada(undefined), null);
  assert.equal(contrasenaConfigurada(""), null);
  assert.equal(contrasenaConfigurada(" ".repeat(12)), null);
  assert.equal(contrasenaConfigurada("corta"), null);
  assert.equal(contrasenaConfigurada("12345678901"), null);
});

test("una contraseña de 12 caracteres o más se devuelve tal cual", () => {
  assert.equal(contrasenaConfigurada("123456789012"), "123456789012");
  assert.equal(contrasenaConfigurada("  con espacios  "), "  con espacios  ");
});

test("contrasenaCorrecta acepta solo la contraseña exacta", () => {
  assert.equal(contrasenaCorrecta(CONTRASENA, CONTRASENA), true);
  assert.equal(contrasenaCorrecta("", CONTRASENA), false);
  assert.equal(contrasenaCorrecta(`${CONTRASENA} `, CONTRASENA), false);
  assert.equal(contrasenaCorrecta(CONTRASENA.toUpperCase(), CONTRASENA), false);
});

test("contrasenaCorrecta no se rompe con un intento larguísimo", () => {
  assert.equal(contrasenaCorrecta("x".repeat(100_000), CONTRASENA), false);
});
