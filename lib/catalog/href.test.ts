import test from "node:test";
import assert from "node:assert/strict";

import { OrdenSchema } from "./types.ts";
import { buildCatalogHref, buildMarcaHref, buildProductosHref, hrefsDeOrden } from "./href.ts";

// Lo que estas pruebas protegen es el REQUISITO DE URL LIMPIA: el orden por
// defecto no se escribe como query param, así que /marcas/kbt sigue siendo
// /marcas/kbt. El canonical de cada ruta se arma con estos mismos builders
// (sin pasar `orden`), así que si el default empezara a emitir parámetro, se
// fragmentaría el canonical de todos los listados.
test("href: el orden por defecto no aparece en la URL", () => {
  assert.equal(buildCatalogHref("bocinas", { orden: "relevancia" }), "/catalogo/bocinas");
  assert.equal(buildMarcaHref("kbt", { orden: "relevancia" }), "/marcas/kbt");
  assert.equal(buildProductosHref({ orden: "relevancia" }), "/productos");
});

test("href: sin estado, la URL queda limpia", () => {
  assert.equal(buildCatalogHref("bocinas", {}), "/catalogo/bocinas");
  assert.equal(buildMarcaHref("kbt", {}), "/marcas/kbt");
  assert.equal(buildProductosHref({}), "/productos");
});

test("href: los órdenes explícitos sí aparecen — son un pedido del usuario", () => {
  assert.equal(
    buildCatalogHref("bocinas", { orden: "precio_asc" }),
    "/catalogo/bocinas?orden=precio_asc",
  );
  assert.equal(buildMarcaHref("kbt", { orden: "precio_desc" }), "/marcas/kbt?orden=precio_desc");
  assert.equal(buildProductosHref({ orden: "precio_asc" }), "/productos?orden=precio_asc");
});

test("href: orden, filtro y página conviven; page 1 se omite", () => {
  assert.equal(
    buildCatalogHref("bocinas", { marca: "kbt", orden: "precio_asc", page: 2 }),
    "/catalogo/bocinas?marca=kbt&orden=precio_asc&page=2",
  );
  assert.equal(
    buildMarcaHref("kbt", { categoria: "subwoofers", orden: "precio_desc", page: 3 }),
    "/marcas/kbt?categoria=subwoofers&orden=precio_desc&page=3",
  );
  // page 1 y el orden por defecto se omiten los dos; queda solo el filtro.
  assert.equal(
    buildProductosHref({ marca: "kbt", orden: "relevancia", page: 1 }),
    "/productos?marca=kbt",
  );
});

test("hrefsDeOrden: resuelve los tres órdenes conservando los filtros", () => {
  const hrefs = hrefsDeOrden((orden) => buildMarcaHref("kbt", { categoria: "subwoofers", orden }));

  assert.deepEqual(hrefs, {
    // El default sigue sin escribir parámetro, también acá.
    relevancia: "/marcas/kbt?categoria=subwoofers",
    precio_asc: "/marcas/kbt?categoria=subwoofers&orden=precio_asc",
    precio_desc: "/marcas/kbt?categoria=subwoofers&orden=precio_desc",
  });
});

test("hrefsDeOrden: cubre todos los valores del enum", () => {
  // Si mañana se agrega un orden nuevo y el selector no lo contempla, esto
  // falla acá y no con un href undefined en el navegador.
  const hrefs = hrefsDeOrden(() => "/x");
  assert.deepEqual(Object.keys(hrefs).sort(), OrdenSchema.options.slice().sort());
});
