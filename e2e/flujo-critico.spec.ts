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
// crear/tocar el carrito) Y del contenido del carrito (sku, qty y precio de
// cada línea) vía buildOrderRef (hash FNV-1a determinista,
// lib/whatsapp/ref.ts) — con el reloj congelado en FECHA_CONGELADA y las dos
// líneas de abajo (1x PRODUCTO_1, 1x PRODUCTO_2), el Ref es siempre el mismo.
// Si cambia la fecha, un producto, su precio o la cantidad, hay que
// recalcularlo con:
//   node --experimental-strip-types -e "import('./lib/whatsapp/ref.ts').then(m => console.log(m.buildOrderRef('2026-01-01T00:00:00.000Z', [{ sku: 'TS-W312D4', qty: 1, unitPriceCents: 80000 }, { sku: 'MVH-X700BT', qty: 1, unitPriceCents: 135000 }])))"
const FECHA_CONGELADA = new Date("2026-01-01T00:00:00.000Z");
const REF_ESPERADO = "SNR-4RH3A";

// Dos productos reales del catálogo (data/catalog.json), misma marca en
// categorías distintas — así "buscar + filtrar" tiene sentido: una búsqueda
// por marca trae resultados de Subwoofers y de Receptores.
//
// La marca es PIONEER y no Memphis a propósito. /buscar muestra los
// resultados de a ocho (INCREMENTO en SearchExperience.tsx) y los ordena por
// puntaje de texto y luego por relevancia, así que los dos productos tienen
// que caer en los primeros ocho o el test tendría que ir pulsando "Ver más".
// Con "memphis" son 110 resultados y el kit caía en el puesto 65; con
// "pioneer" son 15 y estos dos están en los puestos 3 y 4.
//
// Si el catálogo crece y esto vuelve a fallar, el arreglo es elegir una marca
// con pocos productos que abarque dos categorías, no subir el INCREMENTO.
const PRODUCTO_1 = {
  slug: "pioneer-ts-w312d4",
  nombre: 'Subwoofer Champion Series 12" TS-W312D4',
  sku: "TS-W312D4",
  categoria: "Subwoofers",
  precioCents: 80000,
};
const PRODUCTO_2 = {
  slug: "pioneer-mvh-x700bt",
  nombre: "Receptor digital MVH-X700BT",
  sku: "MVH-X700BT",
  categoria: "Receptores",
  precioCents: 135000,
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
  await page.getByLabel("Buscar en el catálogo").fill("pioneer");
  await page.getByLabel("Buscar en el catálogo").press("Enter");
  // Sin fijar el número: el conteo crece cada vez que se importa catálogo, y
  // lo que este paso comprueba es que la búsqueda corrió y trajo resultados
  // — que los dos productos estén visibles lo verifican las líneas de abajo.
  await expect(page.getByRole("heading", { name: /^\d+ resultados?$/ })).toBeVisible();

  const linkProducto1 = page.getByRole("link", { name: new RegExp(PRODUCTO_1.nombre) });
  const linkProducto2 = page.getByRole("link", { name: new RegExp(PRODUCTO_2.nombre) });
  await expect(linkProducto1).toBeVisible();
  await expect(linkProducto2).toBeVisible();

  // 2) Filtrar por categoría — Subwoofers deja ver solo el producto 1
  await page.getByRole("button", { name: new RegExp(`^${PRODUCTO_1.categoria}`) }).click();
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
  await page.getByLabel("Buscar en el catálogo").fill("pioneer");
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
