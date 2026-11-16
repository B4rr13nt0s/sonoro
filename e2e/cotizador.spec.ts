// El cotizador privado (docs/superpowers/specs/2026-11-16-cotizador-design.md):
// sin sesión no hay herramienta ni catálogo, con la contraseña sí, y el
// borrador sobrevive a una recarga. La contraseña es la del servidor de
// pruebas (playwright.config.ts → COTIZADOR_PASSWORD).
import { test, expect, type Page } from "@playwright/test";

const CONTRASENA = "contrasena-de-prueba-e2e";
const PRODUCTO = 'Subwoofer Champion Series 12" TS-W312D4';
// El precio va con expresión: la prueba no depende del valor del catálogo.
// `\s` cubre el espacio duro que usa formatQ.
const LINEA =
  /1x Subwoofer Champion Series 12" TS-W312D4 — Q\s[\d,]+\.\d{2} c\/u — Q\s[\d,]+\.\d{2}/;

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
    .poll(() => page.evaluate(() => localStorage.getItem("sonoro:cotizador")))
    .toContain("TS-W312D4");

  await page.reload();
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);
});

test("vaciar deja el mensaje en blanco y Copiar deshabilitado", async ({ page }) => {
  await entrar(page);
  await agregarProducto(page);
  await expect(cuadroMensaje(page)).toHaveValue(LINEA);

  await page.getByRole("button", { name: "Vaciar" }).click();
  await expect(cuadroMensaje(page)).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copiar" })).toBeDisabled();
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
