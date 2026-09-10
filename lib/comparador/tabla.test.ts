import test from "node:test";
import assert from "node:assert/strict";

import { construirFilas, SIN_DATO } from "./tabla.ts";
import type { Producto, Spec } from "../catalog/types.ts";

function producto(sku: string, specsFicha: Spec[]): Producto {
  return {
    sku,
    slug: sku.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    nombre: sku,
    marca: "Sonoro",
    categoria: "Subwoofers",
    descripcionCorta: "—",
    specsDestacadas: [
      { etiqueta: "A", valor: "1" },
      { etiqueta: "B", valor: "2" },
      { etiqueta: "C", valor: "3" },
    ],
    specsFicha,
    precioCents: 100000,
    moneda: "GTQ",
    disponibilidad: "disponible",
    imagenes: [],
    destacado: false,
    activo: true,
  };
}

const spec = (etiqueta: string, valor: string): Spec => ({ etiqueta, valor });

test("tabla: sin productos devuelve una tabla vacía, no lanza", () => {
  assert.deepEqual(construirFilas([]), []);
});

test("tabla: con un solo producto nada difiere", () => {
  const filas = construirFilas([producto("A", [spec("Tamaño", '12"'), spec("RMS", "600 W")])]);
  assert.deepEqual(
    filas.map((f) => [f.etiqueta, f.valores, f.comparable, f.difieren]),
    [
      ["Tamaño", ['12"'], true, false],
      ["RMS", ["600 W"], true, false],
    ],
  );
});

test("tabla: la unión sigue el orden editorial del PRIMER producto", () => {
  // CLAUDE.md § Esquema de producto: el orden de las specs es decisión
  // editorial y debe respetarse — nada de ordenar alfabéticamente.
  const a = producto("A", [spec("Zeta", "1"), spec("Alfa", "2")]);
  const b = producto("B", [spec("Alfa", "3"), spec("Beta", "4")]);
  assert.deepEqual(
    construirFilas([a, b]).map((f) => f.etiqueta),
    ["Zeta", "Alfa", "Beta"],
  );
});

test("tabla: una etiqueta que solo tiene un producto se rellena y NO se marca", () => {
  const a = producto("A", [spec("RMS", "600 W")]);
  const b = producto("B", [spec("Montaje", "Sellada")]);
  const filas = construirFilas([a, b]);

  assert.deepEqual(filas, [
    { etiqueta: "RMS", valores: ["600 W", SIN_DATO], comparable: false, difieren: false },
    { etiqueta: "Montaje", valores: [SIN_DATO, "Sellada"], comparable: false, difieren: false },
  ]);
});

test("tabla: solo se marca cuando TODAS las columnas traen dato y difieren", () => {
  const a = producto("A", [spec("Tamaño", '12"'), spec("Bobina", "2 Ω"), spec("RMS", "600 W")]);
  const b = producto("B", [spec("Tamaño", '12"'), spec("Bobina", "4 Ω")]);
  const filas = construirFilas([a, b]);
  const porEtiqueta = Object.fromEntries(filas.map((f) => [f.etiqueta, f]));

  assert.equal(porEtiqueta["Tamaño"].difieren, false, "iguales: no se marca");
  assert.equal(porEtiqueta["Bobina"].difieren, true, "distintos y completos: se marca");
  assert.equal(porEtiqueta["RMS"].difieren, false, "hueco: no es diferencia, es dato ausente");
  assert.equal(porEtiqueta["RMS"].comparable, false);
});

test("tabla: etiqueta repetida dentro de un mismo producto no pierde el segundo valor", () => {
  // Forma real de X317-STG6 y X317-STG4 (repiten «Instalación») y de M71512
  // (repite «Serie» y «Aplicación»). specsFicha solo valida .min(4).max(10),
  // no unicidad de etiqueta, así que un find() se quedaría con el primero.
  const a = producto("X317-STG6", [
    spec("Instalación", "Puertas delanteras"),
    spec("Instalación", "Puertas traseras"),
    spec("Calibre", "18 AWG"),
  ]);
  const b = producto("X317-STG4", [
    spec("Instalación", "Puertas delanteras"),
    spec("Calibre", "18 AWG"),
  ]);
  const filas = construirFilas([a, b]);
  const instalacion = filas.find((f) => f.etiqueta === "Instalación");

  assert.ok(instalacion);
  assert.deepEqual(instalacion.valores, [
    "Puertas delanteras · Puertas traseras",
    "Puertas delanteras",
  ]);
  assert.equal(instalacion.difieren, true);
  // Una sola fila «Instalación», no dos.
  assert.equal(filas.filter((f) => f.etiqueta === "Instalación").length, 1);
});

test("tabla: el orden de las columnas es el de los productos que se pasan", () => {
  const a = producto("A", [spec("RMS", "600 W")]);
  const b = producto("B", [spec("RMS", "500 W")]);
  assert.deepEqual(construirFilas([a, b])[0].valores, ["600 W", "500 W"]);
  assert.deepEqual(construirFilas([b, a])[0].valores, ["500 W", "600 W"]);
});

test("tabla: con cuatro productos, una fila completa e igual no se marca", () => {
  const mismos = ["A", "B", "C", "D"].map((sku) => producto(sku, [spec("Tamaño", '12"')]));
  const filas = construirFilas(mismos);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].comparable, true);
  assert.equal(filas[0].difieren, false);
});
