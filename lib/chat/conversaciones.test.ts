// Conversaciones típicas contra el catálogo REAL (data/catalog.json), como
// lib/busqueda/consultas.test.ts: se comprueban cualidades de lo que sale
// —categoría, medida, marca, orden— y no skus, que cambian con el libro.
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoBuscable } from "../busqueda/busqueda.ts";
import { tarjetasBuscables } from "../catalog/buscables.ts";
import { perteneceACategoria } from "../catalog/categorias.ts";
import type { Producto } from "../catalog/types.ts";
import { armarDatosVehiculos } from "../vehiculos/datos.ts";
import type { Vehiculo } from "../vehiculos/types.ts";
import { listAllProducts, listBrands } from "../catalog/index.ts";
import { ESTADO_INICIAL, responder } from "./motor.ts";
import { crearContexto } from "./panel.ts";
import type { Bloque } from "./tipos.ts";

const todos = await listAllProducts({ activo: true });
const marcas = (await listBrands()).map((m) => ({ nombre: m.nombre, slug: m.slug }));
const contexto = crearContexto(
  {
    productos: tarjetasBuscables(todos),
    marcas,
    fichas: Object.fromEntries(todos.map((p) => [p.sku, p.specsFicha])),
  },
  // Los vehículos reales también, como en el panel: ninguna de estas
  // conversaciones debe caer en «¿qué le queda a mi carro?» sin pedirlo.
  armarDatosVehiculos(
    (JSON.parse(readFileSync("data/vehiculos.json", "utf-8")) as { vehiculos: Vehiculo[] })
      .vehiculos,
    JSON.parse(readFileSync("data/catalog.json", "utf-8")) as Producto[],
  ),
  {},
);
const porSku = new Map((contexto.productos ?? []).map((p) => [p.sku, p]));

function conversar(mensajes: string[]) {
  let estado = ESTADO_INICIAL;
  return mensajes.map((m) => {
    const r = responder(estado, { tipo: "texto", texto: m }, contexto);
    estado = r.estado;
    return r;
  });
}

const textos = (bloques: Bloque[]) => bloques.flatMap((b) => (b.tipo === "texto" ? [b.texto] : []));
function mostrados(bloques: Bloque[]): ProductoBuscable[] {
  const b = bloques.find((x) => x.tipo === "productos");
  return b?.tipo === "productos"
    ? b.skus.map((s) => porSku.get(s)).filter((p) => p !== undefined)
    : [];
}

test("subwoofers → 12 → solo memphis → más baratos → precio del primero → agrégalo", () => {
  const [r1, r2, r3, r4, r5, r6] = conversar([
    "subwoofers",
    "12",
    "solo memphis",
    "más baratos",
    "¿cuánto cuesta el primero?",
    "agrégalo",
  ]);
  assert.match(textos(r1.bloques)[0], /^Hay \d+ resultados\. ¿Qué medida buscas\?$/);
  const doce = mostrados(r2.bloques);
  assert.ok(doce.length > 0);
  assert.ok(doce.every((p) => p.pulgadas === 12 && perteneceACategoria(p, "Subwoofers")));
  const memphis = mostrados(r3.bloques);
  assert.ok(memphis.length > 0 && memphis.every((p) => p.marca === "Memphis" && p.pulgadas === 12));
  const baratos = mostrados(r4.bloques).map((p) => p.precioCents);
  assert.deepEqual(
    baratos,
    [...baratos].sort((a, b) => a - b),
  );
  const primero = mostrados(r4.bloques)[0];
  assert.ok(textos(r5.bloques).some((t) => t.startsWith(`${primero.nombre} cuesta Q`)));
  assert.equal(textos(r6.bloques)[0], `Aquí está ${primero.nombre} para agregarlo al carrito.`);
});

test("amplificador → de 4 canales → los disponibles → muéstrame más", () => {
  const [, r2, r3, r4] = conversar([
    "amplificador",
    "de 4 canales",
    "los disponibles",
    "muéstrame más",
  ]);
  const cuatro = mostrados(r2.bloques);
  assert.ok(cuatro.length > 0 && cuatro.every((p) => p.canales === 4));
  const disponibles = mostrados(r3.bloques);
  assert.ok(disponibles.every((p) => p.canales === 4 && p.disponibilidad === "disponible"));
  // Página siguiente, o el aviso de que no hay más.
  const t = textos(r4.bloques)[0];
  assert.ok(/^Del 6 al \d+ de \d+\.$/.test(t) || /^Ya te mostré los \d+\.$/.test(t), t);
});

test("bocinas → (pregunta la medida) → 6.5 → y de rockford?", () => {
  const [r1, r2, r3] = conversar(["bocinas", "6.5", "y de rockford?"]);
  assert.match(textos(r1.bloques)[0], /¿Qué medida buscas\?$/);
  assert.ok(mostrados(r2.bloques).every((p) => p.pulgadas === 6.5));
  const rockford = mostrados(r3.bloques);
  assert.ok(
    rockford.length > 0 &&
      rockford.every((p) => p.marca === "Rockford Fosgate" && p.pulgadas === 6.5),
  );
});

test("sub 12 → gracias → y de 10? → un tema → y de 8? ya es búsqueda nueva", () => {
  const [, r2, r3, r4, r5] = conversar([
    "sub 12",
    "gracias",
    "y de 10?",
    "¿envían a Quetzaltenango?",
    "y de 8?",
  ]);
  assert.deepEqual(textos(r2.bloques), ["Con gusto. ¿Te ayudo con algo más?"]);
  assert.match(textos(r3.bloques)[0], /^Cambié 12" por 10"\./);
  assert.ok(mostrados(r3.bloques).every((p) => p.pulgadas === 10));
  assert.equal(r4.estado.busqueda, undefined);
  assert.ok(!textos(r5.bloques).some((t) => t.startsWith("Cambié") || t.startsWith("Ahora")));
});
