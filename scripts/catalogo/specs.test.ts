import test from "node:test";
import assert from "node:assert/strict";

import type { CamposNormalizados } from "../../lib/catalog/labels.ts";
import type { Spec } from "../../lib/catalog/types.ts";
import { defHoja, type NombreHoja } from "./hojas.ts";
import { construirSpecs, primerNumero } from "./specs.ts";

function specs(hoja: NombreHoja, atributos: CamposNormalizados, libres: Spec[] = []) {
  return construirSpecs(defHoja(hoja), atributos, libres);
}

const etiquetas = (lista: Spec[]) => lista.map((s) => s.etiqueta);
const libre = (etiqueta: string, valor = "x"): Spec => ({ etiqueta, valor });

const SUB: CamposNormalizados = {
  medida: '12"',
  potencia_rms_w: 500,
  impedancia_ohm: 4,
  bobinas: "doble",
  profundidad_mm: 157,
};

test("subwoofer: genera con labels.ts, destacadas en su prioridad, libres al final", () => {
  const r = specs("SUBWOOFERS", SUB, [libre("Potencia máxima", "1,600 W")]);
  assert.deepEqual(r.specsDestacadas, [
    { etiqueta: "Diámetro", valor: '12" (30 cm)' },
    { etiqueta: "Potencia RMS", valor: "500 W" },
    { etiqueta: "Impedancia", valor: "Doble bobina de 4 Ω" },
  ]);
  assert.deepEqual(r.specsFicha, [
    ...r.specsDestacadas,
    { etiqueta: "Profundidad de montaje", valor: "157 mm" },
    { etiqueta: "Potencia máxima", valor: "1,600 W" },
  ]);
  assert.deepEqual(r.advertencias, []);
});

test("bocinas: «Tamaño», potencia por bocina y su propia prioridad", () => {
  const r = specs("BOCINAS", {
    medida: '6.5"',
    configuracion: "coaxial-2v",
    potencia_rms_w: 75,
    impedancia_ohm: 4,
  });
  assert.deepEqual(r.specsDestacadas, [
    { etiqueta: "Tamaño", valor: '6.5" (16.5 cm)' },
    { etiqueta: "Configuración", valor: "Coaxial de 2 vías" },
    { etiqueta: "Potencia RMS", valor: "75 W por bocina" },
  ]);
});

test("amplificadores: la prioridad de destacadas manda sobre el orden de generación", () => {
  const r = specs("AMPLIFICADORES", { canales: 1, clase: "D", potencia_rms_w: 1500 });
  assert.deepEqual(etiquetas(r.specsDestacadas), ["Canales", "Potencia RMS", "Clase"]);
  assert.equal(r.specsDestacadas[0].valor, "Monoblock (1 canal)");
});

test("precedencia: la libre gana en el mismo lugar y advierte si contradice", () => {
  const r = specs("AMPLIFICADORES", { canales: 4, clase: "D", potencia_rms_w: 800 }, [
    libre("potencia rms", "125 W × 4 @ 4 Ω · 200 W × 4 @ 2 Ω"),
    libre("Dimensiones", "212 × 110 mm"),
  ]);
  assert.deepEqual(r.specsDestacadas[1], {
    etiqueta: "Potencia RMS",
    valor: "125 W × 4 @ 4 Ω · 200 W × 4 @ 2 Ω",
  });
  // No se duplica al final.
  assert.deepEqual(etiquetas(r.specsFicha), ["Canales", "Potencia RMS", "Clase", "Dimensiones"]);
  assert.equal(r.advertencias.length, 1);
  assert.equal(r.advertencias[0].tipo, "contradiccion");
  assert.match(r.advertencias[0].detalle, /dice 125, pero potencia_rms_w = 800/);
});

test("precedencia: sin contradicción cuando el primer número coincide", () => {
  const r = specs("AMPLIFICADORES", { canales: 1, clase: "D", potencia_rms_w: 1600 }, [
    libre("Potencia RMS", "1,600 W @ 1 Ω · 900 W @ 2 Ω"),
  ]);
  assert.deepEqual(r.advertencias, []);
});

test("precedencia: la impedancia compara contra los ohms, no contra las bobinas", () => {
  const r = specs("SUBWOOFERS", SUB, [libre("Impedancia", "FLEX seleccionable a 1 Ω, 2 Ω o 4 Ω")]);
  assert.equal(r.specsDestacadas[2].valor, "FLEX seleccionable a 1 Ω, 2 Ω o 4 Ω");
  assert.match(r.advertencias[0].detalle, /dice 1, pero impedancia_ohm = 4/);
});

