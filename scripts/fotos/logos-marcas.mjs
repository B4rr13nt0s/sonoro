// Prepara los logos de las marcas para la web: recorta el margen transparente
// o blanco que traen los originales (el de JBL es de 3840×2160 con el logo en
// un rincón) y los reduce. Los originales viven en assets/logos_marcas/ —
// fuera de public/, no se sirven nunca— con el nombre que les dio cada marca;
// el destino se nombra por slug: public/logos/marcas/<slug>.webp.
//
// Imprime las medidas finales: van a lib/catalog/marcas.ts (LOGOS), porque
// next/image las necesita para reservar el espacio sin mover la página.
import sharp from "sharp";
import fs from "node:fs";

const ORIGEN = "assets/logos_marcas";
const DESTINO = "public/logos/marcas";
const ANCHO_MAX = 960;

// slug de la marca → archivo original.
const ARCHIVOS = {
  memphis: "memphis-logo.png",
  "rockford-fosgate": "rockford-fosgate-logo.png",
  "cerwin-vega": "cerwin-vega-logo.png",
  pioneer: "pioneer_logo.png",
  kbt: "kbt-electronics-logo.png",
  focal: "focal-logo.png",
  jbl: "jbl-logo.png",
  soundskins: "soundskins-logo.png",
};

fs.mkdirSync(DESTINO, { recursive: true });
for (const [slug, archivo] of Object.entries(ARCHIVOS)) {
  // Fondo blanco antes de recortar: el logo de JBL trae un lienzo opaco, y el
  // resto transparencia; `trim` mira el color de la esquina.
  const recortado = await sharp(`${ORIGEN}/${archivo}`)
    .trim({ threshold: 10 })
    .resize({ width: ANCHO_MAX, withoutEnlargement: true })
    .toBuffer();
  const info = await sharp(recortado).webp({ quality: 88 }).toFile(`${DESTINO}/${slug}.webp`);
  console.log(`${slug}: ${info.width}x${info.height} (${Math.round(info.size / 1024)} KB)`);
}
