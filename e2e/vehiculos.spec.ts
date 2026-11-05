// El selector de vehículos de /buscar
// (docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md).
//
// Los datos de /buscar/vehiculos.json se reemplazan con page.route por un
// vehículo de prueba armado con el catálogo REAL (armarDatosVehiculos), así la
// prueba no depende de qué filas del libro estén revisadas, y los nombres de
// las tarjetas salen del catálogo, no se escriben a mano.
import { readFileSync } from "node:fs";

import { test, expect, type Page } from "@playwright/test";

import { INSTALACION } from "../lib/politicas.ts";
import type { Producto } from "../lib/catalog/types.ts";
import { armarDatosVehiculos } from "../lib/vehiculos/datos.ts";
import { notaReceptor, TEXTOS_ESTADO, tituloVehiculo } from "../lib/vehiculos/textos.ts";
import type { Vehiculo } from "../lib/vehiculos/types.ts";

const CATALOGO = JSON.parse(readFileSync("data/catalog.json", "utf-8")) as Producto[];

const PRUEBA: Vehiculo = {
  marca: "Prueba",
  marcaSlug: "prueba",
  modelo: "Uno",
  modeloSlug: "uno",
  version: null,
  versionSlug: null,
  desde: 2008,
  hasta: 2012,
  radio1din: "con_marco",
  radio2din: "directo",
  ubicaciones: [
    { ubicacion: "Puertas delanteras", medidas: ['6.5"'], accesorio: "KSM-8" },
    { ubicacion: "Bandeja trasera", medidas: ['6x8"'], accesorio: null },
  ],
};

// Los receptores con anotación (NOTAS_RECEPTOR) entran como activos y
// disponibles: la anotación se prueba aunque el libro tenga ese producto
// agotado o inactivo en este momento.
const CATALOGO_PRUEBA = CATALOGO.map((p) =>
  notaReceptor(p.sku) ? { ...p, activo: true, disponibilidad: "disponible" as const } : p,
);
const DATOS = armarDatosVehiculos([PRUEBA], CATALOGO_PRUEBA);
const DOS_DIN = DATOS.receptores.find((r) => r.formato === "2-din");
const KSM8 = DATOS.piezas.find((p) => p.sku === "KSM-8");
const AP6650 = DATOS.receptores.find((r) => r.sku === "DMH-AP6650BT");
const CON_NOTA = DATOS.receptores.find((r) => notaReceptor(r.sku) !== null);

const TITULO = tituloVehiculo(PRUEBA, 2010);
const RUTA_ELEGIDA = "/buscar?vehiculo=prueba&modelo=uno&anio=2010";

async function servirDatos(page: Page) {
  await page.route("**/buscar/vehiculos.json", (ruta) =>
    ruta.fulfill({ json: DATOS, headers: { "content-type": "application/json" } }),
  );
}

// Sin fotos optimizadas, como en chat.spec.ts: un vehículo trae unas 45
// tarjetas, y en el runner de CI (pocos núcleos, caché de imágenes vacía) el
// optimizador de Next se quedaba con el procesador del servidor. La recarga,
// que espera a «load», pasaba los 30 s, y el clic en la pieza no llegaba a
// navegar en 5 s. Lo que se prueba acá son los datos y los enlaces, no las
// fotos.
test.beforeEach(async ({ page }) => {
  await page.route(/\/_next\/image/, (ruta) => ruta.abort());
});

// La tarjeta y, debajo, fuera de ella, las líneas de estado y de nota.
function itemDe(page: Page, nombre: string) {
  return page.locator("div.flex.flex-col.gap-2").filter({ hasText: nombre }).first();
}

