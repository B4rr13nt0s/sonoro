// El catálogo del chat en el navegador: se baja UNA vez, al primer clic del
// lanzador, desde la ruta estática app/chat/catalogo.json. Este módulo es lo
// único del chat que el lanzador importa de forma estática, así que se queda
// pequeño a propósito: solo `fetch` y tipos (nada del motor ni de la búsqueda).

import type { ProductoBuscable } from "../busqueda/busqueda.ts";

export interface CatalogoChat {
  productos: ProductoBuscable[];
  marcas: { nombre: string; slug: string }[];
}

export const RUTA_CATALOGO_CHAT = "/chat/catalogo.json";

function esCatalogo(valor: unknown): valor is CatalogoChat {
  if (typeof valor !== "object" || valor === null) return false;
  const { productos, marcas } = valor as Record<string, unknown>;
  return Array.isArray(productos) && Array.isArray(marcas);
}

/** Cuánto se espera al catálogo antes de darlo por no cargado. */
export const PLAZO_CATALOGO_MS = 8000;

/** La descarga en sí. Nunca rechaza: cualquier fallo (red, no-OK, JSON ajeno) es `null`. */
async function descargar(fetchImpl: typeof fetch): Promise<CatalogoChat | null> {
  try {
    const respuesta = await fetchImpl(RUTA_CATALOGO_CHAT);
    if (!respuesta.ok) return null;
    const cuerpo: unknown = await respuesta.json();
    return esCatalogo(cuerpo) ? cuerpo : null;
  } catch {
    return null;
  }
}

/**
 * Espera `bajada` hasta `plazoMs`; si el plazo vence antes, resuelve `null`.
 * Una conexión detenida no rechaza ni responde: sin plazo, el cliente se
 * quedaba esperando el catálogo para siempre.
 */
async function conPlazo(
  bajada: Promise<CatalogoChat | null>,
  plazoMs: number,
): Promise<CatalogoChat | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<null>((resolve) => {
    temporizador = setTimeout(() => resolve(null), plazoMs);
  });
  try {
    return await Promise.race([bajada, vencido]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Un cargador memoiza la DESCARGA, no la espera: reabrir el panel no vuelve a
 * pedir el catálogo y dos llamadas seguidas comparten el mismo `fetch` y el
 * mismo objeto. Cada llamada espera como mucho `plazoMs`; si vence, quien
 * esperaba sigue sin catálogo (`null`), pero la descarga NO se cancela: una
 * conexión lenta que sí avanza termina, se recuerda y la llamada siguiente la
 * usa sin pedirla otra vez. Un fallo real (red, 500, JSON que no es un
 * catálogo) resuelve `null` y NO se recuerda, así que la siguiente reintenta.
 */
export function crearCargadorCatalogo(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  plazoMs: number = PLAZO_CATALOGO_MS,
): () => Promise<CatalogoChat | null> {
  let bajada: Promise<CatalogoChat | null> | null = null;

  return () => {
    if (!bajada) {
      const esta: Promise<CatalogoChat | null> = descargar(fetchImpl).then((catalogo) => {
        // Solo el fallo se olvida; y solo si nadie lo reemplazó mientras tanto.
        if (catalogo === null && bajada === esta) bajada = null;
        return catalogo;
      });
      bajada = esta;
    }
    return conPlazo(bajada, plazoMs);
  };
}

/** Los productos de esos skus, en ese orden; los que no estén en el mapa se descartan. */
export function productosDeSkus(
  skus: readonly string[],
  porSku: ReadonlyMap<string, ProductoBuscable>,
): ProductoBuscable[] {
  const productos: ProductoBuscable[] = [];
  for (const sku of skus) {
    const producto = porSku.get(sku);
    if (producto) productos.push(producto);
  }
  return productos;
}
