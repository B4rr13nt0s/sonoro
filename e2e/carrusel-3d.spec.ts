import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { MODEL_IDS, posterUrl } from "../lib/models3d.ts";

// Carrusel 3D de la portada: lo que se ve, no solo lo que hay en el DOM. El
// modelo vive en un <canvas>, así que estas pruebas MIRAN PÍXELES: sacan una
// franja del cuadro y miden cuánto de ella no es fondo y dónde cae.
//
// La ventana es alta a propósito (1200 px): el cuadro entra entero y el
// lanzador del chat, que es fijo en la esquina de la ventana, queda por debajo
// de la franja. Con 900 px caía adentro y se contaba como modelo.

const CAJA = "div.touch-pan-y";
/** Fondo del cuadro (`bg-fondo-alt`, #F5F5F3): el canvas es transparente. */
const FONDO = [245, 245, 243];
/** Fracción de la franja que tiene que dejar de ser fondo para decir «hay modelo». */
const HAY_MODELO = 0.003;
/** Lo más que se aparta del centro, en px, un modelo ya en su lugar. */
const CENTRADO_PX = 40;

/** Cuánto de una imagen no es fondo y cuánto se aparta eso de su centro, en px de la imagen. */
async function medir(imagen: ReturnType<typeof sharp>, tolerancia = 12) {
  const { data, info } = await imagen.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let distintos = 0;
  let sumaX = 0;
  for (let i = 0; i < data.length; i += 3) {
    const d = Math.max(
      Math.abs(data[i] - FONDO[0]),
      Math.abs(data[i + 1] - FONDO[1]),
      Math.abs(data[i + 2] - FONDO[2]),
    );
    if (d > tolerancia) {
      distintos++;
      sumaX += (i / 3) % info.width;
    }
  }
  return {
    fraccion: distintos / (info.width * info.height),
    /** Positivo: el modelo está a la derecha del centro. */
    desvio: distintos ? sumaX / distintos - info.width / 2 : 0,
  };
}

/** La franja central del cuadro, en px de la ventana: ahí no hay chrome. */
async function franjaDelCuadro(page: Page) {
  const caja = await page.locator(CAJA).boundingBox();
  if (!caja) throw new Error("no se encontró el cuadro del carrusel");
  return {
    x: Math.round(caja.x),
    y: Math.round(caja.y + caja.height * 0.35),
    width: Math.round(caja.width),
    height: Math.round(caja.height * 0.3),
  };
}

/** Cuánto de la franja central del cuadro ocupa el modelo y cuánto se aparta del centro. */
async function modeloEnCuadro(page: Page) {
  const png = await page.screenshot({ clip: await franjaDelCuadro(page), scale: "css" });
  return { ...(await medir(sharp(png))), png };
}

/** Sigue al modelo desde que asoma hasta que queda quieto en su lugar; devuelve sus desvíos. */
async function seguirHastaCentrado(page: Page, topeMs = 40_000): Promise<number[]> {
  const desvios: number[] = [];
  const limite = Date.now() + topeMs;
  let centrados = 0;
  while (Date.now() < limite && centrados < 3) {
    const muestra = await modeloEnCuadro(page);
    if (muestra.fraccion > HAY_MODELO) {
      desvios.push(muestra.desvio);
      centrados = Math.abs(muestra.desvio) < CENTRADO_PX ? centrados + 1 : 0;
    }
  }
  return desvios;
}

// El canvas se dibuja por software en estas pruebas (sin GPU) y el modelo se
// sigue cuadro a cuadro: los 30 s por defecto no alcanzan.
//
// Y van de a una (`serial`), no en paralelo entre sí: tres canvas por software
// a la vez dejaban sin procesador a las pruebas del chat, que corren al lado
// (playwright.config.ts explica el mismo problema con el tope de workers).
test.describe.configure({ timeout: 120_000, mode: "serial" });

const canvasVivo = (page: Page) =>
  expect(page.locator(`${CAJA}.cursor-grab`)).toBeVisible({ timeout: 30_000 });

