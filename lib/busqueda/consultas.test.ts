// Búsquedas típicas contra el catálogo REAL (data/catalog.json), para que un
// cambio de puntaje no rompa lo que ya funcionaba. Se comprueban cualidades de
// los primeros resultados —categoría, medida, marca—, no skus: el negocio
// edita el libro y los productos cambian, pero «radio» tiene que seguir dando
// radios. Cuando la hoja «Chat» reciba registros, sumar acá las búsquedas
// reales que fallaron.
import test from "node:test";
import assert from "node:assert/strict";

import { tarjetasBuscables } from "../catalog/buscables.ts";
import { listAllProducts, listBrands } from "../catalog/index.ts";
import { compararRelevancia } from "../catalog/orden.ts";
import { gruposDeAcote } from "./acotar.ts";
import { buscar, type ProductoBuscable } from "./busqueda.ts";

const PRIMEROS = 5;

const productos = tarjetasBuscables(await listAllProducts({ activo: true }));

const enCategoria =
  (categoria: string) =>
  (p: ProductoBuscable): boolean =>
    p.categoria === categoria || (p.categoriasSecundarias ?? []).includes(categoria);

const nombreDice =
  (texto: string) =>
  (p: ProductoBuscable): boolean =>
    p.nombre.toLowerCase().includes(texto.toLowerCase());

const y =
  (...condiciones: ((p: ProductoBuscable) => boolean)[]) =>
  (p: ProductoBuscable): boolean =>
    condiciones.every((c) => c(p));

const CASOS: { consulta: string; cumple: (p: ProductoBuscable) => boolean }[] = [
  { consulta: "radio", cumple: enCategoria("Receptores") },
  { consulta: "estereo", cumple: enCategoria("Receptores") },
  { consulta: "radio carplay", cumple: enCategoria("Receptores") },
  { consulta: "pantalla 10", cumple: enCategoria("Receptores") },
  { consulta: "bajo", cumple: enCategoria("Subwoofers") },
  { consulta: "sub 12", cumple: y(enCategoria("Subwoofers"), nombreDice('12"')) },
  { consulta: "subwoofer 12", cumple: y(enCategoria("Subwoofers"), nombreDice('12"')) },
  { consulta: "subwoofer 12 memphis", cumple: y(nombreDice('12"'), (p) => p.marca === "Memphis") },
  {
    consulta: "subwoofers de 12 pulgadas marca memphis",
    cumple: y(enCategoria("Subwoofers"), nombreDice('12"'), (p) => p.marca === "Memphis"),
  },
  { consulta: "subwofer", cumple: enCategoria("Subwoofers") },
  { consulta: "bocinas de 6 pulgadas", cumple: enCategoria("Bocinas") },
  { consulta: "bocinas 6.5", cumple: y(enCategoria("Bocinas"), nombreDice('6.5"')) },
  { consulta: "tweeter", cumple: nombreDice("tweeter") },
  { consulta: "planta", cumple: enCategoria("Amplificadores") },
  { consulta: "amplificador 3 canales", cumple: enCategoria("Amplificadores") },
  {
    consulta: "amplificador 4 canales",
    cumple: y(enCategoria("Amplificadores"), nombreDice("4 canales")),
  },
  { consulta: "kit de instalacion", cumple: enCategoria("Kits") },
  { consulta: "cable rca", cumple: nombreDice("rca") },
  { consulta: "ecualizador", cumple: enCategoria("Ecualizadores") },
  { consulta: "eq", cumple: enCategoria("Ecualizadores") },
  { consulta: "insonorizacion", cumple: enCategoria("Insonorización") },
  { consulta: "jbl", cumple: (p) => p.marca === "JBL" },
];

for (const { consulta, cumple } of CASOS) {
  test(`«${consulta}»: los primeros ${PRIMEROS} son lo que se pidió`, () => {
    const primeros = buscar(productos, consulta, compararRelevancia).productos.slice(0, PRIMEROS);
    assert.ok(primeros.length > 0, "sin resultados");
    const fuera = primeros.filter((p) => !cumple(p)).map((p) => `${p.sku} (${p.categoria})`);
    assert.deepEqual(fuera, []);
  });
}

test("un código exacto sale primero", () => {
  assert.equal(buscar(productos, "MJP1244", compararRelevancia).productos[0]?.sku, "MJP1244");
});

const CERCANAS: {
  consulta: string;
  cumple: (p: ProductoBuscable) => boolean;
}[] = [
  {
    consulta: "bocinas de 6 pulgadas",
    cumple: y(enCategoria("Bocinas"), (p) => p.pulgadas === 5.25 || p.pulgadas === 6.5),
  },
  {
    consulta: "bocinas 6",
    cumple: y(enCategoria("Bocinas"), (p) => p.pulgadas === 5.25 || p.pulgadas === 6.5),
  },
  {
    consulta: "amplificador 3 canales",
    cumple: y(enCategoria("Amplificadores"), (p) => p.canales === 2 || p.canales === 4),
  },
  { consulta: "pantalla 10", cumple: y(enCategoria("Receptores"), (p) => p.pulgadas === 9) },
];

for (const { consulta, cumple } of CERCANAS) {
  test(`«${consulta}»: no existe, y se muestra lo más cercano`, () => {
    const r = buscar(productos, consulta, compararRelevancia);
    assert.equal(r.modo, "cercana");
    assert.ok(r.cercania);
    assert.ok(r.productos.length > 0, "sin resultados");
    const fuera = r.productos
      .filter((p) => !cumple(p))
      .map((p) => `${p.sku} (${p.pulgadas ?? p.canales})`);
    assert.deepEqual(fuera, []);
  });
}

test("«subwoofer»: para acotar ofrece sus medidas y marcas", async () => {
  const marcas = (await listBrands()).map((m) => ({ nombre: m.nombre, slug: m.slug }));
  const grupos = gruposDeAcote(
    buscar(productos, "subwoofer", compararRelevancia).productos,
    marcas,
  );
  const medida = grupos.find((g) => g.campo === "medida");
  assert.deepEqual(
    medida?.opciones.map((o) => o.etiqueta),
    ['6.5"', '8"', '10"', '12"', '15"'],
  );
  assert.ok(grupos.some((g) => g.campo === "marca"));
});
