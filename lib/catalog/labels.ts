// ÚNICA fuente de traducción de los valores normalizados del catálogo a texto
// para el cliente. La usan el importador (para GENERAR las specs legibles),
// los filtros y el comparador. Si una etiqueta se traduce en dos lugares, en
// el primer cambio el catálogo generado y la interfaz dicen cosas distintas y
// nadie lo nota hasta que lo ve un cliente — por eso nada de esto se duplica.
//
// Vive en lib/catalog/ y no en un módulo de interfaz: es conocimiento del
// dominio del catálogo, no de la pantalla que lo muestra.
//
// Ojo con el acoplamiento: cambiar una etiqueta acá cambia data/catalog.json
// en el próximo `npm run import:catalog`, además de la interfaz.

// ── Traducción de los campos de lista ───────────────────────────────────────
// Las claves de cada tabla SON los valores válidos de la hoja LISTAS del libro
// (data/source/catalogo.xlsx). labels.test.ts verifica la correspondencia en
// los dos sentidos: ningún valor de LISTAS sin traducción, y ninguna
// traducción de un valor que ya no existe en LISTAS.
export const VALUE_LABELS = {
  configuracion: {
    "coaxial-2v": "Coaxial de 2 vías",
    "coaxial-3v": "Coaxial de 3 vías",
    "componentes-2v": "Componentes de 2 vías",
    "componentes-3v": "Componentes de 3 vías",
    "medio-rango": "Medio rango",
    tweeter: "Tweeter",
  },
  bobinas: {
    simple: "Bobina simple",
    doble: "Doble bobina",
    triple: "Triple bobina",
  },
  clase: {
    D: "Clase D",
    AB: "Clase AB",
    BR: "Clase BR",
  },
  formato: {
    "1-din": "1 DIN",
    "2-din": "Doble DIN",
    flotante: "Pantalla flotante",
    especifico: "Específico por vehículo",
  },
  material_conductor: {
    cobre: "Cobre",
    cca: "CCA (aluminio recubierto)",
    mixto: "Mixto",
  },
  material_insono: {
    butilo: "Butilo",
    espuma: "Espuma de celda cerrada",
    fieltro: "Fieltro",
    mixto: "Multicapa",
  },
  tipo_ecualizador: {
    grafico: "Ecualizador gráfico",
    parametrico: "Ecualizador paramétrico",
    procesador: "Procesador digital (DSP)",
  },
  tipo_accesorio: {
    "cable-rca": "Cable RCA",
    "cable-corriente": "Cable de corriente",
    "cable-bocina": "Cable de bocina",
    adaptador: "Adaptador",
    distribuidor: "Bloque distribuidor",
    portafusible: "Portafusible",
    conector: "Conector",
    otro: "Accesorio",
  },
} as const;

export type CampoLista = keyof typeof VALUE_LABELS;
type ValorLista<C extends CampoLista> = keyof (typeof VALUE_LABELS)[C];

// Los campos normalizados de un producto, con los tipos que tienen DESPUÉS de
// que el importador los valida. Todos opcionales: cada hoja trae solo los de
// su categoría. `salidas_preamp_voltaje` no tiene fila propia — es el
// complemento de `salidas_preamp_pares`, igual que `bobinas` lo es de
// `impedancia_ohm` en Subwoofers.
export type CamposNormalizados = {
  medida?: string;
  potencia_rms_w?: number;
  impedancia_ohm?: number;
  bobinas?: ValorLista<"bobinas">;
  configuracion?: ValorLista<"configuracion">;
  canales?: number;
  clase?: ValorLista<"clase">;
  formato?: ValorLista<"formato">;
  pantalla_pulg?: number;
  carplay?: boolean;
  android_auto?: boolean;
  salidas_preamp_pares?: number;
  salidas_preamp_voltaje?: number;
  espesor_mm?: number;
  cobertura_m2?: number;
  material_insono?: ValorLista<"material_insono">;
  calibre_awg?: number;
  material_conductor?: ValorLista<"material_conductor">;
  tipo_accesorio?: ValorLista<"tipo_accesorio">;
  tipo_ecualizador?: ValorLista<"tipo_ecualizador">;
  bandas?: number;
  profundidad_mm?: number;
  sensibilidad_db?: number;
  capacidad_w?: number;
  longitud_m?: number;
};