test("elige marca, modelo y año en /buscar y muestra lo que cabe", async ({ page }) => {
  expect(DOS_DIN, "el catálogo no trae un receptor 2 DIN").toBeTruthy();
  expect(KSM8, "el catálogo no trae la pieza KSM-8").toBeTruthy();
  expect(CON_NOTA, "ningún receptor con anotación llegó a los datos").toBeTruthy();
  await servirDatos(page);
  await page.goto("/buscar");

  await page.getByLabel("Marca", { exact: true }).selectOption({ label: "Prueba" });
  await page.getByLabel("Modelo", { exact: true }).selectOption({ label: "Uno" });
  await page.getByLabel("Año", { exact: true }).selectOption({ label: "2010" });
  await expect(page).toHaveURL(new RegExp(`${RUTA_ELEGIDA.replaceAll("?", "\\?")}$`));

  await expect(page.getByRole("heading", { name: TITULO })).toBeVisible();
  await expect(itemDe(page, DOS_DIN!.nombre).locator(":scope > p").first()).toHaveText(
    TEXTOS_ESTADO.cabe,
  );

  await expect(page.getByRole("heading", { name: 'Puertas delanteras · 6.5"' })).toBeVisible();
  const enlacePieza = page.getByRole("link", { name: KSM8!.nombre }).first();
  await expect(enlacePieza).toBeVisible();
  await expect(page.getByText('No hay bocinas de 6x8" en el catálogo.')).toBeVisible();
  await expect(page.getByText(INSTALACION)).toBeVisible();

  if (AP6650) {
    const item = itemDe(page, AP6650.nombre);
    await expect(item).toContainText(TEXTOS_ESTADO.consultar);
    const href = await item
      .getByRole("link", { name: "Escríbenos por WhatsApp" })
      .getAttribute("href");
    const mensaje = decodeURIComponent(href ?? "");
    expect(mensaje).toContain(`Vehículo: ${TITULO}`);
    expect(mensaje).toContain(RUTA_ELEGIDA);
  }

  await expect(itemDe(page, CON_NOTA!.nombre).locator(":scope > p").nth(1)).toHaveText(
    notaReceptor(CON_NOTA!.sku)!,
  );

  await page.reload();
  await expect(page.getByRole("heading", { name: TITULO })).toBeVisible();
  await expect(page.getByLabel("Marca", { exact: true })).toHaveValue("prueba");
  await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue("uno");
  await expect(page.getByLabel("Año", { exact: true })).toHaveValue("2010");

  await page.getByRole("link", { name: KSM8!.nombre }).first().click();
  await expect(page).toHaveURL(new RegExp(`/producto/${KSM8!.slug}$`));
});

test("escribir una búsqueda oculta el selector y saca el vehículo de la dirección", async ({
  page,
}) => {
  await servirDatos(page);
  await page.goto(RUTA_ELEGIDA);
  await expect(page.getByRole("heading", { name: TITULO })).toBeVisible();

  const campo = page.getByRole("combobox", { name: "Buscar en el catálogo" });
  await campo.fill("memphis");
  await campo.press("Enter");
  await expect(page).toHaveURL(/\/buscar\?q=memphis$/);
  await expect(
    page.getByRole("heading", { name: "Receptores y bocinas por vehículo" }),
  ).toHaveCount(0);
});

test("si la descarga falla, ofrece reintentar", async ({ page }) => {
  await page.route("**/buscar/vehiculos.json", (ruta) => ruta.fulfill({ status: 500, body: "" }));
  await page.goto("/buscar");
  await expect(page.getByText("No se pudo cargar la lista de vehículos.")).toBeVisible();

  await page.unroute("**/buscar/vehiculos.json");
  await servirDatos(page);
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByLabel("Marca", { exact: true }).locator("option", { hasText: "Prueba" }),
  ).toHaveCount(1);
});

test("vehiculos.json no se indexa y el canonical de /buscar va sin parámetros", async ({
  page,
}) => {
  const respuesta = await page.request.get("/buscar/vehiculos.json");
  expect(respuesta.headers()["x-robots-tag"]).toBe("noindex");

  await servirDatos(page);
  await page.goto("/buscar?vehiculo=prueba");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/buscar$/);
});
