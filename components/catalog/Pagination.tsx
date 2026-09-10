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
    // flex-wrap es la red de seguridad: hoy el listado más largo son 5
    // páginas (Bocinas, 106 productos), pero el catálogo crece y con
    // suficientes números la fila volvería a empujar la página a lo ancho.
    // Envolver a un segundo renglón no pierde información; el scroll
    // horizontal sí molesta en todo el sitio.
    //
    // Las separaciones más cortas bajo 640px son las que evitan que llegue a
    // envolver en el caso de hoy: a 320px la fila necesitaba 279px y había
    // 272, y esos 7px de más dejaban la flecha «›» sola en un segundo
    // renglón. El escritorio conserva sus separaciones.
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-center gap-1.5 pt-10 sm:gap-2"
    >
      <ControlPagina
        href={hrefPara(paginaActual - 1)}
        deshabilitado={paginaActual <= 1}
        etiqueta="Anterior"
        flecha="‹"
      />
      <div className="flex items-center gap-1 sm:gap-1.5">
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
      <ControlPagina
        href={hrefPara(paginaActual + 1)}
        deshabilitado={paginaActual >= totalPaginas}
        etiqueta="Siguiente"
        flecha="›"
        flechaAlFinal
      />
    </nav>
  );
}

function ControlPagina({
  href,
  deshabilitado,
  etiqueta,
  flecha,
  flechaAlFinal = false,
}: {
  href: string;
  deshabilitado: boolean;
  etiqueta: string;
  flecha: string;
  flechaAlFinal?: boolean;
}) {
  // Bajo 640px se dibuja solo la flecha. Con cinco números, "‹ Anterior" y
  // "Siguiente ›" completos suman ~180px que no entran en una pantalla de
  // 320px, y el sobrante le metía scroll horizontal a la página entera. El
  // nombre accesible no se pierde: lo lleva el aria-label del enlace, así
  // que un lector de pantalla sigue anunciando "Anterior" aunque la palabra
  // no se dibuje.
  const contenido = (
    <span className="inline-flex items-center gap-1">
      {flechaAlFinal ? null : <span aria-hidden="true">{flecha}</span>}
      <span className="hidden sm:inline">{etiqueta}</span>
      {flechaAlFinal ? <span aria-hidden="true">{flecha}</span> : null}
    </span>
  );

  if (deshabilitado) {
    return <span className="text-texto-terciario px-3 py-2 text-[13px]">{contenido}</span>;
  }
  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="border-borde-pildora text-texto-nav hover:text-texto-secundario rounded-full border px-3 py-2 text-[13px]"
    >
      {contenido}
    </Link>
  );
}
