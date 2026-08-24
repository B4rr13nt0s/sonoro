// Fallback de OG para toda ruta sin imagen propia (inicio, /marcas,
// /marcas/[marca], /catalogo/[categoria], /nosotros, /buscar) — Next.js
// resuelve opengraph-image por herencia de carpeta: la imagen más
// específica gana, esta es la de más arriba. Fondo de marca = identidad de
// Sonoro (CLAUDE.md § Sistema visual no permite color de acento), no un
// color por fabricante.
import { ImageResponse } from "next/og";

import { LOGO_LOCKUP_BLANCO_DATA_URI } from "@/lib/og/assets.ts";
import { OG_FONTS } from "@/lib/og/fonts.ts";

export const alt = "Sonoro — Equipo de audio para carro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_ASPECT = 680 / 2480;
const LOGO_WIDTH = 360;

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0b0b0c",
        padding: "80px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/satori
            no renderiza DOM real; next/image no funciona acá (patrón de los docs de Next.js). */}
      <img
        src={LOGO_LOCKUP_BLANCO_DATA_URI}
        width={LOGO_WIDTH}
        height={LOGO_WIDTH * LOGO_ASPECT}
        alt=""
      />
      <div
        style={{
          display: "flex",
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 54,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: "#ffffff",
          maxWidth: 820,
        }}
      >
        Equipo de audio para carro
      </div>
    </div>,
    { ...size, fonts: OG_FONTS },
  );
}
