// Contratos del motor del chat (spec: docs/superpowers/specs/2026-11-02-chatbot-design.md,
// § Contratos del motor). Solo tipos y constantes: sin React, sin DOM y sin
// leer variables de entorno, para que el motor se pruebe con `node --test`.

import type { ModoBusqueda, ProductoBuscable } from "../busqueda/busqueda.ts";

/** Largo máximo de lo que el cliente escribe en el chat. */
export const MAX_CONSULTA = 200;

/** Los temas de política que el bot responde con texto fijo. */
export type Tema = "envios" | "garantia" | "instalacion" | "cuotas" | "como_pedir" | "contacto";

export type OpcionId =
  | "buscar"
  | "envios"
  | "garantia"
  | "instalacion"
  | "cuotas"
  | "como_pedir"
  | "contacto" // por texto; no está en el menú de inicio
  | "hablar" // pasar a una persona
  | `categoria:${string}` // slug de categoría del sitio
  | `marca:${string}`; // slug de marca

export type Entrada = { tipo: "texto"; texto: string } | { tipo: "opcion"; id: OpcionId };

export type Bloque =
  | {
      tipo: "texto";
      texto: string;
      // `despues`: lo que cierra la frase tras el enlace (un punto).
      enlace?: { etiqueta: string; href: string; despues?: string };
    }
  | {
      tipo: "filtros";
      aplicados: string[];
      correccion: string | null;
      modo: ModoBusqueda; // los mismos avisos de /buscar
    }
  | { tipo: "productos"; skus: string[]; total: number; verTodosHref: string }
  | { tipo: "opciones"; opciones: { id: OpcionId; etiqueta: string }[] }
  | {
      tipo: "whatsapp";
      etiqueta: string;
      mensaje: string;
      motivo: "hablar" | "disponibilidad";
    };

export interface Estado {
  ultimaConsulta: string | null; // para el mensaje de «Hablar con Sonoro»
  ultimoTema: OpcionId | null;
}

export interface Contexto {
  productos: readonly ProductoBuscable[] | null; // null = catálogo no cargó
  marcas: readonly { nombre: string; slug: string }[];
  // Las BUSINESS_* son variables de servidor: el layout las lee y las pasa.
  contacto: { telefono?: string; correo?: string; direccion?: string };
}

export type EventoChat =
  | { evento: "busqueda"; consulta: string; modo: ModoBusqueda; resultados: number }
  | { evento: "sin_resultados"; consulta: string }
  | { evento: "tema"; tema: OpcionId }
  | { evento: "recomendacion"; consulta: string }
  | { evento: "agregar"; sku: string } // lo emite el panel, no el motor
  | { evento: "whatsapp"; motivo: "hablar" | "disponibilidad" };

/** Un mensaje de la conversación: lo escrito por el cliente o lo que responde el bot. */
export type Mensaje =
  { id: number; autor: "cliente"; texto: string } | { id: number; autor: "bot"; bloques: Bloque[] };

export interface Conversacion {
  id: string;
  estado: Estado;
  mensajes: Mensaje[];
}
