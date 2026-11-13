// Cada modelo del carrusel visto por donde la pose de reposo no lo muestra:
// desde atrás, desde arriba y desde lo más abajo que deja la órbita (10° bajo
// el horizonte, POLAR_MAX). El cliente puede orbitar, así que un defecto en la
// espalda o en el canto inferior también se ve.
//
//   node --no-warnings scripts/carrusel/vistas.mjs "Claude outputs/<carpeta>"
//
// Usa el carrusel real (el build de producción en http://localhost:3100) y los
// mismos gestos que un visitante: rueda para acercar y arrastre para orbitar.
// La captura se toma CON EL BOTÓN APRETADO: al soltar, la cámara vuelve sola a
// la vista predeterminada. Escribe una hoja de cuatro vistas por modelo.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import sharp from "sharp";

import { MODEL_IDS } from "../../lib/models3d.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SALIDA = path.resolve(RAIZ, process.argv[2] ?? "Claude outputs/vistas");
const URL_BASE = (process.argv[3] ?? "http://localhost:3100").replace(/\/$/, "");
const CAJA = "div.touch-pan-y";
// Cuarto argumento, opcional: solo estos modelos (`speaker,amplifier`).
const SOLO = process.argv[4]?.split(",") ?? MODEL_IDS;

// Una vuelta completa por alto de cuadro (useRotateGesture): con 470 px de
// alto, 235 px de arrastre horizontal son media vuelta. El arrastre vertical
// inclina: hacia abajo se mira desde más arriba. La toma «abajo» arrastra de
// más a propósito: se queda en el tope, y así también comprueba que existe.
const VISTAS = [
  { nombre: "reposo", dx: 0, dy: 0 },
  { nombre: "atras", dx: -245, dy: 0 },
  { nombre: "arriba", dx: 0, dy: 80 },
  { nombre: "abajo", dx: -245, dy: -120 },
];
const MUESCAS = 34;

async function quieto(page) {
  let previa = null;
  for (let i = 0; i < 30; i++) {
    const png = await page.locator(CAJA).screenshot();
    if (previa && png.equals(previa)) return png;
    previa = png;
    await page.waitForTimeout(250);
  }
  return previa;
}

await mkdir(SALIDA, { recursive: true });
const navegador = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const contexto = await navegador.newContext({
  viewport: { width: 1280, height: 1100 },
  reducedMotion: "reduce",
});
const page = await contexto.newPage();
await page.goto(`${URL_BASE}/`);
await page.locator(`${CAJA}.cursor-grab`).waitFor({ timeout: 60_000 });
await page.locator(CAJA).scrollIntoViewIfNeeded();

for (let i = 0; i < MODEL_IDS.length; i++) {
  const id = MODEL_IDS[i];
  if (!SOLO.includes(id)) {
    await page.getByRole("button", { name: "Categoría siguiente" }).click();
    await page.waitForTimeout(400);
    continue;
  }
  await quieto(page);
  const tomas = [];
  for (const vista of VISTAS) {
    const caja = await page.locator(CAJA).boundingBox();
    const cx = caja.x + caja.width / 2;
    const cy = caja.y + caja.height / 2;
    await page.mouse.move(cx, cy);
    for (let k = 0; k < MUESCAS; k++) await page.mouse.wheel(0, -100);
    await page.waitForTimeout(500);
    await page.mouse.down();
    // Los primeros 10 px solo deciden que es un arrastre; se suman al recorrido.
    await page.mouse.move(cx + 12, cy, { steps: 3 });
    await page.mouse.move(cx + 12 + vista.dx, cy + vista.dy, { steps: 16 });
    tomas.push(await quieto(page));
    await page.mouse.up();
    // 2 s de espera y ~0.8 s de vuelta a la vista predeterminada.
    await page.waitForTimeout(3400);
  }

  const [ancho, alto] = [760, 302];
  const piezas = await Promise.all(
    tomas.map(async (png, n) => ({
      input: await sharp(png).resize(ancho, alto).png().toBuffer(),
      left: (n % 2) * (ancho + 6),
      top: Math.floor(n / 2) * (alto + 6),
    })),
  );
  await sharp({
    create: { width: 2 * ancho + 6, height: 2 * alto + 6, channels: 3, background: "#ffffff" },
  })
    .composite(piezas)
    .png()
    .toFile(path.join(SALIDA, `${i + 1}-${id}.png`));
  console.log(`${id}: ${VISTAS.map((v) => v.nombre).join(", ")}`);

  if (i < MODEL_IDS.length - 1) {
    await page.getByRole("button", { name: "Categoría siguiente" }).click();
    await page.waitForTimeout(900);
  }
}
await navegador.close();
