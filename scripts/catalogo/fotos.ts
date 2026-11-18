// El lado del disco del flujo de fotos en Blob: hashes de assets/productos/ y
// lectura del manifiesto. Lo usan el importador (scripts/import-catalog.ts) y
// el comando de subida (scripts/fotos/subir-blob.ts); la lógica pura vive en
// lib/catalog/fotos-blob.ts.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ManifiestoFotos } from "../../lib/catalog/fotos-blob.ts";

/** Los 12 primeros caracteres hex del sha-256: suficiente para distinguir versiones de una foto. */
export function hashDeFoto(contenido: Buffer): string {
  return createHash("sha256").update(contenido).digest("hex").slice(0, 12);
}

/**
 * Archivo → hash de cada foto de la carpeta. Ignora archivos punto
 * (.gitkeep, .DS_Store) y subcarpetas; una carpeta que no existe es una
 * carpeta vacía (repo fresco, antes de la primera foto).
 */
export function leerHashesDeFotos(carpeta: string): Map<string, string> {
  const hashes = new Map<string, string>();
  if (!existsSync(carpeta)) return hashes;
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    if (!entrada.isFile() || entrada.name.startsWith(".")) continue;
    hashes.set(entrada.name, hashDeFoto(readFileSync(path.join(carpeta, entrada.name))));
  }
  return hashes;
}

/** Un manifiesto que no existe es un manifiesto vacío: todas las fotos quedan «sin subir». */
export function leerManifiesto(ruta: string): ManifiestoFotos {
  return existsSync(ruta) ? (JSON.parse(readFileSync(ruta, "utf-8")) as ManifiestoFotos) : {};
}

/** Las fotos que hay que subir: sin entrada en el manifiesto o con otro hash. Por puntos de código. */
export function pendientesDeSubir(
  enDisco: ReadonlyMap<string, string>,
  manifiesto: ManifiestoFotos,
): string[] {
  return [...enDisco]
    .filter(([archivo, hash]) => manifiesto[archivo]?.hash !== hash)
    .map(([archivo]) => archivo)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Corre `hacer` sobre cada elemento, de a `enParalelo`. Si alguno falla, las
 * demás del mismo lote terminan antes de relanzar el primer error (y no
 * empieza otro lote): con Promise.all las que seguían en vuelo se subían a
 * Blob sin llegar al manifiesto.
 */
export async function subirEnLotes<T>(
  items: readonly T[],
  hacer: (item: T) => Promise<void>,
  enParalelo: number,
): Promise<void> {
  for (let i = 0; i < items.length; i += enParalelo) {
    const resultados = await Promise.allSettled(items.slice(i, i + enParalelo).map(hacer));
    const fallo = resultados.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (fallo) throw fallo.reason;
  }
}
