"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Orden } from "@/lib/catalog/index.ts";

// Mismo control que FiltroMarca, para el orden: píldora que abre un bottom
// sheet en móvil y un dropdown anclado en escritorio. Reemplaza al botón que
// alternaba entre dos órdenes — con tres opciones, un botón que cicla no deja
// ver qué opciones hay ni ir directo a la que se quiere.
//
// El valor seleccionado vive en la URL (?orden=…), no en este componente; lo
// único que es estado local de verdad es si el menú está abierto o cerrado,
// que es puramente presentacional.
//
// Por ser Client Component no puede recibir el builder de href como función
// (Next solo deja cruzar servidor→cliente con datos serializables), así que
// recibe los tres href ya resueltos — los arma `hrefsDeOrden` en
// lib/catalog/href.ts. Igual que `opciones` en FiltroMarca.
const OPCIONES: { valor: Orden; etiqueta: string }[] = [
  { valor: "relevancia", etiqueta: "Relevancia" },
  { valor: "precio_asc", etiqueta: "Precio ↑" },
  { valor: "precio_desc", etiqueta: "Precio ↓" },
];

type OrdenSelectorProps = {
  orden: Orden;
  hrefs: Record<Orden, string>;
};

export function OrdenSelector({ orden, hrefs }: OrdenSelectorProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

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

  // El default no cuenta como selección, igual que "Todas las marcas" en
  // FiltroMarca: con relevancia la píldora dice "Ordenar" y va con borde; solo
  // se pone en negro cuando el usuario pidió un orden distinto. Así la fila de
  // controles muestra de un vistazo qué se tocó y qué está como viene.
  const seleccion = OPCIONES.find((opcion) => opcion.valor === orden);
  const esDefecto = orden === "relevancia";

  // Se renderiza dos veces (bottom sheet en móvil, dropdown anclado en
  // escritorio) — misma lista de opciones, dos contenedores visualmente
  // distintos gateados por CSS (hidden/lg:), igual que FiltroMarca.
  const listaOpciones = (
    <>
      {OPCIONES.map((opcion) => (
        <Link
          key={opcion.valor}
          href={hrefs[opcion.valor]}
          onClick={() => setAbierto(false)}
          role="option"
          aria-selected={opcion.valor === orden}
          className={`px-4 py-3 text-[14px] lg:py-2 ${
            opcion.valor === orden ? "text-negro font-medium" : "text-texto-secundario"
          }`}
        >
          {opcion.etiqueta}
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
          esDefecto ? "border-borde-pildora text-texto-nav" : "border-negro bg-negro text-white"
        }`}
      >
        {esDefecto ? "Ordenar" : seleccion?.etiqueta}
      </button>

      {abierto ? (
        <>
          {/* Bottom sheet — solo <lg, igual que FiltroMarca. */}
          <div
            className="bg-negro/40 fixed inset-0 z-40 lg:hidden"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            aria-label="Ordenar"
            className="border-borde-tarjeta rounded-t-card-lg fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col border-t bg-white pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
          >
            <div className="border-borde-tarjeta flex items-center justify-between border-b px-5 py-4">
              <span className="text-[15px] font-semibold">Ordenar</span>
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

          {/* Dropdown anclado — ≥lg. Anclado a la DERECHA y no a la izquierda
              como FiltroMarca: este es el último control de la fila y va
              pegado al borde de la sección, así que abrirlo hacia la izquierda
              lo mantiene dentro de la página. */}
          <div
            role="listbox"
            aria-label="Ordenar"
            className="border-borde-tarjeta rounded-card absolute top-full right-0 z-10 mt-2 hidden w-44 flex-col border bg-white py-2 lg:flex"
          >
            {listaOpciones}
          </div>
        </>
      ) : null}
    </div>
  );
}
