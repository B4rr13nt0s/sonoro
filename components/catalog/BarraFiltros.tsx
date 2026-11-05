"use client";

import { useRef } from "react";

import { CLASE_SELECT } from "@/components/ui/campos.ts";
import { etiquetaCanales } from "@/lib/busqueda/acotar.ts";
import {
  DISPONIBILIDADES,
  ORDENES,
  SIN_FILTROS,
  USOS_ETIQUETA,
  filtrosActivos,
  leerDisponibilidad,
  leerNumero,
  leerOrden,
  leerUso,
  type Filtros,
  type Orden,
} from "@/lib/busqueda/filtros-activos.ts";
import type { Disponibilidad, Uso } from "@/lib/catalog/types.ts";

// Los filtros de /buscar (docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md,
// decisiones 8–13). Desde 640 px, una barra entre dos líneas finas: píldoras
// de tipo de producto, un separador, las listas y Ordenar a la derecha; si no
// cabe, se parte en dos líneas. Debajo de 640 px, las píldoras en una línea
// que se desliza —llega hasta el borde de la pantalla y la última queda
// cortada: sin degradado (CLAUDE.md)— y las listas en dos columnas.
//
// Las listas son <select> nativos: teclado, lector de pantalla y selector del
// teléfono funcionan sin menús propios. La barra no guarda estado: recibe los
// valores de SearchExperience, que vive en la dirección, y devuelve cambios.
const CLASE_PILDORA = "flex-none whitespace-nowrap rounded-full border px-4.5 py-3 lg:py-2";
const CLASE_LISTA = `${CLASE_SELECT} w-full min-w-0 sm:w-auto`;
const CLASE_ENLACE = "text-negro underline underline-offset-2";

// La ✕ de las píldoras: dibujada, no el carácter U+2715, que Windows toma de
// una fuente de símbolos con color (CLAUDE.md: sin emoji).
function IconoQuitar() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M1.5 1.5l7 7M8.5 1.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Ordenar va última en la rejilla de móvil: si queda sola en su fila
// (`odd:`), ocupa las dos columnas en vez de cortar su texto a media.
export type CambioFiltros = Partial<Filtros> & { orden?: Orden };