// ── Nombre de fila de cada campo ────────────────────────────────────────────
// Casi todos son un texto fijo; `medida` depende de la categoría, así que se
// guarda como tabla con `defecto`. Leer siempre con fieldLabel(), que resuelve
// los dos casos — no indexar FIELD_LABELS directo desde un componente.
//
// Dos pares de campos comparten fila A PROPÓSITO, porque se muestran juntos:
// impedancia_ohm + bobinas («Doble bobina de 4 Ω») y carplay + android_auto
// («Apple CarPlay y Android Auto»). Quien genere la ficha emite UNA fila por
// etiqueta, no una por campo.
type EtiquetaCampo = string | { readonly defecto: string; readonly [categoria: string]: string };

export const FIELD_LABELS = {
  medida: { Subwoofers: "Diámetro", defecto: "Tamaño" },
  potencia_rms_w: "Potencia RMS",
  impedancia_ohm: "Impedancia",
  bobinas: "Impedancia",
  configuracion: "Configuración",
  canales: "Canales",
  clase: "Clase",
  formato: "Formato",
  pantalla_pulg: "Pantalla",
  carplay: "Integración con el teléfono",
  android_auto: "Integración con el teléfono",
  salidas_preamp_pares: "Salidas preamp",
  espesor_mm: "Espesor",
  cobertura_m2: "Cobertura",
  material_insono: "Material",
  calibre_awg: "Calibre",
  material_conductor: "Material del conductor",
  tipo_accesorio: "Tipo",
  tipo_ecualizador: "Tipo",
  bandas: "Bandas",
  profundidad_mm: "Profundidad de montaje",
  sensibilidad_db: "Sensibilidad",
  capacidad_w: "Capacidad recomendada",
  longitud_m: "Longitud",
} as const satisfies Record<string, EtiquetaCampo>;

export type Campo = keyof typeof FIELD_LABELS;

export function fieldLabel(campo: Campo, categoria: string): string {
  const etiqueta: EtiquetaCampo = FIELD_LABELS[campo];
  if (typeof etiqueta === "string") return etiqueta;
  return etiqueta[categoria] ?? etiqueta.defecto;
}

// ── Listas de valores que no son texto traducible ───────────────────────────
// Igual que las claves de VALUE_LABELS, son copias de columnas de LISTAS y
// labels.test.ts las compara contra la hoja. El importador las usa para
// rechazar un valor fuera de lista; viven acá para no tener la lista en un
// lado y su formato en otro.
export const MEDIDAS = [
  '15"',
  '12"',
  '10"',
  '8"',
  '6x9"',
  '6.75"',
  '6.5"',
  '5.25"',
  '5x7"',
  '4x6"',
  '4"',
  '3.5"',
  '2.75"',
  '2.5"',
  '1.5"',
  '1"',
  "50 mm",
  "44.4 mm",
  "40 mm",
] as const;
export type Medida = (typeof MEDIDAS)[number];

export const IMPEDANCIAS_OHM = [1, 2, 3, 4, 8] as const;
export const CALIBRES_AWG = [0, 4, 8, 10] as const;

