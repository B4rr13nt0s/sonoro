import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { staticAdapter } from "./static.ts";
import type { Producto } from "../types.ts";

// Conteos derivados de data/catalog.json real, no números fijos — el
// catálogo hoy tiene 10 productos de prueba + 2 de Cerwin Vega (uno
// inactivo, para probar el filtro de activo), pero pronto crece con el
// catálogo real (CLAUDE.md § Fuente de verdad). Un total hardcodeado se
// desincroniza cada vez que se importa una fila nueva — estas pruebas
// deben seguir pasando sin tocarlas cuando eso pase.
const RUTA_CATALOGO_REAL = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/catalog.json",
);
const CATALOGO_REAL: Producto[] = JSON.parse(readFileSync(RUTA_CATALOGO_REAL, "utf-8"));
const TOTAL_CATALOGO = CATALOGO_REAL.length;
const TOTAL_BOCINAS = CATALOGO_REAL.filter((p) => p.categoria === "Bocinas").length;
const TOTAL_MEMPHIS = CATALOGO_REAL.filter((p) => p.marca === "Memphis").length;

test("getProduct: devuelve el producto por slug", async () => {
  const producto = await staticAdapter.getProduct("pioneer-dmh-ap6650bt");
  assert.ok(producto);
  assert.equal(producto?.sku, "DMH-AP6650BT");
});

test("getProduct: null si el slug no existe", async () => {
  const producto = await staticAdapter.getProduct("no-existe");
  assert.equal(producto, null);
});

test("listProducts: sin filtros devuelve el total real del catálogo", async () => {
  const { total } = await staticAdapter.listProducts({});
  assert.equal(total, TOTAL_CATALOGO);
});

test("listProducts: con pageSize suficiente, items.length cubre el total", async () => {
  const { items } = await staticAdapter.listProducts({ pageSize: TOTAL_CATALOGO });
  assert.equal(items.length, TOTAL_CATALOGO);
});

test("listProducts: filtra por categoria", async () => {
  const { items, total } = await staticAdapter.listProducts({ categoria: "Bocinas" });
  assert.equal(total, TOTAL_BOCINAS);
  assert.ok(items.every((p) => p.categoria === "Bocinas"));
});

test("listProducts: filtra por marca", async () => {
  const { items, total } = await staticAdapter.listProducts({ marca: "Memphis" });
  assert.equal(total, TOTAL_MEMPHIS);
  assert.ok(items.every((p) => p.marca === "Memphis"));
});

test("listProducts: pagina sin solaparse y sin perder el total real", async () => {
  const pageSize = 4;
  const pagina1 = await staticAdapter.listProducts({ page: 1, pageSize });
  const pagina2 = await staticAdapter.listProducts({ page: 2, pageSize });
  const pagina3 = await staticAdapter.listProducts({ page: 3, pageSize });

  const restantes = (pagina: number) =>
    Math.max(0, Math.min(pageSize, TOTAL_CATALOGO - pagina * pageSize));

  assert.equal(pagina1.total, TOTAL_CATALOGO);
  assert.equal(pagina2.total, TOTAL_CATALOGO);
  assert.equal(pagina1.items.length, restantes(0));
  assert.equal(pagina2.items.length, restantes(1));
  assert.equal(pagina3.items.length, restantes(2));

  const skusPagina1 = pagina1.items.map((p) => p.sku);
  const skusPagina2 = pagina2.items.map((p) => p.sku);
  assert.equal(
    skusPagina1.some((sku) => skusPagina2.includes(sku)),
    false,
  );
});

test("listProducts: page fuera de rango devuelve items vacíos, no un error", async () => {
  const { items, total } = await staticAdapter.listProducts({
    page: TOTAL_CATALOGO + 100,
    pageSize: 4,
  });
  assert.equal(total, TOTAL_CATALOGO);
  assert.deepEqual(items, []);
});

