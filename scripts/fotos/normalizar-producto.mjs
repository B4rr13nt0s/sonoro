// Lleva fotos de producto al formato del sitio (CLAUDE.md § Imágenes):
// 1600 × 1600 px, fondo blanco #FFFFFF, webp, producto centrado con su lado
// más largo al 80 % del cuadro (10 % de aire por lado).
//
//   node scripts/fotos/normalizar-producto.mjs <carpeta-de-entrada> [--salida assets/productos]
//
// Los nombres se conservan (SKU_vista.ext); todo sale como .webp. Qué hace con cada foto:
//  - Aplana la transparencia sobre blanco y recorta el blanco sobrante.
//  - Producto sobre blanco: lo escala a 1280 px por su lado más largo y lo centra.
//  - Foto a sangre (primeros planos y producto instalado: vistas `agua`,
//    `conectores`, `instalada`/`instalado`; cambiable con --sangre "<regex de la
//    vista>"): el producto está cortado por el borde o la foto es una escena, así
//    que no se recorta ni se le deja margen, o se vería cortado en el aire. Se
//    escala entera a 1600 px y, si no es cuadrada, se completa con blanco.
//    (No se detecta por el borde: una foto ajustada al producto también lo toca.)
// No toca los originales. Avisa de las fotos cuyo original es tan chico que hubo
// que agrandarlo más de 1.5 veces (se ven blandas).
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const LADO = 1600;
const PRODUCTO = 1280; // 80 %
const TOPE_BYTES = 300 * 1024;
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const args = process.argv.slice(2);
const iSalida = args.indexOf("--salida");
const salida = path.resolve(iSalida >= 0 ? args[iSalida + 1] : "assets/productos");
const iSangre = args.indexOf("--sangre");
const esSangre =
  iSangre >= 0 ? new RegExp(args[iSangre + 1]) : /^(agua|conectores|instalad[ao]\d*)$/;
const valores = new Set([iSalida, iSangre].filter((i) => i >= 0).map((i) => i + 1));
const entrada = args.find((a, i) => !a.startsWith("--") && !valores.has(i));
if (!entrada) {
  console.error(
    "Uso: node scripts/fotos/normalizar-producto.mjs <entrada> [--salida <carpeta>] [--sangre <regex>]",
  );
  process.exit(1);
}

// WebP q80: a un tercio del peso del jpg sin diferencia visible a 100 % (probado
// con la fibra de carbono de la Focal, el peor caso). Pesa menos en cada
// deployment de Vercel, donde public/productos/ viajaba completo (hoy las fotos viven en assets/productos/ y en Blob).
async function webp(lienzo) {
  for (const q of [80, 76, 72, 68, 64]) {
    const buf = await lienzo
      .clone()
      .webp({ quality: q, effort: 6, smartSubsample: true })
      .toBuffer();
    if (buf.length <= TOPE_BYTES || q === 64) return { buf, q };
  }
}

async function procesar(archivo) {
  const base = sharp(path.join(entrada, archivo)).rotate().flatten({ background: "#ffffff" });
  const original = await base.clone().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = original.info;

  let recortado;
  try {
    recortado = await sharp(original.data)
      .trim({ background: "#ffffff", threshold: 10 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    recortado = original; // todo blanco: no hay nada que recortar
  }
  const vista = path.basename(archivo, path.extname(archivo)).split("_").slice(1).join("_");
  const aSangre = esSangre.test(vista);
  const fuente = aSangre ? original : recortado;
  const caja = aSangre ? LADO : PRODUCTO;
  const escala = caja / Math.max(fuente.info.width, fuente.info.height);
  const rw = Math.max(1, Math.round(fuente.info.width * escala));
  const rh = Math.max(1, Math.round(fuente.info.height * escala));
  const pieza = await sharp(fuente.data).resize(rw, rh, { kernel: "lanczos3" }).toBuffer();

  const lienzo = sharp({
    create: { width: LADO, height: LADO, channels: 3, background: "#ffffff" },
  }).composite([
    { input: pieza, left: Math.round((LADO - rw) / 2), top: Math.round((LADO - rh) / 2) },
  ]);
  const { buf, q } = await webp(lienzo);
  const nombre = path.basename(archivo, path.extname(archivo)) + ".webp";
  await writeFile(path.join(salida, nombre), buf);
  return { archivo, nombre, aSangre, agrandado: escala, kb: Math.round(buf.length / 1024), q };
}

const archivos = (await readdir(entrada))
  .filter((f) => EXT.has(path.extname(f).toLowerCase()))
  .sort();
const nombres = archivos.map((f) => path.basename(f, path.extname(f)));
const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
if (repetidos.length) {
  console.error("Dos archivos darían el mismo .webp:", repetidos.join(", "));
  process.exit(1);
}
await mkdir(salida, { recursive: true });

const resultados = [];
for (let i = 0; i < archivos.length; i += 4) {
  resultados.push(...(await Promise.all(archivos.slice(i, i + 4).map(procesar))));
}

const sangre = resultados.filter((r) => r.aSangre);
const blandas = resultados.filter((r) => r.agrandado > 1.5);
const pesadas = resultados.filter((r) => r.kb * 1024 > TOPE_BYTES);
console.log(`${resultados.length} fotos → ${salida}`);
console.log(`A sangre (sin recorte ni margen): ${sangre.length}`);
for (const r of sangre) console.log(`  ${r.nombre}`);
console.log(`Agrandadas más de 1.5× (original chico): ${blandas.length}`);
for (const r of blandas) console.log(`  ${r.nombre}  ×${r.agrandado.toFixed(2)}`);
console.log(`Sobre 300 KB aun a calidad 70: ${pesadas.length}`);
for (const r of pesadas) console.log(`  ${r.nombre}  ${r.kb} KB`);
const total = resultados.reduce((s, r) => s + r.kb, 0);
console.log(
  `Total ${(total / 1024).toFixed(1)} MB, promedio ${Math.round(total / resultados.length)} KB`,
);
