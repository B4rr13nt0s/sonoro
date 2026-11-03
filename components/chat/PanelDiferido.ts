"use client";

// El panel del chat, bajado con import() y contenido: lazy + Suspense + límite
// de error. Vive aparte del lanzador para poder probarse con un DOM simulado.
//
// Por qué este cableado y no un lazy suelto:
// - Suspense no atrapa errores. Si el import() se rechaza (sin red al primer
//   clic, un chunk que ya no existe tras un deploy), el error subiría hasta el
//   límite de error de la app y se caería la página entera por un extra.
// - lazy recuerda la promesa que falló. El lazy fallido se queda como el
//   vigente mientras el error llega al límite (si se cambiara al rechazarse,
//   React volvería a dibujar con otro lazy y reintentaría el import() sin fin);
//   el límite lo descarta al atraparlo, y el SIGUIENTE clic crea uno nuevo.
// Sin JSX a propósito: es .ts para que `node --test` lo cargue.
import { createElement, lazy, Suspense, type ComponentType, type ReactElement } from "react";

import { crearReintentable } from "../../lib/chat/reintentable.ts";
import { LimiteErrorChat } from "./LimiteErrorChat.ts";
import type { PanelChatProps } from "./PanelChat";

export type PanelDiferidoProps = PanelChatProps & {
  /** El panel no se pudo bajar o lanzó al dibujarse: hay que cerrarlo. */
  alFallar: () => void;
};

export type PanelDiferido = ((props: PanelDiferidoProps) => ReactElement) & {
  /**
   * Empieza a bajar el panel sin abrirlo (al acercar el puntero o enfocar el
   * lanzador), para que el primer clic ya lo encuentre. Comparte el import()
   * con el lazy: abrir mientras la precarga vuela no baja el panel dos veces.
   */
  precargar: () => void;
};

export function crearPanelDiferido(
  importar: () => Promise<{ default: ComponentType<PanelChatProps> }>,
): PanelDiferido {
  // El import() en vuelo o ya resuelto, compartido por la precarga y el lazy.
  // `leido` dice si un lazy ya se quedó con esta promesa.
  let modulo: Promise<{ default: ComponentType<PanelChatProps> }> | null = null;
  let leido = false;
  const bajar = () => (modulo ??= importar());

  const panel = crearReintentable(() =>
    lazy(() => {
      leido = true;
      return bajar();
    }),
  );

  function PanelDiferido({ alFallar, ...propsPanel }: PanelDiferidoProps) {
    return createElement(
      LimiteErrorChat,
      {
        alFallar: () => {
          panel.descartar();
          modulo = null;
          leido = false;
          alFallar();
        },
      },
      createElement(Suspense, { fallback: null }, createElement(panel.actual(), propsPanel)),
    );
  }

  function precargar() {
    const esta = bajar();
    // Una precarga que falla (sin red al pasar el puntero) se olvida, para que
    // el clic intente de nuevo. Si el lazy ya la leyó, el error le toca al
    // límite de error, que la descarta al atraparlo.
    esta.catch(() => {
      if (modulo === esta && !leido) modulo = null;
    });
  }

  return Object.assign(PanelDiferido, { precargar });
}