export function BarraFiltros({
  filtros,
  conteoPorCategoria,
  opcionesUso,
  usosEscritos,
  opcionesMedida,
  opcionesCanales,
  opcionesMarca,
  conteoPorDisp,
  ordenActivo,
  cambiar,
}: {
  filtros: Filtros;
  conteoPorCategoria: Map<string, number>;
  opcionesUso: [Uso, number][];
  /** La categoría que salió de lo escrito («bocinas marino»): su lista queda fija. */
  usosEscritos: readonly Uso[];
  opcionesMedida: [number, number][];
  opcionesCanales: [number, number][];
  opcionesMarca: [string, number][];
  conteoPorDisp: Map<Disponibilidad, number>;
  ordenActivo: Orden;
  cambiar: (cambio: CambioFiltros) => void;
}) {
  const activos = filtrosActivos(filtros, usosEscritos.length > 0);
  const hayFiltros = Object.values(filtros).some((valor) => valor !== null);
  const raiz = useRef<HTMLDivElement>(null);

  // El botón que se toca desaparece con su filtro, y el foco del teclado caía
  // en <body>. Se mueve ANTES del cambio a algo que sigue estando: la píldora
  // siguiente (o la anterior), «Quitar filtros», la lista de ese filtro o
  // «Todo». Si igual se pierde —la lista deja de tener opciones—, va a «Todo».
  function enfocar(destino: string) {
    const buscar = (d: string) => raiz.current?.querySelector<HTMLElement>(`[data-foco="${d}"]`);
    buscar(destino)?.focus();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) buscar("todo")?.focus();
      }),
    );
  }

  function quitarActivo(indice: number) {
    const { campo } = activos[indice];
    const vecino = activos[indice + 1] ?? activos[indice - 1];
    enfocar(vecino ? `quitar-${vecino.campo}` : `lista-${campo}`);
    cambiar({ [campo]: null });
  }

  function quitarTodos() {
    enfocar("todo");
    cambiar(SIN_FILTROS);
  }

  return (
    <div ref={raiz} className="flex flex-col gap-3 self-stretch text-[13px]">
      <div className="sm:border-borde-tarjeta flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:border-y sm:py-3">
        <div className="-mr-6 flex [scrollbar-width:none] gap-2.5 overflow-x-auto pr-6 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            data-foco="todo"
            onClick={() => cambiar({ categoria: null })}
            className={`${CLASE_PILDORA} ${
              !filtros.categoria
                ? "border-negro bg-negro text-white"
                : "border-borde-pildora text-texto-nav"
            }`}
          >
            Todo
          </button>
          {[...conteoPorCategoria.entries()].map(([categoria, cantidad]) => (
            <button
              key={categoria}
              type="button"
              onClick={() => cambiar({ categoria })}
              className={`${CLASE_PILDORA} ${
                filtros.categoria === categoria
                  ? "border-negro bg-negro text-white"
                  : "border-borde-pildora text-texto-nav"
              }`}
            >
              {categoria}{" "}
              <span
                className={
                  filtros.categoria === categoria
                    ? "text-texto-sobre-negro"
                    : "text-texto-terciario"
                }
              >
                {cantidad}
              </span>
            </button>
          ))}
        </div>

        <span aria-hidden="true" className="bg-borde-pildora hidden h-6 w-px sm:block" />

        <div className="grid grid-cols-2 gap-2.5 sm:contents">
          {opcionesMarca.length > 1 || filtros.marca ? (
            <select
              aria-label="Filtrar por marca"
              data-foco="lista-marca"
              value={filtros.marca ?? ""}
              onChange={(e) => cambiar({ marca: e.target.value || null })}
              className={CLASE_LISTA}
            >
              <option value="">Todas las marcas</option>
              {opcionesMarca.map(([marca, cantidad]) => (
                <option key={marca} value={marca}>
                  {marca} ({cantidad})
                </option>
              ))}
            </select>
          ) : null}
          {opcionesMedida.length > 1 || filtros.medida ? (
            <select
              aria-label="Filtrar por medida"
              data-foco="lista-medida"
              value={filtros.medida ?? ""}
              onChange={(e) => cambiar({ medida: leerNumero(e.target.value) })}
              className={CLASE_LISTA}
            >
              <option value="">Medida: todas</option>
              {opcionesMedida.map(([pulgadas, cantidad]) => (
                <option key={pulgadas} value={pulgadas}>
                  Medida: {pulgadas}&quot; ({cantidad})
                </option>
              ))}
            </select>
          ) : null}
          {opcionesCanales.length > 1 || filtros.canales ? (
            <select
              aria-label="Filtrar por canales"
              data-foco="lista-canales"
              value={filtros.canales ?? ""}
              onChange={(e) => cambiar({ canales: leerNumero(e.target.value) })}
              className={CLASE_LISTA}
            >
              <option value="">Canales: todos</option>
              {opcionesCanales.map(([canales, cantidad]) => (
                <option key={canales} value={canales}>
                  {etiquetaCanales(canales)} ({cantidad})
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Filtrar por disponibilidad"
            data-foco="lista-disp"
            value={filtros.disp ?? ""}
            onChange={(e) => cambiar({ disp: leerDisponibilidad(e.target.value) })}
            className={CLASE_LISTA}
          >
            <option value="">Cualquier disponibilidad</option>
            {(Object.keys(DISPONIBILIDADES) as Disponibilidad[]).map((d) => {
              const cantidad = conteoPorDisp.get(d) ?? 0;
              return (
                <option key={d} value={d} disabled={cantidad === 0 && filtros.disp !== d}>
                  {DISPONIBILIDADES[d]} ({cantidad})
                </option>
              );
            })}
          </select>
          {/* Categoría (carro, marino, motorsports). Si la consulta ya la
              nombra («bocinas marino»), el filtro viene de lo escrito y la
              lista lo muestra, fija. */}
          {usosEscritos.length > 0 ? (
            <select
              aria-label="Categoría (viene de lo que escribiste)"
              value="escrita"
              disabled
              className={CLASE_LISTA}
            >
              <option value="escrita">
                Categoría: {usosEscritos.map((u) => USOS_ETIQUETA[u]).join(" o ")}
              </option>
            </select>
          ) : opcionesUso.length > 1 || filtros.uso ? (
            <select
              aria-label="Filtrar por categoría"
              data-foco="lista-uso"
              value={filtros.uso ?? ""}
              onChange={(e) => cambiar({ uso: leerUso(e.target.value) })}
              className={CLASE_LISTA}
            >
              <option value="">Categoría: todas</option>
              {opcionesUso.map(([u, cantidad]) => (
                <option key={u} value={u}>
                  Categoría: {USOS_ETIQUETA[u]} ({cantidad})
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Ordenar resultados"
            value={ordenActivo}
            onChange={(e) => cambiar({ orden: leerOrden(e.target.value) })}
            className={`${CLASE_LISTA} border-negro odd:col-span-2 sm:ml-auto`}
          >
            {(Object.keys(ORDENES) as Orden[]).map((o) => (
              <option key={o} value={o}>
                {ORDENES[o]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desde 640 px: lo elegido, una píldora por filtro que se quita con ✕.
          El tipo de producto no se repite (su píldora ya está en negro) y lo
          escrito tampoco (se quita borrándolo del texto). */}
      {activos.length > 0 ? (
        <div className="hidden flex-wrap items-center gap-2.5 sm:flex">
          {activos.map((activo, indice) => (
            <button
              key={activo.campo}
              type="button"
              data-foco={`quitar-${activo.campo}`}
              aria-label={`Quitar filtro: ${activo.etiqueta}`}
              onClick={() => quitarActivo(indice)}
              className="bg-fondo-alt border-borde-pildora text-texto-nav inline-flex items-center gap-2 rounded-full border px-4 py-2"
            >
              {activo.etiqueta}
              <IconoQuitar />
            </button>
          ))}
          <button type="button" onClick={quitarTodos} className={CLASE_ENLACE}>
            Quitar filtros
          </button>
        </div>
      ) : null}

      {/* Debajo de 640 px no hay píldoras con ✕: el valor elegido se lee en
          cada lista. */}
      {hayFiltros ? (
        <button
          type="button"
          onClick={quitarTodos}
          className={`${CLASE_ENLACE} self-start sm:hidden`}
        >
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}
