// Línea base del carrusel 3D del home: capturas y números, para comparar
// antes y después de cada cambio en los modelos o en el carrusel.
//
//   node --no-warnings scripts/carrusel/linea-base.mjs --salida "Claude outputs/modelos3d-2026-11-13/base"
//
// Mide sobre EL CARRUSEL REAL, no sobre un visor aparte: lo que se captura es
// el home servido por `next start`, con la iluminación, el encuadre y el
// chrome que ve el cliente. Espera el servidor ya levantado (por defecto en
// http://localhost:3100, el del build de producción: `node scripts/lhci-serve.js`).
//
// Fases (todas por defecto; `--fases capturas,pesos` corre solo esas):
//
//   pesos     bytes crudos, gzip y brotli de cada .glb y del decoder de Draco;
//             primitivas (draw calls) y materiales leídos del JSON del GLB.
//   capturas  los nueve modelos en reposo, en móvil (390×844, DPR 3) y en
//             escritorio (1280×900), más un acercamiento en escritorio.
//             Con `prefers-reduced-motion` para que el modelo no gire ni avance.
//   carga     tiempo hasta el primer modelo visible y bytes transferidos, sin
//             freno y con freno (CPU 4× y red 4G lenta).
//   frames    tiempo por frame mientras el modelo gira, sin freno y con CPU 4×.
//
// «Primer modelo visible» se detecta SONDEANDO PÍXELES de una franja del
// cuadro, sin tocar el código del sitio: así antes y después se miden igual.
// Cada sondeo es una captura, de modo que el dato lleva ~0.1 s de error.
//
// El freno de CPU y de red es EMULACIÓN, no un teléfono: sirve para comparar
// dos corridas en la misma máquina, no para afirmar cuánto tarda en un móvil.

import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { chromium } from "@playwright/test";
import sharp from "sharp";

import { MODEL_IDS, MODELS } from "../../lib/models3d.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FASES = ["pesos", "capturas", "carga", "frames"];

const VISTAS = {
  movil: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  escritorio: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
};

// Red «4G lenta» de Lighthouse: 1.6 Mbps de bajada, 750 kbps de subida, 150 ms.
const RED_LENTA = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};
const FRENO_CPU = 4;

/** Fondo del cuadro (`bg-fondo-alt`, #F5F5F3): el canvas es transparente. */
const FONDO = [245, 245, 243];
/** Fracción de la franja que tiene que dejar de ser fondo para decir «hay modelo». */
const UMBRAL_VISIBLE = 0.003;

const CAJA = "div.touch-pan-y";

