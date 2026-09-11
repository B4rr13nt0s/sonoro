import test from "node:test";
import assert from "node:assert/strict";

import type { Celda, FilaCruda } from "./contrato.ts";
import { COLUMNAS_CSV, serializarCsv } from "./csv.ts";
import type { NombreHoja } from "./hojas.ts";

function fila(hoja: NombreHoja, numero: number, celdas: Record<string, Celda>): FilaCruda {
  return { hoja, numero, celdas };
}

const FILAS: FilaCruda[] = [
  fila("SUBWOOFERS", 2, { sku: "SQ12-D2", precio: 2450, destacado: "VERDADERO" }),
  fila("SUBWOOFERS", 3, { sku: "COR-S124D", precio: 1350.29, destacado: true }),
  fila("BOCINAS", 2, { sku: "MJP800.4", nombre: 'Bocina 6x9", coaxial' }),
  fila("BOCINAS", 3, { sku: "ACX 165", nombre: 'Dice "hola"' }),
  fila("ACCESORIOS", 2, { sku: "KDB-201", descripcion_corta: " con espacio" }),
  fila("INSONORIZACION", 2, { sku: "ROLLER", espesor_mm: 2 }),
  fila("ESPECIALES", 2, { sku: "X317-STG6", categorias: "Subwoofers, Bocinas" }),
  // Filas rechazadas por sku vacío: también van, y pueden repetirse.
  fila("KITS", 2, { sku: null, nombre: "Sin código" }),
  fila("KITS", 3, { sku: null, nombre: "Otro sin código" }),
];

function barajar<T>(lista: readonly T[], semilla: number): T[] {
  const copia = [...lista];
  let s = semilla;
  for (let i = copia.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

test("determinista: el orden de entrada no cambia ni un byte", () => {
  const referencia = serializarCsv(FILAS);
  assert.equal(serializarCsv([...FILAS].reverse()), referencia);
  for (const semilla of [1, 7, 42, 2026]) {
    assert.equal(serializarCsv(barajar(FILAS, semilla)), referencia, `semilla ${semilla}`);
  }
});

test("orden: por categoría y luego por sku, en puntos de código", () => {
  const lineas = serializarCsv(FILAS).trimEnd().split("\n").slice(1);
  const clave = (linea: string) => linea.split(",").slice(0, 2).join(",");
  assert.deepEqual(lineas.map(clave), [
    "Accesorios,KDB-201",
    "Bocinas,ACX 165",
    "Bocinas,MJP800.4",
    "Insonorización,ROLLER",
    "Kits,",
    "Kits,",
    "Sistemas,X317-STG6",
    "Subwoofers,COR-S124D",
    "Subwoofers,SQ12-D2",
  ]);
});

test("columnas: orden fijo en código, categoria derivada de la hoja", () => {
  const [encabezado] = serializarCsv(FILAS).split("\n");
  assert.equal(encabezado, COLUMNAS_CSV.join(","));
  assert.deepEqual(COLUMNAS_CSV.slice(0, 3), ["categoria", "sku", "slug"]);
  assert.equal(COLUMNAS_CSV.at(-1), "spec_10_valor");
  assert.equal(new Set(COLUMNAS_CSV).size, COLUMNAS_CSV.length);
});

test("celdas: número canónico, booleano, vacío y comillas solo cuando hacen falta", () => {
  const csv = serializarCsv(FILAS);
  const linea = (sku: string) => csv.split("\n").find((l) => l.split(",")[1] === sku) ?? "";
  const columna = (nombre: string) => COLUMNAS_CSV.indexOf(nombre);

  const sq = linea("SQ12-D2").split(",");
  assert.equal(sq[columna("precio")], "2450");
  assert.equal(sq[columna("destacado")], "VERDADERO");
  assert.equal(sq[columna("precio_antes")], "");
  assert.equal(linea("COR-S124D").split(",")[columna("precio")], "1350.29");
  assert.equal(linea("COR-S124D").split(",")[columna("destacado")], "VERDADERO");

  assert.ok(csv.includes('"Bocina 6x9"", coaxial"'));
  assert.ok(csv.includes('"Dice ""hola"""'));
  assert.ok(csv.includes('" con espacio"'));
  assert.ok(csv.includes('"Subwoofers, Bocinas"'));
});

test("archivo: finales \\n, sin BOM, con salto final", () => {
  const csv = serializarCsv(FILAS);
  assert.ok(!csv.includes("\r"));
  assert.notEqual(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.endsWith("\n") && !csv.endsWith("\n\n"));
});
