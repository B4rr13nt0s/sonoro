"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import type { Pestana } from "@/lib/busqueda/pestana.ts";

// Las dos pestañas de /buscar (docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md,
// § Pestañas). Pestañas de verdad para el lector de pantalla: una sola en el
// orden de tabulación, ← y → pasan a la otra, Inicio y Fin a la primera y la
// última, y se activan al llegar. Solo el panel activo tiene contenido: así
// «Por vehículo» no baja sus datos si no está a la vista.
//
// La pestaña no vive acá sino en la dirección: el componente la recibe y avisa
// el cambio (SearchExperience lo escribe con replaceState).
const PESTANAS: readonly { valor: Pestana; nombre: string }[] = [
  { valor: "producto", nombre: "Por producto" },
  { valor: "vehiculo", nombre: "Por vehículo" },
];

export function PestanasBuscar({
  pestana,
  alCambiar,
  producto,
  vehiculo,
}: {
  pestana: Pestana;
  alCambiar: (pestana: Pestana) => void;
  producto: ReactNode;
  vehiculo: ReactNode;
}) {
  const id = useId();
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  function ir(indice: number) {
    const destino = (indice + PESTANAS.length) % PESTANAS.length;
    botones.current[destino]?.focus();
    if (PESTANAS[destino].valor !== pestana) alCambiar(PESTANAS[destino].valor);
  }

  function alTecleo(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const destino =
      evento.key === "ArrowRight"
        ? indice + 1
        : evento.key === "ArrowLeft"
          ? indice - 1
          : evento.key === "Home"
            ? 0
            : evento.key === "End"
              ? PESTANAS.length - 1
              : null;
    if (destino === null) return;
    evento.preventDefault();
    ir(destino);
  }

  return (
    <>
      {/* Sin nombre propio: con el del h1 («Buscar en el catálogo») chocaba
          con el del campo, que se llama igual. */}
      {/* pl-12 / sm:pl-18: el px de la sección más los 24 px (pl-6) con que arranca
          el texto «¿No está tu vehículo?» de «Por vehículo»: quedan alineados. */}
      <div role="tablist" className="flex gap-7 px-6 pt-10 pl-12 sm:px-12 sm:pt-14 sm:pl-18">
        {PESTANAS.map((p, indice) => {
          const activa = p.valor === pestana;
          return (
            <button
              key={p.valor}
              ref={(boton) => {
                botones.current[indice] = boton;
              }}
              type="button"
              role="tab"
              id={`${id}-pestana-${p.valor}`}
              aria-selected={activa}
              aria-controls={`${id}-panel-${p.valor}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => {
                if (!activa) alCambiar(p.valor);
              }}
              onKeyDown={(evento) => alTecleo(evento, indice)}
              className={`border-b-2 pb-2.5 text-[15px] ${
                activa
                  ? "border-negro text-negro font-medium"
                  : "text-texto-secundario border-transparent"
              }`}
            >
              {p.nombre}
            </button>
          );
        })}
      </div>
      {PESTANAS.map((p) => {
        const activa = p.valor === pestana;
        return (
          <div
            key={p.valor}
            role="tabpanel"
            id={`${id}-panel-${p.valor}`}
            aria-labelledby={`${id}-pestana-${p.valor}`}
            hidden={!activa}
          >
            {activa ? (p.valor === "producto" ? producto : vehiculo) : null}
          </div>
        );
      })}
    </>
  );
}
