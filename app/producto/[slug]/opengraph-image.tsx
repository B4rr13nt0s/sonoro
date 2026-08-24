// OG por producto — la razón de ser de esta fase: WhatsApp es el canal
// principal de difusión y sin esto cada enlace compartido se ve vacío,
// porque no hay una sola fotografía de producto todavía. Fondo de marca +
// nombre + precio + logo (docs/PLAN.md § Fase 7).
import { ImageResponse } from "next/og";

import { formatQ } from "@/lib/format/precio.ts";
import { getProduct } from "@/lib/catalog/index.ts";
import { LOGO_LOCKUP_BLANCO_DATA_URI } from "@/lib/og/assets.ts";
import { OG_FONTS } from "@/lib/og/fonts.ts";

export const alt = "Producto — Sonoro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_ASPECT = 680 / 2480;
const LOGO_WIDTH = 200;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const producto = await getProduct(slug);

  const nombre = producto?.nombre ?? "Sonoro";
  const marca = producto?.marca ?? "";
  const precio = producto ? formatQ(producto.precioCents) : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0b0b0c",
        padding: "72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#a1a1a6",
          }}
        >
          {marca}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/satori
              no renderiza DOM real; next/image no funciona acá (patrón de los docs de Next.js). */}
        <img
          src={LOGO_LOCKUP_BLANCO_DATA_URI}
          width={LOGO_WIDTH}
          height={LOGO_WIDTH * LOGO_ASPECT}
          alt=""
        />
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 56,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: "#ffffff",
          maxWidth: 980,
        }}
      >
        {nombre}
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: "JetBrains Mono",
          fontWeight: 500,
          fontSize: 48,
          color: "#ffffff",
        }}
      >
        {precio}
      </div>
    </div>,
    { ...size, fonts: OG_FONTS },
  );
}
