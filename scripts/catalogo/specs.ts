// Generación de las specs legibles a partir de los campos normalizados. Puro.
//
// Cero traducciones propias: etiqueta y valor salen de lib/catalog/labels.ts,
// la misma fuente que usan los filtros y el comparador. Si algo se ve mal en
// una ficha generada, se arregla allá.
//
// Reglas (docs/IMPORTADOR.md):
//   PRECEDENCIA  una spec libre con la etiqueta de una generada GANA: reemplaza
//                el valor en el mismo lugar. Si su primer número no coincide
//                con el campo normalizado, se advierte (no se bloquea).
//   DESTACADAS   las tres primeras, en la prioridad de la hoja; las que falten
//                se completan con la ficha, saltando etiquetas de marketing.
//   FICHA        destacadas, luego el resto de generadas, luego las libres.
//                Máximo 10; lo que no entra se advierte.

import {
  fieldLabel,
  formatValue,
  type Campo,
  type CamposNormalizados,
} from "../../lib/catalog/labels.ts";
import type { Spec } from "../../lib/catalog/types.ts";
import type { DefHoja } from "./hojas.ts";

export const MAX_FICHA = 10;
export const CANTIDAD_DESTACADAS = 3;
const ETIQUETAS_MARKETING = ["Ventaja", "Línea", "Serie", "Diseño"];

export type Advertencia = {
  tipo: "contradiccion" | "recorte" | "marketing";
  detalle: string;
};

export type ResultadoSpecs = {
  specsDestacadas: Spec[];
  specsFicha: Spec[];
  advertencias: Advertencia[];
};

// «Potencia rms» y «Potencia RMS» son la misma etiqueta; también con y sin
// tilde, porque en una hoja editada a mano pasa.
export function normalizarEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const MARKETING = new Set(ETIQUETAS_MARKETING.map(normalizarEtiqueta));

// «1,600 W» → 1600 · «ø283 mm» → 283 · «125 W × 4 @ 4 Ω» → 125.
export function primerNumero(texto: string): number | null {
  const m = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/.exec(texto);
  return m ? Number(m[0].replace(/,/g, "")) : null;
}

// El número contra el que se compara una spec libre que le gana a un campo.
// null = el campo no tiene un número que comparar (listas, CarPlay).
function numeroDelCampo(campo: Campo, atributos: CamposNormalizados): number | null {
  if (campo === "medida")
    return atributos.medida === undefined ? null : primerNumero(atributos.medida);
  if (campo === "bobinas") return atributos.impedancia_ohm ?? null;
  const valor = atributos[campo];
  return typeof valor === "number" ? valor : null;
}

type Item = { campo: Campo | null; spec: Spec };

export function construirSpecs(
  def: DefHoja,
  atributos: CamposNormalizados,
  libres: readonly Spec[],
): ResultadoSpecs {
  const categoria = def.categoria;
  const advertencias: Advertencia[] = [];

  const slots = def.generadas.map((campo) => ({
    campo,
    etiqueta: fieldLabel(campo, categoria),
    valor: formatValue(campo, atributos, categoria),
    deLibre: false,
  }));

  const libresSueltas: Spec[] = [];
  for (const libre of libres) {
    const clave = normalizarEtiqueta(libre.etiqueta);
    const slot = slots.find((s) => !s.deLibre && normalizarEtiqueta(s.etiqueta) === clave);
    if (!slot) {
      libresSueltas.push(libre);
      continue;
    }
    // Solo se compara cuando el campo sí iba a generar un valor. Si el slot
    // estaba omitido (pantalla 0, sin preamp), la libre llena un hueco en vez
    // de contradecir algo que se muestra.
    if (slot.valor !== null) {
      const delCampo = numeroDelCampo(slot.campo, atributos);
      const deLaLibre = primerNumero(libre.valor);
      if (delCampo !== null && deLaLibre !== null && delCampo !== deLaLibre) {
        advertencias.push({
          tipo: "contradiccion",
          detalle: `la spec libre «${libre.etiqueta}: ${libre.valor}» dice ${deLaLibre}, pero ${slot.campo} = ${delCampo}. Se publica la libre.`,
        });
      }
    }
    slot.valor = libre.valor;
    slot.deLibre = true;
  }

  const generadas: Item[] = slots.flatMap((s) =>
    s.valor === null ? [] : [{ campo: s.campo, spec: { etiqueta: s.etiqueta, valor: s.valor } }],
  );
  const sueltas: Item[] = libresSueltas.map((spec) => ({ campo: null, spec }));

  const destacadas: Item[] = def.destacadas.flatMap((campo) =>
    generadas.filter((item) => item.campo === campo),
  );
  const candidatas = [...generadas.filter((item) => !destacadas.includes(item)), ...sueltas];
  const esMarketing = (item: Item) => MARKETING.has(normalizarEtiqueta(item.spec.etiqueta));
  for (const item of candidatas) {
    if (destacadas.length >= CANTIDAD_DESTACADAS) break;
    if (!esMarketing(item)) destacadas.push(item);
  }
  // Último recurso: una ficha sin otra cosa que ofrecer. Mejor una etiqueta
  // de marketing en destacadas que un producto rechazado por tener dos.
  for (const item of candidatas) {
    if (destacadas.length >= CANTIDAD_DESTACADAS) break;
    if (esMarketing(item) && !destacadas.includes(item)) {
      destacadas.push(item);
      advertencias.push({
        tipo: "marketing",
        detalle: `«${item.spec.etiqueta}» quedó entre las destacadas porque no hay otra spec que ponga`,
      });
    }
  }

  const ficha = [...destacadas, ...candidatas.filter((item) => !destacadas.includes(item))];
  if (ficha.length > MAX_FICHA) {
    const fuera = ficha.slice(MAX_FICHA).map((item) => `«${item.spec.etiqueta}»`);
    advertencias.push({
      tipo: "recorte",
      detalle: `${ficha.length} specs y el máximo es ${MAX_FICHA}: queda fuera ${fuera.join(", ")}`,
    });
  }

  return {
    specsDestacadas: destacadas.map((item) => item.spec),
    specsFicha: ficha.slice(0, MAX_FICHA).map((item) => item.spec),
    advertencias,
  };
}
