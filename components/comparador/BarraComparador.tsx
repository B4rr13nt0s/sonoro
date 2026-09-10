"use client";

// Barra flotante del comparador. Aparece con 2 o más seleccionados, o cuando
// hay un aviso pendiente que mostrar.
//
// Esa segunda condición es la que evita inventar un modal: el repo no tiene
// diálogo, toast ni confirmación (components/ui/ es solo boton.ts), y los dos
// avisos —el cupo lleno y el cambio de categoría— caben acá dentro. Con un
// solo producto seleccionado la barra no se muestra, así que sin esa
// condición el aviso de «otra categoría» no tendría dónde salir.
//
// Vocabulario visual prestado del bottom sheet de FiltroMarca: borde
// superior, fondo blanco y el padding de safe-area. Sin sombra ni tokens
// nuevos (CLAUDE.md § Sistema visual).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { construirHrefComparar, useComparador } from "@/lib/comparador/index.ts";
import { useAvisoComparador } from "./avisoComparador.ts";

export function BarraComparador() {
  const { skus, cantidad, hydrated, vaciar, reemplazarCon } = useComparador();
  const { aviso, descartar } = useAvisoComparador();
  const pathname = usePathname();
  const avisoRef = useRef<HTMLDivElement>(null);

  const hayPregunta = aviso?.tipo === "otra_categoria";

  useEffect(() => {
    // Una región viva anuncia el texto pero NO mueve el foco: sin esto, quien
    // usa lector de pantalla escucha una pregunta y no tiene forma evidente
    // de llegar a los botones que la contestan.
    if (hayPregunta) avisoRef.current?.focus();
  }, [hayPregunta]);

  // En /comparar la barra sobra y además confunde: esa página se dibuja desde
  // la URL, no desde la selección guardada, así que un contador que no
  // coincide con las columnas de la tabla es ruido.
  if (pathname === "/comparar") return null;
  // `hydrated` evita que la barra aparezca y desaparezca en el primer render:
  // localStorage no existe durante SSR.
  if (!hydrated) return null;
  if (cantidad < 2 && !aviso) return null;

  return (
    <>
      {/* Reserva el alto que la barra tapa. Va al final del <body>, después
          del pie, así que empuja el final del documento y deja llegar a la
          paginación y al botón «Pedir por WhatsApp» del carrito. */}
      <div aria-hidden="true" className="h-24" />
      <div className="border-borde-nav fixed inset-x-0 bottom-0 z-20 border-t bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-6 pt-4 sm:px-12">
          {aviso ? (
            <div
              ref={avisoRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2.5 text-[14px] sm:flex-row sm:items-center sm:justify-between"
            >
              {aviso.tipo === "lleno" ? (
                <>
                  <span className="text-texto-secundario">
                    Ya estás comparando 4 productos, que es el máximo. Quita uno para agregar otro.
                  </span>
                  <button
                    type="button"
                    onClick={descartar}
                    className="border-borde-pildora text-texto-nav shrink-0 self-start rounded-full border px-4 py-2 text-[13px] sm:self-auto"
                  >
                    Entendido
                  </button>
                </>
              ) : (
                <>
                  <span className="text-texto-secundario">
                    Estás comparando {aviso.categoriaActual.toLowerCase()}. ¿Reemplazar la selección
                    por {aviso.nombre}?
                  </span>
                  <span className="flex shrink-0 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        reemplazarCon(aviso.producto);
                        descartar();
                      }}
                      className="border-negro bg-negro rounded-full border px-4 py-2 text-[13px] text-white"
                    >
                      Reemplazar
                    </button>
                    <button
                      type="button"
                      onClick={descartar}
                      className="border-borde-pildora text-texto-nav rounded-full border px-4 py-2 text-[13px]"
                    >
                      Cancelar
                    </button>
                  </span>
                </>
              )}
            </div>
          ) : null}

          {cantidad >= 2 ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-texto-secundario text-[14px]">
                {cantidad} productos seleccionados
              </span>
              <span className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={vaciar}
                  className="border-borde-pildora text-texto-nav rounded-full border px-4 py-2 text-[13px]"
                >
                  Vaciar
                </button>
                <Link
                  href={construirHrefComparar(skus)}
                  className="border-negro bg-negro rounded-full border px-4.5 py-2 text-[13px] text-white"
                >
                  Comparar ({cantidad})
                </Link>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
