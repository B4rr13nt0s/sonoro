import type { Orden } from "./types.ts";

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
  // precio_asc es el default de esta página (ver types.ts) — omitirlo
  // mantiene la URL limpia cuando no se pidió nada fuera de lo normal.
  if (estado.orden && estado.orden !== "precio_asc") query.set("orden", estado.orden);
  if (estado.page && estado.page > 1) query.set("page", String(estado.page));

  const search = query.toString();
  return `/catalogo/${categoriaSlug}${search ? `?${search}` : ""}`;
}
