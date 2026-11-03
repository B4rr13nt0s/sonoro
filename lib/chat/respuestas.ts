// Los textos y bloques fijos del chat. Las políticas vienen de lib/politicas.ts
// (las mismas frases de /legal/*); acá solo se arman en bloques. Nada de
// criterio experto ni de pago en línea (CLAUDE.md reglas 2 y 3).

import {
  COMO_PEDIR,
  CUOTAS,
  CUOTAS_CONDICIONES,
  ENVIOS,
  GARANTIA_ALCANCE,
  GARANTIA_ANULA,
  INSTALACION,
  SIN_PAGO_EN_LINEA,
  TIEMPO_ENTREGA,
} from "../politicas.ts";
import { buildChatHandoffMessage } from "../whatsapp/message.ts";
import type { Bloque, Contexto, Estado, OpcionId, Tema } from "./tipos.ts";

/** Cómo se nombra cada tema dentro de una frase («tengo una consulta sobre envíos»). */
export const TEMA_NOMBRE: Record<Tema, string> = {
  envios: "envíos",
  garantia: "garantía",
  instalacion: "instalación",
  cuotas: "pagos en cuotas",
  como_pedir: "cómo pedir",
  contacto: "contacto",
};

type Opcion = { id: OpcionId; etiqueta: string };

const OPCION_BUSCAR: Opcion = { id: "buscar", etiqueta: "Buscar un producto" };
export const OPCION_HABLAR: Opcion = { id: "hablar", etiqueta: "Hablar con Sonoro" };

export const OPCIONES_INICIO: readonly Opcion[] = [
  OPCION_BUSCAR,
  { id: "envios", etiqueta: "Envíos" },
  { id: "garantia", etiqueta: "Garantía" },
  { id: "instalacion", etiqueta: "Instalación" },
  { id: "cuotas", etiqueta: "Pagos en cuotas" },
  { id: "como_pedir", etiqueta: "Cómo pedir" },
  OPCION_HABLAR,
];

export const TEXTO_INICIO =
  "Busca un producto por nombre, marca, código o medida, o elige un tema.";

export const TEXTO_PEDIR_BUSQUEDA = "Escribe el nombre, la marca, el código o la medida.";

export const TEXTO_RECOMENDACION =
  "No recomendamos equipo: te mostramos los datos para que compares.";

export const TEXTO_SIN_CATALOGO = "No pudimos cargar el catálogo.";

export const TEXTO_NO_DEFINIDO = "Eso te lo confirma Sonoro directamente.";

export function opcionesHablar(): Bloque {
  return { tipo: "opciones", opciones: [OPCION_HABLAR] };
}

export function bloquesDeInicio(): Bloque[] {
  return [
    { tipo: "texto", texto: TEXTO_INICIO },
    { tipo: "opciones", opciones: [...OPCIONES_INICIO] },
  ];
}

/** El tema de `ultimoTema`, si es uno de los que tienen nombre. */
function nombreDeTema(id: OpcionId | null): string | null {
  return id !== null && Object.hasOwn(TEMA_NOMBRE, id) ? TEMA_NOMBRE[id as Tema] : null;
}

/** «Hablar con Sonoro»: la consulta escrita manda; si no hay, el tema; si no, el saludo. */
export function bloqueHablar(estado: Estado): Bloque {
  return {
    tipo: "whatsapp",
    etiqueta: OPCION_HABLAR.etiqueta,
    motivo: "hablar",
    mensaje: buildChatHandoffMessage({
      consulta: estado.ultimaConsulta,
      tema: nombreDeTema(estado.ultimoTema),
    }),
  };
}

export function bloquesDeRecomendacion(
  categorias: readonly { slug: string; nombre: string }[],
): Bloque[] {
  return [
    { tipo: "texto", texto: TEXTO_RECOMENDACION },
    {
      tipo: "opciones",
      opciones: [
        ...categorias.map((c) => ({ id: `categoria:${c.slug}` as const, etiqueta: c.nombre })),
        OPCION_HABLAR,
      ],
    },
  ];
}

/** Un bloque de texto por párrafo; el enlace, si lo hay, va en el último. */
function parrafos(
  textos: readonly string[],
  enlace?: { etiqueta: string; href: string },
): Bloque[] {
  return textos.map((texto, i) =>
    enlace && i === textos.length - 1 ? { tipo: "texto", texto, enlace } : { tipo: "texto", texto },
  );
}

/** La respuesta a un tema de política, cerrada con «Buscar un producto» y «Hablar con Sonoro». */
export function bloquesDeTema(tema: Tema, contacto: Contexto["contacto"]): Bloque[] {
  const cierre: Bloque = { tipo: "opciones", opciones: [OPCION_BUSCAR, OPCION_HABLAR] };
  switch (tema) {
    case "envios":
      return [
        ...parrafos([ENVIOS, TIEMPO_ENTREGA], {
          etiqueta: "Términos y condiciones",
          href: "/legal/terminos",
        }),
        cierre,
      ];
    case "garantia":
      return [
        ...parrafos([GARANTIA_ALCANCE, GARANTIA_ANULA], {
          etiqueta: "Garantías",
          href: "/legal/garantias",
        }),
        cierre,
      ];
    case "instalacion":
      return [...parrafos([INSTALACION]), cierre];
    case "cuotas":
      return [...parrafos([`${CUOTAS} ${CUOTAS_CONDICIONES}`]), cierre];
    case "como_pedir":
      return [...parrafos([COMO_PEDIR, SIN_PAGO_EN_LINEA]), cierre];
    case "contacto": {
      const datos = [
        contacto.telefono && `Teléfono: ${contacto.telefono}`,
        contacto.correo && `Correo: ${contacto.correo}`,
        contacto.direccion && `Dirección: ${contacto.direccion}`,
      ].filter((d): d is string => Boolean(d));
      if (datos.length > 0) return [...parrafos(datos), cierre];
      // El estado con el que se responde ya trae `ultimoTema: "contacto"`.
      return [
        ...parrafos([TEXTO_NO_DEFINIDO]),
        bloqueHablar({ ultimaConsulta: null, ultimoTema: "contacto" }),
        // «Hablar» ya está arriba como botón de WhatsApp: no se repite.
        { tipo: "opciones", opciones: [OPCION_BUSCAR] },
      ];
    }
    default:
      // Si se agrega un Tema sin su caso, TypeScript marca esta línea.
      return sinCaso(tema);
  }
}

/** Nunca llega un valor: `never` hace que un Tema sin caso no compile. */
function sinCaso(tema: never): Bloque[] {
  throw new Error(`Tema sin respuesta: ${String(tema)}`);
}
