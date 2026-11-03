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

async function descargar(fetchImpl: typeof fetch, plazoMs: number): Promise<CatalogoChat | null> {
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  // Una conexión detenida no rechaza ni responde: sin plazo, el cliente se
  // quedaba esperando el catálogo para siempre. Al vencer se cancela la
  // descarga (si el `fetch` lo respeta) y se resuelve `null`, que es el mismo
  // camino que un fallo de red.
  const vencido = new Promise<null>((resolve) => {
    temporizador = setTimeout(() => {
      control.abort();
      resolve(null);
    }, plazoMs);
  });

  const bajada = (async () => {
    try {
      const respuesta = await fetchImpl(RUTA_CATALOGO_CHAT, { signal: control.signal });
      if (!respuesta.ok) return null;
      const cuerpo: unknown = await respuesta.json();
      return esCatalogo(cuerpo) ? cuerpo : null;
    } catch {
      return null;
    }
  })();

  try {
    return await Promise.race([bajada, vencido]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Un cargador memoiza la promesa: reabrir el panel no vuelve a pedir el
 * catálogo y dos llamadas seguidas comparten el mismo `fetch` y el mismo
 * objeto. Un fallo (red, 500, JSON que no es un catálogo, plazo vencido)
 * resuelve `null` y NO se recuerda, así que la llamada siguiente reintenta.
 */
export function crearCargadorCatalogo(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  plazoMs: number = PLAZO_CATALOGO_MS,
): () => Promise<CatalogoChat | null> {
  let pendiente: Promise<CatalogoChat | null> | null = null;

  return () => {
    if (pendiente) return pendiente;

    const esta = descargar(fetchImpl, plazoMs).then((catalogo) => {
      // Solo el fallo se olvida; y solo si nadie lo reemplazó mientras tanto.
      if (catalogo === null && pendiente === esta) pendiente = null;
      return catalogo;
    });
    pendiente = esta;
    return esta;
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
