import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

import { CATEGORIAS_SITIO } from "./categorias.ts";
import {
  CALIBRES_AWG,
  FIELD_LABELS,
  IMPEDANCIAS_OHM,
  MEDIDAS,
  VALUE_LABELS,
  compareMeasures,
  fieldLabel,
  formatValue,
  type Campo,
  type CampoLista,
} from "./labels.ts";
import { DisponibilidadSchema } from "./types.ts";

// La hoja LISTAS de data/source/catalogo.xlsx, leída del archivo — no una
// copia. Así un valor nuevo en LISTAS sin traducción rompe este test en vez
// de llegar al cliente como «coaxial-2v».
//
// Cada columna con encabezado es una lista: los valores bajan hasta la
// primera celda vacía; lo que viene después son notas para quien edita.
const RUTA_LIBRO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/source/catalogo.xlsx",
);

function leerListas(): Map<string, string[]> {
  const libro = XLSX.read(readFileSync(RUTA_LIBRO), { type: "buffer" });
  const hoja = libro.Sheets.LISTAS;
  assert.ok(hoja, "el libro no tiene hoja LISTAS");
  const filas = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(hoja, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  const vacia = (c: unknown) => c === null || c === undefined || String(c).trim() === "";

  const listas = new Map<string, string[]>();
  (filas[0] ?? []).forEach((encabezado, columna) => {
    if (vacia(encabezado)) return;
    const valores: string[] = [];
    for (let i = 1; i < filas.length && !vacia(filas[i]?.[columna]); i++) {
      valores.push(String(filas[i][columna]).trim());
    }
    listas.set(String(encabezado).trim(), valores);
  });
  return listas;
}

const LISTAS = leerListas();

function lista(nombre: string): string[] {
  const valores = LISTAS.get(nombre);
  assert.ok(valores, `LISTAS no tiene la columna ${nombre}`);
  return valores;
}

const CAMPOS_LISTA = Object.keys(VALUE_LABELS) as CampoLista[];

test("LISTAS: la hoja no trae una lista que el código no conozca", () => {
  const conocidas = new Set<string>([
    "marca", // abierta: se agrega una marca escribiéndola, sin cambio de código
    "categoria",
    "disponibilidad",
    "medida",
    "impedancia_ohm",
    "calibre_awg",
    ...CAMPOS_LISTA,
  ]);
  for (const columna of LISTAS.keys()) {
    assert.ok(
      conocidas.has(columna),
      `LISTAS trae la columna «${columna}» y el código no la conoce`,
    );
  }
});

test("LISTAS: todo valor de los campos de lista tiene traducción", () => {
  for (const campo of CAMPOS_LISTA) {
    const tabla: Record<string, string> = VALUE_LABELS[campo];
    for (const valor of lista(campo)) {
      assert.ok(tabla[valor], `${campo}: «${valor}» no tiene traducción en VALUE_LABELS`);
    }
  }
});

test("LISTAS: VALUE_LABELS no traduce valores que no están en la hoja", () => {
  // El sentido inverso: una clave con typo («coaxial-2V») o de un valor que
  // salió de LISTAS dejaría el valor real sin traducir sin que nada fallara.
  for (const campo of CAMPOS_LISTA) {
    const validos = lista(campo);
    for (const clave of Object.keys(VALUE_LABELS[campo])) {
      assert.ok(validos.includes(clave), `${campo}: «${clave}» no existe en LISTAS`);
    }
  }
});

test("LISTAS: medidas, impedancias y calibres coinciden con la hoja", () => {
  assert.deepEqual([...MEDIDAS], lista("medida"));
  assert.deepEqual(IMPEDANCIAS_OHM.map(String), lista("impedancia_ohm"));
  assert.deepEqual(CALIBRES_AWG.map(String), lista("calibre_awg"));
});

test("LISTAS: disponibilidad y categorías coinciden con el esquema y el sitio", () => {
  assert.deepEqual(lista("disponibilidad"), DisponibilidadSchema.options);
  assert.deepEqual([...lista("categoria")].sort(), CATEGORIAS_SITIO.map((c) => c.nombre).sort());
});

test("toda medida tiene equivalencia", () => {
  for (const medida of MEDIDAS) {
    const texto = formatValue("medida", medida, "Bocinas");
    assert.match(texto ?? "", /^.+ \(.+\)$/, `${medida} sin equivalencia: ${texto}`);
  }
});

test("impedancias y calibres se formatean", () => {
  for (const ohm of IMPEDANCIAS_OHM) {
    assert.equal(formatValue("impedancia_ohm", ohm, "Bocinas"), `${ohm} Ω`);
  }
  for (const awg of CALIBRES_AWG) {
    assert.equal(formatValue("calibre_awg", awg, "Kits"), `${awg} AWG`);
  }
});

test("FIELD_LABELS: medida es «Diámetro» en Subwoofers y «Tamaño» en el resto", () => {
  assert.equal(fieldLabel("medida", "Subwoofers"), "Diámetro");
  assert.equal(fieldLabel("medida", "Bocinas"), "Tamaño");
  assert.equal(fieldLabel("medida", "Sistemas"), "Tamaño");
  assert.equal(fieldLabel("potencia_rms_w", "Subwoofers"), "Potencia RMS");
});

test("FIELD_LABELS: las parejas comparten fila", () => {
  assert.equal(fieldLabel("bobinas", "Subwoofers"), fieldLabel("impedancia_ohm", "Subwoofers"));
  assert.equal(fieldLabel("carplay", "Receptores"), fieldLabel("android_auto", "Receptores"));
});

test("formatValue: medidas con equivalencia", () => {
  assert.equal(formatValue("medida", '12"', "Subwoofers"), '12" (30 cm)');
  assert.equal(formatValue("medida", '6x9"', "Bocinas"), '6x9" (15 x 23 cm)');
  assert.equal(formatValue("medida", "40 mm", "Bocinas"), '40 mm (1.5")');
  // Fuera de la tabla: tal cual, sin inventar equivalencia.
  assert.equal(formatValue("medida", '7"', "Bocinas"), '7"');
});

test("formatValue: potencia, «por bocina» solo en Bocinas", () => {
  assert.equal(formatValue("potencia_rms_w", 600, "Subwoofers"), "600 W");
  assert.equal(formatValue("potencia_rms_w", 600, "Bocinas"), "600 W por bocina");
  assert.equal(formatValue("potencia_rms_w", 1500, "Amplificadores"), "1,500 W");
});

test("formatValue: impedancia con bobinas en Subwoofers", () => {
  const sub = { impedancia_ohm: 4, bobinas: "doble" } as const;
  assert.equal(formatValue("impedancia_ohm", sub, "Subwoofers"), "Doble bobina de 4 Ω");
  assert.equal(formatValue("bobinas", sub, "Subwoofers"), "Doble bobina de 4 Ω");
  assert.equal(formatValue("impedancia_ohm", { impedancia_ohm: 4 }, "Bocinas"), "4 Ω");
  // Valor suelto, para una faceta: cada uno se muestra solo.
  assert.equal(formatValue("bobinas", "simple", "Subwoofers"), "Bobina simple");
});

test("formatValue: canales, bandas y pares en singular y plural", () => {
  assert.equal(formatValue("canales", 4, "Amplificadores"), "4 canales");
  assert.equal(formatValue("canales", 1, "Amplificadores"), "Monoblock (1 canal)");
  assert.equal(formatValue("bandas", 7, "Ecualizadores"), "7 bandas");
  assert.equal(formatValue("bandas", 1, "Ecualizadores"), "1 banda");
  const preamp = (pares: number, voltaje?: number) =>
    formatValue(
      "salidas_preamp_pares",
      { salidas_preamp_pares: pares, salidas_preamp_voltaje: voltaje },
      "Receptores",
    );
  assert.equal(preamp(3, 4), "3 pares (4 V)");
  assert.equal(preamp(1, 2), "1 par (2 V)");
  assert.equal(preamp(3), "3 pares");
  assert.equal(preamp(0, 2), null);
});

test("formatValue: pantalla se omite en 0", () => {
  assert.equal(formatValue("pantalla_pulg", 9, "Receptores"), '9"');
  assert.equal(formatValue("pantalla_pulg", 6.8, "Receptores"), '6.8"');
  assert.equal(formatValue("pantalla_pulg", 0, "Receptores"), null);
});

test("formatValue: integración con el teléfono, se omite si no hay ninguna", () => {
  const tel = (carplay: boolean, android_auto: boolean) => ({ carplay, android_auto });
  assert.equal(
    formatValue("carplay", tel(true, true), "Receptores"),
    "Apple CarPlay y Android Auto",
  );
  assert.equal(
    formatValue("android_auto", tel(true, true), "Receptores"),
    "Apple CarPlay y Android Auto",
  );
  assert.equal(formatValue("carplay", tel(true, false), "Receptores"), "Apple CarPlay");
  assert.equal(formatValue("carplay", tel(false, true), "Receptores"), "Android Auto");
  assert.equal(formatValue("carplay", tel(false, false), "Receptores"), null);
});

test("formatValue: unidades", () => {
  assert.equal(formatValue("espesor_mm", 2, "Insonorización"), "2 mm");
  assert.equal(formatValue("espesor_mm", 4.57, "Insonorización"), "4.57 mm");
  assert.equal(formatValue("cobertura_m2", 3.6, "Insonorización"), "3.6 m²");
  assert.equal(formatValue("calibre_awg", 8, "Kits"), "8 AWG");
  assert.equal(formatValue("capacidad_w", 1200, "Kits"), "Hasta 1,200 W");
  assert.equal(formatValue("longitud_m", 5, "Accesorios"), "5 m");
  assert.equal(formatValue("profundidad_mm", 130, "Subwoofers"), "130 mm");
  assert.equal(formatValue("sensibilidad_db", 88, "Bocinas"), "88 dB");
});

test("formatValue: campos de lista usan VALUE_LABELS", () => {
  assert.equal(formatValue("configuracion", "coaxial-2v", "Bocinas"), "Coaxial de 2 vías");
  assert.equal(formatValue("formato", "2-din", "Receptores"), "Doble DIN");
  assert.equal(formatValue("material_insono", "mixto", "Insonorización"), "Multicapa");
  assert.equal(formatValue("material_conductor", "cobre", "Kits"), "Cobre");
  assert.equal(formatValue("tipo_accesorio", "cable-rca", "Accesorios"), "Cable RCA");
  assert.equal(formatValue("tipo_ecualizador", "grafico", "Ecualizadores"), "Ecualizador gráfico");
  // La fila ya se llama «Clase»: el valor va sin repetirlo.
  assert.equal(formatValue("clase", "D", "Amplificadores"), "D");
});

test("formatValue: un campo vacío se omite", () => {
  for (const campo of Object.keys(FIELD_LABELS) as Campo[]) {
    assert.equal(formatValue(campo, {}, "Subwoofers"), null, campo);
  }
});

test("compareMeasures: orden por magnitud, milímetros al final", () => {
  const ordenadas = [...MEDIDAS].sort(compareMeasures);
  assert.deepEqual(ordenadas, [
    '1"',
    '1.5"',
    '2.5"',
    '2.75"',
    '3.5"',
    '4"',
    '4x6"',
    '5.25"',
    '5x7"',
    '6.5"',
    '6.75"',
    '6x9"',
    '8"',
    '10"',
    '12"',
    '15"',
    "40 mm",
    "44.4 mm",
    "50 mm",
  ]);
});

test('compareMeasures: 10" va después de 8" (alfabético lo pondría antes)', () => {
  assert.ok(compareMeasures('10"', '8"') > 0);
  assert.ok(compareMeasures('8"', '10"') < 0);
  assert.deepEqual(['10"', '8"'].sort(), ['10"', '8"']); // lo que evita
  assert.deepEqual(['10"', '8"'].sort(compareMeasures), ['8"', '10"']);
});

test("compareMeasures: el resultado no depende del orden de entrada", () => {
  const esperado = [...MEDIDAS].sort(compareMeasures);
  const invertido = [...MEDIDAS].reverse().sort(compareMeasures);
  assert.deepEqual(invertido, esperado);
  // Lo que no se reconoce va después de todo, no rompe el orden.
  assert.deepEqual(["otra", "40 mm", '8"'].sort(compareMeasures), ['8"', "40 mm", "otra"]);
});
