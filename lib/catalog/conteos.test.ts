import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { staticAdapter } from "./adapters/static.ts";
import { CATEGORIAS_SITIO } from "./categorias.ts";
import { construirConteos, listadoInexistente, type Conteos } from "./conteos.ts";
import { PAGE_SIZE_DEFECTO } from "./paginacion.ts";
import type { Brand, Producto } from "./types.ts";

const MARCAS = [
  { nombre: "Memphis", slug: "memphis" },
  { nombre: "KBT", slug: "kbt" },
];
const CATEGORIAS = [
  { nombre: "Subwoofers", slug: "subwoofers" },
  { nombre: "Bocinas", slug: "bocinas" },
];

function p(
  marca: string,
  categoria: string,
  extra: { destacado?: boolean; activo?: boolean; categoriasSecundarias?: string[] } = {},
) {
  return { marca, categoria, destacado: false, activo: true, ...extra };
}

const params = (query: string) => new URLSearchParams(query);

test("construirConteos: cuenta activos, secundarias y deja los ceros", () => {
  const conteos = construirConteos(
    [
      p("Memphis", "Subwoofers", { destacado: true }),
      p("Memphis", "Subwoofers", { activo: false }),
      p("KBT", "Bocinas"),
      p("KBT", "Sistemas", { categoriasSecundarias: ["Subwoofers"] }),
    ],
    MARCAS,
    CATEGORIAS,
  );

  assert.deepEqual(conteos.catalogo, { total: 3, porFiltro: { memphis: 1, kbt: 2 } });
  assert.deepEqual(conteos.productos, { total: 1, porFiltro: { memphis: 1, kbt: 0 } });
  // El sistema de «Sistemas» cuenta en Subwoofers por su secundaria.
  assert.deepEqual(conteos.categorias.subwoofers, {
    total: 2,
    porFiltro: { memphis: 1, kbt: 1 },
  });
  // Memphis no tiene bocinas: el 0 está, no falta.
  assert.deepEqual(conteos.marcas.memphis, {
    total: 1,
    porFiltro: { subwoofers: 1, bocinas: 0 },
  });
});

// 30 productos de Memphis en Subwoofers → 2 páginas de 24.
const CONTEOS = construirConteos(
  Array.from({ length: 30 }, () => p("Memphis", "Subwoofers")),
  MARCAS,
  CATEGORIAS,
);

test("listadoInexistente: páginas que existen y que no", () => {
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/subwoofers", params("page=2")), false);
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/subwoofers", params("page=3")), true);
  assert.equal(listadoInexistente(CONTEOS, "/catalogo", params("page=99999")), true);
  assert.equal(listadoInexistente(CONTEOS, "/marcas/memphis", params("page=2")), false);
  assert.equal(listadoInexistente(CONTEOS, "/marcas/memphis", params("page=3")), true);
});

test("listadoInexistente: la página se lee igual que parsePagina", () => {
  // Basura cae en la 1, que siempre existe.
  for (const q of ["page=abc", "page=0", "page=-3", "page=", ""]) {
    assert.equal(listadoInexistente(CONTEOS, "/catalogo/subwoofers", params(q)), false, q);
  }
  // 2.9 se trunca a 2.
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/subwoofers", params("page=2.9")), false);
});

test("listadoInexistente: un listado vacío existe (página 1), pero no su página 2", () => {
  // /productos no tiene destacados en este conteo; /catalogo/bocinas tampoco.
  assert.equal(listadoInexistente(CONTEOS, "/productos", params("")), false);
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/bocinas", params("")), false);
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/bocinas", params("page=2")), true);
  // KBT existe pero no tiene subwoofers: vacío legítimo.
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/subwoofers", params("marca=kbt")), false);
});

test("listadoInexistente: filtros con slug inexistente", () => {
  assert.equal(listadoInexistente(CONTEOS, "/catalogo", params("marca=noexiste")), true);
  assert.equal(listadoInexistente(CONTEOS, "/marcas/memphis", params("categoria=zzz")), true);
  // Claves heredadas de Object.prototype no cuentan como slugs.
  assert.equal(listadoInexistente(CONTEOS, "/catalogo", params("marca=constructor")), true);
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/toString", params("")), true);
  // Filtro vacío = sin filtro, como en las páginas.
  assert.equal(listadoInexistente(CONTEOS, "/catalogo", params("marca=")), false);
  // El filtro cambia el total: Memphis tiene 30 → 2 páginas.
  assert.equal(listadoInexistente(CONTEOS, "/catalogo", params("marca=memphis&page=2")), false);
});

test("listadoInexistente: categoría o marca de la ruta que no existe", () => {
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/no-existe", params("")), true);
  assert.equal(listadoInexistente(CONTEOS, "/marcas/no-existe", params("")), true);
});

test("listadoInexistente: rutas que no son listados no le tocan", () => {
  assert.equal(listadoInexistente(CONTEOS, "/producto/algo", params("page=9")), null);
  assert.equal(listadoInexistente(CONTEOS, "/marcas", params("page=9")), null);
  assert.equal(listadoInexistente(CONTEOS, "/catalogo/a/b", params("")), null);
});

// ── Contra los datos reales ────────────────────────────────────────────────

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(path.join(RAIZ, "data", archivo), "utf-8")) as T;

test("data/conteos.json está al día con catalog.json (correr npm run import:catalog)", () => {
  const esperado = construirConteos(
    leer<Producto[]>("catalog.json"),
    leer<Brand[]>("brands.json"),
    CATEGORIAS_SITIO,
  );
  assert.deepEqual(leer<Conteos>("conteos.json"), esperado);
});

// Lo que protege de verdad: que el proxy y la página cuenten lo mismo. Si
// divergen, el proxy devuelve 404 a una página que existe, o deja pasar una
// que no.
test("los conteos coinciden con listProducts en cada combinación de listado y filtro", async () => {
  const conteos = leer<Conteos>("conteos.json");
  const marcas = leer<Brand[]>("brands.json");
  const total = async (filtros: Parameters<typeof staticAdapter.listProducts>[0]) =>
    (await staticAdapter.listProducts({ ...filtros, activo: true, pageSize: 1 })).total;

  assert.equal(conteos.catalogo.total, await total({}));
  assert.equal(conteos.productos.total, await total({ destacado: true }));
  for (const marca of marcas) {
    assert.equal(conteos.catalogo.porFiltro[marca.slug], await total({ marca: marca.nombre }));
    assert.equal(
      conteos.productos.porFiltro[marca.slug],
      await total({ marca: marca.nombre, destacado: true }),
    );
  }
  for (const categoria of CATEGORIAS_SITIO) {
    assert.equal(
      conteos.categorias[categoria.slug].total,
      await total({ categoria: categoria.nombre }),
    );
    for (const marca of marcas) {
      const n = await total({ categoria: categoria.nombre, marca: marca.nombre });
      assert.equal(conteos.categorias[categoria.slug].porFiltro[marca.slug], n);
      assert.equal(conteos.marcas[marca.slug].porFiltro[categoria.slug], n);
    }
  }
  for (const marca of marcas) {
    assert.equal(conteos.marcas[marca.slug].total, await total({ marca: marca.nombre }));
  }
});

test("PAGE_SIZE_DEFECTO es el tamaño que usa listProducts sin pageSize", async () => {
  const { pageSize } = await staticAdapter.listProducts({});
  assert.equal(pageSize, PAGE_SIZE_DEFECTO);
});
