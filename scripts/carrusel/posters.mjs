// Imagen estática de cada modelo del carrusel, para cuando no hay WebGL.
//
//   node --no-warnings scripts/carrusel/posters.mjs
//
// Si el canvas 3D no puede crearse o falla (sin WebGL, un .glb que no baja,
// el bloque de three que no llega), el cuadro muestra esta imagen en vez de
// quedar vacío (ProductCarousel3D.tsx). No es una foto de producto ni un
// render aparte: es EL MISMO carrusel, capturado en su pose de reposo, con el
// fondo transparente y sin el chrome. Así la imagen y el 3D coinciden en luz,
// ángulo y tamaño, y un cambio en el estudio o en un modelo se arrastra a la
// imagen con solo volver a correr esto.
//
// Espera el build de producción ya levantado en http://localhost:3100
// (`node scripts/lhci-serve.js`). Escribe public/models/posters/<archivo>.webp,
// con el nombre del .glb —versión incluida—, porque /models/* se sirve con
// caché `immutable`: regenerar un modelo cambia el nombre de los dos.
//
// HAY QUE VOLVER A CORRERLO cuando cambia un .glb, la iluminación del estudio
// (CarouselCanvas.tsx) o el encuadre. lib/models3d.test.ts falla si a un
// modelo le falta su imagen.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import sharp from "sharp";

import { MODEL_IDS, MODELS, POSTER_ALTO, POSTER_ANCHO } from "../../lib/models3d.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESTINO = path.join(RAIZ, "public", "models", "posters");
const URL_BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const CAJA = "div.touch-pan-y";

/**
 * La imagen es el recorte central del cuadro de escritorio (1184 × 470 px):
 * el mismo rectángulo para los nueve, así los tamaños relativos entre modelos
 * se conservan. El recorte por modelo los igualaría a todos.
 */
const FRACCION_ANCHO = POSTER_ANCHO / 1184;
const FRACCION_ALTO = POSTER_ALTO / 470;

async function esperarQuieto(page, clip) {
  let previa = null;
  for (let i = 0; i < 40; i++) {
    const png = await page.screenshot({ clip, omitBackground: true });
    if (previa && png.equals(previa)) {
      const { channels } = await sharp(png).stats();
      // Con el fondo transparente, el canal alfa solo sube donde hay modelo.
      if (channels[3].max > 200) return png;
    }
    previa = png;
    await page.waitForTimeout(300);
  }
  throw new Error("el cuadro no quedó quieto o no hay modelo");
}

await mkdir(DESTINO, { recursive: true });
const navegador = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const contexto = await navegador.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const page = await contexto.newPage();
await page.goto(`${URL_BASE}/`);
await page.locator(`${CAJA}.cursor-grab`).waitFor({ timeout: 60_000 });
// Solo queda el canvas: fuera los fondos de toda la página, el chrome del
// cuadro (todo lo que no es el canvas) y el lanzador del chat.
await page.addStyleTag({
  content: `
    html, body, body * { background: transparent !important; }
    ${CAJA} > :not(:first-child) { visibility: hidden !important; }
    body > :not(main):not(header):not(footer) { visibility: hidden !important; }
    header { visibility: hidden !important; }
  `,
});
await page.locator(CAJA).scrollIntoViewIfNeeded();

for (let i = 0; i < MODEL_IDS.length; i++) {
  const id = MODEL_IDS[i];
  const caja = await page.locator(CAJA).boundingBox();
  const ancho = caja.width * FRACCION_ANCHO;
  const alto = caja.height * FRACCION_ALTO;
  const clip = {
    x: caja.x + (caja.width - ancho) / 2,
    y: caja.y + (caja.height - alto) / 2,
    width: ancho,
    height: alto,
  };
  const png = await esperarQuieto(page, clip);
  const archivo = MODELS[id].archivo.replace(/\.glb$/, ".webp");
  const info = await sharp(png)
    .resize(POSTER_ANCHO, POSTER_ALTO)
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(path.join(DESTINO, archivo));
  console.log(`${archivo}: ${(info.size / 1024).toFixed(1)} KB`);

  if (i < MODEL_IDS.length - 1) {
    // El botón está oculto, no ausente: se pulsa por el DOM.
    await page
      .getByRole("button", { name: "Categoría siguiente", includeHidden: true })
      .evaluate((boton) => boton.click());
    await page.waitForTimeout(900);
  }
}
await navegador.close();
