import test from "node:test";
import assert from "node:assert/strict";

import { clavesDeAtributos, numerosDeAtributos } from "../busqueda/busqueda.ts";
import { tarjetasBuscables } from "./buscables.ts";
import type { Producto } from "./types.ts";

const SUB: Producto = {
  sku: "TS-W312D4",
  slug: "pioneer-ts-w312d4",
  nombre: 'Subwoofer Champion Series 12" TS-W312D4',
  marca: "Pioneer",
  categoria: "Subwoofers",
  descripcionCorta: "Subwoofer de 12 pulgadas de doble bobina para caja sellada o ventilada",
  specsDestacadas: [
    { etiqueta: "Diámetro", valor: '12" (30 cm)' },
    { etiqueta: "Potencia RMS", valor: "500 W" },
    { etiqueta: "Impedancia", valor: "Doble bobina de 2 Ω" },
  ],
  specsFicha: [
    { etiqueta: "Diámetro", valor: '12" (30 cm)' },
    { etiqueta: "Potencia RMS", valor: "500 W" },
    { etiqueta: "Impedancia", valor: "Doble bobina de 2 Ω" },
  ],
  precioCents: 88500,
  moneda: "GTQ",
  disponibilidad: "disponible",
  imagenes: [{ url: "/productos/TS-W312D4_frontal.jpg", alt: 'Subwoofer 12" — frontal' }],
  destacado: true,
  activo: true,
  atributos: { medida: '12"', impedancia_ohm: 2, potencia_rms_w: 500 },
};

test("tarjetasBuscables: trae los campos de la tarjeta, las claves y los números", () => {
  const [r] = tarjetasBuscables([SUB]);
  assert.deepEqual(r, {
    sku: SUB.sku,
    slug: SUB.slug,
    nombre: SUB.nombre,
    marca: SUB.marca,
    categoria: SUB.categoria,
    precioCents: SUB.precioCents,
    disponibilidad: SUB.disponibilidad,
    destacado: SUB.destacado,
    imagenes: SUB.imagenes,
    specsDestacadas: SUB.specsDestacadas,
    claves: clavesDeAtributos(SUB.atributos),
    ...numerosDeAtributos(SUB.atributos),
  });
  assert.equal("specsFicha" in r, false);
  assert.equal("atributos" in r, false);
});

test("tarjetasBuscables: categoriasSecundarias y uso solo si existen", () => {
  const [sin] = tarjetasBuscables([SUB]);
  assert.equal("uso" in sin, false);
  assert.equal("categoriasSecundarias" in sin, false);

  const [con] = tarjetasBuscables([
    { ...SUB, uso: ["marino"], categoriasSecundarias: ["Bocinas"] },
  ]);
  assert.deepEqual(con.uso, ["marino"]);
  assert.deepEqual(con.categoriasSecundarias, ["Bocinas"]);
});
