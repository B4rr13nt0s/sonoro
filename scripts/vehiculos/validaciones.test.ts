import test from "node:test";
import assert from "node:assert/strict";

import { slugificar } from "../slug.ts";
import type { Vehiculo } from "../../lib/vehiculos/types.ts";
import type { FilaVehiculo } from "./filas.ts";
import { problemasEntreFilas } from "./validaciones.ts";

function fila(numero: number, revisado: boolean, v: Partial<Vehiculo> = {}): FilaVehiculo {
  const marca = v.marca ?? "Toyota";
  const modelo = v.modelo ?? "Corolla";
  const version = v.version ?? null;
  return {
    numero,
    revisado,
    vehiculo: {
      marca,
      marcaSlug: slugificar(marca),
      modelo,
      modeloSlug: slugificar(modelo),
      version,
      versionSlug: version ? slugificar(version) : null,
      desde: 2009,
      hasta: 2013,
      radio1din: null,
      radio2din: "directo",
      ubicaciones: [],
      ...v,
    },
  };
}

test("mismo modelo, años cruzados y sin versión: se anota en las dos", () => {
  const p = problemasEntreFilas([fila(2, true), fila(3, true, { desde: 2012, hasta: 2015 })]);
  assert.match(p.get(2)?.join() ?? "", /fila 3/);
  assert.match(p.get(3)?.join() ?? "", /fila 2/);
});

test("cruzadas con la misma versión, o una con versión y otra sin: las dos", () => {
  const misma = problemasEntreFilas([
    fila(2, true, { version: "Tablero gris" }),
    fila(3, true, { version: "Tablero gris", desde: 2013, hasta: 2015 }),
  ]);
  assert.deepEqual([...misma.keys()].sort(), [2, 3]);

  const unaSin = problemasEntreFilas([
    fila(2, true, { version: "Tablero gris" }),
    fila(3, true, { desde: 2010, hasta: 2011 }),
  ]);
  assert.deepEqual([...unaSin.keys()].sort(), [2, 3]);
});

test("versiones distintas, años que no se tocan u otro modelo: sin problema", () => {
  assert.equal(
    problemasEntreFilas([
      fila(2, true, { hasta: 2011 }),
      fila(3, true, { desde: 2012, hasta: 2015 }),
    ]).size,
    0,
  );
  assert.equal(
    problemasEntreFilas([
      fila(2, true, { version: "Tablero gris" }),
      fila(3, true, { version: "Tablero negro", desde: 2010, hasta: 2011 }),
    ]).size,
    0,
  );
  assert.equal(problemasEntreFilas([fila(2, true), fila(3, true, { modelo: "Yaris" })]).size, 0);
});

test("cruce con una fila sin revisar: se anota solo en la sin revisar", () => {
  const p = problemasEntreFilas([fila(2, true), fila(3, false, { desde: 2012, hasta: 2015 })]);
  assert.equal(p.has(2), false);
  assert.match(p.get(3)?.join() ?? "", /fila 2/);
});

test("dos grafías que dan el mismo slug: marca, modelo o versión", () => {
  const marca = problemasEntreFilas([
    fila(2, true, { marca: "Mazda", modelo: "3" }),
    fila(3, true, { marca: "MAZDA", modelo: "CX-5" }),
  ]);
  assert.deepEqual([...marca.keys()].sort(), [2, 3]);
  assert.match(marca.get(2)?.join() ?? "", /Mazda.*MAZDA|MAZDA.*Mazda/);

  const modelo = problemasEntreFilas([
    fila(2, true, { marca: "Honda", modelo: "CR-V", hasta: 2011 }),
    fila(3, true, { marca: "Honda", modelo: "Cr-V", desde: 2012, hasta: 2016 }),
  ]);
  assert.deepEqual([...modelo.keys()].sort(), [2, 3]);

  const version = problemasEntreFilas([
    fila(2, true, { version: "Tablero gris", hasta: 2011 }),
    fila(3, true, { version: "Tablero Gris", desde: 2012, hasta: 2015 }),
  ]);
  assert.deepEqual([...version.keys()].sort(), [2, 3]);
});

test("grafías distintas, con una sin revisar: solo la sin revisar", () => {
  const p = problemasEntreFilas([
    fila(2, true, { marca: "Mazda", modelo: "3" }),
    fila(3, false, { marca: "MAZDA", modelo: "CX-5" }),
  ]);
  assert.deepEqual([...p.keys()], [3]);
});

test("dos grafías revisadas chocan aunque una tercera, sin revisar, comparta el slug", () => {
  const p = problemasEntreFilas([
    fila(2, true, { marca: "Mazda", modelo: "3" }),
    fila(3, true, { marca: "MAZDA", modelo: "CX-5" }),
    fila(4, false, { marca: "mazda", modelo: "Protegé" }),
  ]);
  assert.deepEqual([...p.keys()].sort(), [2, 3, 4]);
  assert.match(p.get(2)?.join() ?? "", /«Mazda» y «MAZDA»/);
  assert.doesNotMatch(p.get(2)?.join() ?? "", /«mazda»/);
});
