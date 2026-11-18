// El manifiesto de fotos en Vercel Blob (data/fotos-blob.json): qué foto fuente
// de assets/productos/ está subida, con qué hash y en qué URL. Esta parte es
// pura —sin fs ni crypto— para que next.config.ts y los tests la usen igual;
// scripts/catalogo/fotos.ts aporta el disco y scripts/fotos/subir-blob.ts la
// red. Diseño: docs/superpowers/specs/2026-11-17-fotos-blob-design.md.

export type EntradaFoto = { url: string; hash: string; bytes: number };
/** Clave: el nombre de archivo `SKU_vista.ext`. */
export type ManifiestoFotos = Record<string, EntradaFoto>;
export type DiferenciasFotos = {
  /** En disco y no en el manifiesto. */
  sinSubir: string[];
  /** En los dos, con hash distinto: se reemplazó la foto y no se volvió a subir. */
  cambiadas: string[];
  /** En el manifiesto y no en disco. */
  huerfanas: string[];
};

// Por puntos de código, no con localeCompare: el manifiesto es un archivo
// versionado y su orden no puede cambiar entre máquinas (como orden.ts).
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Nombre de la foto dentro de Blob. El hash del contenido va en el nombre:
 * si la foto cambia cambia la URL, y la caché inmutable nunca sirve la vieja
 * (la misma razón por la que los .glb llevan la versión en el nombre).
 */
export function nombreBlob(archivo: string, hash: string): string {
  const punto = archivo.lastIndexOf(".");
  return `productos/${archivo.slice(0, punto)}.${hash}${archivo.slice(punto)}`;
}

/** `enDisco` mapea nombre de archivo → hash del contenido. */
export function compararConManifiesto(
  enDisco: ReadonlyMap<string, string>,
  manifiesto: ManifiestoFotos,
): DiferenciasFotos {
  const sinSubir: string[] = [];
  const cambiadas: string[] = [];
  for (const [archivo, hash] of enDisco) {
    const subida = manifiesto[archivo];
    if (!subida) sinSubir.push(archivo);
    else if (subida.hash !== hash) cambiadas.push(archivo);
  }
  const huerfanas = Object.keys(manifiesto).filter((archivo) => !enDisco.has(archivo));
  return {
    sinSubir: sinSubir.sort(comparar),
    cambiadas: cambiadas.sort(comparar),
    huerfanas: huerfanas.sort(comparar),
  };
}

export function alertasDeFotos(d: DiferenciasFotos): string[] {
  return [
    ...d.sinSubir.map((a) => `${a}: sin subir a Blob (corre npm run fotos:subir)`),
    ...d.cambiadas.map((a) => `${a}: cambió desde la última subida (corre npm run fotos:subir)`),
    ...d.huerfanas.map((a) => `${a}: está en data/fotos-blob.json pero no en assets/productos/`),
  ];
}

export function serializarManifiesto(m: ManifiestoFotos): string {
  const ordenado: ManifiestoFotos = {};
  for (const clave of Object.keys(m).sort(comparar)) ordenado[clave] = m[clave];
  return JSON.stringify(ordenado, null, 2) + "\n";
}

/** Los hostnames de las URLs, únicos y ordenados: de ahí salen los remotePatterns. */
export function hostsDeManifiesto(m: ManifiestoFotos): string[] {
  const hosts = new Set(Object.values(m).map((e) => new URL(e.url).hostname));
  return [...hosts].sort(comparar);
}

const TIPOS: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/**
 * Opciones de `put` de @vercel/blob para una foto. Sobrescribir es seguro: el
 * nombre ya lleva el hash del contenido, así que «ya existe» solo puede ser la
 * misma foto —por un manifiesto perdido o una subida a medias— y fallar ahí
 * dejaría la subida atascada para siempre.
 */
export function opcionesDeSubida(archivo: string) {
  const extension = archivo.slice(archivo.lastIndexOf(".") + 1).toLowerCase();
  return {
    access: "public" as const,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: TIPOS[extension],
    cacheControlMaxAge: 31_536_000,
  };
}
