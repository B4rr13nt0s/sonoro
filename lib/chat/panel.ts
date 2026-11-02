// Lo que el panel del chat (components/chat/PanelChat.tsx) hace con la
// conversación, sin React: armar el Contexto, sumar mensajes y pasar una
// entrada por el motor. Vive aparte para probarse con `node --test`; el
// componente solo dibuja y cablea eventos.

import type { CatalogoChat } from "./catalogo.ts";
import { ESTADO_INICIAL, bloquesDeInicio, cortar, responder } from "./motor.ts";
import type { Bloque, Contexto, Conversacion, Entrada, EventoChat, Mensaje } from "./tipos.ts";

export const PLACEHOLDER_CAMPO = "Escribe tu pregunta";
/** El placeholder después de «Buscar un producto»: un ejemplo de lo que entiende la búsqueda. */
export const PLACEHOLDER_BUSCAR = 'Ej.: sub 12" 2 ohm menos de Q 3,000';

/** El enlace bajo las filas de producto: el destino es `verTodosHref`. */
export function etiquetaVerTodos(total: number): string {
  return total === 1 ? "Ver en Buscar" : `Ver los ${total} resultados`;
}

/** El mismo texto de la confirmación de la ficha (AgregarConCantidad). */
export function textoAgregado(n: number): string {
  return `Has añadido ${n} ${n === 1 ? "ítem" : "ítems"} al carrito.`;
}

/**
 * Lo escrito, listo para enviar: recortado y con el mismo corte del motor.
 * `null` si no queda nada: un texto vacío no se envía (el mensaje de «Hablar
 * con Sonoro» lo tomaría como consulta).
 */
export function prepararTexto(texto: string): string | null {
  const listo = cortar(texto.trim()).trimEnd();
  return listo === "" ? null : listo;
}

export function conversacionInicial(id: string): Conversacion {
  return {
    id,
    estado: ESTADO_INICIAL,
    mensajes: [{ id: 0, autor: "bot", bloques: bloquesDeInicio() }],
  };
}

export function crearContexto(
  catalogo: CatalogoChat | null,
  contacto: Contexto["contacto"],
): Contexto {
  return { productos: catalogo?.productos ?? null, marcas: catalogo?.marcas ?? [], contacto };
}

/** Un Mensaje antes de tener id. */
type MensajeNuevo = { autor: "cliente"; texto: string } | { autor: "bot"; bloques: Bloque[] };

/** La conversación con un mensaje más al final; el id es el siguiente al último. */
export function conMensaje(conversacion: Conversacion, mensaje: MensajeNuevo): Conversacion {
  const id = (conversacion.mensajes.at(-1)?.id ?? -1) + 1;
  const nuevo: Mensaje = { ...mensaje, id };
  return { ...conversacion, mensajes: [...conversacion.mensajes, nuevo] };
}

/** La línea del bot después de «Agregar al carrito». */
export function mensajeAgregado(conversacion: Conversacion, agregadas: number): Conversacion {
  return conMensaje(conversacion, {
    autor: "bot",
    bloques: [
      {
        tipo: "texto",
        texto: textoAgregado(agregadas),
        enlace: { etiqueta: "Ver carrito", href: "/carrito" },
      },
    ],
  });
}

/** Pasa la entrada por el motor y suma su respuesta; el evento, si lo hay, va al registro. */
export function responderEnConversacion(
  conversacion: Conversacion,
  entrada: Entrada,
  contexto: Contexto,
): { conversacion: Conversacion; evento: EventoChat | null } {
  const respuesta = responder(conversacion.estado, entrada, contexto);
  return {
    conversacion: {
      ...conMensaje(conversacion, { autor: "bot", bloques: respuesta.bloques }),
      estado: respuesta.estado,
    },
    evento: respuesta.evento,
  };
}
