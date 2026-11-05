import test from "node:test";
import assert from "node:assert/strict";

import { RUTA_DATOS_VEHICULOS, descargarDatosVehiculos } from "./carga.ts";

const DATOS = { vehiculos: [], receptores: [], bocinas: [], piezas: [] };

test("pide la ruta de los datos y los devuelve con una respuesta válida", async () => {
  let pedida = "";
  const resultado = await descargarDatosVehiculos(async (url) => {
    pedida = String(url);
    return Response.json(DATOS);
  });
  assert.equal(pedida, RUTA_DATOS_VEHICULOS);
  assert.equal(RUTA_DATOS_VEHICULOS, "/buscar/vehiculos.json");
  assert.deepEqual(resultado, DATOS);
});

test("null con una respuesta que no es OK", async () => {
  assert.equal(await descargarDatosVehiculos(async () => new Response("", { status: 500 })), null);
});

test("null si fetch lanza", async () => {
  assert.equal(
    await descargarDatosVehiculos(async () => {
      throw new TypeError("Failed to fetch");
    }),
    null,
  );
});

test("null con un JSON ajeno", async () => {
  assert.equal(await descargarDatosVehiculos(async () => Response.json({ productos: [] })), null);
});

test("null si la descarga se traba más que el plazo", async () => {
  const trabado: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  assert.equal(await descargarDatosVehiculos(trabado, 20), null);
});
