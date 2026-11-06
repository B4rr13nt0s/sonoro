import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { ProductoBuscable } from "../busqueda/busqueda.ts";
import type { Vehiculo } from "../vehiculos/types.ts";
import {
  etiquetaGeneracion,
  generaciones,
  leerVehiculo,
  nombresAmbiguos,
  tieneFraseVehiculo,
} from "./vehiculo.ts";

const VEHICULOS = (
  JSON.parse(readFileSync("data/vehiculos.json", "utf-8")) as { vehiculos: Vehiculo[] }
).vehiculos;
const AMBIGUOS = new Set(["fit", "protege"]);

function leer(texto: string) {
  return leerVehiculo(texto, VEHICULOS, AMBIGUOS, 2026);
}

function producto(sku: string, nombre: string): ProductoBuscable {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre,
    marca: "Memphis",
    categoria: "Accesorios",
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
  };
}

test("los slugs de las pruebas existen en el libro", () => {
  const slugs = new Set(VEHICULOS.map((v) => v.modeloSlug));
  for (const s of ["corolla", "civic-si", "corolla-im", "cr-v", "rav4", "cx-5", "4runner", "fit"]) {
    assert.ok(slugs.has(s), s);
  }
  for (const s of AMBIGUOS) assert.ok(slugs.has(s), s);
});

test("leerVehiculo: modelo y año, con o sin marca", () => {
  const esperado = { marca: "toyota", modelo: "corolla", anio: 2010 };
  assert.deepEqual(leer("corolla 2010"), esperado);
  assert.deepEqual(leer("¿Qué le queda a mi Toyota Corolla 2010?"), esperado);
});

test("leerVehiculo: gana el nombre más largo", () => {
  assert.deepEqual(leer("civic si 2004"), { marca: "honda", modelo: "civic-si", anio: 2004 });
  assert.equal(leer("corolla im")?.modelo, "corolla-im");
  assert.equal(leer("civic 2010")?.modelo, "civic");
});

test("leerVehiculo: sin separadores o con otros", () => {
  assert.equal(leer("crv 2010")?.modelo, "cr-v");
  assert.equal(leer("CR-V 2010")?.modelo, "cr-v");
  assert.equal(leer("cr v")?.modelo, "cr-v");
  assert.equal(leer("rav 4")?.modelo, "rav4");
  assert.equal(leer("rav4")?.modelo, "rav4");
  assert.equal(leer("cx5")?.modelo, "cx-5");
  assert.deepEqual(leer("4runner 2005"), { marca: "toyota", modelo: "4runner", anio: 2005 });
});

test("leerVehiculo: un nombre ambiguo pide marca o año", () => {
  assert.equal(leer("fit"), null);
  assert.deepEqual(leer("honda fit"), { marca: "honda", modelo: "fit" });
  assert.deepEqual(leer("fit 2010"), { marca: "honda", modelo: "fit", anio: 2010 });
  assert.deepEqual(leer("protege 2001"), { marca: "mazda", modelo: "protege", anio: 2001 });
  assert.equal(leer("funda para proteger"), null);
});

test("leerVehiculo: solo la marca", () => {
  assert.deepEqual(leer("toyota"), { marca: "toyota" });
  assert.deepEqual(leer("qué le queda a mi toyota 2010"), { marca: "toyota", anio: 2010 });
});

test("leerVehiculo: lo que no está en la lista no es un vehículo", () => {
  assert.equal(leer("hilux 2015"), null);
  assert.equal(leer("sub 12 memphis"), null);
  assert.equal(leer(""), null);
});

test("leerVehiculo: el año escrito, válido o no para el modelo, dentro de 1940…año + 1", () => {
  assert.equal(leer("corolla 1980")?.anio, 1980);
  assert.equal(leer("corolla 2027")?.anio, 2027);
  assert.equal(leer("corolla 2099")?.anio, undefined);
  assert.equal(leer("corolla 1939")?.anio, undefined);
});

test("tieneFraseVehiculo", () => {
  assert.equal(tieneFraseVehiculo("¿Qué le queda a mi carro?"), true);
  assert.equal(tieneFraseVehiculo("cual le queda"), true);
  assert.equal(tieneFraseVehiculo("qué le cabe"), true);
  assert.equal(tieneFraseVehiculo("qué cabe en mi carro"), true);
  assert.equal(tieneFraseVehiculo("radio para mi carro"), false);
  assert.equal(tieneFraseVehiculo("cuál es mejor"), false);
});

test("generaciones: rangos distintos, del más nuevo al más viejo", () => {
  const corolla = generaciones(VEHICULOS, "toyota", "corolla");
  assert.deepEqual(corolla[0], { desde: 2003, hasta: 2018 });
  for (let i = 1; i < corolla.length; i += 1) assert.ok(corolla[i - 1].desde > corolla[i].desde);
  // Elantra 2007–2010 tiene dos versiones: un solo rango.
  const elantra = generaciones(VEHICULOS, "hyundai", "elantra");
  assert.equal(elantra.filter((g) => g.desde === 2007).length, 1);
  assert.deepEqual(generaciones(VEHICULOS, "toyota", "no-existe"), []);
});

test("etiquetaGeneracion", () => {
  assert.equal(etiquetaGeneracion({ desde: 2003, hasta: 2018 }), "2003–2018");
  assert.equal(etiquetaGeneracion({ desde: 2018, hasta: 2018 }), "2018");
});

test("nombresAmbiguos: los modelos que la búsqueda encuentra como producto", () => {
  const ambiguos = nombresAmbiguos(VEHICULOS, [
    producto("KIT-FIT", "Kit de ajuste Fit"),
    producto("SQ12", "Subwoofer Serie SQ"),
  ]);
  assert.ok(ambiguos.has("fit"));
  assert.ok(!ambiguos.has("corolla"));
});