// ── Medidas ─────────────────────────────────────────────────────────────────
// Equivalencias COMERCIALES, no conversión exacta: 12" se vende como «30 cm»
// aunque mida 30.48, y un tweeter de 40 mm como 1.5". Por eso es una tabla y
// no una fórmula. El tipo obliga a cubrir cada medida de MEDIDAS; una medida
// fuera de la tabla se muestra tal cual, sin equivalencia, en vez de inventar
// una.
const EQUIVALENCIAS_MEDIDA: Readonly<Record<Medida, string>> = {
  '15"': "38 cm",
  '12"': "30 cm",
  '10"': "25 cm",
  '8"': "20 cm",
  '6x9"': "15 x 23 cm",
  '6.75"': "17 cm",
  '6.5"': "16.5 cm",
  '5.25"': "13 cm",
  '5x7"': "13 x 18 cm",
  '4x6"': "10 x 15 cm",
  '4"': "10 cm",
  '3.5"': "9 cm",
  '2.75"': "7 cm",
  '2.5"': "6.4 cm",
  '1.5"': "3.8 cm",
  '1"': "2.5 cm",
  "50 mm": '2"',
  "44.4 mm": '1.75"',
  "40 mm": '1.5"',
};

// Magnitud de una medida para ordenar. Tres grupos: pulgadas (redondas y
// ovaladas), milímetros al final, y cualquier texto que no se reconozca
// después de todo. Un óvalo cuenta por su diámetro equivalente —el de un
// círculo de la misma área, √(a·b)—, así 6x9" (≈7.3) cae entre 6.75" y 8".
const RE_PULGADAS = /^(\d+(?:\.\d+)?)"$/;
const RE_OVALO = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)"$/;
const RE_MILIMETROS = /^(\d+(?:\.\d+)?) mm$/;

function magnitudMedida(medida: string): { grupo: number; magnitud: number } {
  const pulgadas = RE_PULGADAS.exec(medida);
  if (pulgadas) return { grupo: 0, magnitud: Number(pulgadas[1]) };
  const ovalo = RE_OVALO.exec(medida);
  if (ovalo) return { grupo: 0, magnitud: Math.sqrt(Number(ovalo[1]) * Number(ovalo[2])) };
  const milimetros = RE_MILIMETROS.exec(medida);
  if (milimetros) return { grupo: 1, magnitud: Number(milimetros[1]) };
  return { grupo: 2, magnitud: 0 };
}

// Ordena medidas por MAGNITUD ascendente, no alfabéticamente: 10" va después
// de 8" (con sort() a secas va antes), y los valores en milímetros van al
// final. Es un orden total: el desempate es por puntos de código, no con
// localeCompare, por la misma razón que lib/catalog/orden.ts — el orden no
// puede cambiar entre builds.
export function compareMeasures(a: string, b: string): number {
  const ma = magnitudMedida(a);
  const mb = magnitudMedida(b);
  if (ma.grupo !== mb.grupo) return ma.grupo - mb.grupo;
  if (ma.magnitud !== mb.magnitud) return ma.magnitud - mb.magnitud;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ── Formato de valor ────────────────────────────────────────────────────────
// Separador de miles y punto decimal, como formatQ (lib/format/precio.ts):
// «1,200 W», «3.6 m²», «4.57 mm». Sin decimales de relleno: la hoja trae 500.0.
const NUMERO_ES_GT = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 });
const num = (n: number) => NUMERO_ES_GT.format(n);

const plural = (n: number, singular: string, pluralTexto: string) =>
  `${num(n)} ${n === 1 ? singular : pluralTexto}`;

function traducir<C extends CampoLista>(campo: C, valor: string): string {
  const tabla: Readonly<Record<string, string>> = VALUE_LABELS[campo];
  // Un valor fuera de lista no debería llegar hasta acá (el importador lo
  // rechaza); si llega, se muestra crudo en vez de romper la página.
  return tabla[valor] ?? valor;
}

