// Contrato del libro data/source/catalogo.xlsx — la ÚNICA tabla que dice qué
// trae cada hoja: a qué categoría del sitio corresponde, qué columnas
// específicas lleva, cuáles son obligatorias, qué specs se generan y en qué
// orden salen las destacadas. Validación (contrato.ts), normalización
// (filas.ts), generación de specs (specs.ts) y CSV (csv.ts) leen de acá.
//
// Todo va en CLAVES de campo, nunca en textos de etiqueta: el texto que ve el
// cliente sale solo de lib/catalog/labels.ts.

import { CATEGORIA_SISTEMAS } from "../../lib/catalog/categorias.ts";
import type { Campo, CamposNormalizados } from "../../lib/catalog/labels.ts";

// Bloque común: idéntico, en este orden, en las nueve hojas de producto.
export const COMUN = [
  "sku",
  "slug",
  "nombre",
  "marca",
  "descripcion_corta",
  "precio",
  "precio_antes",
  "disponibilidad",
  "garantia_meses",
  "destacado",
  "activo",
] as const;

// Hojas de referencia para quien edita el libro; el importador no las lee.
export const HOJAS_IGNORADAS = ["INSTRUCCIONES", "LISTAS"] as const;

export const MAX_SPECS_LIBRES = 10;
export const COLUMNAS_SPECS: readonly string[] = Array.from(
  { length: MAX_SPECS_LIBRES },
  (_, i) => [`spec_${i + 1}_etiqueta`, `spec_${i + 1}_valor`],
).flat();

export type CampoHoja = keyof CamposNormalizados;

export type DefHoja = {
  // Categoría del sitio: la hoja ES la categoría, no hay columna que la diga.
  categoria: string;
  // Columnas específicas, en orden canónico (el del CSV de registro).
  campos: readonly CampoHoja[];
  obligatorios: readonly CampoHoja[];
  // Specs generadas, en el orden en que entran a la ficha después de las
  // destacadas. Cada pareja se genera UNA vez, por su campo principal:
  // impedancia_ohm (lee bobinas), carplay (lee android_auto) y
  // salidas_preamp_pares (lee el voltaje).
  generadas: readonly Campo[];
  // Prioridad de las destacadas. Las que falten se completan con la ficha.
  destacadas: readonly Campo[];
  // Solo ESPECIALES: columna `categorias` obligatoria, sin specs generadas.
  multicategoria?: true;
};

export const HOJAS = {
  SUBWOOFERS: {
    categoria: "Subwoofers",
    campos: [
      "medida",
      "potencia_rms_w",
      "impedancia_ohm",
      "bobinas",
      "profundidad_mm",
      "sensibilidad_db",
    ],
    obligatorios: ["medida", "potencia_rms_w", "impedancia_ohm", "bobinas"],
    generadas: ["medida", "potencia_rms_w", "impedancia_ohm", "profundidad_mm", "sensibilidad_db"],
    destacadas: ["medida", "potencia_rms_w", "impedancia_ohm"],
  },
  BOCINAS: {
    categoria: "Bocinas",
    campos: [
      "medida",
      "configuracion",
      "potencia_rms_w",
      "impedancia_ohm",
      "profundidad_mm",
      "sensibilidad_db",
    ],
    obligatorios: ["medida", "configuracion", "potencia_rms_w", "impedancia_ohm"],
    generadas: [
      "medida",
      "configuracion",
      "potencia_rms_w",
      "impedancia_ohm",
      "profundidad_mm",
      "sensibilidad_db",
    ],
    destacadas: ["medida", "configuracion", "potencia_rms_w"],
  },
  AMPLIFICADORES: {
    categoria: "Amplificadores",
    campos: ["canales", "clase", "potencia_rms_w"],
    obligatorios: ["canales", "clase", "potencia_rms_w"],
    generadas: ["canales", "clase", "potencia_rms_w"],
    destacadas: ["canales", "potencia_rms_w", "clase"],
  },
  RECEPTORES: {
    categoria: "Receptores",
    campos: [
      "formato",
      "pantalla_pulg",
      "carplay",
      "android_auto",
      "salidas_preamp_pares",
      "salidas_preamp_voltaje",
    ],
    obligatorios: ["formato", "pantalla_pulg", "carplay", "android_auto", "salidas_preamp_pares"],
    generadas: ["formato", "pantalla_pulg", "carplay", "salidas_preamp_pares"],
    destacadas: ["formato", "pantalla_pulg", "carplay"],
  },
  ECUALIZADORES: {
    categoria: "Ecualizadores",
    campos: [
      "tipo_ecualizador",
      "canales",
      "bandas",
      "salidas_preamp_pares",
      "salidas_preamp_voltaje",
    ],
    obligatorios: ["tipo_ecualizador", "canales"],
    generadas: ["tipo_ecualizador", "canales", "bandas", "salidas_preamp_pares"],
    destacadas: ["tipo_ecualizador", "bandas", "canales"],
  },
  INSONORIZACION: {
    categoria: "Insonorización",
    campos: ["espesor_mm", "cobertura_m2", "material_insono"],
    obligatorios: ["espesor_mm", "cobertura_m2", "material_insono"],
    generadas: ["espesor_mm", "cobertura_m2", "material_insono"],
    destacadas: ["material_insono", "espesor_mm", "cobertura_m2"],
  },
  KITS: {
    categoria: "Kits",
    campos: ["calibre_awg", "material_conductor", "capacidad_w"],
    obligatorios: ["calibre_awg", "material_conductor"],
    generadas: ["calibre_awg", "material_conductor", "capacidad_w"],
    destacadas: ["calibre_awg", "material_conductor", "capacidad_w"],
  },
  ACCESORIOS: {
    categoria: "Accesorios",
    campos: ["tipo_accesorio", "longitud_m"],
    obligatorios: ["tipo_accesorio"],
    generadas: ["tipo_accesorio", "longitud_m"],
    destacadas: ["tipo_accesorio", "longitud_m"],
  },
  ESPECIALES: {
    categoria: CATEGORIA_SISTEMAS,
    campos: [],
    obligatorios: [],
    generadas: [],
    destacadas: [],
    multicategoria: true,
  },
} as const satisfies Record<string, DefHoja>;

export type NombreHoja = keyof typeof HOJAS;
export const NOMBRES_HOJAS = Object.keys(HOJAS) as NombreHoja[];

export function defHoja(hoja: NombreHoja): DefHoja {
  return HOJAS[hoja];
}

// Columnas que una hoja lleva después del bloque común.
export function columnasEspecificas(def: DefHoja): string[] {
  return [...(def.multicategoria ? ["categorias"] : []), ...def.campos, ...COLUMNAS_SPECS];
}
