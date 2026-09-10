import type { Metadata } from "next";
import { Bakbak_One, JetBrains_Mono } from "next/font/google";

import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AvisoComparadorProvider } from "@/components/comparador/avisoComparador.ts";
import { BarraComparador } from "@/components/comparador/BarraComparador";
import { CartProvider } from "@/lib/cart/index.ts";
import type { CatalogoSku } from "@/lib/cart/index.ts";
import { listAllProducts } from "@/lib/catalog/index.ts";
import { ComparadorProvider } from "@/lib/comparador/index.ts";
import type { CatalogoComparable } from "@/lib/comparador/index.ts";
import { SITE_URL } from "@/lib/seo/site.ts";
// Solo por su efecto de validación al importarse (ver lib/whatsapp/config.ts):
// falla el build en Production si NEXT_PUBLIC_WHATSAPP_NUMBER no está
// definida, en vez de dejar pasar un botón "Pedir por WhatsApp" roto.
import "@/lib/whatsapp/config.ts";

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
  // UN SOLO arreglo para los dos providers. React Flight deduplica por
  // identidad de referencia, así que el segundo consumidor cuesta un puntero
  // en vez de repetir ~19 KB en el payload de cada página. Ojo: pasarle a uno
  // de los dos un `.map()` propio "para limpiar los tipos" rompe esa
  // deduplicación sin que nada avise.
  //
  // `satisfies` y no `: CatalogoSku[]` — la anotación borraría `categoria`
  // del tipo y ComparadorProvider dejaría de compilar; con satisfies se
  // conserva la comprobación de que la proyección cubre lo que necesita cada
  // reconcile().
  const catalogo = productos.map((p) => ({
    sku: p.sku,
    activo: p.activo,
    disponibilidad: p.disponibilidad,
    precioCents: p.precioCents,
    categoria: p.categoria,
  })) satisfies (CatalogoSku & CatalogoComparable)[];

  return (
    <html
      lang="es"
      className={`${bakbakOne.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <GoogleAnalytics />
        <CartProvider catalogo={catalogo}>
          <ComparadorProvider catalogo={catalogo}>
            <AvisoComparadorProvider>
              <SiteHeader />
              <main className="flex flex-1 flex-col">{children}</main>
              <SiteFooter />
              {/* La barra es `fixed` y taparía la última fila de la rejilla
                  y la paginación; el hueco lo reserva ella misma con un
                  espaciador, para que el layout no dependa de estado de
                  cliente cuando no hay nada seleccionado. */}
              <BarraComparador />
            </AvisoComparadorProvider>
          </ComparadorProvider>
        </CartProvider>
      </body>
    </html>
  );
}
