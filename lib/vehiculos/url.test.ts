import test from "node:test";
import assert from "node:assert/strict";

import type { Vehiculo } from "./types.ts";
import { escribirSeleccion, leerSeleccion, resolverSeleccion } from "./url.ts";

function v(
  marca: string,
  modelo: string,
  desde: number,
  hasta: number,
  version: string | null = null,
): Vehiculo {
  const slug = (t: string) => t.toLowerCase().replace(/ /g, "-");
  return {
    marca,
    marcaSlug: slug(marca),
    modelo,
    modeloSlug: slug(modelo),
    version,
    versionSlug: version ? slug(version) : null,
    desde,
    hasta,
    radio1din: null,
    radio2din: "directo",
    ubicaciones: [],
  };
}

const COROLLA_VIEJO = v("Toyota", "Corolla", 2003, 2008);
const COROLLA_GRIS = v("Toyota", "Corolla", 2009, 2013, "Tablero gris");
const COROLLA_NEGRO = v("Toyota", "Corolla", 2010, 2011, "Tablero negro");
const VEHICULOS = [
  v("Toyota", "Yaris", 2006, 2011),
  COROLLA_GRIS,
  v("Honda", "Civic", 2006, 2011),
  COROLLA_NEGRO,
  COROLLA_VIEJO,
];

test("leerSeleccion: lee los cuatro parámetros; un año que no es número no cuenta", () => {
  assert.deepEqual(leerSeleccion("vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris"), {
    marca: "toyota",
    modelo: "corolla",
    anio: 2010,
    version: "tablero-gris",
  });
  assert.equal(leerSeleccion("vehiculo=toyota&anio=abc").anio, undefined);
  assert.deepEqual(leerSeleccion("q=memphis&marca=memphis"), {});
});

test("escribirSeleccion: orden fijo, y sin un nivel al que le falta el anterior", () => {
  assert.equal(
    escribirSeleccion({ marca: "toyota", modelo: "corolla", anio: 2010, version: "tablero-gris" }),
    "vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris",
  );
  assert.equal(escribirSeleccion({ marca: "toyota", anio: 2010 }), "vehiculo=toyota");
  assert.equal(escribirSeleccion({}), "");
});

test("resolverSeleccion: marcas y modelos por nombre, años del más nuevo al más viejo", () => {
  const r = resolverSeleccion(VEHICULOS, { marca: "toyota", modelo: "corolla" });
  assert.deepEqual(
    r.opciones.marcas.map((o) => o.nombre),
    ["Honda", "Toyota"],
  );
  assert.deepEqual(
    r.opciones.modelos.map((o) => o.nombre),
    ["Corolla", "Yaris"],
  );
  assert.deepEqual(
    r.opciones.anios,
    [2013, 2012, 2011, 2010, 2009, 2008, 2007, 2006, 2005, 2004, 2003],
  );
  assert.equal(r.anio, null);
  assert.equal(r.vehiculo, null);
});

test("resolverSeleccion: un valor que no existe deja el selector en ese nivel", () => {
  const r = resolverSeleccion(VEHICULOS, { marca: "toyota", modelo: "camry", anio: 2010 });
  assert.equal(r.marca?.nombre, "Toyota");
  assert.equal(r.modelo, null);
  assert.equal(r.anio, null);
  assert.equal(r.vehiculo, null);
  assert.deepEqual(
    r.opciones.modelos.map((o) => o.nombre),
    ["Corolla", "Yaris"],
  );

  const sinMarca = resolverSeleccion(VEHICULOS, { marca: "zzz" });
  assert.equal(sinMarca.marca, null);
  assert.deepEqual(sinMarca.opciones.modelos, []);

  const anioFuera = resolverSeleccion(VEHICULOS, { marca: "honda", modelo: "civic", anio: 2020 });
  assert.equal(anioFuera.modelo?.nombre, "Civic");
  assert.equal(anioFuera.anio, null);
});

test("resolverSeleccion: una sola fila con versión no se elige sola; hay que elegir la versión", () => {
  // Civic 2016–2018 «LX o Sport»: el dueño de un EX tiene que ver que esa
  // fila no es la suya antes de ver resultados.
  const unaSola = resolverSeleccion(VEHICULOS, { marca: "toyota", modelo: "corolla", anio: 2012 });
  assert.deepEqual(
    unaSola.opciones.versiones.map((o) => o.nombre),
    ["Tablero gris"],
  );
  assert.equal(unaSola.vehiculo, null);
  assert.equal(unaSola.version, null);

  const elegida = resolverSeleccion(VEHICULOS, {
    marca: "toyota",
    modelo: "corolla",
    anio: 2012,
    version: "tablero-gris",
  });
  assert.equal(elegida.vehiculo, COROLLA_GRIS);
  assert.equal(elegida.version?.nombre, "Tablero gris");

  const vieja = resolverSeleccion(VEHICULOS, {
    marca: "toyota",
    modelo: "corolla",
    anio: 2012,
    version: "tablero-negro",
  });
  assert.equal(vieja.vehiculo, null);
  assert.equal(vieja.anio, 2012);
});

test("resolverSeleccion: «Versión» con más de una", () => {
  const dos = resolverSeleccion(VEHICULOS, { marca: "toyota", modelo: "corolla", anio: 2010 });
  assert.deepEqual(
    dos.opciones.versiones.map((o) => o.nombre),
    ["Tablero gris", "Tablero negro"],
  );
  assert.equal(dos.vehiculo, null);
  assert.equal(dos.version, null);

  const elegida = resolverSeleccion(VEHICULOS, {
    marca: "toyota",
    modelo: "corolla",
    anio: 2010,
    version: "tablero-negro",
  });
  assert.equal(elegida.vehiculo, COROLLA_NEGRO);
});

test("resolverSeleccion: con un solo vehículo en el año, una versión de más no rompe", () => {
  const r = resolverSeleccion(VEHICULOS, {
    marca: "toyota",
    modelo: "corolla",
    anio: 2005,
    version: "tablero-negro",
  });
  assert.equal(r.vehiculo, COROLLA_VIEJO);
  assert.equal(r.version, null);
});
