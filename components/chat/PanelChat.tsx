"use client";

// STUB de la tarea 6. La tarea 7 lo reemplaza por el panel real; lo único que
// se conserva es el contrato de PanelChatProps, que el lanzador ya usa.
import type { RefObject } from "react";

import type { CatalogoChat } from "@/lib/chat/catalogo.ts";
import type { Contexto, Conversacion } from "@/lib/chat/tipos.ts";

export interface PanelChatProps {
  conversacion: Conversacion | null;
  setConversacion: (conversacion: Conversacion) => void;
  // El panel arma su Contexto con el catálogo que carga; el layout solo sabe
  // los datos de contacto (variables de servidor).
  contacto: Contexto["contacto"];
  cargarCatalogo: () => Promise<CatalogoChat | null>;
  alCerrar: () => void;
  lanzadorRef: RefObject<HTMLButtonElement | null>;
}

export default function PanelChat(props: PanelChatProps) {
  void props;
  return <div id="panel-chat" role="dialog" aria-label="Preguntas" />;
}