test("omisión: pantalla 0 no genera fila, y las destacadas se completan con la ficha", () => {
  const r = specs(
    "RECEPTORES",
    {
      formato: "1-din",
      pantalla_pulg: 0,
      carplay: false,
      android_auto: false,
      salidas_preamp_pares: 2,
      salidas_preamp_voltaje: 2,
    },
    [libre("Conectividad", "Bluetooth")],
  );
  assert.deepEqual(etiquetas(r.specsDestacadas), ["Formato", "Salidas preamp", "Conectividad"]);
});

test("omisión: una libre llena el hueco de un slot omitido, sin advertir contradicción", () => {
  const r = specs(
    "RECEPTORES",
    {
      formato: "1-din",
      pantalla_pulg: 0,
      carplay: true,
      android_auto: true,
      salidas_preamp_pares: 0,
    },
    [libre("Pantalla", "LCD de 2 líneas")],
  );
  assert.deepEqual(r.specsDestacadas, [
    { etiqueta: "Formato", valor: "1 DIN" },
    { etiqueta: "Pantalla", valor: "LCD de 2 líneas" },
    { etiqueta: "Integración con el teléfono", valor: "Apple CarPlay y Android Auto" },
  ]);
  assert.deepEqual(r.advertencias, []);
});

test("destacadas: se saltan las etiquetas de marketing al completar", () => {
  const r = specs("ACCESORIOS", { tipo_accesorio: "cable-rca" }, [
    libre("Serie"),
    libre("Aplicación"),
    libre("Línea"),
    libre("Función"),
  ]);
  assert.deepEqual(etiquetas(r.specsDestacadas), ["Tipo", "Aplicación", "Función"]);
  assert.deepEqual(etiquetas(r.specsFicha), ["Tipo", "Aplicación", "Función", "Serie", "Línea"]);
  assert.deepEqual(r.advertencias, []);
});

test("destacadas: marketing como último recurso, con advertencia", () => {
  const r = specs("ACCESORIOS", { tipo_accesorio: "otro" }, [libre("Serie"), libre("Aplicación")]);
  assert.deepEqual(etiquetas(r.specsDestacadas), ["Tipo", "Aplicación", "Serie"]);
  assert.deepEqual(
    r.advertencias.map((a) => a.tipo),
    ["marketing"],
  );
});

test("accesorios: Tipo · Longitud · primera libre", () => {
  const r = specs("ACCESORIOS", { tipo_accesorio: "cable-rca", longitud_m: 5 }, [
    libre("Canales", "2"),
    libre("Blindaje", "Doble"),
  ]);
  assert.deepEqual(r.specsDestacadas, [
    { etiqueta: "Tipo", valor: "Cable RCA" },
    { etiqueta: "Longitud", valor: "5 m" },
    { etiqueta: "Canales", valor: "2" },
  ]);
});

test("ESPECIALES: las tres primeras libres que no son marketing", () => {
  const r = specs("ESPECIALES", {}, [
    libre("Línea"),
    libre("Sistema"),
    libre("Protección"),
    libre("Amplificador"),
    libre("Conectividad"),
  ]);
  assert.deepEqual(etiquetas(r.specsDestacadas), ["Sistema", "Protección", "Amplificador"]);
  assert.deepEqual(etiquetas(r.specsFicha), [
    "Sistema",
    "Protección",
    "Amplificador",
    "Línea",
    "Conectividad",
  ]);
});

test("ficha: máximo 10 — las generadas cuentan, y el recorte se advierte", () => {
  const libres = Array.from({ length: 7 }, (_, i) => libre(`Libre ${i + 1}`));
  const r = specs("SUBWOOFERS", { ...SUB, sensibilidad_db: 88 }, libres);
  assert.equal(r.specsFicha.length, 10);
  assert.equal(r.specsFicha.at(-1)?.etiqueta, "Libre 5");
  assert.equal(r.advertencias.length, 1);
  assert.equal(r.advertencias[0].tipo, "recorte");
  assert.match(r.advertencias[0].detalle, /12 specs .*«Libre 6», «Libre 7»/);
});

test("primerNumero: separador de miles, decimales y texto alrededor", () => {
  assert.equal(primerNumero("1,600 W"), 1600);
  assert.equal(primerNumero("ø283 mm"), 283);
  assert.equal(primerNumero('2.24" (57 mm)'), 2.24);
  assert.equal(primerNumero("125 W × 4 @ 4 Ω"), 125);
  assert.equal(primerNumero("Alta"), null);
});
