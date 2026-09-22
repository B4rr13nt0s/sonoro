import Link from "next/link";

import { paginasVisibles } from "@/lib/catalog/paginacion.ts";

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

  const paginas = paginasVisibles(paginaActual, totalPaginas);

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
      {/* flex-wrap también acá dentro: el wrap del contenedor de afuera
          trata este bloque como UNA pieza, así que sin esto una lista larga
          de números no envuelve, se desborda y empuja la página a lo ancho.
          Con la ventana ya casi nunca hace falta, pero es la red que faltaba. */}
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
        {paginas.map((pagina, indice) =>
          pagina === "…" ? (
            // Los saltos no son navegables ni se anuncian: el lector de
            // pantalla ya tiene «Página N» en cada número y primera/última.
            <span
              key={`salto-${indice}`}
              aria-hidden="true"
              className="text-texto-terciario flex h-11 items-center justify-center px-0.5 text-[13px] sm:h-9"
            >
              …
            </span>
          ) : (
            <Link
              key={pagina}
              href={hrefPara(pagina)}
              aria-label={`Página ${pagina}`}
              aria-current={pagina === paginaActual ? "page" : undefined}
              // 44x44 en el teléfono, que es el mínimo para el dedo; en
              // escritorio vuelven a los 36 del handoff, donde se apunta con
              // el mouse.
              className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] sm:h-9 sm:w-9 ${
                pagina === paginaActual
                  ? "bg-negro text-white"
                  : "text-texto-nav hover:text-texto-secundario"
              }`}
            >
              {pagina}
            </Link>
          ),
        )}
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
      className="border-borde-pildora text-texto-nav hover:text-texto-secundario flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 py-2 text-[13px] sm:min-h-0 sm:min-w-0"
    >
      {contenido}
    </Link>
  );
}
