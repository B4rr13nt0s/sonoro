// La barra de filtros de /buscar
// (docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md, decisiones 8–13).
//
// La consulta de todas las pruebas es «bocina»: hoy trae varias marcas,
// medidas y usos, así que salen todas las listas. Antes de cada caso se
// comprueba con el catálogo real que siga siendo así: si el libro cambia, la
// prueba falla diciendo eso y no por una lista que no aparece.
import { readFileSync } from "node:fs";

import { test, expect, type Page } from "@playwright/test";

import type { Producto } from "../lib/catalog/types.ts";

const BOCINAS = (JSON.parse(readFileSync("data/catalog.json", "utf-8")) as Producto[]).filter(
  (p) => p.activo && p.categoria === "Bocinas",
);
const MARCAS = [...new Set(BOCINAS.map((p) => p.marca))];
const MEDIDAS = new Set(BOCINAS.map((p) => p.atributos?.medida));
const USOS = new Set(BOCINAS.flatMap((p) => p.uso ?? ["carro"]));
const MARCA = MARCAS[0];

function comprobarCatalogo() {
  expect(MARCAS.length, "las bocinas activas ya no traen más de una marca").toBeGreaterThan(1);
  expect(MEDIDAS.size, "las bocinas activas ya no traen más de una medida").toBeGreaterThan(1);
  expect(USOS.size, "las bocinas activas ya no traen más de un uso").toBeGreaterThan(1);
}

async function sobranteHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

// Sin fotos optimizadas, como en vehiculos.spec.ts: lo que se prueba es la
// barra, no las fotos, y en CI el optimizador se queda con el procesador.
test.beforeEach(async ({ page }) => {
  comprobarCatalogo();
  await page.route(/\/_next\/image/, (ruta) => ruta.abort());
});

test("una ✕ quita su filtro", async ({ page }) => {
  await page.goto(`/buscar?q=bocina&marca=${encodeURIComponent(MARCA)}`);
  const quitar = page.getByRole("button", { name: `Quitar filtro: ${MARCA}` });
  await expect(quitar).toBeVisible();
  await quitar.click();
  await expect(page).not.toHaveURL(/[?&]marca=/);
  await expect(page.getByLabel("Filtrar por marca")).toHaveValue("");
});

test("«Quitar filtros» vuelve todo a todos y conserva lo escrito", async ({ page }) => {
  await page.goto(`/buscar?q=bocina&marca=${encodeURIComponent(MARCA)}&disp=disponible`);
  await expect(page.getByRole("button", { name: `Quitar filtro: ${MARCA}` })).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page).toHaveURL(/\/buscar\?q=bocina$/);
});

test("a 375 px los filtros no desbordan la página", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/buscar?q=bocina");
  const marca = page.getByLabel("Filtrar por marca");
  await expect(marca).toBeVisible();
  expect(await sobranteHorizontal(page)).toBe(0);
  const caja = await marca.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.x).toBeGreaterThanOrEqual(0);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(375);
});

test("a 768 px Ordenar queda en la barra, a la derecha", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/buscar?q=bocina");
  const ordenar = page.getByLabel("Ordenar resultados");
  await expect(ordenar).toBeVisible();
  expect(await sobranteHorizontal(page)).toBe(0);
  const caja = await ordenar.boundingBox();
  const ancho = await page.evaluate(() => document.documentElement.clientWidth);
  expect(caja).not.toBeNull();
  expect(ancho - (caja!.x + caja!.width)).toBeLessThanOrEqual(48);
});

test("al quitar un filtro el foco pasa al siguiente, y «Quitar filtros» lo deja en «Todo»", async ({
  page,
}) => {
  await page.goto(`/buscar?q=bocina&marca=${encodeURIComponent(MARCA)}&disp=disponible`);
  const quitarMarca = page.getByRole("button", { name: `Quitar filtro: ${MARCA}` });
  await expect(quitarMarca).toBeVisible();
  await quitarMarca.focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/[?&]marca=/);
  await expect(page.getByRole("button", { name: "Quitar filtro: Disponible" })).toBeFocused();

  await page.getByRole("button", { name: "Quitar filtros" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/buscar\?q=bocina$/);
  await expect(page.getByRole("button", { name: "Todo", exact: true })).toBeFocused();
});

test("a 375 px cada lista va a todo el ancho y su texto se lee entero", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/buscar?q=bocina");
  await expect(page.getByLabel("Filtrar por marca")).toBeVisible();
  const anchos = await page
    .locator('select[aria-label^="Filtrar por"], select[aria-label="Ordenar resultados"]')
    .evaluateAll((listas) => listas.map((l) => Math.round(l.getBoundingClientRect().width)));
  expect(anchos.length).toBeGreaterThan(2);
  for (const ancho of anchos) expect(ancho).toBeGreaterThanOrEqual(375 - 48);
});

test("a 1280 px, con tres listas, la barra entra en una línea", async ({ page }) => {
  await page.goto("/buscar?q=subwoofer%2012");
  const ordenar = page.getByLabel("Ordenar resultados");
  await expect(ordenar).toBeVisible();
  const listas = await page.locator('select[aria-label^="Filtrar por"]').count();
  expect(listas, "«subwoofer 12» ya no trae tres listas de filtros").toBeLessThanOrEqual(3);
  const todo = await page.getByRole("button", { name: "Todo", exact: true }).boundingBox();
  const caja = await ordenar.boundingBox();
  expect(Math.abs(caja!.y + caja!.height / 2 - (todo!.y + todo!.height / 2))).toBeLessThan(8);
});
