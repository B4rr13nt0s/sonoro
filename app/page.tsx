import Link from "next/link";
import { Fragment } from "react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { ProductCarousel3D } from "@/components/home/ProductCarousel3D";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { CATEGORIAS_SITIO } from "@/lib/catalog/categorias.ts";
import { listBrands, listProducts } from "@/lib/catalog/index.ts";
import { jsonLdScriptProps } from "@/lib/seo/jsonLd.ts";
import { buildLocalBusinessJsonLd } from "@/lib/seo/business.ts";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/whatsapp/index.ts";

// Mensaje genérico (no depende de un carrito, a diferencia de
// CarritoView) — solo consulta de existencia, sin lenguaje de asesoría ni
// instalación (CLAUDE.md § reglas 1 y 2).
const MENSAJE_CONSULTA_EXISTENCIAS = "Hola Sonoro, quiero consultar disponibilidad de un producto.";

// Una tarjeta por categoría del sitio, en el orden del nav. El nombre y el
// slug salen de CATEGORIAS_SITIO; acá solo vive lo propio de la tarjeta.
// Record sobre los slugs: una categoría nueva sin su tarjeta no compila.
// Las descripciones describen lo que HAY en el catálogo (medidas, canales,
// calibres), no lo que conviene — CLAUDE.md § reglas 2.
//
// Composición tipo Mondrian, según el boceto del negocio: una retícula de 4
// columnas por 8 medias filas donde cada bloque tiene su lugar FIJO (`area`).
// Los lugares se escriben a mano en vez de dejarlos al auto-placement, para
// que el orden del DOM —el del nav, que es el que siguen el teclado y el
// lector de pantalla— no dependa del orden visual. Las 32 celdas quedan
// cubiertas exactamente una vez:
//
//   filas   col 1        col 2        col 3            col 4
//   1-2     Bocinas      Bocinas      Amplificadores   Amplificadores
//   3-4     Subwoofers   Receptores   Receptores       Ecualizadores
//   5       Subwoofers   Subwoofers   Insonorización   Ecualizadores
//   6       Subwoofers   Subwoofers   Insonorización   Accesorios
//   7-8     Kits         Kits         Insonorización   Accesorios
//
// Subwoofers es una L. CSS grid solo coloca rectángulos, así que va en dos
// piezas —`area` arriba y `extension` abajo— que se tocan sin hueco (ver el
// JSX). Las tarjetas conservan el estilo del sitio: fondo alterno o negro.
//
// Debajo de lg no hay retícula: las tarjetas van en el orden del nav, cada
// una con su primera foto a todo el ancho, y la extensión de Subwoofers no se
// muestra.
type SlugCategoria = (typeof CATEGORIAS_SITIO)[number]["slug"];

type Bloque = {
  area: string;
  // Cuántas fotos lleva el bloque y cómo se acomodan: una al lado de la otra
  // en "fila", una debajo de la otra en "columna". Todas miden lo mismo (ver
  // FotosBloque), así que un bloque más grande no agranda sus fotos: lleva más.
  fotos: string[];
  direccion: "fila" | "columna";
};

type TarjetaCategoria = Bloque & {
  descripcion: string;
  dark?: true;
  extension?: Bloque;
};

const TARJETAS_CATEGORIA: Record<SlugCategoria, TarjetaCategoria> = {
  bocinas: {
    descripcion: 'Coaxiales y de componentes, de 4" a 6×9".',
    area: "lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    fotos: ['FOTO — bocina 6×9"', 'FOTO — componentes 6.5"'],
    direccion: "fila",
  },
  subwoofers: {
    descripcion: 'De 6.5" a 15", bobina simple, doble y triple.',
    area: "lg:col-start-1 lg:row-start-3 lg:row-span-2",
    fotos: ['FOTO — sub 12" tres cuartos'],
    direccion: "fila",
    dark: true,
    extension: {
      area: "lg:col-start-1 lg:col-span-2 lg:row-start-5 lg:row-span-2",
      fotos: ['FOTO — sub 10" de frente', 'FOTO — sub 15" de perfil'],
      direccion: "fila",
    },
  },
  amplificadores: {
    descripcion: "Monoblock y multicanal, de 1 a 6 canales.",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    fotos: ["FOTO — amplificador de 4 canales", "FOTO — monoblock"],
    direccion: "fila",
    dark: true,
  },
  receptores: {
    descripcion: 'CarPlay y Android Auto sin cables, de 7" a 10", con cámara de reversa.',
    area: "lg:col-start-2 lg:col-span-2 lg:row-start-3 lg:row-span-2",
    fotos: ['FOTO — pantalla 9"', "FOTO — radio 1 DIN"],
    direccion: "fila",
  },
  ecualizadores: {
    descripcion: "Gráficos, paramétricos y procesadores DSP.",
    area: "lg:col-start-4 lg:row-start-3 lg:row-span-3",
    fotos: ["FOTO — ecualizador de frente", "FOTO — procesador DSP"],
    direccion: "columna",
  },
  kits: {
    descripcion: "Kits de cable de 0 a 8 AWG, en cobre y CCA.",
    area: "lg:col-start-1 lg:col-span-2 lg:row-start-7 lg:row-span-2",
    fotos: ["FOTO — kit de cable calibre 4", "FOTO — portafusible y terminales"],
    direccion: "fila",
  },
  insonorizacion: {
    descripcion: "Láminas butílicas para puertas, piso y cajuela.",
    area: "lg:col-start-3 lg:row-start-5 lg:row-span-4",
    fotos: ["FOTO — lámina butílica en puerta", "FOTO — rollo de insonorización"],
    direccion: "columna",
  },
  accesorios: {
    descripcion: "Cables RCA, adaptadores, distribuidores y portafusibles.",
    area: "lg:col-start-4 lg:row-start-6 lg:row-span-3",
    fotos: ["FOTO — cables RCA y adaptadores"],
    direccion: "fila",
    dark: true,
  },
};

