import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { FotosCategoria } from "@/components/home/FotosCategoria";
import { ProductCarousel3D } from "@/components/home/ProductCarousel3D";
import { CATEGORIAS_SITIO } from "@/lib/catalog/categorias.ts";
import { listBrands, listProducts } from "@/lib/catalog/index.ts";
import { jsonLdScriptProps } from "@/lib/seo/jsonLd.ts";
import { buildLocalBusinessJsonLd } from "@/lib/seo/business.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";
import { DESCRIPCION_SITIO, TITULO_SITIO } from "@/lib/seo/textos.ts";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/whatsapp/index.ts";

export const metadata: Metadata = metadataPagina({
  titulo: TITULO_SITIO,
  tituloAbsoluto: true,
  descripcion: DESCRIPCION_SITIO,
  ruta: "/",
  // app/opengraph-image.tsx vive en este mismo segmento: la de config la
  // pisaría y se perdería el hash de versión que Next le agrega a la URL.
  conImagenPropia: true,
});

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
//   6       Subwoofers   Subwoofers   Insonorización   Kits
//   7-8     Accesorios   Accesorios   Insonorización   Kits
//
// Subwoofers es una L. CSS grid solo coloca rectángulos, así que va en dos
// piezas —`area` arriba y `extension` abajo— que se tocan sin hueco (ver el
// JSX). Las tarjetas conservan el estilo del sitio: fondo alterno o negro.
//
// Debajo de lg no hay retícula: las tarjetas van en el orden del nav, cada
// una con su primera foto a todo el ancho, y la extensión de Subwoofers no se
// muestra.
type SlugCategoria = (typeof CATEGORIAS_SITIO)[number]["slug"];

// Las fotos de la portada viven en public/fotos_pagina_de_inicio/, con el
// nombre SKU_pagina_de_inicio.webp. No pasan por el catálogo: ilustran la
// categoría, no venden un producto puntual.
//
// Son copias SIN FONDO —WebP con transparencia, recortadas al producto— para
// que el producto se asiente sobre el color de la tarjeta. Las genera
// `npm run fotos:sin-fondo` desde los originales de assets/, que no se
// publican; una foto nueva se guarda ahí y se vuelve a correr ese comando.
type Foto = { src: string; alt: string };

const foto = (archivo: string, alt: string): Foto => ({
  src: `/fotos_pagina_de_inicio/${archivo}`,
  alt,
});

