// El cotizador privado (docs/superpowers/specs/2026-11-16-cotizador-design.md):
// sin sesión no hay herramienta ni catálogo, con la contraseña sí, y el
// borrador sobrevive a una recarga. La contraseña es la del servidor de
// pruebas (playwright.config.ts → COTIZADOR_PASSWORD).
import { readFileSync } from "node:fs";

import { test, expect, type Page } from "@playwright/test";

const CONTRASENA = "contrasena-de-prueba-e2e";
// El nombre sale del catálogo: el libro se edita y un nombre escrito acá rompía
// la prueba sin que fallara nada real.
const PRODUCTO = (
  JSON.parse(readFileSync("data/catalog.json", "utf-8")) as { sku: string; nombre: string }[]
).find((p) => p.sku === "TS-W312D4")!.nombre;
// El precio va con expresión: la prueba no depende del valor del catálogo.
// `\s` cubre el espacio duro que usa formatQ.
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LINEA = new RegExp(
  `1x ${escapar(PRODUCTO)} — Q\\s[\\d,]+\\.\\d{2} c\\/u — Q\\s[\\d,]+\\.\\d{2}`,
);

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

// Sin fotos optimizadas: lo que se prueba es la herramienta, y en CI el
// optimizador se queda con el procesador.
test.beforeEach(async ({ page }) => {
  await page.route(/\/_next\/image/, (ruta) => ruta.abort());
});

async function entrar(page: Page) {
  await page.goto("/cotizador");
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("textbox", { name: "Buscar productos" })).toBeVisible();
}

async function agregarProducto(page: Page) {
  await page.getByRole("textbox", { name: "Buscar productos" }).fill("TS-W312D4");
  await page.getByRole("button", { name: `Agregar ${PRODUCTO}`, exact: true }).click();
}

function cuadroMensaje(page: Page) {
  return page.getByRole("textbox", { name: "Mensaje de la cotización" });
}

test("sin sesión solo hay el formulario: ni catálogo ni indexación", async ({ page }) => {
  const respuesta = await page.request.get("/cotizador");
  expect(respuesta.status()).toBe(200);
  const html = await respuesta.text();
  expect(html).toContain('type="password"');
  // Los nombres de producto solo viajan con sesión. (Los skus no sirven para
  // esta prueba: el layout los manda en todas las páginas, por el carrito.)
  expect(html).not.toContain("Champion Series");
  expect(html).toMatch(/<meta name="robots" content="noindex/);
});

test("una contraseña incorrecta no entra", async ({ page }) => {
  await page.goto("/cotizador");
  await page.getByLabel("Contraseña").fill("otra-contrasena-larga");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Buscar productos" })).toHaveCount(0);
});

test("con la contraseña correcta se arma la cotización y se copia", async ({ page }) => {
  await entrar(page);
  await agregarProducto(page);
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);

  await page.getByRole("button", { name: "Copiar" }).click();
  await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
  const portapapeles = await page.evaluate(() => navigator.clipboard.readText());
  expect(portapapeles).toMatch(LINEA);
  expect(portapapeles).toContain("Precios con IVA incluido.");
});

test("recargar conserva el borrador", async ({ page }) => {
  await entrar(page);
  await agregarProducto(page);
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("sonoro:cotizador")))
    .toContain("TS-W312D4");

  await page.reload();
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);
});

