import test from "node:test";
import assert from "node:assert/strict";

import {
  lineaConsultar,
  lineaReceptores,
  lineaUbicacion,
  notaReceptor,
  TEXTO_PEDIR_VEHICULO,
  textoFueraDeLista,
  textoGrupoVacio,
  textoPedirAnio,
  textoPedirModelo,
  textoPedirVersion,
  tituloConRango,
  tituloGrupo,
  tituloVehiculo,
} from "./textos.ts";
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

test("notaReceptor: la DMH-A5650BT lleva su anotación; los demás, ninguna", () => {
  assert.equal(
    notaReceptor("DMH-A5650BT"),
    "Utiliza un chasis trasero de 1-DIN, pero cuenta con una pantalla frontal de 2-DIN.",
  );
  assert.equal(notaReceptor("DMH-G225BT"), null);
});

test("los textos del chat para pedir el vehículo", () => {
  assert.equal(
    TEXTO_PEDIR_VEHICULO,
    "Escribe la marca, el modelo y el año de tu carro, por ejemplo «Toyota Corolla 2010».",
  );
  assert.equal(textoPedirModelo("Toyota"), "¿Qué modelo de Toyota?");
  assert.equal(textoPedirAnio("Toyota", "Corolla"), "¿De qué año es tu Toyota Corolla?");
  assert.equal(
    textoFueraDeLista("Toyota", "Corolla", 1980),
    "No tengo el Toyota Corolla 1980 en la lista.",
  );
  assert.equal(textoPedirVersion("Hyundai Elantra 2008"), "¿Cuál es tu Hyundai Elantra 2008?");
  assert.equal(tituloConRango(COROLLA, "2009–2013"), "Toyota Corolla 2009–2013");
  assert.equal(
    tituloConRango({ ...COROLLA, version: "LX o Sport" }, "2016–2018"),
    "Toyota Corolla 2016–2018 · LX o Sport",
  );
});

test("lineaReceptores: por estado, en singular o plural", () => {
  assert.equal(
    lineaReceptores({ cabe: 4, conAccesorios: 6 }),
    "Receptores: 4 caben y 6 caben con accesorios.",
  );
  assert.equal(
    lineaReceptores({ cabe: 0, conAccesorios: 10 }),
    "Receptores: 10 caben con accesorios.",
  );
  assert.equal(lineaReceptores({ cabe: 1, conAccesorios: 0 }), "Receptores: 1 cabe.");
  assert.equal(
    lineaReceptores({ cabe: 0, conAccesorios: 1 }),
    "Receptores: 1 cabe con accesorios.",
  );
});

test("lineaConsultar", () => {
  assert.equal(
    lineaConsultar('Pantalla de 9" DMH-AP6650BT'),
    'Pantalla de 9" DMH-AP6650BT: también puede ir, pero su marco depende del vehículo; escríbenos por WhatsApp.',
  );
});

test("lineaUbicacion: el estado de la ubicación, y la pieza como enlace", () => {
  const grupo = { ubicacion: "Puertas delanteras", medidas: ['6.5"'] };
  assert.deepEqual(lineaUbicacion(grupo, 34, { tipo: "cabe" }), {
    texto: 'Puertas delanteras · 6.5": 34 bocinas, caben.',
  });
  assert.deepEqual(lineaUbicacion(grupo, 1, { tipo: "con_accesorios" }), {
    texto: 'Puertas delanteras · 6.5": 1 bocina, cabe con accesorios.',
  });
  assert.deepEqual(
    lineaUbicacion(grupo, 34, {
      tipo: "con_pieza",
      pieza: { sku: "KSM-8", slug: "ksm-8", nombre: 'Alza para bocinas de 6.5"' },
    }),
    {
      texto: 'Puertas delanteras · 6.5": 34 bocinas, caben con',
      enlace: { etiqueta: 'Alza para bocinas de 6.5"', href: "/producto/ksm-8", despues: "." },
    },
  );
});
