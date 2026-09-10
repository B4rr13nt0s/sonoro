import { ORDEN_DEFECTO, OrdenSchema, type Orden } from "./types.ts";

// Construye la URL de /catalogo/[categoria] a partir del ESTADO COMPLETO
// deseado (no un merge parcial) — CLAUDE.md § Rutas: los filtros y el orden
// viven en query params, no en estado de React, para que la URL sea
// compartible por WhatsApp y rastreable por Google, y el botón atrás
// funcione. Cada link de la página arma su propio estado final; no hay
// "estado actual" oculto en un componente.
export type CatalogQueryState = {
  marca?: string; // slug de marca
  orden?: Orden;
  page?: number;
};

export function buildCatalogHref(categoriaSlug: string, estado: CatalogQueryState): string {
  const query = new URLSearchParams();

  if (estado.marca) query.set("marca", estado.marca);
  // El orden por defecto (ORDEN_DEFECTO en types.ts) NO se escribe en la
  // URL: así /catalogo/bocinas se mantiene limpia mientras no se haya pedido
  // nada fuera de lo normal, y el canonical —que arma este mismo builder sin
  // pasar `orden`— no se fragmenta. Los otros órdenes sí aparecen, porque son
  // un pedido explícito del usuario que debe sobrevivir al compartir la URL.
  if (estado.orden && estado.orden !== ORDEN_DEFECTO) query.set("orden", estado.orden);
  if (estado.page && estado.page > 1) query.set("page", String(estado.page));

  const search = query.toString();
  return `/catalogo/${categoriaSlug}${search ? `?${search}` : ""}`;
}

// Misma idea que buildCatalogHref, para /marcas/[marca]: ahí el filtro
// secundario es categoría en vez de marca. Son dos funciones cortas en vez
// de una genérica porque cada una documenta su propia ruta y sus propios
// query params — más legible que una abstracción con un parámetro "campo".
export type MarcaQueryState = {
  categoria?: string; // slug de categoría
  orden?: Orden;
  page?: number;
};

export function buildMarcaHref(marcaSlug: string, estado: MarcaQueryState): string {
  const query = new URLSearchParams();

  if (estado.categoria) query.set("categoria", estado.categoria);
  if (estado.orden && estado.orden !== ORDEN_DEFECTO) query.set("orden", estado.orden);
  if (estado.page && estado.page > 1) query.set("page", String(estado.page));

  const search = query.toString();
  return `/marcas/${marcaSlug}${search ? `?${search}` : ""}`;
}

// /productos (destacados): mismo criterio, el único filtro secundario es
// marca — no hay categoría ni marca "de la ruta" que omitir de la query.
export type ProductosQueryState = {
  marca?: string; // slug de marca
  orden?: Orden;
  page?: number;
};

export function buildProductosHref(estado: ProductosQueryState): string {
  const query = new URLSearchParams();

  if (estado.marca) query.set("marca", estado.marca);
  if (estado.orden && estado.orden !== ORDEN_DEFECTO) query.set("orden", estado.orden);
  if (estado.page && estado.page > 1) query.set("page", String(estado.page));

  const search = query.toString();
  return `/productos${search ? `?${search}` : ""}`;
}

// Resuelve de una vez los href de los tres órdenes, para OrdenSelector.
//
// Existe porque OrdenSelector es "use client" (necesita el estado de abierto
// o cerrado) y una FUNCIÓN no cruza la frontera servidor→cliente: el
// componente no puede recibir el builder y llamarlo él. Cada ruta le pasa acá
// su builder con sus propios filtros ya fijados y manda al cliente un objeto
// plano, que sí es serializable. Mismo criterio que `opciones` en
// FiltroMarca, que también viaja con el href ya resuelto.
export function hrefsDeOrden(construir: (orden: Orden) => string): Record<Orden, string> {
  return Object.fromEntries(
    OrdenSchema.options.map((orden) => [orden, construir(orden)]),
  ) as Record<Orden, string>;
}
