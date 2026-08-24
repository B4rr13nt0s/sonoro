// Tipografía real para las imágenes OG, en vez de la fuente por defecto de
// satori (Noto Sans). En una tarjeta de 1200×630 con solo fondo, logo,
// nombre y precio, la tipografía es la mayor parte del diseño.
//
// JetBrains Mono ya es parte del sistema visual (CLAUDE.md § Sistema
// visual, cargada vía next/font/google en app/layout.tsx) — se usa para
// precio, marca y etiquetas. Inter no es Helvetica Neue, pero de las
// alternativas de licencia abierta es la que tiene proporciones más
// cercanas y más precedente en ImageResponse/satori — se usa para el
// nombre del producto. Ambas SIL OFL (ver assets/fonts/OFL-*.txt).
//
// ttf, no woff2: satori no soporta woff2 (el formato que sirve next/font a
// los navegadores).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const [jetbrainsMonoRegular, jetbrainsMonoMedium, interSemiBold] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/JetBrainsMono-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/JetBrainsMono-Medium.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Inter-SemiBold.ttf")),
]);

export const OG_FONTS = [
  {
    name: "JetBrains Mono",
    data: jetbrainsMonoRegular,
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "JetBrains Mono",
    data: jetbrainsMonoMedium,
    weight: 500 as const,
    style: "normal" as const,
  },
  { name: "Inter", data: interSemiBold, weight: 600 as const, style: "normal" as const },
];