type Bloque = {
  area: string;
  // Cuántas fotos lleva el bloque y cómo se acomodan: una al lado de la otra
  // en "fila", una debajo de la otra en "columna". Todas miden lo mismo (ver
  // FotosBloque), así que un bloque más grande no agranda sus fotos: lleva más.
  fotos: Foto[];
  direccion: "fila" | "columna";
  // Columnas de la retícula que ocupa el bloque. De acá sale el ancho de sus
  // fotos, no de cuántas lleva: ver FotosBloque.
  columnas: 1 | 2;
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
    columnas: 2,
    fotos: [
      foto("165AS_pagina_de_inicio.webp", 'Componente Access de 6.5" 165 AS de Focal'),
      foto(
        "PRX6903_pagina_de_inicio.webp",
        'Bocinas coaxiales Power Reference de 6x9" PRX6903 de Memphis',
      ),
    ],
    direccion: "fila",
  },
  subwoofers: {
    descripcion: 'De 6.5" a 15", bobina simple, doble y triple.',
    area: "lg:col-start-1 lg:row-start-3 lg:row-span-2",
    columnas: 1,
    fotos: [foto("SRX1044_pagina_de_inicio.webp", "Subwoofer SRX1044 de Memphis")],
    direccion: "fila",
    dark: true,
    extension: {
      area: "lg:col-start-1 lg:col-span-2 lg:row-start-5 lg:row-span-2",
      columnas: 2,
      fotos: [
        foto("VR10_pagina_de_inicio.webp", 'Subwoofer amplificado de 10" VR10 de Cerwin Vega'),
        foto(
          "TS-W312D4_pagina_de_inicio.webp",
          'Subwoofer Champion Series 12" TS-W312D4 de Pioneer',
        ),
      ],
      direccion: "fila",
    },
  },
  amplificadores: {
    descripcion: "Monoblock y multicanal, de 1 a 6 canales.",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    columnas: 2,
    fotos: [
      foto(
        "MJP800.4_pagina_de_inicio.webp",
        "Amplificador MOJO Pro de 4 canales MJP800.4 de Memphis",
      ),
      foto(
        "R250X1_pagina_de_inicio.webp",
        "Amplificador monoblock Prime R250X1 de Rockford Fosgate",
      ),
    ],
    direccion: "fila",
    dark: true,
  },
  receptores: {
    descripcion: 'CarPlay y Android Auto sin cables, de 7" a 10", con cámara de reversa.',
    area: "lg:col-start-2 lg:col-span-2 lg:row-start-3 lg:row-span-2",
    columnas: 2,
    fotos: [
      foto("DMH-Z6350BT_pagina_de_inicio.webp", 'Pantalla de 6.8" DMH-Z6350BT de Pioneer'),
      foto("DEH-S4250BT_pagina_de_inicio.webp", "Autoestéreo con CD DEH-S4250BT de Pioneer"),
    ],
    direccion: "fila",
  },
  ecualizadores: {
    descripcion: "Gráficos, paramétricos y procesadores DSP.",
    area: "lg:col-start-4 lg:row-start-3 lg:row-span-3",
    columnas: 1,
    fotos: [
      foto("EQL7_pagina_de_inicio.webp", "Ecualizador gráfico de 7 bandas EQL7 de Memphis"),
      foto("KEQS-7_pagina_de_inicio.webp", "Ecualizador gráfico de 7 bandas KEQS-7 de KBT"),
    ],
    direccion: "columna",
  },
  kits: {
    descripcion: "Kits de cable de 0 a 8 AWG, en cobre y CCA.",
    area: "lg:col-start-4 lg:row-start-6 lg:row-span-3",
    columnas: 1,
    fotos: [
      foto(
        "CAK82_pagina_de_inicio.webp",
        "Kit de amplificador de 2 canales calibre 8 CAK82 de Cerwin Vega",
      ),
    ],
    direccion: "fila",
    dark: true,
  },
  insonorizacion: {
    descripcion: "Láminas butílicas para puertas, piso y cajuela.",
    area: "lg:col-start-3 lg:row-start-5 lg:row-span-4",
    columnas: 1,
    fotos: [
      foto("CLASSIC-BULK-KIT-BLACK_pagina_de_inicio.webp", "Rollo a granel Classic de SoundSkins"),
      foto("SILENT-STRIP_pagina_de_inicio.webp", "Tira selladora Silent Strip de SoundSkins"),
    ],
    direccion: "columna",
  },
  accesorios: {
    descripcion: "Cables RCA, adaptadores, distribuidores y portafusibles.",
    area: "lg:col-start-1 lg:col-span-2 lg:row-start-7 lg:row-span-2",
    columnas: 2,
    fotos: [
      foto("RCA-Y2F1MB_pagina_de_inicio.webp", "Adaptador Y RCA de 2 hembras a 1 macho de KBT"),
      foto("ANL1_pagina_de_inicio.webp", "Portafusible tipo ANL ANL1 de Cerwin Vega"),
    ],
    direccion: "fila",
  },
};

