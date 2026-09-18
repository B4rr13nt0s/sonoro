// Recorte con rejilla de una zona de la foto, en coordenadas del lienzo de
// 1000 de ancho: node zona.cjs <archivo> <x0> <y0> <x1> <y1> <salida>
import sharp from "sharp";
import path from "node:path";

const ORIGEN = "public/fotos_pagina_de_inicio";
const [archivo, sx0, sy0, sx1, sy1, salida] = process.argv.slice(2);
const x0 = +sx0,
  y0 = +sy0,
  x1 = +sx1,
  y1 = +sy1;
const W = 1000;
const ESCALA = 900 / (x1 - x0);

(async () => {
  const buf = await sharp(path.join(ORIGEN, archivo))
    .flatten({ background: "#ffffff" })
    .resize(W)
    .png()
    .toBuffer();
  const recorte = await sharp(buf)
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .resize(Math.round((x1 - x0) * ESCALA))
    .toBuffer();
  const { width: RW, height: RH } = await sharp(recorte).metadata();

  let lineas = "";
  for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
    const px = (x - x0) * ESCALA;
    const fuerte = x % 50 === 0;
    lineas += `<line x1="${px}" y1="0" x2="${px}" y2="${RH}" stroke="#00A" stroke-width="${fuerte ? 1.4 : 0.6}" opacity="${fuerte ? 0.9 : 0.45}"/>`;
    if (fuerte)
      lineas += `<text x="${px + 2}" y="14" font-size="13" fill="#00A" font-family="monospace">${x}</text>`;
  }
  for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) {
    const py = (y - y0) * ESCALA;
    const fuerte = y % 50 === 0;
    lineas += `<line x1="0" y1="${py}" x2="${RW}" y2="${py}" stroke="#00A" stroke-width="${fuerte ? 1.4 : 0.6}" opacity="${fuerte ? 0.9 : 0.45}"/>`;
    if (fuerte)
      lineas += `<text x="2" y="${py - 3}" font-size="13" fill="#00A" font-family="monospace">${y}</text>`;
  }

  await sharp(recorte)
    .composite([
      { input: Buffer.from(`<svg width="${RW}" height="${RH}">${lineas}</svg>`), top: 0, left: 0 },
    ])
    .png()
    .toFile(salida);
  console.log(archivo, `${x0},${y0} → ${x1},${y1}`);
})();
