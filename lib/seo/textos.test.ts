import test from "node:test";
import assert from "node:assert/strict";

import {
  masFrecuentes,
  textosCategoria,
  textosMarca,
  textosProducto,
  TITULO_SITIO,
} from "./textos.ts";

test("textosCategoria: solo nombra lancha y UTV donde el catálogo los tiene", () => {
  const subwoofers = textosCategoria({
    slug: "subwoofers",
    nombre: "Subwoofers",
    total: 55,
    marcas: ["Memphis", "KBT", "Rockford Fosgate", "Pioneer"],
    page: 1,
  });
  assert.equal(subwoofers.titulo, "Subwoofers para carro, lancha y UTV");
  assert.match(
    subwoofers.descripcion,
    /^55 subwoofers para carro, lancha y UTV de Memphis, KBT, Rockford Fosgate y más/,
  );

  const ecualizadores = textosCategoria({
    slug: "ecualizadores",
    nombre: "Ecualizadores",
    total: 9,
    marcas: ["KBT"],
    page: 1,
  });
  assert.equal(ecualizadores.titulo, "Ecualizadores para carro");
});

test("textosCategoria: con marca filtrada no promete usos, y la página 2 se distingue", () => {
  const { titulo } = textosCategoria({
    slug: "subwoofers",
    nombre: "Subwoofers",
    total: 3,
    marcas: ["Cerwin Vega"],
    marcaFiltro: "Cerwin Vega",
    page: 2,
  });
  assert.equal(titulo, "Subwoofers Cerwin Vega en Guatemala, página 2");
});

test("textosMarca: nombra lo que la marca tiene, no «marino y motorsports»", () => {
  const { titulo, descripcion } = textosMarca({
    nombre: "Memphis",
    total: 110,
    categorias: ["Bocinas", "Accesorios", "Subwoofers", "Amplificadores"],
    page: 1,
  });
  assert.equal(titulo, "Memphis en Guatemala: bocinas y accesorios");
  assert.match(descripcion, /^110 productos Memphis en Sonoro: bocinas, accesorios y subwoofers\./);
});

test("textosProducto: la marca va primero, sin repetirla si el nombre ya la trae", () => {
  const base = {
    sku: "TS-W312D4",
    descripcionCorta: "Subwoofer de 12 pulgadas.",
    precioCents: 80000,
  };
  assert.equal(
    textosProducto({ ...base, nombre: 'Subwoofer 12" TS-W312D4', marca: "Pioneer" }).titulo,
    'Pioneer Subwoofer 12" TS-W312D4',
  );
  assert.equal(
    textosProducto({ ...base, nombre: "Control remoto Memphis", marca: "Memphis" }).titulo,
    "Control remoto Memphis",
  );
  // Sin punto doble, y el precio con el formato del sitio.
  assert.equal(
    textosProducto({ ...base, nombre: "X", marca: "Pioneer" }).descripcion,
    "Subwoofer de 12 pulgadas. Código TS-W312D4, Q 800.00 con IVA. Hasta 6 pagos precio contado.",
  );
});

test("ningún texto usa «gratis» sin sus restricciones (regla 7)", () => {
  const textos = [
    TITULO_SITIO,
    textosCategoria({ slug: "bocinas", nombre: "Bocinas", total: 1, marcas: ["KBT"], page: 1 })
      .descripcion,
  ];
  for (const texto of textos) assert.doesNotMatch(texto, /gratis/i);
});

test("masFrecuentes: de más a menos, desempate estable por código", () => {
  assert.deepEqual(masFrecuentes(["B", "A", "B", "C", "A", "B"]), ["B", "A", "C"]);
  assert.deepEqual(masFrecuentes(["b", "a"]), ["a", "b"]);
});
