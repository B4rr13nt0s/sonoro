// JSON-LD BreadcrumbList a partir de las mismas migas que se ven en pantalla
// (components/layout/Breadcrumbs.tsx): Google solo acepta marcar lo que la
// página muestra, así que salir de la misma lista lo garantiza por
// construcción.
import { absoluteUrl } from "./site.ts";

export type MigaJsonLd = { label: string; href?: string };

// null cuando las migas no alcanzan para un BreadcrumbList válido. Google
// exige `item` (la URL) en todos los elementos menos el último, y la ficha
// de un sistema completo lleva «Sistemas» sin link en el medio (no tiene
// página, CLAUDE.md § Fuente de verdad): un bloque con ese hueco daría error
// en Search Console. Mejor ninguno que uno inválido.
export function buildBreadcrumbJsonLd(migas: MigaJsonLd[]) {
  if (migas.length < 2) return null;
  if (migas.slice(0, -1).some((miga) => !miga.href)) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((miga, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: miga.label,
      ...(miga.href ? { item: absoluteUrl(miga.href) } : {}),
    })),
  };
}