// TODAS las fotos de la sección miden lo mismo, y dentro de cada tarjeta van
// CENTRADAS y separadas siempre 24 px entre sí, igual que el gap de la rejilla.
//
// El ancho es el interior de una tarjeta de una columna. En una de dos
// columnas el interior mide eso dos veces más 72 px (el gap entre columnas y
// los dos paddings que ya no están), así que cada foto mide
// (100% − 72 px) / 2. Si cambia el gap de la rejilla (gap-6) o el padding de
// las tarjetas (p-6), hay que recalcular ese 72: si no, las fotos de los
// bloques anchos dejan de medir lo mismo que las de los angostos.
//
// Consecuencia asumida: en un bloque ancho las fotos quedan a 48 px del borde
// (24 de padding + lo que sobra al centrarlas) y en uno angosto a 24. No hay
// forma de tener las dos cosas —mismo tamaño y mismo margen— porque un bloque
// de dos columnas es más ancho que dos de una: tiene el gap del medio.
//
// `anclaje` decide dónde va el grupo en el alto que sobra debajo del texto:
// al centro en una tarjeta normal; abajo en la pieza de arriba de la L y
// arriba en la de abajo, para que la distancia entre la foto de arriba y las
// de abajo dependa solo de los paddings de la costura (ver el JSX).
//
// LA L TIENE SU PROPIA GEOMETRÍA, y es la única que funciona. Sus tres fotos
// quedan a 24 px de TODOS los bordes —los de afuera y los internos, el
// vertical al costado de la foto de arriba y el horizontal sobre la de abajo
// a la derecha—, la de arriba cae exactamente sobre la de la esquina, y las
// tres están a 72 px entre sí en las dos direcciones.
//
// No se puede usar la separación de 24 px de las demás tarjetas: con fotos
// del mismo tamaño, alinear la de arriba sobre la de la esquina deja entre
// ella y el borde interno (separación − gap de la rejilla) / 2 = 0 px. Para
// que ese margen sea 24, la separación tiene que ser 24 + 2 × 24 = 72.
//
// `separacionL` pone esos 72 px entre las dos fotos de abajo. Los 72 px en
// vertical salen de la costura: 48 px de padding abajo en la pieza de arriba
// más 24 arriba en la de abajo.
//
// Debajo de lg todas las tarjetas tienen el mismo ancho y cada una muestra
// solo su primera foto, a todo el ancho, así que ahí también son iguales.
// Las demás se ocultan en su envoltorio.
//
// Cada foto va en un recuadro de proporción 3:2, sin fondo propio, y se
// muestra completa (object-contain) con un margen interno para que el
// producto no toque el borde. Las fotos tienen proporciones muy distintas
// —de 0.5 a 2.2—: recortarlas a 3:2 cortaría productos.
//
// El bloque de fotos vive en components/home/FotosCategoria.tsx, del lado
// del cliente: las pide al acercarse a la sección, no en la carga inicial
// (ahí está el porqué).
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
        {/* Las filas 5 y 6 son las de la pieza de abajo de la L, y NO van
            en auto: en auto toman el alto que les imponen Ecualizadores,
            Insonorización y Accesorios, y a esa pieza le sobraba espacio
            debajo de sus fotos (38 a 50 px en vez de 24). Se fijan al alto
            justo — foto + 24 px arriba + 24 abajo — y las tarjetas vecinas
            absorben lo que les falte en sus otras filas, que sí son auto.

            El alto de la foto depende del ancho de la columna, así que se
            calcula con cqw sobre el contenedor de la rejilla (@container):
              columna = (100cqw − 3 gaps de 24) / 4
              foto    = columna − 48 (dos paddings)     → alto = foto × 2/3
              filas 5 + 6 + gap = alto + 48  →  cada fila = foto / 3 + 12
            Si cambia el gap, el padding o la proporción 3:2 de las fotos,
            esta cuenta cambia con ellos. */}
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[repeat(4,auto)_calc(((100cqw-72px)/4-48px)/3+12px)_calc(((100cqw-72px)/4-48px)/3+12px)_repeat(2,auto)]">
            {CATEGORIAS_SITIO.map(({ slug, nombre }) => {
              const {
                descripcion,
                area,
                fotos,
                direccion,
                columnas,
                extension,
                dark = false,
              } = TARJETAS_CATEGORIA[slug];
              const fondo = dark ? "bg-negro text-white" : "bg-fondo-alt text-negro";
              return (
                <Fragment key={slug}>
                  {/* Con extensión, la pieza de arriba de la L baja 24 px (el
                    gap) y pierde las esquinas de abajo: así se funde con la
                    de abajo en un solo bloque, sin la línea blanca del gap.
                    En la costura la pieza de arriba deja 48 px de padding
                    y la de abajo sus 24 de siempre: con la foto de arriba
                    anclada abajo y las de abajo ancladas arriba, las separan
                    48 + 24 = 72 px, lo mismo que separa a las dos de abajo
                    entre sí (ver FotosBloque). */}
                  <Link
                    href={`/catalogo/${slug}`}
                    className={`rounded-card-lg flex flex-col justify-between gap-3 p-6 ${area} ${fondo} ${
                      extension ? "lg:-mb-6 lg:rounded-b-none lg:pb-12" : ""
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
                    <FotosCategoria
                      fotos={fotos}
                      direccion={direccion}
                      columnas={columnas}
                      anclaje={extension ? "abajo" : "centro"}
                    />
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
                      <FotosCategoria
                        fotos={extension.fotos}
                        direccion={extension.direccion}
                        columnas={extension.columnas}
                        anclaje="arriba"
                        separacionL
                      />
                    </Link>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
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
