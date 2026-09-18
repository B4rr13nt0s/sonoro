// Dibuja la foto con una rejilla de coordenadas encima, para poder trazar a
// mano el contorno del producto. Las coordenadas son sobre un lienzo de
// 1000 de ancho (la altura sale de la proporción de cada foto).
import sharp from "sharp";
import path from "node:path";

const ORIGEN = "assets/fotos_pagina_de_inicio";
const [archivo, salida] = process.argv.slice(2);
const W = 1000;

(async () => {
  const base = sharp(path.join(ORIGEN, archivo)).flatten({ background: "#ffffff" }).resize(W);
  const buf = await base.png().toBuffer();
  const { height: H } = await sharp(buf).metadata();

  let lineas = "";
  for (let x = 0; x <= W; x += 50) {
    const fuerte = x % 100 === 0;
    lineas += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${fuerte ? "#00A" : "#0AA"}" stroke-width="${fuerte ? 1.4 : 0.7}" opacity="0.8"/>`;
    if (fuerte)
      lineas += `<text x="${x + 3}" y="14" font-size="14" fill="#00A" font-family="monospace">${x}</text>`;
  }
  for (let y = 0; y <= H; y += 50) {
    const fuerte = y % 100 === 0;
    lineas += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${fuerte ? "#00A" : "#0AA"}" stroke-width="${fuerte ? 1.4 : 0.7}" opacity="0.8"/>`;
    if (fuerte)
      lineas += `<text x="3" y="${y - 4}" font-size="14" fill="#00A" font-family="monospace">${y}</text>`;
  }

  await sharp(buf)
    .composite([
      { input: Buffer.from(`<svg width="${W}" height="${H}">${lineas}</svg>`), top: 0, left: 0 },
    ])
    .png()
    .toFile(salida);
  console.log(archivo, `${W}x${H}`);
})();
