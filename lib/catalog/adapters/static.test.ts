import test from "node:test";
import assert from "node:assert/strict";

import { staticAdapter } from "./static.ts";

test("getProduct: devuelve el producto por slug", async () => {
  const producto = await staticAdapter.getProduct("pioneer-dmh-ap6650bt");
  assert.ok(producto);
  assert.equal(producto?.sku, "DMH-AP6650BT");
});

test("getProduct: null si el slug no existe", async () => {
  const producto = await staticAdapter.getProduct("no-existe");
  assert.equal(producto, null);
});

test("listProducts: sin filtros devuelve todo el catálogo con su total real", async () => {
  const { items, total } = await staticAdapter.listProducts({});
  assert.equal(total, 10);
  assert.equal(items.length, 10); // 10 < pageSize por defecto, cabe en una página
});

test("listProducts: filtra por categoria", async () => {
  const { items, total } = await staticAdapter.listProducts({ categoria: "Bocinas" });
  assert.equal(total, 3);
  assert.ok(items.every((p) => p.categoria === "Bocinas"));
});

test("listProducts: filtra por marca", async () => {
  const { items, total } = await staticAdapter.listProducts({ marca: "Memphis" });
  assert.equal(total, 2);
  assert.ok(items.every((p) => p.marca === "Memphis"));
});

test("listProducts: pagina sin solaparse y sin perder el total real", async () => {
  const pagina1 = await staticAdapter.listProducts({ page: 1, pageSize: 4 });
  const pagina2 = await staticAdapter.listProducts({ page: 2, pageSize: 4 });
  const pagina3 = await staticAdapter.listProducts({ page: 3, pageSize: 4 });

  assert.equal(pagina1.total, 10);
  assert.equal(pagina2.total, 10);
  assert.equal(pagina1.items.length, 4);
  assert.equal(pagina2.items.length, 4);
  assert.equal(pagina3.items.length, 2); // resto: 10 - 4 - 4

  const skusPagina1 = pagina1.items.map((p) => p.sku);
  const skusPagina2 = pagina2.items.map((p) => p.sku);
  assert.equal(
    skusPagina1.some((sku) => skusPagina2.includes(sku)),
    false,
  );
});

test("listProducts: page fuera de rango devuelve items vacíos, no un error", async () => {
  const { items, total } = await staticAdapter.listProducts({ page: 99, pageSize: 4 });
  assert.equal(total, 10);
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

test("listCategories: devuelve las seis categorías con su conteo", async () => {
  const categorias = await staticAdapter.listCategories();
  assert.equal(categorias.length, 6);
  const bocinas = categorias.find((c) => c.slug === "bocinas");
  assert.equal(bocinas?.nombre, "Bocinas");
  assert.equal(bocinas?.cantidadProductos, 3);
});

test("las firmas son asíncronas: devuelven una Promise", () => {
  assert.ok(staticAdapter.getProduct("x") instanceof Promise);
  assert.ok(staticAdapter.listProducts({}) instanceof Promise);
  assert.ok(staticAdapter.listBrands() instanceof Promise);
  assert.ok(staticAdapter.listCategories() instanceof Promise);
});
