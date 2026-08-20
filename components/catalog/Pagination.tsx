import Link from "next/link";

// CLAUDE.md § Rutas: "Paginación con URLs indexables (?page=2), no scroll
// infinito." Cada número es un <Link> real — indexable, compartible, y el
// botón atrás del navegador funciona porque no hay estado de cliente
// gobernando qué página se ve.
//
// No sabe nada de catálogo, marca ni categoría — recibe `hrefPara(pagina)`
// ya armado por quien la usa (buildCatalogHref, buildMarcaHref, o lo que
// haga falta), así sirve para cualquier listado paginado del sitio.
type PaginationProps = {
  paginaActual: number;
  totalPaginas: number;
  hrefPara: (pagina: number) => string;
};

export function Pagination({ paginaActual, totalPaginas, hrefPara }: PaginationProps) {
  if (totalPaginas <= 1) return null;

  const paginas = Array.from({ length: totalPaginas }, (_, indice) => indice + 1);

  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-2 pt-10">
      <ControlPagina href={hrefPara(paginaActual - 1)} deshabilitado={paginaActual <= 1}>
        ‹ Anterior
      </ControlPagina>
      <div className="flex items-center gap-1.5">
        {paginas.map((pagina) => (
          <Link
            key={pagina}
            href={hrefPara(pagina)}
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
      <ControlPagina href={hrefPara(paginaActual + 1)} deshabilitado={paginaActual >= totalPaginas}>
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