// Cada pestaña del navegador es una cotización aparte: el borrador vive en
// sessionStorage, que no se comparte entre pestañas (localStorage sí, y ahí la
// última en guardar pisaba a las demás). Las dos pestañas son del MISMO
// contexto: comparten cookie de sesión y localStorage, como dos pestañas reales.
test("dos pestañas son dos cotizaciones distintas", async ({ page, context }) => {
  await entrar(page);
  await page.getByLabel("Cliente (opcional)").fill("Ana");
  await agregarProducto(page);
  await expect(cuadroMensaje(page)).toHaveValue(/^Cotización Sonoro para Ana:/);

  const otra = await context.newPage();
  await otra.route(/\/_next\/image/, (ruta) => ruta.abort());
  await otra.goto("/cotizador");
  await expect(otra.getByRole("textbox", { name: "Buscar productos" })).toBeVisible();
  // La pestaña nueva arranca vacía: no hereda la cotización de la primera.
  await expect(cuadroMensaje(otra)).toHaveValue("");
  await expect(otra.getByLabel("Cliente (opcional)")).toHaveValue("");

  await otra.getByLabel("Cliente (opcional)").fill("Beto");
  await agregarProducto(otra);
  await expect(cuadroMensaje(otra)).toHaveValue(/^Cotización Sonoro para Beto:/);

  // Recargar cada una devuelve SU cotización, no la de la otra.
  await page.reload();
  await expect(cuadroMensaje(page)).toHaveValue(/^Cotización Sonoro para Ana:/);
  await otra.reload();
  await expect(cuadroMensaje(otra)).toHaveValue(/^Cotización Sonoro para Beto:/);
});

// El borrador de antes vivía en localStorage. Una pestaña nueva no debe
// heredarlo, y se borra para no dejar para siempre en el navegador una
// cotización —con el nombre de un cliente— que nada vuelve a leer.
test("el borrador viejo de localStorage no se hereda y se borra", async ({ page }) => {
  await entrar(page);
  await page.evaluate(() =>
    localStorage.setItem(
      "sonoro:cotizador",
      JSON.stringify({ cliente: "Viejo", lineas: [{ sku: "TS-W312D4", qty: 1 }] }),
    ),
  );

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Buscar productos" })).toBeVisible();
  await expect(cuadroMensaje(page)).toHaveValue("");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sonoro:cotizador"))).toBeNull();
});

test("vaciar deja el mensaje en blanco y Copiar deshabilitado", async ({ page }) => {
  await entrar(page);
  await agregarProducto(page);
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);

  await page.getByRole("button", { name: "Vaciar" }).click();
  await expect(cuadroMensaje(page)).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copiar" })).toBeDisabled();
});

test("la casilla de precios individuales quita los precios de las líneas, no los totales", async ({
  page,
}) => {
  await entrar(page);
  await agregarProducto(page);
  const casilla = page.getByRole("checkbox", { name: "Mostrar precios individuales" });
  // Activada de entrada: así se veía la cotización antes de la casilla.
  await expect(casilla).toBeChecked();
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);

  await casilla.uncheck();
  await expect(cuadroMensaje(page)).toHaveValue(new RegExp(`^.*\\n\\n1x ${escapar(PRODUCTO)}\\n`));
  const mensaje = await cuadroMensaje(page).inputValue();
  expect(mensaje).not.toContain("c/u");
  expect(mensaje).toContain("Subtotal: Q");
  expect(mensaje).toContain("Total: Q");

  // Es parte de la cotización de ESTA pestaña: recargar la conserva...
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("sonoro:cotizador")))
    .toContain('"mostrarPrecios":false');
  await page.reload();
  await expect(casilla).not.toBeChecked();
  await expect(cuadroMensaje(page)).not.toHaveValue(/c\/u/);

  // ...y «Vaciar» empieza una cotización nueva, que vuelve a mostrar los precios.
  await page.getByRole("button", { name: "Vaciar" }).click();
  await expect(casilla).toBeChecked();
});

test("salir cierra la sesión", async ({ page }) => {
  await entrar(page);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByLabel("Contraseña")).toBeVisible();

  await page.goto("/cotizador");
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Buscar productos" })).toHaveCount(0);
});

test("robots.txt no deja rastrear /cotizador", async ({ request }) => {
  const respuesta = await request.get("/robots.txt");
  expect(await respuesta.text()).toContain("Disallow: /cotizador");
});
