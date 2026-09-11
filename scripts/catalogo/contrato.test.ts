import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { leerLibro, validarLibro, type Celda } from "./contrato.ts";
import {
  COMUN,
  HOJAS_IGNORADAS,
  NOMBRES_HOJAS,
  columnasEspecificas,
  defHoja,
  type NombreHoja,
} from "./hojas.ts";

// Libros sintéticos en memoria: estas pruebas fijan el CONTRATO, no el libro
// real. Cada hoja arranca con sus encabezados correctos y una fila válida.
function encabezados(hoja: NombreHoja): string[] {
  return [...COMUN, ...columnasEspecificas(defHoja(hoja))];
}

function fila(hoja: NombreHoja, sku: string, extra: Record<string, Celda> = {}): Celda[] {
  const valores: Record<string, Celda> = {
    sku,
    slug: sku.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    nombre: `Producto ${sku}`,
    marca: "KBT",
    descripcion_corta: "—",
    precio: 100,
    disponibilidad: "disponible",
    destacado: "FALSO",
    activo: "VERDADERO",
    categorias: hoja === "ESPECIALES" ? "Subwoofers, Bocinas" : null,
    ...extra,
  };
  return encabezados(hoja).map((h) => valores[h] ?? null);
}

function libroValido() {
  const hojas = new Map<string, Celda[][]>();
  for (const hoja of HOJAS_IGNORADAS) hojas.set(hoja, [["nota para quien edita"]]);
  for (const hoja of NOMBRES_HOJAS) hojas.set(hoja, [encabezados(hoja), fila(hoja, `${hoja}-1`)]);
  return { nombresHojas: [...hojas.keys()], hojas };
}

test("libro válido: sin ofensores, una fila por hoja", () => {
  const { ofensores, filas } = validarLibro(libroValido());
  assert.deepEqual(ofensores, []);
  assert.equal(filas.length, NOMBRES_HOJAS.length);
  assert.ok(filas.every((f) => f.numero === 2));
});

test("filas vacías: se saltan, y la numeración sigue la de la hoja", () => {
  const libro = libroValido();
  const kits = libro.hojas.get("KITS")!;
  kits.push(Array(encabezados("KITS").length).fill(null));
  kits.push(["   ", ...Array(encabezados("KITS").length - 1).fill(null)]);
  kits.push(fila("KITS", "KITS-2"));

  const { ofensores, filas } = validarLibro(libro);
  assert.deepEqual(ofensores, []);
  const deKits = filas.filter((f) => f.hoja === "KITS");
  assert.deepEqual(
    deKits.map((f) => f.numero),
    [2, 5],
  );
});

test("hojas: reporta la que falta y la desconocida", () => {
  const libro = libroValido();
  libro.hojas.delete("KITS");
  libro.hojas.set("BORRADOR", []);
  libro.nombresHojas = [...libro.hojas.keys()];

  const { ofensores } = validarLibro(libro);
  assert.ok(ofensores.includes("Falta la hoja KITS"));
  assert.ok(ofensores.includes('Hoja desconocida: "BORRADOR"'));
});

test("bloque común: dice qué hoja difiere y en qué columna", () => {
  const libro = libroValido();
  libro.hojas.get("BOCINAS")![0][6] = "precio antes";

  const { ofensores } = validarLibro(libro);
  assert.deepEqual(ofensores, [
    'BOCINAS, columna G (posición 7): dice "precio antes", se esperaba "precio_antes"',
  ]);
});

test("bloque común: igualdad exacta — un espacio de más es una diferencia", () => {
  const libro = libroValido();
  libro.hojas.get("SUBWOOFERS")![0][0] = "sku ";

  const { ofensores } = validarLibro(libro);
  assert.equal(ofensores.length, 1);
  assert.match(ofensores[0], /^SUBWOOFERS, columna A .*\(espacio extra\)$/);
});

test("bloque común: el mismo nombre en otro orden también difiere", () => {
  const libro = libroValido();
  const encabezado = libro.hojas.get("KITS")![0];
  [encabezado[9], encabezado[10]] = [encabezado[10], encabezado[9]]; // destacado ↔ activo

  const { ofensores } = validarLibro(libro);
  assert.deepEqual(ofensores, [
    'KITS, columna J (posición 10): dice "activo", se esperaba "destacado"',
    'KITS, columna K (posición 11): dice "destacado", se esperaba "activo"',
  ]);
});