// TODAS las fotos de la sección miden lo mismo, sin importar el bloque.
//
// El ancho sale de la retícula: cada foto ocupa exactamente una columna menos
// el padding de su tarjeta. En un bloque de una columna ese es el ancho
// interior, sin más. En uno de dos columnas, dos fotos lado a lado solo miden
// eso si las separa el gap de la rejilla más los dos paddings: 24 + 24 + 24 =
// 72 px (gap-18). Con eso cada foto cae alineada con su columna, también de
// una tarjeta a otra. El alto sale de la proporción fija 3:2.
//
// Si cambia el gap de la rejilla (gap-6) o el padding de las tarjetas (p-6),
// hay que recalcular gap-18: si no, las fotos de los bloques anchos dejan de
// medir lo mismo que las de los angostos.
//
// Debajo de lg todas las tarjetas tienen el mismo ancho y cada una muestra
// solo su primera foto, a todo el ancho, así que ahí también son iguales.
// Las demás van envueltas en un div que se oculta, y no con `hidden` sobre
// el placeholder: ese componente ya trae `flex`, y entre dos utilidades de
// display el orden de la hoja de estilos —no el del className— decide cuál
// gana.
function FotosBloque({ fotos, direccion, dark }: Omit<Bloque, "area"> & { dark: boolean }) {
  const enFila = direccion === "fila";
  return (
    <div className={`flex ${enFila ? "flex-row lg:gap-18" : "flex-col lg:gap-6"}`}>
      {fotos.map((foto, i) => (
        <div
          key={foto}
          className={`${enFila ? "min-w-0 flex-1" : "w-full"} ${i > 0 ? "hidden lg:block" : ""}`}
        >
          <PlaceholderImage label={foto} dark={dark} className="aspect-[3/2] w-full" />
        </div>
      ))}
    </div>
  );
}

const CARACTERISTICAS = [
  {
    numero: "01",
    titulo: "Diversidad de gamas",
    texto: "Contamos con un catálogo amplio que se ajusta a lo que buscas.",
  },
  {
    numero: "02",
    titulo: "Ficha técnica completa",
    texto:
      "Te brindamos especificaciones de todos nuestros equipos, tal como las publica el fabricante.",
  },
  {
    numero: "03",
    titulo: "Envíos gratis a todo el país",
    texto:
      "El tiempo de entrega depende del departamento. Aplican restricciones según destino y volumen del pedido.",
  },
] as const;

