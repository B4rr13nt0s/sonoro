import test from "node:test";
import assert from "node:assert/strict";

import type { Celda } from "../catalogo/contrato.ts";
import { importarVehiculos } from "./importar.ts";
import { FILA_VALIDA, filaVehiculo, libroVehiculos } from "./libro-de-prueba.ts";

const ctx = { skusCatalogo: new Set(["KSM-8", "OEMBKT60", "OEMBKT69"]), anioActual: 2026 };

function fila(valores: Record<string, Celda> = {}): Celda[] {
  return filaVehiculo({ ...FILA_VALIDA, ...valores });
}

test("el contrato roto aborta", () => {
  const r = importarVehiculos(libroVehiculos({ hojas: ["VEHICULOS"] }), ctx);
  assert.equal(r.tipo, "abortar");
});

test("sin ninguna fila publicable aborta, y lista los problemas del borrador", () => {
  const r = importarVehiculos(
    libroVehiculos({
      vehiculos: [fila({ revisado: "no" }), fila({ revisado: "no", desde: 1900, modelo: "Yaris" })],
    }),
    ctx,
  );
  assert.equal(r.tipo, "abortar");
  assert.ok(r.tipo === "abortar");
  assert.match(r.motivos[0], /ninguna fila/i);
  assert.ok(
    r.motivos.some((m) => m.includes("fila 3") && m.includes("desde")),
    r.motivos.join("\n"),
  );
});

test("también aborta si todas las revisadas están rechazadas", () => {
  const r = importarVehiculos(libroVehiculos({ vehiculos: [fila({ desde: 1900 })] }), ctx);
  assert.equal(r.tipo, "abortar");
  assert.ok(r.tipo === "abortar");
  assert.ok(r.motivos.some((m) => m.includes("fila 2") && m.includes("desde")));
});

test("con una fila rechazada no hay archivo, pero sí reporte", () => {
  const r = importarVehiculos(
    libroVehiculos({ vehiculos: [fila(), fila({ modelo: "Yaris", radio_1din: "x" })] }),
    ctx,
  );
  assert.equal(r.tipo, "listo");
  assert.ok(r.tipo === "listo");
  assert.equal(r.archivo, null);
  assert.equal(r.rechazadas, 1);
  assert.equal(r.publicadas, 1);
  assert.ok(r.reporte.includes("## Filas rechazadas"));
  assert.ok(r.reporte.includes("VEHICULOS fila 3"));
});

test("revisado = no: no se publica, y sus problemas van a «Filas sin revisar» sin frenar", () => {
  const r = importarVehiculos(
    libroVehiculos({
      vehiculos: [fila(), fila({ modelo: "Yaris", revisado: "no", radio_1din: "x" })],
    }),
    ctx,
  );
  assert.equal(r.tipo, "listo");
  assert.ok(r.tipo === "listo");
  assert.notEqual(r.archivo, null);
  assert.equal(r.archivo?.vehiculos.length, 1);
  assert.equal(r.rechazadas, 0);
  assert.equal(r.sinRevisar, 1);
  const sinRevisar = r.reporte.slice(r.reporte.indexOf("## Filas sin revisar"));
  assert.ok(sinRevisar.includes("fila 3"), r.reporte);
});

test("una fila del borrador que se cruza con una revisada no la despublica", () => {
  const r = importarVehiculos(
    libroVehiculos({ vehiculos: [fila(), fila({ revisado: "no", desde: 2012, hasta: 2015 })] }),
    ctx,
  );
  assert.ok(r.tipo === "listo");
  assert.equal(r.rechazadas, 0);
  assert.equal(r.archivo?.vehiculos.length, 1);
});

test("el orden de salida es determinista", () => {
  const filas = [
    fila({ modelo: "Yaris", desde: 2006, hasta: 2011 }),
    fila({ marca: "Honda", modelo: "Civic", desde: 2006, hasta: 2011 }),
    fila({ desde: 2009, hasta: 2013 }),
    fila({ desde: 2003, hasta: 2008 }),
  ];
  const ida = importarVehiculos(libroVehiculos({ vehiculos: filas }), ctx);
  const vuelta = importarVehiculos(libroVehiculos({ vehiculos: [...filas].reverse() }), ctx);
  assert.ok(ida.tipo === "listo" && vuelta.tipo === "listo");
  assert.equal(JSON.stringify(ida.archivo), JSON.stringify(vuelta.archivo));
  assert.deepEqual(
    ida.archivo?.vehiculos.map((v) => `${v.modeloSlug} ${v.desde}`),
    ["civic 2006", "corolla 2003", "corolla 2009", "yaris 2006"],
  );
});

test("schemaVersion es 1", () => {
  const r = importarVehiculos(libroVehiculos(), ctx);
  assert.ok(r.tipo === "listo");
  assert.equal(r.archivo?.schemaVersion, 1);
});