test("columnas específicas: la que falta y la desconocida", () => {
  const libro = libroValido();
  const datos = libro.hojas.get("SUBWOOFERS")!;
  const i = datos[0].indexOf("bobinas");
  datos[0][i] = "color";

  const { ofensores } = validarLibro(libro);
  assert.ok(ofensores.includes("SUBWOOFERS: faltan columnas: bobinas"));
  assert.ok(ofensores.some((o) => o.includes('columna desconocida "color"')));
});

test("acumula: una hoja rota no impide revisar las filas de las demás", () => {
  const libro = libroValido();
  libro.hojas.get("BOCINAS")![0][1] = "url";
  libro.hojas.get("RECEPTORES")!.push(fila("RECEPTORES", "KITS-1", { slug: "otro-slug" }));

  const { ofensores } = validarLibro(libro);
  assert.ok(ofensores.some((o) => o.startsWith("BOCINAS, columna B")));
  // Las ocurrencias salen en el orden de las hojas del libro.
  assert.ok(ofensores.includes('sku "KITS-1" duplicado: RECEPTORES fila 3, KITS fila 2'));
});

test("acumula: reporta TODOS los ofensores de fila, no el primero", () => {
  const libro = libroValido();
  libro.hojas.get("SUBWOOFERS")![1] = fila("SUBWOOFERS", "X", { sku: 12345 });
  libro.hojas.get("BOCINAS")![1] = fila("BOCINAS", "BOC-1", {
    precio: "800",
    precio_antes: "Q 900",
  });
  libro.hojas.get("INSONORIZACION")![1] = fila("INSONORIZACION", "1.2E+05");
  libro.hojas.get("KITS")![1] = fila("KITS", "2024-06-09");
  libro.hojas.get("AMPLIFICADORES")![1] = fila("AMPLIFICADORES", "REPETIDO", { slug: "mismo" });
  libro.hojas.get("RECEPTORES")![1] = fila("RECEPTORES", "REPETIDO", { slug: "mismo" });
  libro.hojas.get("ESPECIALES")![1] = fila("ESPECIALES", "STG-1", {
    categorias: "Bocinas, Sistemas",
  });

  const { ofensores } = validarLibro(libro);
  const esperados = [
    /^SUBWOOFERS fila 2: el sku llegó como número \(12345\)/,
    /^BOCINAS fila 2 .*precio "800" llegó como texto/,
    /^BOCINAS fila 2 .*precio_antes "Q 900" llegó como texto/,
    /^INSONORIZACION fila 2: sku "1\.2E\+05" parece un valor mangeado/,
    /^KITS fila 2: sku "2024-06-09" parece un valor mangeado/,
    /^sku "REPETIDO" duplicado: AMPLIFICADORES fila 2, RECEPTORES fila 2$/,
    /^slug "mismo" duplicado: AMPLIFICADORES fila 2, RECEPTORES fila 2$/,
    /^ESPECIALES fila 2: la categoría "Sistemas" de la columna categorias no existe/,
  ];
  for (const esperado of esperados) {
    assert.ok(
      ofensores.some((o) => esperado.test(o)),
      `falta ${esperado}:\n${ofensores.join("\n")}`,
    );
  }
  assert.equal(ofensores.length, esperados.length);
});

test("leerLibro: cada celda conserva su tipo real, y las filas vacías cuentan", () => {
  const hoja = XLSX.utils.aoa_to_sheet([
    ["sku", "precio"],
    ["ACX 165", 800],
    [null, null],
    ["MJP800.4", "800"],
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "KITS");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Uint8Array;

  const leido = leerLibro(buffer);
  assert.deepEqual(leido.nombresHojas, ["KITS"]);
  assert.deepEqual(leido.hojas.get("KITS"), [
    ["sku", "precio"],
    ["ACX 165", 800],
    [null, null],
    ["MJP800.4", "800"],
  ]);
});
