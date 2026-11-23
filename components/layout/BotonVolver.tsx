"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { claseBoton } from "@/components/ui/boton.ts";
import { hayPaginaAnterior } from "@/lib/navegacion/volver.ts";

// «Volver» en todas las páginas menos la portada. Vive en el layout, entre el
// header y el contenido, con el mismo ancho y márgenes que el header para que
// quede alineado con el logo en cada página, y sin tocar ninguna de ellas.
//
// Hace lo mismo que el botón de atrás del navegador: vuelve a la página
// anterior, con su scroll y sus filtros. Si no hay una página anterior DEL
// SITIO (se abrió un enlace compartido), lleva a la portada en vez de sacar al
// visitante (lib/navegacion/volver.ts).
//
// Es el mismo botón secundario compacto del sistema (`claseBoton`), con una
// flecha en SVG —no el carácter, que cada sistema dibuja distinto— y 44 px de
// alto mínimo para el dedo.
export function BotonVolver() {
  const pathname = usePathname();
  const router = useRouter();
  // Las rutas que vio el botón desde que cargó el documento: solo es la
  // respuesta de reserva para navegadores sin la Navigation API.
  const paginasVistas = useRef(0);

  useEffect(() => {
    paginasVistas.current += 1;
  }, [pathname]);

  if (pathname === "/") return null;

  function volver() {
    const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
    const hayAtras = hayPaginaAnterior({
      canGoBack: navigation?.canGoBack,
      paginasVistas: paginasVistas.current,
      longitudHistorial: window.history.length,
      referrerMismoOrigen: document.referrer.startsWith(window.location.origin),
    });
    if (hayAtras) router.back();
    else router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pt-4 sm:px-12">
      <button
        type="button"
        onClick={volver}
        className={`${claseBoton("secundario", "compacto")} inline-flex min-h-11 items-center gap-2`}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 3 5 8l5 5" />
        </svg>
        Volver
      </button>
    </div>
  );
}
