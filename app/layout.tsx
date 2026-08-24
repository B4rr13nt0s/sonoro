import type { Metadata } from "next";
import { Bakbak_One, JetBrains_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CartProvider } from "@/lib/cart/index.ts";
import type { CatalogoSku } from "@/lib/cart/index.ts";
import { listAllProducts } from "@/lib/catalog/index.ts";
import { SITE_URL } from "@/lib/seo/site.ts";

import "./globals.css";

const bakbakOne = Bakbak_One({
  variable: "--font-bakbak-one",
  weight: "400",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const DESCRIPCION_SITIO =
  "Bocinas, subwoofers, amplificadores, receptores, kits, insonorización y accesorios. Envíos a toda Guatemala.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: "Sonoro — Equipo de audio para carro",
  description: DESCRIPCION_SITIO,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sonoro — Equipo de audio para carro",
    description: DESCRIPCION_SITIO,
    url: "/",
    siteName: "Sonoro",
    locale: "es_GT",
    type: "website",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // CartProvider corre en el navegador y no puede leer el catálogo (el
  // adaptador de lib/catalog usa el filesystem) — este Server Component se
  // lo trae una vez, igual que /buscar hace con SearchExperience, y le pasa
  // solo lo que reconcile() necesita, no el Producto completo.
  const productos = await listAllProducts();
  const catalogo: CatalogoSku[] = productos.map((p) => ({
    sku: p.sku,
    activo: p.activo,
    disponibilidad: p.disponibilidad,
    precioCents: p.precioCents,
  }));

  return (
    <html
      lang="es"
      className={`${bakbakOne.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <CartProvider catalogo={catalogo}>
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
