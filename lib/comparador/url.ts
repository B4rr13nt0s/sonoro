import { MAX_COMPARAR } from "./types.ts";

// El estado de /comparar vive en la URL, no en localStorage, porque lo que le
// da valor a la función es que se pueda compartir por WhatsApp — un cliente
// pone dos equipos lado a lado y manda el enlace exacto (CLAUDE.md § Rutas:
// los query params existen para que la URL sea compartible y rastreable).
//
// Formato: /comparar?skus=SQ12-D2,COR-S124D
//
// Los sku van tal cual los publica el fabricante, con espacios y puntos
// incluidos (ACX 165, TNT-3000.1), así que un enlace real puede quedar como
// ?skus=ACX%20165,SQ12-D2. URLSearchParams lo codifica al armarlo y Next lo
// entrega ya decodificado en searchParams.

export function parsearSkus(valor: string | string[] | undefined): string[] {
  // Next entrega string[] cuando el param viene repetido (?skus=a&skus=b).
  // Se toma el primero, igual que primeroDeQuery en las rutas de listado.
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (!crudo) return [];

  const vistos = new Set<string>();
  const skus: string[] = [];
  for (const parte of crudo.split(",")) {
    const sku = parte.trim();
    if (!sku || vistos.has(sku)) continue;
    vistos.add(sku);
    skus.push(sku);
    // Se corta acá y no después de resolver contra el catálogo: el tope es
    // del comparador, no de cuántos resulten válidos.
    if (skus.length === MAX_COMPARAR) break;
  }
  return skus;
}

export function construirHrefComparar(skus: string[]): string {
  if (skus.length === 0) return "/comparar";
  const query = new URLSearchParams({ skus: skus.join(",") });
  return `/comparar?${query.toString()}`;
}
