// Convierte a WebP (q80) los .jpg de public/productos/ y borra el .jpg.
//
//   node scripts/fotos/jpg-a-webp.mjs [carpeta]      (por defecto public/productos)
//
// Se corrió una vez, en noviembre de 2026, para bajar el peso de cada deployment
// de Vercel (82 MB de fotos en jpg). Mismo tamaño en píxeles, mismo nombre
// (SKU_vista) con otra extensión. Después hay que correr `npm run import:catalog`
// para que catalog.json apunte a los .webp. Verifica que cada foto conserve sus
// dimensiones y no borra el .jpg si el .webp salió más pesado.
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const carpeta = path.resolve(process.argv[2] ?? "public/productos");
const archivos = (await readdir(carpeta)).filter((f) => /\.jpe?g$/i.test(f)).sort();

async function convertir(archivo) {
  const origen = path.join(carpeta, archivo);
  const bytes = await readFile(origen);
  const meta = await sharp(bytes).metadata();
  const buf = await sharp(bytes).webp({ quality: 80, effort: 6, smartSubsample: true }).toBuffer();
  const nueva = await sharp(buf).metadata();
  if (nueva.width !== meta.width || nueva.height !== meta.height) {
    throw new Error(`${archivo}: cambió de tamaño`);
  }
  if (buf.length >= bytes.length)
    return { archivo, antes: bytes.length, despues: bytes.length, omitida: true };
  await writeFile(path.join(carpeta, archivo.replace(/\.jpe?g$/i, ".webp")), buf);
  await unlink(origen);
  return { archivo, antes: bytes.length, despues: buf.length, omitida: false };
}

const res = [];
for (let i = 0; i < archivos.length; i += 4) {
  res.push(...(await Promise.all(archivos.slice(i, i + 4).map(convertir))));
}
const antes = res.reduce((s, r) => s + r.antes, 0);
const despues = res.reduce((s, r) => s + r.despues, 0);
const omitidas = res.filter((r) => r.omitida);
console.log(
  `${res.length - omitidas.length} convertidas, ${omitidas.length} se quedan en jpg (el webp pesaba más).`,
);
console.log(`${(antes / 1048576).toFixed(1)} MB → ${(despues / 1048576).toFixed(1)} MB`);
for (const o of omitidas) console.log("  se quedó:", o.archivo);
