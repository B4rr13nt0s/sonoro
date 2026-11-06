import test from "node:test";
import assert from "node:assert/strict";

import { ORDENES, SIN_FILTROS, filtrosActivos, type Filtros } from "./filtros-activos.ts";

const NINGUNO: Filtros = {
  categoria: null,
  medida: null,
  canales: null,
  marca: null,
  disp: null,
  uso: null,
};

test("filtrosActivos: una píldora por filtro, en el orden de la barra", () => {
  assert.deepEqual(
    filtrosActivos(
      { ...NINGUNO, uso: "marino", disp: "disponible", marca: "Memphis", medida: 12, canales: 4 },
      false,
    ),
    [
      { campo: "marca", etiqueta: "Memphis" },
      { campo: "medida", etiqueta: '12"' },
      { campo: "canales", etiqueta: "4 canales" },
      { campo: "disp", etiqueta: "Disponible" },
      { campo: "uso", etiqueta: "Marino" },
    ],
  );
});

test("filtrosActivos: el tipo de producto no se repite, y lo escrito no lleva ✕", () => {
  assert.deepEqual(filtrosActivos({ ...NINGUNO, categoria: "Subwoofers" }, false), []);
  assert.deepEqual(filtrosActivos({ ...NINGUNO, uso: "marino" }, true), []);
  assert.deepEqual(filtrosActivos(NINGUNO, false), []);
});

test("SIN_FILTROS: todos los filtros a null, sin tocar q ni orden", () => {
  assert.deepEqual(SIN_FILTROS, NINGUNO);
});

test("ORDENES: textos cortos, para que la barra entre en una línea a 1280 px", () => {
  assert.deepEqual(ORDENES, {
    relevancia: "Ordenar: relevancia",
    precio_asc: "Ordenar: menor precio",
    precio_desc: "Ordenar: mayor precio",
  });
});
