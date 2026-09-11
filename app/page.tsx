import Link from "next/link";

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
// Composición tipo Mondrian: cuadrados y rectángulos de distinto tamaño que
// llenan una retícula de 4 × 4 SIN huecos (4+2+2+2+1+1+2+2 = 16 celdas). El
// orden de colocación es el de CATEGORIAS_SITIO y la rejilla va en modo
// `dense`, así que un bloque alto entra en el hueco que dejó uno ancho en
// vez de empujar todo hacia abajo.
//
// De Mondrian se toma la COMPOSICIÓN, no la paleta: no hay color de acento
// (CLAUDE.md § Sistema visual), así que los bloques son el fondo alterno y
// uno solo negro.
//
// `span` solo aplica desde lg. Abajo de eso todas las tarjetas miden igual,
// que es como ya se comportaba la rejilla.
type SlugCategoria = (typeof CATEGORIAS_SITIO)[number]["slug"];

type TarjetaCategoria = {
  descripcion: string;
  // Un cuadrado encuadra una sola foto; un rectángulo, varias — se reparten
  // el alto si es vertical y el ancho si es horizontal.
  fotos: string[];
  direccion: "fila" | "columna";
  span: string;
  dark?: true;
};

const TARJETAS_CATEGORIA: Record<SlugCategoria, TarjetaCategoria> = {
  bocinas: {
    descripcion: 'Coaxiales y de componentes, de 4" a 6×9".',
    fotos: ['FOTO — bocina 6×9"'],
    direccion: "fila",
    span: "lg:col-span-2 lg:row-span-2",
  },
  subwoofers: {
    descripcion: 'De 6.5" a 15", bobina simple, doble y triple.',
    fotos: ['FOTO — sub 12" tres cuartos', 'FOTO — sub 10" de frente'],
    direccion: "columna",
    span: "lg:row-span-2",
  },
  amplificadores: {
    descripcion: "Monoblock y multicanal, de 1 a 6 canales.",
    fotos: ["FOTO — amplificador de 4 canales", "FOTO — monoblock"],
    direccion: "fila",
    span: "lg:col-span-2",
  },
  receptores: {
    descripcion: 'CarPlay y Android Auto sin cables, de 7" a 10", con cámara de reversa.',
    fotos: ['FOTO — pantalla 9"', "FOTO — radio 1 DIN"],
    direccion: "columna",
    span: "lg:row-span-2",
    dark: true,
  },
  ecualizadores: {
    descripcion: "Gráficos, paramétricos y procesadores DSP.",
    fotos: ["FOTO — ecualizador de frente"],
    direccion: "fila",
    span: "",
  },
  kits: {
    descripcion: "Kits de cable de 0 a 8 AWG, en cobre y CCA.",
    fotos: ["FOTO — kit de cable calibre 4"],
    direccion: "fila",
    span: "",
  },
  insonorizacion: {
    descripcion: "Láminas butílicas para puertas, piso y cajuela.",
    fotos: ["FOTO — lámina butílica en puerta", "FOTO — rollo de insonorización"],
    direccion: "fila",
    span: "lg:col-span-2",
  },
  accesorios: {
    descripcion: "Cables RCA, adaptadores, distribuidores y portafusibles.",
    fotos: ["FOTO — cables RCA", "FOTO — bloque distribuidor", "FOTO — portafusible"],
    direccion: "fila",
    span: "lg:col-span-2",
  },
};

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-flow-row-dense lg:auto-rows-[200px] lg:grid-cols-4">
          {CATEGORIAS_SITIO.map(({ slug, nombre }) => {
            const { descripcion, fotos, direccion, span, dark = false } = TARJETAS_CATEGORIA[slug];
            return (
              <Link
                key={slug}
                href={`/catalogo/${slug}`}
                className={`rounded-card-lg flex h-[280px] flex-col justify-between gap-3 p-6 lg:h-auto ${span} ${
                  dark ? "bg-negro text-white" : "bg-fondo-alt text-negro"
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
                {/* min-h-0: sin esto cada placeholder se planta en su alto de
                    contenido y el conjunto se desborda de la tarjeta en vez
                    de repartirse el espacio que sobra. */}
                <div
                  className={`flex flex-1 gap-2 ${direccion === "columna" ? "flex-col" : "flex-row"}`}
                >
                  {fotos.map((foto) => (
                    <PlaceholderImage
                      key={foto}
                      label={foto}
                      dark={dark}
                      className="min-h-0 flex-1"
                    />
                  ))}
                </div>
              </Link>
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