function argumentos() {
  const args = process.argv.slice(2);
  const valor = (nombre, defecto) => {
    const i = args.indexOf(`--${nombre}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : defecto;
  };
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    salida: path.resolve(RAIZ, valor("salida", `Claude outputs/modelos3d-${hoy}/base`)),
    url: valor("url", "http://localhost:3100").replace(/\/$/, ""),
    fases: valor("fases", FASES.join(",")).split(","),
    corridas: Number(valor("corridas", "3")),
  };
}

const mediana = (valores) => {
  const v = valores.filter((x) => x != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const percentil = (valores, p) => {
  const v = [...valores].sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))] : null;
};
const redondear = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

// ------------------------------------------------------------------ pesos ---

function leerJsonDeGlb(bytes) {
  if (bytes.toString("latin1", 0, 4) !== "glTF") throw new Error("no es un GLB");
  const largo = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + largo).toString("utf8"));
}

async function medirPesos() {
  const modelos = {};
  for (const id of MODEL_IDS) {
    const archivo = MODELS[id].archivo;
    const bytes = await readFile(path.join(RAIZ, "public", "models", archivo));
    const gltf = leerJsonDeGlb(bytes);
    const medidas = JSON.parse(
      await readFile(path.join(RAIZ, "scripts", "models3d_v3", "medidas", `${id}.json`), "utf8"),
    );
    const imagenes = (gltf.images ?? []).reduce(
      (suma, im) => suma + (gltf.bufferViews?.[im.bufferView]?.byteLength ?? 0),
      0,
    );
    modelos[id] = {
      archivo,
      bytes: bytes.length,
      gzip: gzipSync(bytes).length,
      brotli: brotliCompressSync(bytes).length,
      tris: medidas.archivo === archivo ? medidas.tris : null,
      primitivas: (gltf.meshes ?? []).reduce((n, m) => n + m.primitives.length, 0),
      materiales: (gltf.materials ?? []).length,
      transparentes: (gltf.materials ?? []).filter((m) => m.alphaMode === "BLEND").length,
      bytesDeImagen: imagenes,
      nodoConTransformacion: (gltf.nodes ?? []).some((n) =>
        ["translation", "rotation", "scale", "matrix"].some((k) => k in n),
      ),
    };
  }
  const draco = {};
  for (const archivo of ["draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
    const bytes = await readFile(path.join(RAIZ, "public", "draco", archivo));
    draco[archivo] = { bytes: bytes.length, brotli: brotliCompressSync(bytes).length };
  }
  const suma = (campo) => Object.values(modelos).reduce((n, m) => n + (m[campo] ?? 0), 0);
  return {
    modelos,
    draco,
    total: { bytes: suma("bytes"), gzip: suma("gzip"), brotli: suma("brotli"), tris: suma("tris") },
  };
}

// ------------------------------------------------------- sondeo del cuadro ---

/**
 * Franja central del cuadro, en píxeles CSS: ahí no hay chrome, que vive en
 * las esquinas. Recortada a lo que se ve en la ventana, y `null` si no queda
 * nada: mientras la página carga el cuadro todavía se mueve (las fuentes
 * cambian el alto del titular), así que se pide de nuevo en cada sondeo.
 */
async function franja(page) {
  const caja = await page.locator(CAJA).boundingBox();
  const ventana = page.viewportSize();
  if (!caja || !ventana) return null;
  const arriba = Math.max(0, Math.round(caja.y + caja.height * 0.35));
  const abajo = Math.min(ventana.height, Math.round(caja.y + caja.height * 0.65));
  // Solo el 70 % central del ancho: el lanzador del chat es fijo en la esquina
  // de la ventana y, con el cuadro a medio asomar, cae dentro de la franja.
  const izquierda = Math.max(0, Math.round(caja.x + caja.width * 0.15));
  const derecha = Math.min(ventana.width, Math.round(caja.x + caja.width * 0.85));
  if (abajo - arriba < 8 || derecha - izquierda < 8) return null;
  return { x: izquierda, y: arriba, width: derecha - izquierda, height: abajo - arriba };
}

/** Qué fracción de la franja no es fondo: 0 con el cuadro vacío. */
async function fraccionConModelo(page, clip) {
  if (!clip) return 0;
  const png = await page.screenshot({ clip, scale: "css" });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let distintos = 0;
  for (let i = 0; i < data.length; i += 3) {
    const d = Math.max(
      Math.abs(data[i] - FONDO[0]),
      Math.abs(data[i + 1] - FONDO[1]),
      Math.abs(data[i + 2] - FONDO[2]),
    );
    if (d > 12) distintos++;
  }
  return distintos / (info.width * info.height);
}

/** Espera a que el cuadro tenga modelo y deje de cambiar entre dos capturas. */
async function esperarQuieto(page, { tope = 15_000 } = {}) {
  const clip = await franja(page);
  const inicio = Date.now();
  let previa = null;
  while (Date.now() - inicio < tope) {
    const png = await page.screenshot({ clip, scale: "css" });
    if (previa && png.equals(previa) && (await fraccionConModelo(page, clip)) > UMBRAL_VISIBLE) {
      return true;
    }
    previa = png;
    await page.waitForTimeout(300);
  }
  return false;
}

function escucharConsola(page, bolsa) {
  page.on("console", (mensaje) => {
    if (!["warning", "error"].includes(mensaje.type())) return;
    const texto = mensaje.text().slice(0, 300);
    bolsa.set(texto, (bolsa.get(texto) ?? 0) + 1);
  });
  page.on("pageerror", (error) => {
    const texto = `pageerror: ${String(error).slice(0, 300)}`;
    bolsa.set(texto, (bolsa.get(texto) ?? 0) + 1);
  });
}

// --------------------------------------------------------------- capturas ---

async function capturar(navegador, url, salida, consola) {
  const carpeta = path.join(salida, "capturas");
  await mkdir(carpeta, { recursive: true });
  const avisos = [];

  for (const [nombre, vista] of Object.entries(VISTAS)) {
    const contexto = await navegador.newContext({ ...vista, reducedMotion: "reduce" });
    const page = await contexto.newPage();
    escucharConsola(page, consola);
    await page.goto(`${url}/`);
    await page.locator(`${CAJA}.cursor-grab`).waitFor({ timeout: 60_000 });

    for (let i = 0; i < MODEL_IDS.length; i++) {
      const id = MODEL_IDS[i];
      const base = `${nombre}-${i + 1}-${id}`;
      if (!(await esperarQuieto(page))) avisos.push(`${base}: el cuadro no quedó quieto`);
      await page.locator(CAJA).screenshot({ path: path.join(carpeta, `${base}.png`) });

      if (nombre === "escritorio") {
        // Acercamiento para juzgar materiales: 45 muescas de 1.5 % ≈ la mitad
        // de la distancia. Cambiar de producto repone la vista.
        const caja = await page.locator(CAJA).boundingBox();
        await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
        for (let k = 0; k < 45; k++) await page.mouse.wheel(0, -100);
        await page.waitForTimeout(700);
        if (!(await esperarQuieto(page))) avisos.push(`${base}-cerca: el cuadro no quedó quieto`);
        await page.locator(CAJA).screenshot({ path: path.join(carpeta, `${base}-cerca.png`) });
      }

      if (i < MODEL_IDS.length - 1) {
        await page.getByRole("button", { name: "Categoría siguiente" }).click();
        await page.waitForTimeout(800);
      }
    }
    await contexto.close();
  }
  return { carpeta: path.relative(RAIZ, carpeta), avisos };
}

// ------------------------------------------------------------------ carga ---

const CATEGORIAS = [
  ["glb", /\/models\/.*\.glb/],
  ["draco", /\/draco\//],
  ["js", /\.js(\?|$)/],
  ["css", /\.css(\?|$)/],
  ["fuentes", /\.(woff2?|ttf)(\?|$)/],
  ["imagenes", /\.(webp|png|jpe?g|svg|ico|avif)(\?|$)|\/_next\/image/],
];
const categoriaDe = (direccion) =>
  CATEGORIAS.find(([, patron]) => patron.test(direccion))?.[0] ?? "otros";

async function medirUnaCarga(navegador, url, vista, conFreno) {
  const contexto = await navegador.newContext(vista);
  const page = await contexto.newPage();
  const cdp = await contexto.newCDPSession(page);
  await cdp.send("Network.enable");
  if (conFreno) {
    await cdp.send("Network.emulateNetworkConditions", RED_LENTA);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: FRENO_CPU });
  }
  await page.addInitScript(() => {
    window.__carga = { lcp: null, cls: 0 };
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) window.__carga.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) if (!e.hadRecentInput) window.__carga.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });

  const pedidos = new Map();
  const terminados = [];
  cdp.on("Network.requestWillBeSent", (e) => pedidos.set(e.requestId, e.request.url));
  cdp.on("Network.loadingFinished", (e) => {
    terminados.push({
      url: pedidos.get(e.requestId) ?? "",
      bytes: e.encodedDataLength,
      t: Date.now(),
    });
  });

  const t0 = Date.now();
  await page.goto(`${url}/`, { waitUntil: "commit" });
  await page.locator(CAJA).waitFor({ timeout: 60_000 });

  let canvasVivo = null;
  let modeloVisible = null;
  while (Date.now() - t0 < 90_000) {
    if (canvasVivo == null && (await page.locator(`${CAJA}.cursor-grab`).count())) {
      canvasVivo = Date.now() - t0;
    }
    // Sin canvas no hay modelo: antes de eso, lo que no es fondo en la franja
    // es la página a medio armar (el titular, antes de que carguen las fuentes).
    if (canvasVivo != null) {
      const antes = Date.now();
      if ((await fraccionConModelo(page, await franja(page))) > UMBRAL_VISIBLE) {
        modeloVisible = antes - t0;
        break;
      }
    }
    await page.waitForTimeout(60);
  }
  const alVer = Date.now();
  // Margen para la precarga del resto de los modelos (requestIdleCallback, tope 3 s).
  await page.waitForTimeout(conFreno ? 12_000 : 6_000);

  const pintado = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
    lcp: window.__carga.lcp,
    cls: window.__carga.cls,
  }));
  await contexto.close();

  const sumar = (lista) => {
    const porCategoria = {};
    for (const p of lista) {
      const c = categoriaDe(p.url);
      porCategoria[c] = (porCategoria[c] ?? 0) + p.bytes;
    }
    porCategoria.total = lista.reduce((n, p) => n + p.bytes, 0);
    return porCategoria;
  };
  return {
    canvasVivoMs: canvasVivo,
    modeloVisibleMs: modeloVisible,
    fcpMs: pintado.fcp,
    lcpMs: pintado.lcp,
    cls: pintado.cls,
    bytesHastaModelo: sumar(terminados.filter((p) => p.t <= alVer)),
    bytesAlFinal: sumar(terminados),
    glbPedidos: terminados.filter((p) => categoriaDe(p.url) === "glb").length,
    jsMasPesados: terminados
      .filter((p) => categoriaDe(p.url) === "js")
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5)
      .map((p) => ({ archivo: p.url.split("/").pop().slice(0, 40), bytes: p.bytes, ms: p.t - t0 })),
  };
}

async function medirCarga(navegador, url, corridas) {
  const resultado = {};
  for (const [nombre, vista] of Object.entries(VISTAS)) {
    for (const conFreno of [false, true]) {
      const clave = `${nombre}${conFreno ? "-freno" : ""}`;
      const lista = [];
      for (let i = 0; i < corridas; i++)
        lista.push(await medirUnaCarga(navegador, url, vista, conFreno));
      const de = (campo) => redondear(mediana(lista.map((c) => c[campo])), 0);
      resultado[clave] = {
        corridas,
        canvasVivoMs: de("canvasVivoMs"),
        modeloVisibleMs: de("modeloVisibleMs"),
        modeloVisibleMsTodas: lista.map((c) => c.modeloVisibleMs),
        fcpMs: de("fcpMs"),
        lcpMs: de("lcpMs"),
        cls: redondear(mediana(lista.map((c) => c.cls)), 4),
        bytesHastaModelo: lista[0].bytesHastaModelo,
        bytesAlFinal: lista[0].bytesAlFinal,
        glbPedidos: lista[0].glbPedidos,
        jsMasPesados: lista[0].jsMasPesados,
      };
      console.log(`  carga ${clave}: modelo visible a ${resultado[clave].modeloVisibleMs} ms`);
    }
  }
  return resultado;
}

// ----------------------------------------------------------------- frames ---

async function medirFrames(navegador, url) {
  const resultado = {};
  for (const [nombre, vista] of Object.entries(VISTAS)) {
    for (const conFreno of [false, true]) {
      const contexto = await navegador.newContext(vista);
      const page = await contexto.newPage();
      const cdp = await contexto.newCDPSession(page);
      await page.goto(`${url}/`);
      await page.locator(`${CAJA}.cursor-grab`).waitFor({ timeout: 60_000 });
      const clip = await franja(page);
      const inicio = Date.now();
      while (
        Date.now() - inicio < 60_000 &&
        (await fraccionConModelo(page, clip)) <= UMBRAL_VISIBLE
      ) {
        await page.waitForTimeout(100);
      }
      if (conFreno) await cdp.send("Emulation.setCPUThrottlingRate", { rate: FRENO_CPU });
      // Entrada (0.9 s) y espera previa (2 s): a los 4 s el modelo ya gira.
      await page.waitForTimeout(4000);
      const deltas = await page.evaluate(
        () =>
          new Promise((resolver) => {
            const lista = [];
            let previo = performance.now();
            const fin = previo + 6000;
            const paso = (ahora) => {
              lista.push(ahora - previo);
              previo = ahora;
              if (ahora < fin) requestAnimationFrame(paso);
              else resolver(lista.slice(1));
            };
            requestAnimationFrame(paso);
          }),
      );
      await contexto.close();
      const clave = `${nombre}${conFreno ? "-cpu4x" : ""}`;
      resultado[clave] = {
        frames: deltas.length,
        medianaMs: redondear(mediana(deltas)),
        p95Ms: redondear(percentil(deltas, 95)),
        maxMs: redondear(Math.max(...deltas)),
        sobre20Ms: redondear((deltas.filter((d) => d > 20).length / deltas.length) * 100),
        sobre34Ms: redondear((deltas.filter((d) => d > 34).length / deltas.length) * 100),
      };
      console.log(
        `  frames ${clave}: mediana ${resultado[clave].medianaMs} ms, p95 ${resultado[clave].p95Ms} ms`,
      );
    }
  }
  return resultado;
}

// ------------------------------------------------------------------- main ---

async function main() {
  const { salida, url, fases, corridas } = argumentos();
  await mkdir(salida, { recursive: true });
  const informe = {
    fecha: new Date().toISOString(),
    commit: execSync("git rev-parse --short HEAD", { cwd: RAIZ }).toString().trim(),
    url,
    fases,
  };

  if (fases.includes("pesos")) {
    informe.pesos = await medirPesos();
    const t = informe.pesos.total;
    console.log(`pesos: ${t.bytes} bytes crudos, ${t.brotli} en brotli, ${t.tris} triángulos`);
  }

  if (fases.some((f) => f !== "pesos")) {
    // Chromium completo en modo sin ventana, con la GPU de la máquina: el
    // «headless shell» dibuja WebGL por software y ni los tiempos ni los
    // frames dirían nada. El renderer queda anotado en el informe.
    const navegador = await chromium.launch({
      channel: "chromium",
      args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
    });
    const sonda = await navegador.newPage();
    informe.navegador = {
      version: navegador.version(),
      webgl: await sonda.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "sin WebGL";
      }),
    };
    await sonda.close();
    console.log(`navegador: Chromium ${informe.navegador.version}, ${informe.navegador.webgl}`);

    const consola = new Map();
    if (fases.includes("capturas"))
      informe.capturas = await capturar(navegador, url, salida, consola);
    if (fases.includes("carga")) informe.carga = await medirCarga(navegador, url, corridas);
    if (fases.includes("frames")) informe.frames = await medirFrames(navegador, url);
    informe.consola = [...consola].map(([texto, veces]) => ({ veces, texto }));
    await navegador.close();
  }

  const destino = path.join(salida, "linea-base.json");
  // Una corrida parcial no borra lo que ya midió otra: se mezcla por fase.
  let previo = {};
  try {
    previo = JSON.parse(await readFile(destino, "utf8"));
  } catch {
    // primera corrida
  }
  await writeFile(destino, `${JSON.stringify({ ...previo, ...informe }, null, 2)}\n`);
  console.log(`escrito ${path.relative(RAIZ, destino)}`);
}

await main();
