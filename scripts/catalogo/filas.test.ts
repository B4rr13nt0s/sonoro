import test from "node:test";
import assert from "node:assert/strict";

import type { Celda, FilaCruda } from "./contrato.ts";
import { normalizarFila } from "./filas.ts";
import { defHoja, type NombreHoja } from "./hojas.ts";

const SUBWOOFER: Record<string, Celda> = {
  sku: "TS-W312D4",
  slug: "pioneer-ts-w312d4",
  nombre: 'Subwoofer Champion Series 12" TS-W312D4',
  marca: "Pioneer",
  descripcion_corta: "Subwoofer de 12 pulgadas de doble bobina",
  precio: 800,
  precio_antes: null,
  disponibilidad: "disponible",
  garantia_meses: null,
  destacado: "VERDADERO",
  activo: "FALSO",
  medida: '12"',
  potencia_rms_w: 500,
  impedancia_ohm: "4", // las columnas con lista llegan como texto
  bobinas: "doble",
  profundidad_mm: 157,
  sensibilidad_db: null,
  spec_1_etiqueta: "Potencia máxima",
  spec_1_valor: "1,600 W",
};

function normalizar(hoja: NombreHoja, celdas: Record<string, Celda>) {
  const fila: FilaCruda = { hoja, numero: 2, celdas };
  return normalizarFila(fila, defHoja(hoja));
}

function motivo(hoja: NombreHoja, celdas: Record<string, Celda>): string {
  const r = normalizar(hoja, celdas);
  assert.equal(r.ok, false, "se esperaba un rechazo");
  return r.ok ? "" : r.motivo;
}

test("fila válida: tipos convertidos, atributos sin vacíos, libres en orden", () => {
  const r = normalizar("SUBWOOFERS", SUBWOOFER);
  assert.ok(r.ok);
  assert.deepEqual(r.fila, {
    sku: "TS-W312D4",
    slug: "pioneer-ts-w312d4",
    nombre: 'Subwoofer Champion Series 12" TS-W312D4',
    marca: "Pioneer",
    descripcionCorta: "Subwoofer de 12 pulgadas de doble bobina",
    precioCents: 80000,
    disponibilidad: "disponible",
    destacado: true,
    activo: false,
    atributos: {
      medida: '12"',
      potencia_rms_w: 500,
      impedancia_ohm: 4,
      bobinas: "doble",
      profundidad_mm: 157,
    },
    libres: [{ etiqueta: "Potencia máxima", valor: "1,600 W" }],
  });
});

test("precio: centavos sin error de punto flotante, y más de dos decimales se rechaza", () => {
  const r = normalizar("SUBWOOFERS", { ...SUBWOOFER, precio: 1350.29, precio_antes: 1500 });
  assert.ok(r.ok);
  assert.equal(r.fila.precioCents, 135029);
  assert.equal(r.fila.precioAntesCents, 150000);

  assert.match(motivo("SUBWOOFERS", { ...SUBWOOFER, precio: 12.345 }), /12\.345/);
});

test("obligatorio vacío: los reporta todos", () => {
  const m = motivo("SUBWOOFERS", { ...SUBWOOFER, sku: "  ", medida: null, bobinas: "" });
  assert.match(m, /sku: obligatorio vacío/);
  assert.match(m, /medida: obligatorio vacío/);
  assert.match(m, /bobinas: obligatorio vacío/);
});

test("valor fuera de lista", () => {
  assert.match(motivo("SUBWOOFERS", { ...SUBWOOFER, medida: '7"' }), /^medida:/);
  assert.match(motivo("SUBWOOFERS", { ...SUBWOOFER, impedancia_ohm: "5" }), /^impedancia_ohm:/);
  assert.match(motivo("SUBWOOFERS", { ...SUBWOOFER, bobinas: "cuádruple" }), /^bobinas:/);
  assert.match(
    motivo("SUBWOOFERS", { ...SUBWOOFER, disponibilidad: "pronto" }),
    /^disponibilidad:/,
  );
});

test("número escrito con letras: se rechaza, no se convierte en silencio", () => {
  assert.match(motivo("SUBWOOFERS", { ...SUBWOOFER, potencia_rms_w: "500 W" }), /^potencia_rms_w:/);
});

test("booleano ilegible", () => {
  assert.match(motivo("SUBWOOFERS", { ...SUBWOOFER, destacado: "SI" }), /^destacado:/);
});

test("booleano: acepta celda booleana y VERDADERO/FALSO en cualquier caja", () => {
  const r = normalizar("RECEPTORES", {
    ...SUBWOOFER,
    formato: "2-din",
    pantalla_pulg: 6.8,
    carplay: true,
    android_auto: "falso",
    salidas_preamp_pares: 3,
    salidas_preamp_voltaje: 4,
  });
  assert.ok(r.ok);
  assert.equal(r.fila.atributos.carplay, true);
  assert.equal(r.fila.atributos.android_auto, false);
});

test("spec libre con etiqueta y sin valor", () => {
  const m = motivo("SUBWOOFERS", { ...SUBWOOFER, spec_2_etiqueta: "Caja" });
  assert.match(m, /^spec_2 tiene solo etiqueta o solo valor/);
});

test("ESPECIALES: categorias se separa por comas, y vacía se rechaza", () => {
  const especial = { ...SUBWOOFER, categorias: "Subwoofers, Bocinas," };
  const r = normalizar("ESPECIALES", especial);
  assert.ok(r.ok);
  assert.deepEqual(r.fila.categoriasSecundarias, ["Subwoofers", "Bocinas"]);
  assert.deepEqual(r.fila.atributos, {});

  assert.match(
    motivo("ESPECIALES", { ...especial, categorias: null }),
    /categorias: obligatorio vacío/,
  );
});
