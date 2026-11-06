// Preguntas por un dato de un producto: «¿cuántos watts tiene el MJP1244?»,
// «¿está disponible el SQ12-D2?». El vocabulario vive acá, como el de los
// temas en `intencion.ts`, ya normalizado (sin acentos ni mayúsculas). La
// respuesta sale de la ficha técnica tal como la publica el fabricante: el
// chat muestra el valor, nunca dice si «sirve» (regla 2), y tampoco contesta
// «sí» o «no» a «¿es de 2 ohm?» —comparar el número escrito con un rango o
// con la potencia en puente es donde se equivocaría—.

import type { Disponibilidad, Spec } from "../catalog/types.ts";
import { formatQ, lineaCuota } from "../format/precio.ts";

/** Un dato de la ficha técnica, con las etiquetas que lo publican. */
export interface CampoSpec {
  tipo: "spec";
  id: string;
  /** Para la fila de un producto que no lo publica: «Potencia: sin dato del fabricante». */
  nombre: string;
  /** Para la frase de un solo producto: «el fabricante no publica la potencia». */
  frase: string;
  etiquetas: readonly string[];
}

export type Campo = CampoSpec | { tipo: "disponibilidad" } | { tipo: "precio" };

interface Vocabulario {
  campo: Campo;
  /** Frases enteras, ya normalizadas. */
  palabras: readonly string[];
}

// Las etiquetas son las de `specsFicha` (data/catalog.json). Varias por dato
// porque cada categoría lo nombra a su manera: la potencia de un amplificador
// es «Potencia RMS», la de un receptor «Potencia de salida».
export const VOCABULARIO_DATOS: readonly Vocabulario[] = [
  {
    campo: {
      tipo: "spec",
      id: "potencia",
      nombre: "Potencia",
      frase: "la potencia",
      etiquetas: [
        "Potencia RMS",
        "Potencia máxima",
        "Potencia de salida",
        "Potencia total",
        "Potencia",
      ],
    },
    palabras: ["watts", "watt", "vatios", "potencia", "rms"],
  },
  {
    campo: {
      tipo: "spec",
      id: "impedancia",
      nombre: "Impedancia",
      frase: "la impedancia",
      etiquetas: ["Impedancia", "Impedancia mínima"],
    },
    palabras: ["impedancia", "ohm", "ohms", "ohmios"],
  },
  {
    campo: {
      tipo: "spec",
      id: "medida",
      nombre: "Medida",
      frase: "la medida",
      etiquetas: [
        "Tamaño",
        "Diámetro",
        "Pantalla",
        "Dimensiones",
        "Diámetro de corte",
        "Profundidad de montaje",
        "Longitud",
      ],
    },
    palabras: [
      "medida",
      "medidas",
      "tamano",
      "pulgadas",
      "pulgada",
      "diametro",
      "dimensiones",
      "mide",
    ],
  },
  {
    campo: {
      tipo: "spec",
      id: "profundidad",
      nombre: "Profundidad",
      frase: "la profundidad",
      etiquetas: ["Profundidad de montaje"],
    },
    palabras: ["profundidad"],
  },
  {
    campo: {
      tipo: "spec",
      id: "canales",
      nombre: "Canales",
      frase: "los canales",
      etiquetas: ["Canales"],
    },
    palabras: ["canales"],
  },
  {
    campo: {
      tipo: "spec",
      id: "frecuencia",
      nombre: "Respuesta en frecuencia",
      frase: "la respuesta en frecuencia",
      etiquetas: ["Respuesta en frecuencia", "Frecuencia de resonancia"],
    },
    palabras: ["frecuencia", "hz"],
  },
  {
    campo: {
      tipo: "spec",
      id: "sensibilidad",
      nombre: "Sensibilidad",
      frase: "la sensibilidad",
      etiquetas: ["Sensibilidad", "Sensibilidad de entrada"],
    },
    palabras: ["sensibilidad"],
  },
  {
    campo: { tipo: "spec", id: "peso", nombre: "Peso", frase: "el peso", etiquetas: ["Peso"] },
    palabras: ["peso", "pesa"],
  },
  {
    campo: {
      tipo: "spec",
      id: "calibre",
      nombre: "Calibre",
      frase: "el calibre",
      etiquetas: ["Calibre", "Ajuste de calibre"],
    },
    palabras: ["calibre", "awg", "gauge"],
  },
  {
    campo: {
      tipo: "spec",
      id: "contenido",
      nombre: "Contenido",
      frase: "el contenido",
      // Un kit de instalación no tiene «Contenido»: lo que trae va pieza por
      // pieza, en el orden de su ficha.
      etiquetas: [
        "Contenido",
        "Incluye",
        "Componentes",
        "Cables RCA incluidos",
        "Portafusible",
        "Cable de alimentación",
        "Cable de tierra",
        "Cable remoto",
        "Cables RCA",
        "Cable para altavoz",
        "Terminales",
        "Accesorios",
      ],
    },
    // Sin «que trae» ni «incluye» sueltos: «radio que trae bluetooth» busca
    // un radio, no pregunta por el contenido de una caja.
    palabras: ["contenido", "que incluye", "que contiene"],
  },
  {
    // El precio y la cuota, como en la ficha. «cuánto cuesta» también es un
    // arranque de búsqueda (`intencion.ts`): se busca antes de quitarlo.
    campo: { tipo: "precio" },
    // Sin «vale» ni «sale» sueltos: «vale» es un «ok» y «¿sale en negro?» no
    // pregunta un precio.
    palabras: ["cuanto cuesta", "cuanto vale", "cuanto sale", "precio", "cuesta"],
  },
  {
    campo: { tipo: "disponibilidad" },
    palabras: [
      "disponible",
      "disponibles",
      "disponibilidad",
      "existencia",
      "existencias",
      "stock",
      "inventario",
      "agotado",
      "agotados",
    ],
  },
];

