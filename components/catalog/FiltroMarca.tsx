"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// El valor seleccionado vive en la URL (?marca=slug), no en este componente
// — lo único que es estado local de verdad es si el menú está abierto o
// cerrado, que es puramente presentacional.
//
// Este es un Client Component (necesita el estado de abierto/cerrado), así
// que no puede recibir una función (buildCatalogHref/buildProductosHref):
// Next solo deja cruzar el límite servidor→cliente con datos serializables.
// Por eso `opciones` ya trae el href resuelto por quien llama — sirve tanto
// para /catalogo/[categoria] como para /productos sin que este componente
// sepa nada de rutas.
export type OpcionMarca = { slug: string; nombre: string; href: string };

type FiltroMarcaProps = {
  opciones: OpcionMarca[];
  hrefTodas: string;
  marcaActual?: string;
};

export function FiltroMarca({ opciones, hrefTodas, marcaActual }: FiltroMarcaProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const marcaSeleccionada = opciones.find((opcion) => opcion.slug === marcaActual);

  useEffect(() => {
    if (!abierto) return;

    function alHacerClicFuera(evento: MouseEvent) {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }

    function alPresionarEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }

    document.addEventListener("mousedown", alHacerClicFuera);
    document.addEventListener("keydown", alPresionarEscape);
    return () => {
      document.removeEventListener("mousedown", alHacerClicFuera);
      document.removeEventListener("keydown", alPresionarEscape);
    };
  }, [abierto]);

  // Se renderiza dos veces (bottom sheet en móvil, dropdown anclado en
  // escritorio) — misma lista de opciones, dos contenedores visualmente
  // distintos gateados por CSS (hidden/lg:), igual que el patrón que ya usa
  // SiteHeader para su nav de escritorio vs. su menú móvil.
  const listaOpciones = (
    <>
      <Link
        href={hrefTodas}
        onClick={() => setAbierto(false)}
        role="option"
        aria-selected={!marcaActual}
        className={`px-4 py-3 text-[14px] lg:py-2 ${
          !marcaActual ? "text-negro font-medium" : "text-texto-secundario"
        }`}
      >
        Todas las marcas
      </Link>
      {opciones.map((opcion) => (
        <Link
          key={opcion.slug}
          href={opcion.href}
          onClick={() => setAbierto(false)}
          role="option"
          aria-selected={opcion.slug === marcaActual}
          className={`px-4 py-3 text-[14px] lg:py-2 ${
            opcion.slug === marcaActual ? "text-negro font-medium" : "text-texto-secundario"
          }`}
        >
          {opcion.nombre}
        </Link>
      ))}
    </>
  );

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className={`rounded-full border px-4.5 py-3 text-[13px] lg:py-2 ${
          marcaSeleccionada
            ? "border-negro bg-negro text-white"
            : "border-borde-pildora text-texto-nav"
        }`}
      >
        {marcaSeleccionada ? marcaSeleccionada.nombre : "Marca"}
      </button>

      {abierto ? (
        <>
          {/* Bottom sheet — solo <lg (docs/PLAN.md § Fase 5: "FilterPanel,
              drawer en móvil, sidebar en escritorio"). El escritorio
              (≥1024px) sigue con el dropdown anclado de siempre, sin
              tocar. */}
          <div
            className="bg-negro/40 fixed inset-0 z-40 lg:hidden"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            aria-label="Filtrar por marca"
            className="border-borde-tarjeta rounded-t-card-lg fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col border-t bg-white pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
          >
            <div className="border-borde-tarjeta flex items-center justify-between border-b px-5 py-4">
              <span className="text-[15px] font-semibold">Marca</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-texto-secundario flex h-11 w-11 items-center justify-center text-[22px]"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col overflow-y-auto py-2">{listaOpciones}</div>
          </div>

          {/* Dropdown anclado — ≥lg, sin cambios de comportamiento. */}
          <div
            role="listbox"
            aria-label="Filtrar por marca"
            className="border-borde-tarjeta rounded-card absolute top-full left-0 z-10 mt-2 hidden max-h-72 w-56 flex-col overflow-y-auto border bg-white py-2 lg:flex"
          >
            {listaOpciones}
          </div>
        </>
      ) : null}
    </div>
  );
}