test.describe("carrusel 3D: lo que se ve", () => {
  test.use({ viewport: { width: 1280, height: 1200 } });

  test("el primer producto entra deslizándose desde la derecha y queda centrado", async ({
    page,
  }) => {
    // La entrada dura 0.9 s y una captura suelta tarda casi lo mismo en estas
    // pruebas: con capturas se la veía una vez o ninguna. Se graban los
    // cuadros que el navegador va componiendo y se miden después.
    const cdp = await page.context().newCDPSession(page);
    const cuadros: Buffer[] = [];
    cdp.on("Page.screencastFrame", (cuadro) => {
      cuadros.push(Buffer.from(cuadro.data, "base64"));
      cdp.send("Page.screencastFrameAck", { sessionId: cuadro.sessionId }).catch(() => {});
    });

    await page.goto("/");
    await canvasVivo(page);
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85 });
    const alFinal = await seguirHastaCentrado(page);
    await cdp.send("Page.stopScreencast");
    // Terminó en el centro…
    expect(Math.abs(alFinal.at(-1)!)).toBeLessThan(CENTRADO_PX);

    const franja = await franjaDelCuadro(page);
    const ventana = page.viewportSize()!;
    const desvios: number[] = [];
    for (const jpeg of cuadros) {
      // El cuadro grabado puede venir a otra escala que la ventana.
      const { width, height } = await sharp(jpeg).metadata();
      const kx = width / ventana.width;
      const ky = height / ventana.height;
      const recorte = sharp(jpeg).extract({
        left: Math.floor(franja.x * kx),
        top: Math.floor(franja.y * ky),
        width: Math.min(Math.floor(franja.width * kx), width - Math.floor(franja.x * kx)),
        height: Math.min(Math.floor(franja.height * ky), height - Math.floor(franja.y * ky)),
      });
      // Más tolerancia que en una captura: el JPEG ensucia el fondo liso.
      const muestra = await medir(recorte, 24);
      if (muestra.fraccion > HAY_MODELO) desvios.push(muestra.desvio / kx);
    }
    // …y se lo vio llegar: asomó por la derecha del cuadro, en más de un cuadro.
    expect(desvios[0]).toBeGreaterThan(80);
    expect(desvios.filter((d) => d > 80).length).toBeGreaterThan(1);
  });

  test("cambiar rápido de producto durante la entrada deja el pedido en su lugar", async ({
    page,
  }) => {
    await page.goto("/");
    await canvasVivo(page);

    // Dos cambios seguidos, sin esperar a que el primero termine de entrar.
    const siguiente = page.getByRole("button", { name: "Categoría siguiente" });
    await siguiente.click();
    await siguiente.click();
    await expect(page.getByText("3 / 9")).toBeVisible();
    await expect(page.locator(CAJA).getByRole("link", { name: "Amplificadores" })).toBeVisible();

    const desvios = await seguirHastaCentrado(page);
    expect(desvios.length).toBeGreaterThan(0);
    expect(Math.abs(desvios.at(-1)!)).toBeLessThan(CENTRADO_PX);
    // El canvas sigue vivo: el cambio a mitad de la entrada no lo tumbó.
    await expect(page.locator(`${CAJA}.cursor-grab`)).toBeVisible();
    await expect(page.locator(`${CAJA} img`)).toHaveCount(0);
  });
});

test.describe("carrusel 3D: con prefers-reduced-motion", () => {
  test.use({
    viewport: { width: 1280, height: 1200 },
    contextOptions: { reducedMotion: "reduce" },
  });

  test("el primer producto aparece en su lugar, no gira y no avanza solo", async ({ page }) => {
    await page.goto("/");
    await canvasVivo(page);

    // Desde la primera muestra en que se ve, ya está centrado: no hay entrada.
    const desvios = await seguirHastaCentrado(page);
    expect(desvios.length).toBeGreaterThan(0);
    for (const desvio of desvios) expect(Math.abs(desvio)).toBeLessThan(CENTRADO_PX);

    // Pasada la espera de 2 s tras la que empezaría a girar, el cuadro no cambia.
    await page.waitForTimeout(3500);
    const antes = await modeloEnCuadro(page);
    await page.waitForTimeout(1200);
    const despues = await modeloEnCuadro(page);
    expect(despues.png.equals(antes.png)).toBe(true);
    await expect(page.getByText("1 / 9")).toBeVisible();
  });
});

test.describe("carrusel 3D: sin WebGL", () => {
  test.use({ viewport: { width: 1280, height: 1200 } });

  test("el cuadro muestra la imagen estática de la categoría, y cambia con las flechas", async ({
    page,
  }) => {
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

    const imagen = page.locator(`${CAJA} img`);
    await expect(imagen).toHaveAttribute("src", posterUrl(MODEL_IDS[0]), { timeout: 30_000 });
    // Decorativa: la categoría ya está escrita en el enlace de al lado.
    await expect(imagen).toHaveAttribute("alt", "");
    await expect
      .poll(() => imagen.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    // Se ve de verdad: la franja del cuadro ya no es solo fondo, y está centrada.
    const muestra = await modeloEnCuadro(page);
    expect(muestra.fraccion).toBeGreaterThan(HAY_MODELO);
    expect(Math.abs(muestra.desvio)).toBeLessThan(CENTRADO_PX);

    await page.getByRole("button", { name: "Categoría siguiente" }).click();
    await expect(imagen).toHaveAttribute("src", posterUrl(MODEL_IDS[1]));
    await expect(page.locator(CAJA).getByRole("link", { name: "Subwoofers" })).toBeVisible();
  });
});