/**
 * Palabras de la pregunta que no nombran el producto («cuántos», «tiene»,
 * «es»): se quitan de lo que se busca, estén donde estén. Las de relleno
 * comunes (`el`, `de`, `para`…) las agrega `intencion.ts`.
 */
export const PALABRAS_DE_PREGUNTA: ReadonlySet<string> = new Set([
  "cuanto",
  "cuantos",
  "cuantas",
  "es",
  "son",
  "tiene",
  "tienen",
  "trae",
  "traen",
  "esta",
  "estan",
  "hay",
  "aguanta",
  "soporta",
  "saca",
  "da",
  "sabe",
  "saber",
  "quisiera",
  "puedes",
  "podrias",
  "decir",
]);

/** Los valores que publica la ficha para un dato, en el orden de la ficha. */
export function valoresDeCampo(ficha: readonly Spec[], campo: CampoSpec): Spec[] {
  return ficha.filter((spec) => campo.etiquetas.includes(spec.etiqueta));
}

/** «X cuesta Q 2,450.00, o Q 408.34 al mes × 6.» */
export function frasePrecio(nombre: string, precioCents: number): string {
  return `${nombre} cuesta ${formatQ(precioCents)}, ${lineaCuota(precioCents)}.`;
}

/** La frase de disponibilidad para un solo producto. */
export function fraseDisponibilidad(nombre: string, disponibilidad: Disponibilidad): string {
  switch (disponibilidad) {
    case "disponible":
      return `${nombre}: disponible.`;
    case "bajo_pedido":
      return `${nombre}: bajo pedido. Sonoro te confirma el tiempo de entrega.`;
    case "agotado":
      return `${nombre}: agotado.`;
  }
}

/** La etiqueta de la fila de disponibilidad, en una lista. */
export function valorDisponibilidad(disponibilidad: Disponibilidad): string {
  switch (disponibilidad) {
    case "disponible":
      return "Disponible";
    case "bajo_pedido":
      return "Bajo pedido";
    case "agotado":
      return "Agotado";
  }
}
