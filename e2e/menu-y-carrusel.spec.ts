// Lo que cambió en septiembre de 2026 y solo se había verificado a mano:
// el menú móvil (Escape, foco contenido, sin scroll de fondo) y el gating de
// los gestos del carrusel por canvas vivo. Corren contra el build de
// producción, como el resto de e2e/.
import { test, expect, type Page } from "@playwright/test";

test.describe("menú móvil", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  const abrir = async (page: Page) => {
    await page.goto("/nosotros");
    const boton = page.getByRole("button", { name: "Abrir menú" });
    await boton.click();
    await expect(page.locator("#menu-movil")).toBeVisible();
    return page.getByRole("button", { name: "Cerrar menú" });
  };

  test("abre con el foco adentro, bloquea el scroll y Escape lo cierra devolviendo el foco", async ({
    page,
  }) => {
    const cerrar = await abrir(page);
    await expect(cerrar).toHaveAttribute("aria-controls", "menu-movil");
    await expect(page.locator("#menu-movil a").first()).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator("#menu-movil")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("Tab no sale del encabezado: del último enlace da la vuelta al primero", async ({
    page,
  }) => {
    await abrir(page);
    const enlaces = page.locator("#menu-movil a");
    await enlaces.last().focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Inicio" }).first()).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(enlaces.last()).toBeFocused();
  });

  test("si la ventana pasa a escritorio con el menú abierto, se cierra y libera el scroll", async ({
    page,
  }) => {
    await abrir(page);
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(page.locator("#menu-movil")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
});

test.describe("carrusel 3D: gestos solo con canvas vivo", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // Eventos sintéticos y cancelables: lo que importa es si la página los deja
  // pasar (defaultPrevented false) o se los queda.
  const probar = (page: Page) =>
    page.evaluate(() => {
      // El contenedor del carrusel es el único con `touch-pan-y`; el primer
      // enlace de categoría de la página sería el del nav.
      const tarjeta = document.querySelector("div.touch-pan-y");
      const enlace = tarjeta?.querySelector<HTMLElement>("a[href^='/catalogo/']");
      if (!tarjeta || !enlace) throw new Error("no se encontró la tarjeta del carrusel");
      const lanzar = (el: Element, evento: Event) => {
        el.dispatchEvent(evento);
        return evento.defaultPrevented;
      };
      return {
        rueda: lanzar(
          tarjeta,
          new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }),
        ),
        menuDelEnlace: lanzar(
          enlace,
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }),
        ),
        agarrable: tarjeta.className.includes("cursor-grab"),
      };
    });

  test("sin WebGL la rueda scrollea la página y el cuadro no se ofrece como agarrable", async ({
    page,
  }) => {
    // Sin contexto WebGL r3f lanza al crear el canvas y SinCanvasSiFalla deja
    // el cuadro sin modelo.
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
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Bocinas" }).first()).toBeVisible();
    // Margen para que el canvas diferido (requestIdleCallback, hasta 2 s) intente montarse.
    await page.waitForTimeout(3500);

    const resultado = await probar(page);
    expect(resultado.rueda).toBe(false);
    expect(resultado.agarrable).toBe(false);
    expect(resultado.menuDelEnlace).toBe(false);
  });

  test("con WebGL se arman los gestos, pero el enlace de la categoría conserva su menú", async ({
    page,
  }) => {
    await page.goto("/");
    // canvasVivo llega con onCreated; el cursor «agarrable» es su señal visible.
    await expect(page.locator("div.touch-pan-y.cursor-grab")).toBeVisible({ timeout: 20_000 });

    const resultado = await probar(page);
    expect(resultado.rueda).toBe(true);
    expect(resultado.agarrable).toBe(true);
    expect(resultado.menuDelEnlace).toBe(false);
  });
});
