import Link from "next/link";

// Plantilla compartida por las 3 páginas de /legal/* — misma forma en las
// tres (etiqueta, h1, fecha, secciones de título+párrafos, enlaces
// cruzados), así que una sola plantilla evita triplicar el layout. No hay
// referencia visual en design/*.html para páginas legales; la tipografía y
// el espaciado se toman de app/nosotros/page.tsx, la página de texto más
// cercana que ya existe.
export type LegalSeccion = { titulo: string; parrafos: string[] };

const ENLACES_LEGALES = [
  { href: "/legal/terminos", nombre: "Términos" },
  { href: "/legal/privacidad", nombre: "Privacidad" },
  { href: "/legal/garantias", nombre: "Garantías" },
] as const;

type LegalPageProps = {
  etiqueta: string;
  titulo: string;
  actualizado: string;
  intro?: string;
  secciones: LegalSeccion[];
};

export function LegalPage({ etiqueta, titulo, actualizado, intro, secciones }: LegalPageProps) {
  return (
    <div className="flex flex-col">
      <section className="flex max-w-[820px] flex-col gap-5 px-6 pt-16 pb-4 sm:px-12 sm:pt-24">
        <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
          {etiqueta}
        </div>
        <h1 className="text-40 sm:text-48 leading-[1.1] font-semibold tracking-[-0.03em]">
          {titulo}
        </h1>
        {intro ? <p className="text-texto-secundario text-[17px] leading-[1.55]">{intro}</p> : null}
        <div className="text-texto-terciario font-mono text-[11px]">{actualizado}</div>
      </section>

      {/* Grid a dos columnas (mismo patrón que app/nosotros/page.tsx) en vez
          de una sola columna angosta a la izquierda: con 7-9 secciones por
          página, esto reparte el contenido en todo el ancho de página
          disponible sin dejar líneas de texto absurdamente largas. */}
      <section className="grid grid-cols-1 gap-x-14 gap-y-10 px-6 py-12 sm:grid-cols-2 sm:px-12 sm:py-16">
        {secciones.map((seccion) => (
          <div key={seccion.titulo} className="flex flex-col gap-3">
            <h2 className="text-22 sm:text-26 font-semibold tracking-[-0.02em]">
              {seccion.titulo}
            </h2>
            {seccion.parrafos.map((parrafo, i) => (
              <p key={i} className="text-texto-secundario text-[16px] leading-[1.65]">
                {parrafo}
              </p>
            ))}
          </div>
        ))}
      </section>

      <section className="border-borde-nav flex flex-wrap gap-5 border-t px-6 py-10 sm:px-12">
        {ENLACES_LEGALES.map((enlace) => (
          <Link
            key={enlace.href}
            href={enlace.href}
            className="text-texto-terciario hover:text-texto-secundario font-mono text-[11px] tracking-[0.06em] uppercase"
          >
            {enlace.nombre}
          </Link>
        ))}
        <Link
          href="/"
          className="text-texto-terciario hover:text-texto-secundario font-mono text-[11px] tracking-[0.06em] uppercase"
        >
          Inicio
        </Link>
      </section>
    </div>
  );
}
