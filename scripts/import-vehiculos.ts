// Importador del libro de vehículos — CLAUDE.md § Selector de vehículos.
//
// Lee data/source/vehiculos.xlsx (hojas VEHICULOS y LISTAS) y escribe:
//   data/vehiculos.json            los vehículos publicados (filas con revisado = sí)
//   reports/vehiculos-errores.md   filas rechazadas y filas sin revisar con problemas
//
// Corre DESPUÉS de import:catalog (npm run build), porque valida los
// accesorios contra el data/catalog.json que ese acaba de escribir.
//
// Toda la lógica está en scripts/vehiculos/ (importar.ts); este archivo solo
// lee y escribe. Con filas rechazadas se escribe el reporte pero no
// data/vehiculos.json, que se queda en la última importación buena, y el
// build no continúa.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { leerLibro, type LibroCrudo } from "./catalogo/contrato.ts";
import { importarVehiculos } from "./vehiculos/importar.ts";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUTA_LIBRO = path.join(RAIZ, "data", "source", "vehiculos.xlsx");
const RUTA_CATALOG = path.join(RAIZ, "data", "catalog.json");
const RUTA_VEHICULOS = path.join(RAIZ, "data", "vehiculos.json");
const RUTA_REPORTE = path.join(RAIZ, "reports", "vehiculos-errores.md");

function abortar(motivos: string[]): void {
  console.error("✘ Importación de vehículos abortada. No se escribió ningún archivo.\n");
  motivos.forEach((motivo) => console.error(`  - ${motivo}`));
  process.exitCode = 1;
}

function main(): void {
  let libro: LibroCrudo;
  try {
    libro = leerLibro(readFileSync(RUTA_LIBRO));
  } catch (error) {
    abortar([`No se pudo leer ${path.relative(RAIZ, RUTA_LIBRO)}: ${(error as Error).message}`]);
    return;
  }

  let skusCatalogo: Set<string>;
  try {
    const catalogo = JSON.parse(readFileSync(RUTA_CATALOG, "utf-8")) as { sku: string }[];
    skusCatalogo = new Set(catalogo.map((p) => p.sku));
  } catch (error) {
    abortar([`No se pudo leer ${path.relative(RAIZ, RUTA_CATALOG)}: ${(error as Error).message}`]);
    return;
  }

  const resultado = importarVehiculos(libro, {
    skusCatalogo,
    anioActual: new Date().getFullYear(),
  });
  if (resultado.tipo === "abortar") {
    abortar(resultado.motivos);
    return;
  }

  mkdirSync(path.dirname(RUTA_REPORTE), { recursive: true });
  writeFileSync(RUTA_REPORTE, resultado.reporte);
  if (resultado.archivo) {
    writeFileSync(RUTA_VEHICULOS, JSON.stringify(resultado.archivo, null, 2) + "\n");
  }

  console.log(
    `Vehículos: ${resultado.publicadas} publicado(s), ${resultado.rechazadas} rechazado(s), ` +
      `${resultado.sinRevisar} sin revisar.`,
  );
  if (resultado.rechazadas > 0) {
    console.error(
      `✘ ${resultado.rechazadas} fila(s) rechazada(s) — ver reports/vehiculos-errores.md. ` +
        "El build no continúa.",
    );
    process.exitCode = 1;
  }
}

main();
