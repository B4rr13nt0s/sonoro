// Sube las fotos de producto de assets/productos/ a Vercel Blob y escribe
// data/fotos-blob.json, el manifiesto que lee el importador.
//
//   npm run fotos:subir
//
// Necesita BLOB_READ_WRITE_TOKEN en .env.local (solo este comando lo usa: el
// build no). Idempotente: una foto cuyo hash ya está en el manifiesto no toca
// la red, y el nombre en Blob lleva el hash del contenido, así que una foto
// reemplazada sube con otra URL y la vieja sigue ahí (no se borran blobs).
// Diseño: docs/superpowers/specs/2026-11-17-fotos-blob-design.md.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { put } from "@vercel/blob";

import {
  nombreBlob,
  serializarManifiesto,
  type ManifiestoFotos,
} from "../../lib/catalog/fotos-blob.ts";
import { leerHashesDeFotos, leerManifiesto, pendientesDeSubir } from "../catalogo/fotos.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CARPETA = path.join(RAIZ, "assets", "productos");
const RUTA_MANIFIESTO = path.join(RAIZ, "data", "fotos-blob.json");
const EN_PARALELO = 4;
const UN_ANIO_S = 31_536_000;

const TIPOS: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

// Antes de leer o subir nada: sin token no hay nada que hacer, y un error a
// mitad de la subida sería más difícil de entender.
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "Falta BLOB_READ_WRITE_TOKEN. Crea la tienda Blob (pública) en Vercel → Storage y pon el token en .env.local.",
  );
  process.exit(1);
}

// El paquete es CommonJS (sin "type": "module"): tsx no admite await en el
// nivel superior, así que el trabajo va en una función.
async function subir() {
  const enDisco = leerHashesDeFotos(CARPETA);
  const manifiesto: ManifiestoFotos = leerManifiesto(RUTA_MANIFIESTO);
  const pendientes = pendientesDeSubir(enDisco, manifiesto);

  let subidas = 0;
  let bytesSubidos = 0;
  try {
    for (let i = 0; i < pendientes.length; i += EN_PARALELO) {
      await Promise.all(
        pendientes.slice(i, i + EN_PARALELO).map(async (archivo) => {
          const hash = enDisco.get(archivo)!;
          const contenido = readFileSync(path.join(CARPETA, archivo));
          const extension = archivo.slice(archivo.lastIndexOf(".") + 1).toLowerCase();
          const { url } = await put(nombreBlob(archivo, hash), contenido, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: false,
            contentType: TIPOS[extension],
            cacheControlMaxAge: UN_ANIO_S,
          });
          manifiesto[archivo] = { url, hash, bytes: contenido.length };
          subidas += 1;
          bytesSubidos += contenido.length;
        }),
      );
    }
  } finally {
    // Entradas de archivos que ya no existen en disco: fuera. Y se escribe
    // siempre, también si algo falló a mitad: lo ya subido queda registrado y
    // volver a correr el comando continúa desde ahí.
    let quitadas = 0;
    for (const archivo of Object.keys(manifiesto)) {
      if (!enDisco.has(archivo)) {
        delete manifiesto[archivo];
        quitadas += 1;
      }
    }
    writeFileSync(RUTA_MANIFIESTO, serializarManifiesto(manifiesto));
    console.log(
      `${subidas} subida(s), ${enDisco.size - pendientes.length} ya estaban, ${quitadas} entrada(s) quitada(s), ` +
        `${(bytesSubidos / 1048576).toFixed(1)} MB subidos.`,
    );
  }
}

subir().catch((error) => {
  console.error(error);
  process.exit(1);
});
