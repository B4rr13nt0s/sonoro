import test from "node:test";
import assert from "node:assert/strict";

import { textoGrupoVacio, tituloGrupo, tituloVehiculo } from "./textos.ts";
import type { Vehiculo } from "./types.ts";

const COROLLA: Vehiculo = {
  marca: "Toyota",
  marcaSlug: "toyota",
  modelo: "Corolla",
  modeloSlug: "corolla",
  version: null,
  versionSlug: null,
  desde: 2009,
  hasta: 2013,
  radio1din: null,
  radio2din: "directo",
  ubicaciones: [],
};

test("tituloVehiculo: con y sin versión", () => {
  assert.equal(tituloVehiculo(COROLLA, 2010), "Toyota Corolla 2010");
  assert.equal(
    tituloVehiculo({ ...COROLLA, version: "Tablero gris", versionSlug: "tablero-gris" }, 2010),
    "Toyota Corolla 2010 · Tablero gris",
  );
});

test("tituloGrupo: una o varias medidas", () => {
  assert.equal(
    tituloGrupo({ ubicacion: "Puertas delanteras", medidas: ['6.5"'] }),
    'Puertas delanteras · 6.5"',
  );
  assert.equal(
    tituloGrupo({ ubicacion: "Puertas delanteras", medidas: ['5.25"', '6.5"'] }),
    'Puertas delanteras · 5.25" o 6.5"',
  );
});

test("textoGrupoVacio: nombra la medida solo si es una", () => {
  assert.equal(textoGrupoVacio({ medidas: ['6x8"'] }), 'No hay bocinas de 6x8" en el catálogo.');
  assert.equal(
    textoGrupoVacio({ medidas: ['5x7"', '6x8"'] }),
    "No hay bocinas de esas medidas en el catálogo.",
  );
});
