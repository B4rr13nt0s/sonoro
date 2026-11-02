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

export function crearPanelDiferido(
  importar: () => Promise<{ default: ComponentType<PanelChatProps> }>,
): (props: PanelDiferidoProps) => ReactElement {
  const panel = crearReintentable(() => lazy(importar));

  return function PanelDiferido({ alFallar, ...propsPanel }) {
    return createElement(
      LimiteErrorChat,
      {
        alFallar: () => {
          panel.descartar();
          alFallar();
        },
      },
      createElement(Suspense, { fallback: null }, createElement(panel.actual(), propsPanel)),
    );
  };
}