test("listProducts: sin orden no reordena — respeta el orden del catálogo", async () => {
  const sinOrden = await staticAdapter.listProducts({});
  const conAsc = await staticAdapter.listProducts({ orden: "precio_asc" });
  assert.notDeepEqual(
    sinOrden.items.map((p) => p.sku),
    conAsc.items.map((p) => p.sku),
  );
});

test("listProducts: orden precio_asc ordena de menor a mayor precio", async () => {
  const { items } = await staticAdapter.listProducts({ orden: "precio_asc" });
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i].precioCents >= items[i - 1].precioCents);
  }
});

test("listProducts: orden precio_desc ordena de mayor a menor precio", async () => {
  const { items } = await staticAdapter.listProducts({ orden: "precio_desc" });
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i].precioCents <= items[i - 1].precioCents);
  }
});

test("listProducts: activo: true solo devuelve productos activos", async () => {
  const { items } = await staticAdapter.listProducts({ activo: true });
  assert.ok(items.every((p) => p.activo === true));
});

test("listProducts: activo: false solo devuelve productos inactivos", async () => {
  const { items } = await staticAdapter.listProducts({ activo: false });
  assert.ok(items.every((p) => p.activo === false));
});

test("listProducts: sin especificar activo, no filtra por ese campo — activo:true + activo:false = sin filtro", async () => {
  const sinFiltro = await staticAdapter.listProducts({});
  const soloActivos = await staticAdapter.listProducts({ activo: true });
  const soloInactivos = await staticAdapter.listProducts({ activo: false });
  // Prueba que la partición es exacta (ni se pierde ni se duplica nada),
  // sin depender de cuántos productos inactivos haya hoy en el catálogo.
  assert.equal(sinFiltro.total, soloActivos.total + soloInactivos.total);
});

test("listProducts: devuelve page y pageSize junto con items y total", async () => {
  const resultado = await staticAdapter.listProducts({ page: 2, pageSize: 4 });
  assert.equal(resultado.page, 2);
  assert.equal(resultado.pageSize, 4);
});

test("listBrands: devuelve las marcas distintas con su conteo", async () => {
  const brands = await staticAdapter.listBrands();
  assert.equal(brands.length, 8);
  const pioneer = brands.find((b) => b.nombre === "Pioneer");
  assert.equal(pioneer?.cantidadProductos, 2);
});

test("listBrands: el conteo solo cuenta productos activos (Cerwin Vega: CAK42 activo + XED62 inactivo → 1, no 2)", async () => {
  const brands = await staticAdapter.listBrands();
  const cerwinVega = brands.find((b) => b.slug === "cerwin-vega");
  assert.equal(cerwinVega?.cantidadProductos, 1);
});

test("listCategories: devuelve las ocho categorías con su conteo", async () => {
  const categorias = await staticAdapter.listCategories();
  assert.equal(categorias.length, 8);
  const bocinas = categorias.find((c) => c.slug === "bocinas");
  assert.equal(bocinas?.nombre, "Bocinas");
  // Solo activos: ACX 165 y STAGE2 634 (XED62 está inactivo).
  assert.equal(bocinas?.cantidadProductos, 2);
});

test("listCategories: una categoría sin productos todavía sigue apareciendo, con conteo 0", async () => {
  const categorias = await staticAdapter.listCategories();
  const ecualizadores = categorias.find((c) => c.slug === "ecualizadores");
  const accesorios = categorias.find((c) => c.slug === "accesorios");
  assert.equal(ecualizadores?.cantidadProductos, 0);
  assert.equal(accesorios?.cantidadProductos, 0);
});

test("las firmas son asíncronas: devuelven una Promise", () => {
  assert.ok(staticAdapter.getProduct("x") instanceof Promise);
  assert.ok(staticAdapter.listProducts({}) instanceof Promise);
  assert.ok(staticAdapter.listBrands() instanceof Promise);
  assert.ok(staticAdapter.listCategories() instanceof Promise);
});
