// Fuerza el status HTTP correcto en rutas que Next no puede corregir solo.
//
// 410 Gone en /producto/[slug] cuando el producto tiene
// activo === false (CLAUDE.md § Mantenimiento del catálogo: la fila nunca
// se borra, solo se marca inactiva). 410 le dice a Google que la
// desaparición es intencional y permanente, distinto de un 404.
//
// Esta versión de Next.js solo soporta 404/403/401 vía
// notFound()/forbidden()/unauthorized() — están hardcodeados en
// node_modules/next/dist/client/components/http-access-fallback/
// http-access-fallback.js (`HTTPAccessErrorStatus`). No hay un `gone()`.
// La única forma soportada de mandar otro status para una página que sigue
// renderizando su árbol de React normal es este archivo, reescribiendo la
// petición a sí misma con `status` en el init — Proxy corre en runtime
// Node.js por default en v16, así que esto no necesita Edge runtime.
//
// Lee data/inactive-slugs.json en vez de lib/catalog: esta ruta es la más
// visitada del sitio y los slugs inactivos ya se conocen en tiempo de
// build (scripts/import-catalog.ts los emite) — no hay razón para resolver
// el catálogo completo (con specs, precios, imágenes) en cada petición
// solo para leer un booleano.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import conteosRaw from "./data/conteos.json";
import inactiveSlugsRaw from "./data/inactive-slugs.json";
import { listadoInexistente, type Conteos } from "./lib/catalog/conteos.ts";

const INACTIVE_SLUGS = new Set<string>(inactiveSlugsRaw);
const CONTEOS: Conteos = conteosRaw;

// El 404 de los LISTADOS también tiene que salir de acá: /catalogo,
// /productos, /catalogo/[categoria] y /marcas/[marca]. Leen searchParams, así
// que se renderizan por petición, y su loading.tsx empieza a mandar el
// esqueleto ANTES de que la página llegue a su notFound(): para entonces las
// cabeceras ya salieron con 200. El resultado era un soft 404 —
// /catalogo/no-existe o /catalogo?page=99999 respondían 200 con la página de
// error y un noindex— que Search Console reporta como error.
//
// listadoInexistente cubre la categoría o marca de la ruta, el slug de un
// filtro (?marca=, ?categoria=) y la página más allá de la última, con los
// conteos que el importador deja en data/conteos.json: una tabla chica
// conocida en build, leída directo por la misma razón que inactive-slugs.json.

function noIndexar(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

// El producto retirado se reescribe a SÍ MISMO: la ficha se sigue
// renderizando (con su aviso), y solo cambia el código.
function retirado(request: NextRequest) {
  return noIndexar(NextResponse.rewrite(request.nextUrl, { status: 410 }));
}

// El slug inválido se reescribe a la 404 prerenderizada (app/not-found.tsx),
// no a sí mismo: reescrito a sí mismo, el status salía bien pero la página
// arrancaba con el esqueleto de loading.tsx y el aviso llegaba solo en el
// payload de React — sin JavaScript no se veía nada, ni siquiera el h1.
function inexistente(request: NextRequest) {
  return noIndexar(NextResponse.rewrite(new URL("/_not-found", request.nextUrl), { status: 404 }));
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const [, seccion, slug] = pathname.match(/^\/([a-z]+)\/([^/]+)$/) ?? [];

  if (seccion === "producto" && INACTIVE_SLUGS.has(slug)) return retirado(request);
  if (listadoInexistente(CONTEOS, pathname, searchParams)) return inexistente(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/producto/:slug", "/catalogo", "/catalogo/:slug", "/productos", "/marcas/:slug"],
};
