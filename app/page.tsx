import Link from "next/link";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { listBrands, listProducts } from "@/lib/catalog/index.ts";

const CATEGORIAS_DESTACADAS = [
  {
    slug: "subwoofers",
    nombre: "Subwoofers y cajas",
    descripcion: 'De 8 a 15", bobina simple y doble, con cajas selladas y ventiladas.',
    foto: 'FOTO — sub 12" tres cuartos',
    span: true,
    dark: false,
  },
  {
    slug: "receptores",
    nombre: "Receptores",
    descripcion: 'CarPlay y Android Auto sin cables, de 7" a 10", con cámara de reversa.',
    foto: 'FOTO — pantalla 9"',
    span: false,
    dark: true,
  },
  {
    slug: "bocinas",
    nombre: "Bocinas",
    descripcion: 'Coaxiales y de componentes, de 4" a 6×9".',
    foto: 'FOTO — bocina 6×9"',
    span: false,
    dark: false,
  },
  {
    slug: "amplificadores",
    nombre: "Amplificadores y cable",
    descripcion: "Mono, 4 y 5 canales. Kits de 0 a 8 AWG.",
    foto: "FOTO — amplificador de 4 canales",
    span: false,
    dark: false,
  },
  {
    slug: "insonorizacion",
    nombre: "Insonorización",
    descripcion: "Láminas butílicas para puertas, piso y cajuela.",
    foto: "FOTO — lámina butílica en puerta",
    span: false,
    dark: false,
  },
] as const;

const CARACTERISTICAS = [
  {
    numero: "01",
    titulo: "Diversidad de gamas",
    texto: "Contamos con un catálogo amplio que se ajusta a lo que buscas.",
  },
  {
    numero: "02",
    titulo: "Ficha técnica completa",
    texto: "Potencia RMS, impedancia y medidas de cada equipo, tal como los publica el fabricante.",
  },
  {
    numero: "03",
    titulo: "Envíos gratis a todo el país",
    texto: "Entrega de 24 a 72 horas. Aplican restricciones según destino y volumen del pedido.",
  },
] as const;

export default async function Home() {
  const [{ items: destacados }, marcas] = await Promise.all([
    listProducts({ destacado: true, pageSize: 4 }),
    listBrands(),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 pt-16 text-center sm:px-12 sm:pt-24">
        <h1 className="text-44 sm:text-64 lg:text-82 max-w-[900px] leading-[1.05] font-semibold tracking-[-0.025em] text-balance sm:leading-[1.03] sm:tracking-[-0.03em] lg:leading-[1.02] lg:tracking-[-0.035em]">
          Tu carro ya suena,
          <br />
          pero podría escucharse mejor.
        </h1>
        <p className="text-texto-secundario max-w-[620px] text-[17px] leading-[1.45] sm:text-[21px]">
          Bocinas, subwoofers, amplificadores, receptores, kits, insonorización y accesorios. Envíos
          a toda Guatemala.
        </p>
        <div className="flex gap-3.5 pt-1.5 text-[15px]">
          <Link href="/catalogo/subwoofers" className="bg-negro rounded-full px-6 py-3 text-white">
            Ver catálogo
          </Link>
        </div>
        <div className="text-texto-terciario px-4 font-mono text-[11px] tracking-[0.06em]">
          Hasta 6 pagos precio contado · Envíos gratis a todo el país, aplican restricciones ·
          Producto original
        </div>
        <PlaceholderImage
          label="FOTO — subwoofer y amplificador sobre fondo negro, luz dura"
          className="mt-7 h-[220px] w-full items-end rounded-t-2xl sm:h-[320px] lg:h-[470px]"
        />
      </section>

      {/* Categorías */}
      <section className="flex flex-col gap-9 px-6 py-16 sm:px-12 sm:py-22">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-34 sm:text-40 font-semibold tracking-[-0.025em]">Categorías</h2>
          <Link href="/catalogo/subwoofers" className="text-texto-secundario text-[15px]">
            Ver toda la tienda →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIAS_DESTACADAS.map((categoria) => (
            <Link
              key={categoria.slug}
              href={`/catalogo/${categoria.slug}`}
              className={`rounded-card-lg flex h-[300px] flex-col justify-between gap-2 p-8 ${
                categoria.dark ? "bg-negro text-white" : "bg-fondo-alt text-negro"
              } ${categoria.span ? "sm:col-span-2" : ""}`}
            >
              <div className="flex flex-col gap-2">
                <div className="text-26 font-semibold tracking-[-0.02em]">{categoria.nombre}</div>
                <div
                  className={`max-w-[400px] text-[15px] ${
                    categoria.dark ? "text-texto-sobre-negro" : "text-texto-secundario"
                  }`}
                >
                  {categoria.descripcion}
                </div>
              </div>
              <PlaceholderImage label={categoria.foto} dark={categoria.dark} className="flex-1" />
            </Link>
          ))}
        </div>
      </section>

      {/* Los más vendidos */}
      {destacados.length > 0 ? (
        <section className="bg-fondo-alt flex flex-col gap-7 px-6 py-16 sm:px-12">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.025em]">
              Los más vendidos
            </h2>
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
            Producto original, precio y stock a la vista.
          </h2>
          <p className="text-texto-sobre-negro max-w-[380px] text-[17px] leading-[1.55]">
            Vendemos equipo nuevo de marcas autorizadas, buscando siempre ofrecer lo mejor.
          </p>
        </div>
        <div className="border-borde-sobre-negro grid grid-cols-1 gap-8 border-t pt-2 sm:grid-cols-3 sm:gap-10">
          {CARACTERISTICAS.map((caracteristica) => (
            <div key={caracteristica.numero} className="flex flex-col gap-2.5 pt-6">
              <div className="font-mono text-[12px] text-[#6e6e72]">{caracteristica.numero}</div>
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

      {/* Consulta / comparador */}
      <section className="flex flex-col gap-4 px-6 pb-16 sm:flex-row sm:px-12 sm:pb-24">
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Consulta existencias</div>
          <div className="text-texto-secundario text-[15px] leading-[1.55]">
            Escríbenos el modelo que buscas y te confirmamos disponibilidad y precio del día.
          </div>
          <span className="mt-auto pt-5 text-[15px]">Escríbenos por WhatsApp →</span>
        </div>
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">
            Comparador de especificaciones
          </div>
          <div className="text-texto-secundario text-[15px] leading-[1.55]">
            Pon dos o tres equipos lado a lado y revisa sus fichas técnicas completas.
          </div>
          <span className="mt-auto pt-5 text-[15px]">Abrir comparador →</span>
        </div>
      </section>
    </div>
  );
}
