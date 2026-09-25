import Link from "next/link";

import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbs.ts";
import { jsonLdScriptProps } from "@/lib/seo/jsonLd.ts";

// Patrón repetido en /catalogo/[categoria], /marcas/[marca] y
// /producto/[slug] — mismo estilo mono en los tres, ahora con cada
// segmento que tenga `href` navegable. El último segmento normalmente NO
// lleva `href` (es la página actual, CLAUDE.md § Breadcrumbs) — excepto en
// la ficha de producto, donde termina en la marca, no en el producto
// mismo (Inicio / Subwoofers / Sonoro), así que ahí los tres segmentos son
// navegables.
export type Miga = { label: string; href?: string };

// Los enlaces llevan `py-3 -my-3`: el texto mide 11 px y queda donde estaba,
// pero el área tocable sube a 44 px de alto, que es el mínimo para el dedo.
//
// Emite también el BreadcrumbList en JSON-LD, desde la misma lista: así
// nunca marca algo distinto de lo que se ve.
export function Breadcrumbs({ items }: { items: Miga[] }) {
  const jsonLd = buildBreadcrumbJsonLd(items);

  return (
    <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
      {jsonLd ? <script {...jsonLdScriptProps(jsonLd)} /> : null}
      {items.map((item, indice) => (
        <span key={`${item.label}-${indice}`}>
          {indice > 0 ? " / " : ""}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-texto-secundario -my-3.5 inline-block py-3.5"
            >
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </span>
      ))}
    </div>
  );
}
