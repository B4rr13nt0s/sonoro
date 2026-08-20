"use client";

import Link from "next/link";
import { useRef } from "react";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import type { Brand } from "@/lib/catalog/index.ts";

// Los botones ← → del handoff son <span> decorativos (sin lógica, como todo
// el prototipo). Aquí sí desplazan el carrusel — un botón que no hace nada
// es peor que no tenerlo.
const DESPLAZAMIENTO_PX = 264; // ancho de tarjeta (232px) + gap (16px) + margen

export function MarcasScroller({ marcas }: { marcas: Brand[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function desplazar(direccion: -1 | 1) {
    scrollRef.current?.scrollBy({ left: direccion * DESPLAZAMIENTO_PX, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-9">
      <div className="flex items-end justify-between gap-12">
        <div className="flex flex-col gap-3">
          <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
            Marcas que vendemos
          </div>
          <h2 className="text-26 sm:text-40 font-semibold tracking-[-0.03em]">
            {marcas.length === 1
              ? "Una marca, importada de forma directa."
              : `${marcas.length} marcas, importadas de forma directa.`}
          </h2>
        </div>
        <div className="hidden flex-none gap-2.5 sm:flex">
          <button
            type="button"
            onClick={() => desplazar(-1)}
            aria-label="Marcas anteriores"
            className="border-borde-pildora text-texto-terciario flex h-11 w-11 items-center justify-center rounded-full border text-[16px]"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => desplazar(1)}
            aria-label="Marcas siguientes"
            className="border-negro flex h-11 w-11 items-center justify-center rounded-full border text-[16px]"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex [scrollbar-width:none] gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {marcas.map((marca) => (
          <Link
            key={marca.slug}
            href={`/marcas/${marca.slug}`}
            className="rounded-card-lg border-borde-tarjeta flex w-[232px] flex-none flex-col overflow-hidden border"
          >
            <PlaceholderImage
              label={`LOGO — ${marca.nombre}`}
              className="h-[132px] items-center justify-center"
            />
            <div className="px-5 py-5 text-[19px] font-semibold tracking-[-0.02em]">
              {marca.nombre}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