// El valor de un campo como lo ve el cliente, o null cuando la fila se OMITE
// (campo vacío, pantalla de 0", ni CarPlay ni Android Auto, 0 salidas preamp).
//
// `valor` acepta dos formas:
//   - el valor suelto, para una faceta:   formatValue("medida", '12"', cat)
//   - el registro normalizado del producto, que es lo que necesitan los
//     campos compuestos para leer a su pareja:
//       formatValue("impedancia_ohm", { impedancia_ohm: 4, bobinas: "doble" },
//                   "Subwoofers")  →  «Doble bobina de 4 Ω»
// Los dos campos de una pareja devuelven el mismo texto; con el valor suelto
// cada uno se muestra solo («4 Ω», «Doble bobina»).
export function formatValue<C extends Campo>(
  campo: C,
  valor: CamposNormalizados[C] | CamposNormalizados,
  categoria: string,
): string | null {
  const c: CamposNormalizados =
    typeof valor === "object" && valor !== null ? valor : { [campo]: valor };

  switch (campo) {
    case "medida": {
      if (c.medida === undefined) return null;
      const tabla: Readonly<Record<string, string | undefined>> = EQUIVALENCIAS_MEDIDA;
      const equivalencia = tabla[c.medida];
      return equivalencia ? `${c.medida} (${equivalencia})` : c.medida;
    }
    case "potencia_rms_w":
      if (c.potencia_rms_w === undefined) return null;
      return `${num(c.potencia_rms_w)} W${categoria === "Bocinas" ? " por bocina" : ""}`;
    case "impedancia_ohm":
    case "bobinas": {
      // Solo Subwoofers trae `bobinas`: en el resto de categorías no hay
      // pareja y sale la impedancia sola.
      const ohm = c.impedancia_ohm === undefined ? null : `${num(c.impedancia_ohm)} Ω`;
      const bobinas = c.bobinas === undefined ? null : traducir("bobinas", c.bobinas);
      if (bobinas && ohm) return `${bobinas} de ${ohm}`;
      return bobinas ?? ohm;
    }
    case "canales":
      if (c.canales === undefined) return null;
      return c.canales === 1 ? "Monoblock (1 canal)" : plural(c.canales, "canal", "canales");
    case "clase":
      // La fila ya se llama «Clase»: en la ficha va «Clase: D», no
      // «Clase: Clase D». VALUE_LABELS.clase («Clase D») es para donde el
      // valor aparece sin su fila, como una opción de filtro.
      return c.clase ?? null;
    case "pantalla_pulg":
      if (c.pantalla_pulg === undefined || c.pantalla_pulg === 0) return null;
      return `${num(c.pantalla_pulg)}"`;
    case "carplay":
    case "android_auto": {
      const sistemas = [c.carplay && "Apple CarPlay", c.android_auto && "Android Auto"].filter(
        (s): s is string => typeof s === "string",
      );
      return sistemas.length > 0 ? sistemas.join(" y ") : null;
    }
    case "salidas_preamp_pares": {
      const pares = c.salidas_preamp_pares;
      if (pares === undefined || pares === 0) return null;
      const voltaje =
        c.salidas_preamp_voltaje === undefined ? "" : ` (${num(c.salidas_preamp_voltaje)} V)`;
      return plural(pares, "par", "pares") + voltaje;
    }
    case "espesor_mm":
      return c.espesor_mm === undefined ? null : `${num(c.espesor_mm)} mm`;
    case "cobertura_m2":
      return c.cobertura_m2 === undefined ? null : `${num(c.cobertura_m2)} m²`;
    case "calibre_awg":
      return c.calibre_awg === undefined ? null : `${num(c.calibre_awg)} AWG`;
    case "capacidad_w":
      return c.capacidad_w === undefined ? null : `Hasta ${num(c.capacidad_w)} W`;
    case "longitud_m":
      return c.longitud_m === undefined ? null : `${num(c.longitud_m)} m`;
    case "profundidad_mm":
      return c.profundidad_mm === undefined ? null : `${num(c.profundidad_mm)} mm`;
    case "sensibilidad_db":
      return c.sensibilidad_db === undefined ? null : `${num(c.sensibilidad_db)} dB`;
    case "bandas":
      return c.bandas === undefined ? null : plural(c.bandas, "banda", "bandas");
    case "configuracion":
    case "formato":
    case "material_conductor":
    case "material_insono":
    case "tipo_accesorio":
    case "tipo_ecualizador": {
      const crudo = c[campo as CampoLista];
      return crudo === undefined ? null : traducir(campo as CampoLista, crudo);
    }
  }
  return null;
}
