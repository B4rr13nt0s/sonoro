"use client";

// La píldora «Preguntar» y nada más. Es lo único del chat que viaja en el JS
// de cada página: el panel, el motor y la búsqueda se bajan con import() al
// primer clic, y el catálogo con fetch (lib/chat/catalogo.ts). Por eso este
// archivo solo importa ese módulo (pequeño) y tipos.
//
// La conversación vive AQUÍ, en el layout, que no se desmonta al navegar: se
// conserva entre páginas y se pierde al recargar (no hay localStorage). En
// /carrito el lanzador no se dibuja pero sigue montado, así que la
// conversación sobrevive a pasar por el carrito.
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { crearPanelDiferido } from "@/components/chat/PanelDiferido.ts";
import { crearCargadorCatalogo } from "@/lib/chat/catalogo.ts";
import type { Contexto, Conversacion } from "@/lib/chat/tipos.ts";

// El panel se baja con import() al primer clic y, si eso falla, el siguiente
// clic lo reintenta (components/chat/PanelDiferido.ts).
const PanelDiferido = crearPanelDiferido(() => import("./PanelChat"));

// Uno por carga de página: reabrir el panel no vuelve a pedir el catálogo.
const cargarCatalogo = crearCargadorCatalogo();

function IconoPreguntar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3.5 3h11c.6 0 1 .4 1 1v7c0 .6-.4 1-1 1H8.2L5 15v-3H3.5c-.6 0-1-.4-1-1V4c0-.6.4-1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LanzadorChat({ contacto }: { contacto: Contexto["contacto"] }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  const lanzadorRef = useRef<HTMLButtonElement | null>(null);

  // Después de los hooks: devolver null aquí NO desmonta el componente, solo
  // no dibuja nada, y el estado de arriba se conserva.
  if (pathname === "/carrito" || pathname.startsWith("/carrito/")) return null;

  function alternar() {
    if (!abierto) {
      // No se espera: el panel abre ya con el saludo y el menú, que no
      // necesitan el catálogo. El cargador memoiza la promesa.
      void cargarCatalogo();
    }
    setAbierto(!abierto);
  }

  return (
    <>
      <button
        ref={lanzadorRef}
        type="button"
        onClick={alternar}
        // Precarga el panel: al primer clic ya está bajado, o va en camino.
        onPointerEnter={() => PanelDiferido.precargar()}
        onFocus={() => PanelDiferido.precargar()}
        aria-expanded={abierto}
        aria-controls="panel-chat"
        className="bg-negro fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] text-white lg:right-6 lg:bottom-6"
      >
        <IconoPreguntar />
        Preguntar
      </button>
      {abierto ? (
        <PanelDiferido
          conversacion={conversacion}
          setConversacion={setConversacion}
          contacto={contacto}
          cargarCatalogo={cargarCatalogo}
          alCerrar={() => setAbierto(false)}
          alFallar={() => setAbierto(false)}
          lanzadorRef={lanzadorRef}
        />
      ) : null}
    </>
  );
}
