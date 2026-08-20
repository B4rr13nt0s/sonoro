import Link from "next/link";

import { buildCatalogHref } from "@/lib/catalog/href.ts";
import type { Orden } from "@/lib/catalog/index.ts";

// CLAUDE.md § Rutas: "Paginación con URLs indexables (?page=2), no scroll
// infinito." Cada número es un <Link> real — indexable, compartible, y el
// botón atrás del navegador funciona porque no hay estado de cliente
// gobernando qué página se ve.
type PaginationProps = {
  categoriaSlug: string;
  marcaActual?: string;
  orden: Orden;
  paginaActual: number;
  totalPaginas: number;
};

export function Pagination({
  categoriaSlug,
  marcaActual,
  orden,
  paginaActual,
  totalPaginas,
}: PaginationProps) {
  if (totalPaginas <= 1) return null;

  const href = (pagina: number) =>
    buildCatalogHref(categoriaSlug, { marca: marcaActual, orden, page: pagina });
  const paginas = Array.from({ length: totalPaginas }, (_, indice) => indice + 1);

  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-2 pt-10">
      <ControlPagina href={href(paginaActual - 1)} deshabilitado={paginaActual <= 1}>
        ‹ Anterior
      </ControlPagina>
      <div className="flex items-center gap-1.5">
        {paginas.map((pagina) => (
          <Link
            key={pagina}
            href={href(pagina)}
            aria-current={pagina === paginaActual ? "page" : undefined}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] ${
              pagina === paginaActual
                ? "bg-negro text-white"
                : "text-texto-nav hover:text-texto-secundario"
            }`}
          >
            {pagina}
          </Link>
        ))}
      </div>
      <ControlPagina href={href(paginaActual + 1)} deshabilitado={paginaActual >= totalPaginas}>
        Siguiente ›
      </ControlPagina>
    </nav>
  );
}

function ControlPagina({
  href,
  deshabilitado,
  children,
}: {
  href: string;
  deshabilitado: boolean;
  children: React.ReactNode;
}) {
  if (deshabilitado) {
    return <span className="text-texto-terciario px-3 py-2 text-[13px]">{children}</span>;
  }
  return (
    <Link
      href={href}
      className="border-borde-pildora text-texto-nav hover:text-texto-secundario rounded-full border px-3 py-2 text-[13px]"
    >
      {children}
    </Link>
  );
}
