// El chat «Preguntar» (docs/superpowers/specs/2026-11-02-chatbot-design.md).
// Corre contra el build de producción con NEXT_PUBLIC_CHAT_ENABLED=true
// (playwright.config.ts): la bandera se lee al compilar, no al ejecutar.
//
// Los datos salen de data/catalog.json, como en flujo-critico.spec.ts: el
// catálogo cambia en cada importación, y lo que se prueba es la integración
// (¿el lanzador abre un panel que busca, agrega y responde?), no un producto.
import { readFileSync } from "node:fs";

import { test, expect, type Page } from "@playwright/test";

import { formatQ } from "../lib/format/precio.ts";

const CATALOGO = (
  JSON.parse(readFileSync("data/catalog.json", "utf-8")) as {
    sku: string;
    precioCents: number;
    disponibilidad: "disponible" | "bajo_pedido" | "agotado";
    activo: boolean;
  }[]
).filter((p) => p.activo);

// Solo los activos: el chat busca en el catálogo publicado (listAllProducts
// con activo: true), y un agotado descontinuado no está.
const DISPONIBLE = CATALOGO.find((p) => p.disponibilidad === "disponible");
const AGOTADO = CATALOGO.find((p) => p.disponibilidad === "agotado");

// El chat no depende de la portada, pero la portada pesa: el carrusel 3D se
// dibuja en software (sin GPU en el runner) y, con un worker por núcleo, el
// WebGL de seis páginas se queda con el procesador, y las fotos y los modelos
// (que el panel, al bajarse con import() en el primer clic, espera en la misma
// cola de conexiones) retrasan el trozo del panel más de lo que dura un
// expect. Acá no hay WebGL (el mismo recurso que el test «sin WebGL» de
// menu-y-carrusel.spec.ts), ni imágenes optimizadas, ni modelos.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      tipo: string,
      ...resto: unknown[]
    ) {
      if (/webgl/i.test(tipo)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto);
    } as typeof original;
  });
  await page.route(/\/_next\/image|\/models\/|\/draco\//, (ruta) => ruta.abort());
});

async function abrirChat(page: Page) {
  await page.goto("/");
  const lanzador = page.getByRole("button", { name: "Preguntar" });
  // El lanzador viene en el HTML del servidor antes de hidratar, y un clic
  // anterior a la hidratación se pierde sin error (el handler aún no existe).
  // React deja sus props en el nodo cuando lo adopta.
  await lanzador.evaluate(
    (el) =>
      new Promise<void>((listo) => {
        const hidratado = () => Object.keys(el).some((k) => k.startsWith("__reactProps"));
        const espera = () => (hidratado() ? listo() : setTimeout(espera, 50));
        espera();
      }),
  );
  await lanzador.click();
  const panel = page.getByRole("dialog", { name: "Preguntas" });
  await expect(panel).toBeVisible();
  // Al abrir, el foco va al campo (PanelChat.tsx). Esperarlo también deja
  // pasar los efectos del montaje, que es donde se registra el Esc.
  await expect(page.getByLabel("Tu pregunta")).toBeFocused();
  return panel;
}

async function preguntar(page: Page, texto: string) {
  const campo = page.getByLabel("Tu pregunta");
  await campo.fill(texto);
  await campo.press("Enter");
}

test("busca por código y agrega al carrito", async ({ page }) => {
  if (!DISPONIBLE) throw new Error("data/catalog.json no trae productos disponibles y activos");
  const panel = await abrirChat(page);

  await preguntar(page, DISPONIBLE.sku);
  await expect(panel.getByText(formatQ(DISPONIBLE.precioCents), { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "Agregar al carrito" }).click();
  // En la región «Conversación», no en el panel: la región en vivo (sr-only)
  // repite el mismo texto para los lectores de pantalla.
  await expect(
    panel.getByRole("region", { name: "Conversación" }).getByText("Has añadido 1 ítem al carrito."),
  ).toBeVisible();
  // El contador del nav: «Carrito» + el número (SiteHeader.tsx → CartLink).
  await expect(page.getByRole("banner").getByRole("link", { name: /^Carrito\s*1$/ })).toBeVisible();
});

// Q 500.00 escrito a mano a propósito (CLAUDE.md § Modelo de conversión):
// si cambia el mínimo, este test avisa que el texto del chat hay que revisarlo.
test("«Envíos» nombra el mínimo", async ({ page }) => {
  const panel = await abrirChat(page);

  await panel.getByRole("button", { name: "Envíos" }).click();
  await expect(panel.getByText(formatQ(50000)).first()).toBeVisible();
});

test("un producto agotado no se puede agregar", async ({ page }) => {
  test.skip(!AGOTADO, "data/catalog.json no trae productos agotados y activos");
  const panel = await abrirChat(page);

  await preguntar(page, AGOTADO!.sku);
  await expect(panel.getByRole("button", { name: "Agotado" })).toBeDisabled();
});

test("no hay lanzador en /carrito", async ({ page }) => {
  await page.goto("/carrito");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preguntar" })).toHaveCount(0);
});

test("Esc cierra el panel y devuelve el foco al lanzador", async ({ page }) => {
  const panel = await abrirChat(page);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Preguntar" })).toBeFocused();
});

test("en móvil el panel es modal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const panel = await abrirChat(page);

  await expect(panel).toHaveAttribute("aria-modal", "true");
});