export default async function Home() {
  const [{ items: destacados }, marcas] = await Promise.all([
    listProducts({ destacado: true, activo: true, pageSize: 4 }),
    listBrands(),
  ]);

  return (
    <div className="flex flex-col">
      {/* JSON-LD LocalBusiness: va en inicio, no en cada página — es la
          entidad del sitio completo, no de esta ruta en particular. */}
      <script {...jsonLdScriptProps(buildLocalBusinessJsonLd())} />

      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 pt-16 text-center sm:px-12 sm:pt-24">
        <h1 className="text-44 sm:text-64 lg:text-82 max-w-[900px] leading-[1.05] font-semibold tracking-[-0.025em] text-balance sm:leading-[1.03] sm:tracking-[-0.03em] lg:leading-[1.02] lg:tracking-[-0.035em]">
          Transforma tu camino a través del sonido.
        </h1>
        <p className="text-texto-secundario max-w-[620px] text-[17px] leading-[1.45] sm:text-[21px]">
          En Sonoro, disponemos de todo lo que necesitas para elevar tu experiencia al manejar.
        </p>
        <div className="flex gap-3.5 pt-1.5 text-[15px]">
          <Link href="/catalogo" className="bg-negro rounded-full px-6 py-3 text-white">
            Ver productos
          </Link>
        </div>
        <div className="text-texto-terciario px-4 font-mono text-[11px] tracking-[0.06em]">
          Hasta 6 pagos precio contado · Producto original · Envíos gratis a todo el país, aplican
          restricciones
        </div>
        <ProductCarousel3D />
      </section>

      {/* Categorías */}
      <section className="flex flex-col gap-9 px-6 py-16 sm:px-12 sm:py-22">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-34 sm:text-40 font-semibold tracking-[-0.025em]">Categorías</h2>
          <Link href="/catalogo" className="text-texto-secundario text-[15px]">
            Ver toda la tienda →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[repeat(8,auto)]">
          {CATEGORIAS_SITIO.map(({ slug, nombre }) => {
            const {
              descripcion,
              area,
              fotos,
              direccion,
              extension,
              dark = false,
            } = TARJETAS_CATEGORIA[slug];
            const fondo = dark ? "bg-negro text-white" : "bg-fondo-alt text-negro";
            return (
              <Fragment key={slug}>
                {/* Con extensión, la pieza de arriba de la L baja 24 px (el
                    gap) y pierde las esquinas de abajo: así se funde con la
                    de abajo en un solo bloque, sin la línea blanca del gap. */}
                <Link
                  href={`/catalogo/${slug}`}
                  className={`rounded-card-lg flex flex-col justify-between gap-3 p-6 ${area} ${fondo} ${
                    extension ? "lg:-mb-6 lg:rounded-b-none" : ""
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-26 font-semibold tracking-[-0.02em]">{nombre}</div>
                    <div
                      className={`max-w-[400px] text-[15px] ${
                        dark ? "text-texto-sobre-negro" : "text-texto-secundario"
                      }`}
                    >
                      {descripcion}
                    </div>
                  </div>
                  <FotosBloque fotos={fotos} direccion={direccion} dark={dark} />
                </Link>
                {/* La pieza de abajo de la L también lleva al listado, pero
                    fuera del orden de tabulación y oculta al lector de
                    pantalla: es el mismo destino que la de arriba, y
                    anunciarlo dos veces seguidas solo estorba. */}
                {extension ? (
                  <Link
                    href={`/catalogo/${slug}`}
                    aria-hidden="true"
                    tabIndex={-1}
                    className={`rounded-card-lg hidden p-6 lg:flex lg:flex-col lg:rounded-tl-none ${extension.area} ${fondo}`}
                  >
                    <FotosBloque
                      fotos={extension.fotos}
                      direccion={extension.direccion}
                      dark={dark}
                    />
                  </Link>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </section>

      {/* Destacados */}
      {destacados.length > 0 ? (
        <section className="bg-fondo-alt flex flex-col gap-7 px-6 py-16 sm:px-12">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.025em]">Destacados</h2>
            <span className="text-texto-terciario font-mono text-[12px]">
              Precios en quetzales, IVA incluido
            </span>
          </div>
          <ProductGrid productos={destacados} />
        </section>
      ) : null}

      {/* Producto original */}
      <section className="bg-negro flex flex-col gap-12 px-6 py-16 text-white sm:px-12 sm:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-26 sm:text-38 lg:text-44 max-w-[620px] font-semibold tracking-[-0.03em]">
            Producto original, de marcas reconocidas a nivel mundial.
          </h2>
          <p className="text-texto-sobre-negro max-w-[380px] text-[17px] leading-[1.55]">
            Buscamos siempre ofrecerte productos de calidad, la cual no sólo se ve, se escucha.
          </p>
        </div>
        <div className="border-borde-sobre-negro grid grid-cols-1 gap-8 border-t pt-2 sm:grid-cols-3 sm:gap-10">
          {CARACTERISTICAS.map((caracteristica) => (
            <div key={caracteristica.numero} className="flex flex-col gap-2.5 pt-6">
              <div className="text-texto-sobre-negro font-mono text-[12px]">
                {caracteristica.numero}
              </div>
              <div className="text-22 font-semibold tracking-[-0.02em]">
                {caracteristica.titulo}
              </div>
              <div className="text-texto-sobre-negro text-[15px] leading-[1.55]">
                {caracteristica.texto}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Marcas */}
      <section className="flex flex-col gap-8 px-6 pt-16 pb-16 sm:px-12 sm:pt-22 sm:pb-20">
        <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
          Marcas que vendemos
        </div>
        <div className="flex flex-wrap gap-3.5">
          {marcas.map((marca) => (
            <Link
              key={marca.slug}
              href={`/marcas/${marca.slug}`}
              className="border-borde-pildora rounded-full border px-6.5 py-3 text-[17px] text-[#2c2c2a]"
            >
              {marca.nombre}
            </Link>
          ))}
        </div>
      </section>

      {/* Consulta */}
      <section className="flex flex-col gap-4 px-6 pb-16 sm:flex-row sm:px-12 sm:pb-24">
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Consulta existencias</div>
          <div className="text-texto-secundario text-[15px] leading-[1.55]">
            Escríbenos el modelo que buscas para confirmarte disponibilidad y precio.
          </div>
          <a
            href={buildWhatsAppUrl(WHATSAPP_NUMBER, MENSAJE_CONSULTA_EXISTENCIAS)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto pt-5 text-[15px]"
          >
            Escríbenos por WhatsApp →
          </a>
        </div>
      </section>
    </div>
  );
}
