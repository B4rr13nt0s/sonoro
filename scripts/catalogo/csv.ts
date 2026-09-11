// data/source/catalogo.csv: el libro aplanado, una fila por producto. No se
// edita — se GENERA en cada import y se versiona solo para que `git diff`
// muestre qué cambió (un precio, un nombre), cosa que el .xlsx no permite.
//
// Por eso tiene que ser DETERMINISTA: el mismo libro produce los mismos bytes,
// o cada import mete un diff falso de cientos de líneas y nadie ve el cambio
// real. Lo que lo garantiza:
//   - columnas en un orden fijo EN CÓDIGO (COLUMNAS_CSV), nunca derivado del
//     orden de las hojas ni de Object.keys;
//   - filas ordenadas por (categoria, sku) con comparación por puntos de
//     código, sin localeCompare — la salida de ICU cambia entre versiones.
//     El sku es único (duplicado = abort), así que el orden es total; la
//     línea completa desempata las filas sin sku, que sí pueden repetirse;
//   - números en su forma canónica (String(n): «800», no «800.0»), booleanos
//     como VERDADERO/FALSO, finales de línea \n y UTF-8 sin BOM.
//
// Incluye las filas RECHAZADAS: es el registro de la fuente, no del catálogo
// publicado.

import type { Celda, FilaCruda } from "./contrato.ts";
import { COLUMNAS_SPECS, COMUN, HOJAS, NOMBRES_HOJAS } from "./hojas.ts";

const CAMPOS_EN_ORDEN = [
  ...new Set(NOMBRES_HOJAS.flatMap((hoja): readonly string[] => HOJAS[hoja].campos)),
];

export const COLUMNAS_CSV: readonly string[] = [
  "categoria",
  ...COMUN,
  "categorias",
  ...CAMPOS_EN_ORDEN,
  ...COLUMNAS_SPECS,
];

function valorCsv(celda: Celda | undefined): string {
  if (celda === null || celda === undefined) return "";
  if (typeof celda === "boolean") return celda ? "VERDADERO" : "FALSO";
  return String(celda);
}

// RFC 4180: comillas solo cuando hacen falta. Un espacio al borde también
// las lleva, para que ningún lector lo recorte.
function escapar(valor: string): string {
  return /[",\r\n]|^\s|\s$/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

const porPuntosDeCodigo = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function serializarCsv(filas: readonly FilaCruda[]): string {
  const lineas = filas.map((fila) => {
    const categoria = HOJAS[fila.hoja].categoria;
    const valores = COLUMNAS_CSV.map((columna) =>
      columna === "categoria" ? categoria : valorCsv(fila.celdas[columna]),
    );
    return { categoria, sku: valorCsv(fila.celdas.sku), linea: valores.map(escapar).join(",") };
  });

  lineas.sort(
    (a, b) =>
      porPuntosDeCodigo(a.categoria, b.categoria) ||
      porPuntosDeCodigo(a.sku, b.sku) ||
      porPuntosDeCodigo(a.linea, b.linea),
  );

  return [COLUMNAS_CSV.join(","), ...lineas.map((l) => l.linea)].join("\n") + "\n";
}
