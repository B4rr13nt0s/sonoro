import type { Metadata } from "next";
import { Bakbak_One, JetBrains_Mono } from "next/font/google";

import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CartProvider } from "@/lib/cart/index.ts";
import type { CatalogoSku } from "@/lib/cart/index.ts";
import { listAllProducts } from "@/lib/catalog/index.ts";
import { DESCRIPCION_SITIO, SUFIJO_TITULO, TITULO_SITIO } from "@/lib/seo/metadata.ts";
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

// Solo lo que TODA ruta puede heredar sin mentir. El canonical y el og:url
// no están acá a propósito: vivían en este layout apuntando a "/", y toda
// página que no declaraba el suyo —/comparar, la 404— heredaba un canonical
// a la portada. Cada página los pone con metadataPagina (lib/seo/metadata.ts).
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: TITULO_SITIO,
    template: `%s${SUFIJO_TITULO}`,
  },
  description: DESCRIPCION_SITIO,
  openGraph: {
    title: TITULO_SITIO,
    description: DESCRIPCION_SITIO,
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
  // Solo lo que necesita reconcile() del carrito, no el Producto completo.
  //
  // Llevaba también `categoria`, que era lo único que usaba
  // ComparadorProvider; salió junto con los accesos al comparador (ver abajo).
  // Si el comparador vuelve, hay que devolver ese campo y su tipo
  // CatalogoComparable, o el provider no compila.
  const catalogo = productos.map((p) => ({
    sku: p.sku,
    activo: p.activo,
    disponibilidad: p.disponibilidad,
    precioCents: p.precioCents,
  })) satisfies CatalogoSku[];

  return (
    <html
      lang="es"
      className={`${bakbakOne.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <GoogleAnalytics />
        {/* El comparador quedó SIN accesos a propósito, no borrado: la
            ruta /comparar sigue viva y funcionando, y un enlace ya compartido
            por WhatsApp se sigue abriendo. Lo que se quitó son las tres
            puertas de entrada — la barra flotante de acá, el botón «Comparar»
            de la tarjeta y el de la ficha — más la tarjeta del inicio. Para
            devolverlo: reponer ComparadorProvider + AvisoComparadorProvider
            alrededor de esto, <BarraComparador /> al final, y los
            <CompararToggle /> de components/catalog/ProductCard.tsx y
            app/producto/[slug]/page.tsx. Nada de components/comparador/ ni de
            lib/comparador/ se tocó. */}
        <CartProvider catalogo={catalogo}>
          {/* Saltar al contenido: invisible hasta que el teclado lo enfoca.
              El nav lleva ocho categorías más marcas, nosotros, buscar y
              carrito — sin esto, quien navega con teclado o lector de
              pantalla los recorre enteros en CADA página antes de llegar a
              lo que vino a leer. */}
          <a
            href="#contenido"
            // Está SIEMPRE en el DOM, colocado fuera de la pantalla, y baja
            // a la vista al enfocarse. Así el primer Tab de cada página cae
            // en él: verificado con un navegador de verdad (142 × 46 px a
            // 12 px del borde).
            //
            // Ojo al probar esto: `:focus` solo coincide cuando la VENTANA
            // tiene el foco, así que medirlo desde un panel automatizado en
            // segundo plano da siempre "sigue escondido", aunque funcione.
            className="border-negro bg-blanco text-negro absolute -top-20 left-3 z-50 rounded-full border px-4 py-3 text-[13px] focus:top-3"
          >
            Saltar al contenido
          </a>
          <SiteHeader />
          <main id="contenido" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
