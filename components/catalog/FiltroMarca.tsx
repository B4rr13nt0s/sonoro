"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buildCatalogHref } from "@/lib/catalog/href.ts";
import type { Brand, Orden } from "@/lib/catalog/index.ts";

// El valor seleccionado vive en la URL (?marca=slug), no en este componente
// — lo único que es estado local de verdad es si el menú está abierto o
// cerrado, que es puramente presentacional.
type FiltroMarcaProps = {
  categoriaSlug: string;
  marcas: Brand[];
  marcaActual?: string;
  orden: Orden;
};

export function FiltroMarca({ categoriaSlug, marcas, marcaActual, orden }: FiltroMarcaProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const marcaSeleccionada = marcas.find((marca) => marca.slug === marcaActual);

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

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className={`rounded-full border px-4.5 py-2 text-[13px] ${
          marcaSeleccionada
            ? "border-negro bg-negro text-white"
            : "border-borde-pildora text-texto-nav"
        }`}
      >
        {marcaSeleccionada ? marcaSeleccionada.nombre : "Marca"}
      </button>

      {abierto ? (
        <div
          role="listbox"
          className="border-borde-tarjeta rounded-card absolute top-full left-0 z-10 mt-2 flex max-h-72 w-56 flex-col overflow-y-auto border bg-white py-2"
        >
          <Link
            href={buildCatalogHref(categoriaSlug, { orden })}
            onClick={() => setAbierto(false)}
            role="option"
            aria-selected={!marcaActual}
            className={`px-4 py-2 text-[14px] ${
              !marcaActual ? "text-negro font-medium" : "text-texto-secundario"
            }`}
          >
            Todas las marcas
          </Link>
          {marcas.map((marca) => (
            <Link
              key={marca.slug}
              href={buildCatalogHref(categoriaSlug, { marca: marca.slug, orden })}
              onClick={() => setAbierto(false)}
              role="option"
              aria-selected={marca.slug === marcaActual}
              className={`px-4 py-2 text-[14px] ${
                marca.slug === marcaActual ? "text-negro font-medium" : "text-texto-secundario"
              }`}
            >
              {marca.nombre}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
