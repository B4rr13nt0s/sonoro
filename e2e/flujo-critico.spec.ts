// Flujo crítico de docs/PLAN.md § Fase 6/8: buscar → filtrar → agregar dos
// productos → abrir el carrito → verificar el texto EXACTO del mensaje de
// WhatsApp generado (incluye el formato de precio).
//
// El precio (formatQ) se calcula con la función real de
// lib/format/precio.ts — así el test no depende de teclear a mano el
// espacio duro U+00A0 (invisible, fácil de escribir mal). La PLANTILLA del
// mensaje (orden de líneas, texto literal) sí está escrita a mano acá, no
// llamando a buildOrderMessage: si llamara a la misma función que arma el
// mensaje real, el test nunca detectaría una regresión de texto en esa
// función. El objetivo es probar la integración (¿la UI de verdad conecta
// carrito → mensaje → URL de WhatsApp?), no repetir lo que ya cubren
// lib/whatsapp/*.test.ts.
import { test, expect } from "@playwright/test";

import { formatQ } from "../lib/format/precio.ts";

// El Ref depende de cart.createdAt (lib/cart/context.ts: new Date() al
// crear/tocar el carrito) vía buildOrderRef (hash FNV-1a determinista,
// lib/whatsapp/ref.ts) — con el reloj congelado en FECHA_CONGELADA, el Ref
// es siempre el mismo. Recalculado con:
//   node --experimental-strip-types -e "import('./lib/whatsapp/ref.ts').then(m => console.log(m.buildOrderRef('2026-01-01T00:00:00.000Z')))"
const FECHA_CONGELADA = new Date("2026-01-01T00:00:00.000Z");
const REF_ESPERADO = "SNR-SIE5N";

// Dos productos reales del catálogo (data/catalog.json), misma marca
// (Memphis) en categorías distintas — así "buscar + filtrar" tiene sentido:
// una búsqueda por marca trae resultados de Amplificadores y de Kits.
const PRODUCTO_1 = {
  slug: "memphis-mjp800-4",
  nombre: "Amplificador MJP800.4 - 4 canales",
  sku: "MJP800.4",
  precioCents: 300000,
};
const PRODUCTO_2 = {
  slug: "memphis-4gkit",
  nombre: "Kit de instalación calibre 4",
  sku: "4GKIT",
  precioCents: 110000,
};

test("buscar, filtrar, agregar dos productos y verificar el mensaje de WhatsApp", async ({
  page,
}) => {
  // Reloj congelado ANTES de la primera navegación, para que el primer
  // new Date() de la app (al crear/tocar el carrito) use esta fecha.
  // setFixedTime, no install(): install() arranca en esta fecha pero SIGUE
  // avanzando en tiempo real — con eso el createdAt real difiere en los
  // milisegundos que tarda el flujo completo, y el Ref deja de ser
  // predecible. setFixedTime detiene el reloj de verdad.
  await page.clock.setFixedTime(FECHA_CONGELADA);

  // 1) Buscar
  await page.goto("/buscar");
  await page.getByLabel("Buscar en el catálogo").fill("memphis");
  await page.getByLabel("Buscar en el catálogo").press("Enter");
  await expect(page.getByRole("heading", { name: "2 resultados" })).toBeVisible();

  const linkProducto1 = page.getByRole("link", { name: new RegExp(PRODUCTO_1.nombre) });
  const linkProducto2 = page.getByRole("link", { name: new RegExp(PRODUCTO_2.nombre) });
  await expect(linkProducto1).toBeVisible();
  await expect(linkProducto2).toBeVisible();

  // 2) Filtrar por categoría — Amplificadores deja ver solo el producto 1
  await page.getByRole("button", { name: /^Amplificadores/ }).click();
  await expect(linkProducto1).toBeVisible();
  await expect(linkProducto2).not.toBeVisible();

  // Volver a "Todo" confirma que el filtro de verdad filtraba, no que
  // siempre mostró lo mismo.
  await page.getByRole("button", { name: "Todo" }).click();
  await expect(linkProducto1).toBeVisible();
  await expect(linkProducto2).toBeVisible();

  // 3) Agregar el primer producto
  await linkProducto1.click();
  await expect(page.getByRole("heading", { level: 1, name: PRODUCTO_1.nombre })).toBeVisible();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  // 4) Buscar de nuevo y agregar el segundo producto — el carrito vive en
  // localStorage, así que sobrevive a la recarga real de page.goto().
  await page.goto("/buscar");
  await page.getByLabel("Buscar en el catálogo").fill("memphis");
  await page.getByLabel("Buscar en el catálogo").press("Enter");
  await page.getByRole("link", { name: new RegExp(PRODUCTO_2.nombre) }).click();
  await expect(page.getByRole("heading", { level: 1, name: PRODUCTO_2.nombre })).toBeVisible();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  // 5) Abrir el carrito y verificar las dos líneas
  await page.goto("/carrito");
  await expect(page.getByText(PRODUCTO_1.nombre, { exact: true })).toBeVisible();
  await expect(page.getByText(PRODUCTO_1.sku, { exact: true })).toBeVisible();
  await expect(page.getByText(PRODUCTO_2.nombre, { exact: true })).toBeVisible();
  await expect(page.getByText(PRODUCTO_2.sku, { exact: true })).toBeVisible();
  await expect(page.getByText(`Ref: ${REF_ESPERADO}`)).toBeVisible();

  // 6) El mensaje de WhatsApp — se lee el href, nunca se hace click (no
  // depende de que wa.me responda en CI/red real).
  const href = await page.getByRole("link", { name: "Pedir por WhatsApp" }).getAttribute("href");
  if (!href) throw new Error('No se encontró el link "Pedir por WhatsApp"');

  const url = new URL(href);
  expect(url.origin + url.pathname).toBe("https://wa.me/50200000000");
  const mensaje = url.searchParams.get("text");

  const subtotalCents = PRODUCTO_1.precioCents + PRODUCTO_2.precioCents;
  const mensajeEsperado = [
    "Hola Sonoro, quiero pedir:",
    "",
    `1x ${PRODUCTO_1.nombre} (${PRODUCTO_1.sku}) — ${formatQ(PRODUCTO_1.precioCents)}`,
    `1x ${PRODUCTO_2.nombre} (${PRODUCTO_2.sku}) — ${formatQ(PRODUCTO_2.precioCents)}`,
    "",
    `Subtotal: ${formatQ(subtotalCents)}`,
    "Envío: gratis",
    `Total: ${formatQ(subtotalCents)}`,
    `Ref: ${REF_ESPERADO}`,
  ].join("\n");

  expect(mensaje).toBe(mensajeEsperado);
});
