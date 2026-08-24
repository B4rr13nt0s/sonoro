// Logo para las imágenes OG (ImageResponse/satori no puede usar los SVG de
// public/logos/ directamente como <img> — se lee el PNG del filesystem una
// vez, a nivel de módulo, y se pasa como data: URI. Ver "Predictable
// values" en los docs de Next.js: el archivo no depende de datos de la
// petición, así que se lee una sola vez y se reutiliza en cada render.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const logoLockupBlanco = await readFile(
  join(process.cwd(), "public/logos/sonoro-lockup-blanco.png"),
);

export const LOGO_LOCKUP_BLANCO_DATA_URI = `data:image/png;base64,${logoLockupBlanco.toString("base64")}`;
