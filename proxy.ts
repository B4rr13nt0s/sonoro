// Fuerza HTTP 410 Gone en /producto/[slug] cuando el producto tiene
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

import inactiveSlugsRaw from "./data/inactive-slugs.json";

const INACTIVE_SLUGS = new Set<string>(inactiveSlugsRaw);

export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.match(/^\/producto\/([^/]+)$/)?.[1];
  if (!slug || !INACTIVE_SLUGS.has(slug)) return NextResponse.next();

  const response = NextResponse.rewrite(request.nextUrl, { status: 410 });
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = {
  matcher: "/producto/:slug",
};
