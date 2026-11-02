// El motor del chat: una función pura que convierte lo que el cliente escribe
// o elige en bloques tipados. Sin React, sin DOM y sin variables de entorno
// (el contacto llega por `Contexto`), para probarlo con `node --test`.
// Spec: docs/superpowers/specs/2026-11-02-chatbot-design.md § Conversación.

import { buscar, sugerir } from "../busqueda/busqueda.ts";
import { CATEGORIAS_SITIO } from "../catalog/categorias.ts";
import { compararRelevancia } from "../catalog/orden.ts";
import { buildAvailabilityInquiryMessage } from "../whatsapp/message.ts";
import { detectarIntencion } from "./intencion.ts";
import {
  TEXTO_PEDIR_BUSQUEDA,
  TEXTO_SIN_CATALOGO,
  bloqueHablar,
  bloquesDeInicio,
  bloquesDeRecomendacion,
  TEMA_NOMBRE,
  bloquesDeTema,
  opcionesHablar,
} from "./respuestas.ts";
import {
  MAX_CONSULTA,
  type Bloque,
  type Contexto,
  type Entrada,
  type Estado,
  type EventoChat,
  type Tema,
} from "./tipos.ts";

export { bloquesDeInicio };

export const MAX_PRODUCTOS_CHAT = 5;

export const ESTADO_INICIAL: Estado = { ultimaConsulta: null, ultimoTema: null };

interface Respuesta {
  estado: Estado;
  bloques: Bloque[];
  evento: EventoChat | null;
}

function saludo(estado: Estado): Respuesta {
  return { estado, bloques: bloquesDeInicio(), evento: null };
}

function responderTema(tema: Tema, contexto: Contexto): Respuesta {
  return {
    estado: { ultimaConsulta: null, ultimoTema: tema },
    bloques: bloquesDeTema(tema, contexto.contacto),
    evento: { evento: "tema", tema },
  };
}

/**
 * Busca `consulta` en el catálogo. `verTodosHref` es el destino de «ver
 * todos»: por defecto la misma búsqueda en /buscar; una categoría o una marca
 * lleva al suyo.
 */
function responderBusqueda(consulta: string, contexto: Contexto, verTodosHref?: string): Respuesta {
  const estado: Estado = { ultimaConsulta: consulta, ultimoTema: null };
  const { productos } = contexto;

  if (productos === null) {
    return {
      estado,
      bloques: [
        {
          tipo: "texto",
          texto: TEXTO_SIN_CATALOGO,
          enlace: { etiqueta: "Ir a Buscar", href: "/buscar" },
        },
        opcionesHablar(),
      ],
      evento: null,
    };
  }

  const resultado = buscar(productos, consulta, compararRelevancia);

  if (resultado.productos.length === 0) {
    const sugerencias = sugerir(
      productos,
      contexto.marcas,
      CATEGORIAS_SITIO,
      consulta,
      compararRelevancia,
    );
    const opciones = [
      ...sugerencias.categorias.map((c) => ({
        id: `categoria:${c.slug}` as const,
        etiqueta: c.nombre,
      })),
      ...sugerencias.marcas.map((m) => ({ id: `marca:${m.slug}` as const, etiqueta: m.nombre })),
    ];
    const bloques: Bloque[] = [
      { tipo: "texto", texto: `No encontramos productos para «${consulta}».` },
    ];
    if (opciones.length > 0) bloques.push({ tipo: "opciones", opciones });
    bloques.push({
      tipo: "whatsapp",
      etiqueta: "Consultar disponibilidad por WhatsApp",
      motivo: "disponibilidad",
      mensaje: buildAvailabilityInquiryMessage(consulta),
    });
    return { estado, bloques, evento: { evento: "sin_resultados", consulta } };
  }

  const bloques: Bloque[] = [];
  if (resultado.aplicados.length > 0 || resultado.correccion || resultado.modo !== "exacta") {
    bloques.push({
      tipo: "filtros",
      aplicados: resultado.aplicados,
      correccion: resultado.correccion,
      modo: resultado.modo,
    });
  }
  bloques.push({
    tipo: "productos",
    skus: resultado.productos.slice(0, MAX_PRODUCTOS_CHAT).map((p) => p.sku),
    total: resultado.productos.length,
    verTodosHref: verTodosHref ?? `/buscar?${new URLSearchParams({ q: consulta })}`,
  });
  bloques.push(opcionesHablar());
  return {
    estado,
    bloques,
    evento: {
      evento: "busqueda",
      consulta,
      modo: resultado.modo,
      resultados: resultado.productos.length,
    },
  };
}

function responderOpcion(estado: Estado, id: string, contexto: Contexto): Respuesta {
  if (id === "buscar") {
    return { estado, bloques: [{ tipo: "texto", texto: TEXTO_PEDIR_BUSQUEDA }], evento: null };
  }
  if (id === "hablar") return { estado, bloques: [bloqueHablar(estado)], evento: null };
  if (Object.hasOwn(TEMA_NOMBRE, id)) return responderTema(id as Tema, contexto);

  if (id.startsWith("categoria:")) {
    const slug = id.slice("categoria:".length);
    const categoria = CATEGORIAS_SITIO.find((c) => c.slug === slug);
    if (categoria) return responderBusqueda(categoria.nombre, contexto, `/catalogo/${slug}`);
  }
  if (id.startsWith("marca:")) {
    const slug = id.slice("marca:".length);
    const marca = contexto.marcas.find((m) => m.slug === slug);
    if (marca) return responderBusqueda(marca.nombre, contexto, `/marcas/${slug}`);
  }
  return saludo(estado);
}

/**
 * Corta a MAX_CONSULTA unidades UTF-16 sin dejar medio emoji: un surrogate
 * alto suelto en el último lugar haría fallar `encodeURIComponent` (URIError)
 * al armar el enlace de WhatsApp.
 */
export function cortar(texto: string): string {
  const corte = texto.slice(0, MAX_CONSULTA);
  const ultimo = corte.charCodeAt(corte.length - 1);
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? corte.slice(0, -1) : corte;
}

export function responder(estado: Estado, entrada: Entrada, contexto: Contexto): Respuesta {
  if (entrada.tipo === "opcion") return responderOpcion(estado, entrada.id, contexto);

  // Lo escrito se corta antes de cualquier otra cosa: nada de lo que sigue
  // (intención, búsqueda, evento, mensaje de WhatsApp) ve más de MAX_CONSULTA.
  const texto = cortar(entrada.texto.trim()).trimEnd();
  if (texto === "") return saludo(estado);

  const intencion = detectarIntencion(texto);
  switch (intencion.tipo) {
    case "saludo":
      return saludo(estado);
    case "recomendacion":
      return {
        estado: { ultimaConsulta: texto, ultimoTema: null },
        bloques: bloquesDeRecomendacion(CATEGORIAS_SITIO),
        evento: { evento: "recomendacion", consulta: texto },
      };
    case "tema":
      return responderTema(intencion.tema, contexto);
    case "busqueda":
      return responderBusqueda(intencion.consulta, contexto);
  }
}
