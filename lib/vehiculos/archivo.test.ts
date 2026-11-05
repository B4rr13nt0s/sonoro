import test from "node:test";
import assert from "node:assert/strict";

import { parsearVehiculosArchivo } from "./archivo.ts";
import type { Vehiculo } from "./types.ts";

const COROLLA: Vehiculo = {
  marca: "Toyota",
  marcaSlug: "toyota",
  modelo: "Corolla",
  modeloSlug: "corolla",
  version: "Tablero gris",
  versionSlug: "tablero-gris",
  desde: 2009,
  hasta: 2013,
  radio1din: "con_marco",
  radio2din: "directo",
  ubicaciones: [
    { ubicacion: "Puertas delanteras", medidas: ['5.25"', '6.5"'], accesorio: "KSM-8" },
    { ubicacion: "Bandeja trasera", medidas: ['6x9"'], accesorio: null },
  ],
};

test("parsearVehiculosArchivo: devuelve los vehículos de un archivo válido", () => {
  assert.deepEqual(parsearVehiculosArchivo({ schemaVersion: 1, vehiculos: [COROLLA] }), [COROLLA]);
});

test("parsearVehiculosArchivo: otro schemaVersion lanza", () => {
  assert.throws(
    () => parsearVehiculosArchivo({ schemaVersion: 2, vehiculos: [] }),
    /schemaVersion/,
  );
});

test("parsearVehiculosArchivo: un radio fuera de lista lanza", () => {
  assert.throws(
    () =>
      parsearVehiculosArchivo({ schemaVersion: 1, vehiculos: [{ ...COROLLA, radio1din: "sí" }] }),
    /radio1din/,
  );
});
