// Lo que el panel del chat (components/chat/PanelChat.tsx) hace con la
// conversación, sin React: armar el Contexto, sumar mensajes y pasar una
// entrada por el motor. Vive aparte para probarse con `node --test`; el
// componente solo dibuja y cablea eventos.

import type { ModoBusqueda } from "../busqueda/busqueda.ts";
import { textoAgregado } from "../cart/confirmacion.ts";
import type { DatosVehiculos } from "../vehiculos/types.ts";
import type { CatalogoChat } from "./catalogo.ts";
import { ESTADO_INICIAL, bloquesDeInicio, cortar, responder } from "./motor.ts";
import type { Bloque, Contexto, Conversacion, Entrada, EventoChat, Mensaje } from "./tipos.ts";
import { nombresAmbiguos } from "./vehiculo.ts";

export const PLACEHOLDER_CAMPO = "Escribe tu pregunta";
/** El placeholder después de «Buscar un producto»: un ejemplo de lo que entiende la búsqueda. */
export const PLACEHOLDER_BUSCAR = 'Ej.: sub 12" 2 ohm menos de Q 3,000';

/** El enlace bajo las filas de producto: el destino es `verTodosHref`. */
export function etiquetaVerTodos(total: number): string {
  return total === 1 ? "Ver en Buscar" : `Ver los ${total} resultados`;
}

/** «Filtros de tu búsqueda: …», el mismo texto de /buscar (SearchExperience). */
export function textoFiltros(aplicados: readonly string[]): string | null {
  return aplicados.length > 0 ? `Filtros de tu búsqueda: ${aplicados.join(" · ")}` : null;
}

/**
 * El aviso de /buscar cuando la búsqueda no fue exacta. En la «cercana» es la
 * frase que armó la búsqueda (`cercania`): qué no hay y qué se muestra.
 */
export function textoModo(modo: ModoBusqueda, cercania?: string | null): string | null {
  if (modo === "exacta") return null;
  if (modo === "cercana") return cercania ?? null;
  return modo === "parcial"
    ? "Ningún producto coincide con todo lo que escribiste; estos coinciden con alguna palabra."
    : "No hay coincidencias exactas; estos se le parecen.";
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

// Los modelos ambiguos dependen del catálogo y de los vehículos: se calculan
// una vez por catálogo cargado (corren una búsqueda por modelo), no en cada
// mensaje.
const AMBIGUOS = new WeakMap<CatalogoChat, { datos: DatosVehiculos; ambiguos: Set<string> }>();

function ambiguosDe(catalogo: CatalogoChat | null, datos: DatosVehiculos): Set<string> {
  if (!catalogo) return new Set();
  const guardado = AMBIGUOS.get(catalogo);
  if (guardado && guardado.datos === datos) return guardado.ambiguos;
  const ambiguos = nombresAmbiguos(datos.vehiculos, catalogo.productos);
  AMBIGUOS.set(catalogo, { datos, ambiguos });
  return ambiguos;
}

export function crearContexto(
  catalogo: CatalogoChat | null,
  vehiculos: DatosVehiculos | null,
  contacto: Contexto["contacto"],
): Contexto {
  return {
    productos: catalogo?.productos ?? null,
    marcas: catalogo?.marcas ?? [],
    fichas: catalogo?.fichas ?? {},
    contacto,
    vehiculos: vehiculos ? { datos: vehiculos, ambiguos: ambiguosDe(catalogo, vehiculos) } : null,
  };
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

export interface ColaDeRespuestas {
  /**
   * `preparar` es lo que la respuesta espera (el catálogo, ya en camino);
   * `aplicar` la escribe en la conversación. Las respuestas se aplican en el
   * orden en que se encolaron, aunque una posterior esté lista antes: así el
   * historial queda Q1, Q2, R1, R2 y el estado de la conversación (consulta o
   * tema para «Hablar con Sonoro») es el de la última respuesta, no el de una
   * lenta que llega tarde. Una respuesta que no espera nada solo se demora
   * mientras haya otra anterior pendiente. Si `preparar` rechaza, esa
   * respuesta falla y las siguientes salen igual.
   */
  encolar<T>(preparar: Promise<T> | T, aplicar: (valor: T) => void): Promise<void>;
}

export function colaDeRespuestas(): ColaDeRespuestas {
  let ultima: Promise<void> = Promise.resolve();
  return {
    encolar(preparar, aplicar) {
      const previo = ultima;
      const esta = (async () => {
        const valor = await preparar;
        await previo;
        aplicar(valor);
      })();
      ultima = esta.catch(() => {});
      return esta;
    },
  };
}

/** Con punto final, salvo que ya lo traiga. */
function frase(texto: string): string {
  return /[.!?]$/.test(texto) ? texto : `${texto}.`;
}

/**
 * Lo que la región en vivo del panel anuncia de un mensaje: un resumen corto
 * de la respuesta del bot, no el historial entero. Una búsqueda dice cuántos
 * resultados hay, no cada fila con su precio y su botón; las opciones no se
 * leen (están a un Tab). Lo del cliente no se anuncia: es lo que acaba de
 * escribir.
 */
export function resumenDeMensaje(mensaje: Mensaje): string | null {
  if (mensaje.autor === "cliente") return null;
  const partes: string[] = [];
  for (const bloque of mensaje.bloques) {
    switch (bloque.tipo) {
      case "texto":
        if (bloque.enlace?.despues) {
          // La frase sigue después del enlace: se lee de corrido.
          partes.push(`${bloque.texto} ${bloque.enlace.etiqueta}${bloque.enlace.despues}`);
          break;
        }
        partes.push(frase(bloque.texto));
        if (bloque.enlace) partes.push(frase(bloque.enlace.etiqueta));
        break;
      case "filtros": {
        const filtros = textoFiltros(bloque.aplicados);
        const modo = textoModo(bloque.modo, bloque.cercania);
        if (filtros) partes.push(frase(filtros));
        if (modo) partes.push(frase(modo));
        if (modo && bloque.correccion) partes.push(`Quizá quisiste decir «${bloque.correccion}».`);
        break;
      }
      case "productos": {
        const { total } = bloque;
        const mostrados = bloque.skus.length;
        partes.push(
          total === 1
            ? "1 resultado."
            : mostrados < total
              ? `${total} resultados; se muestran ${mostrados}.`
              : `${total} resultados.`,
        );
        // Lo preguntado de un solo producto también se anuncia: es la respuesta.
        const filas = mostrados === 1 ? bloque.datos?.[bloque.skus[0]] : undefined;
        for (const { etiqueta, valor } of filas ?? []) partes.push(frase(`${etiqueta}: ${valor}`));
        break;
      }
      case "whatsapp":
        partes.push(frase(bloque.etiqueta));
        break;
      case "opciones":
      case "acotar":
        break;
    }
  }
  return partes.length > 0 ? partes.join(" ") : null;
}

/**
 * La conversación de la que parte el próximo cambio. `prop` es la que tiene
 * el lanzador según el último render; `guardada`, la última que escribió un
 * panel (este u otro montaje anterior). Una conversación solo crece, así que
 * si es la misma y la guardada va más adelante, la prop se quedó atrás (el
 * render todavía no llegó, o una respuesta tardía la escribió un panel ya
 * desmontado) y gana la guardada. Si es otra conversación, manda el lanzador.
 */
export function adoptar(prop: Conversacion, guardada: Conversacion | null): Conversacion {
  if (!guardada || guardada.id !== prop.id) return prop;
  const ultimo = (c: Conversacion) => c.mensajes.at(-1)?.id ?? -1;
  return ultimo(guardada) > ultimo(prop) ? guardada : prop;
}
