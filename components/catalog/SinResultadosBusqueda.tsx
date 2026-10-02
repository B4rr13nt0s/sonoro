import Link from "next/link";

import { CATEGORIAS_SITIO } from "@/lib/catalog/categorias.ts";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/whatsapp/index.ts";

const CLASE_PILDORA =
  "border-borde-pildora text-texto-nav rounded-full border px-4.5 py-3 text-[13px] lg:py-2";

type Enlace = { nombre: string; slug: string };

/**
 * La búsqueda que no encontró nada, con salidas: la corrección de lo
 * escrito, las categorías y marcas que se le parecen (o todas las categorías,
 * si no hay ninguna) y la consulta de disponibilidad por WhatsApp — el mismo
 * mensaje genérico de la portada, sin lenguaje de asesoría (CLAUDE.md §
 * reglas 2).
 */
export function SinResultadosBusqueda({
  consulta,
  correccion,
  marcas,
  categorias,
  alCorregir,
}: {
  consulta: string;
  correccion: string | null;
  marcas: Enlace[];
  categorias: Enlace[];
  alCorregir: (consulta: string) => void;
}) {
  const hayRelacionadas = marcas.length + categorias.length > 0;
  const mensaje = `Hola Sonoro, quiero consultar disponibilidad de: ${consulta}`;

  return (
    <div className="border-borde-tarjeta rounded-card-lg flex flex-col items-center gap-6 border border-dashed px-6 py-14 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          Sin resultados
        </div>
        <p className="text-texto-secundario text-[15px]">
          No encontramos productos para «{consulta}».
        </p>
        {correccion ? (
          <p className="text-[15px]">
            Quizá quisiste decir{" "}
            <button type="button" onClick={() => alCorregir(correccion)} className="underline">
              «{correccion}»
            </button>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          {hayRelacionadas ? "Relacionadas" : "Explorar por categoría"}
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {hayRelacionadas
            ? [
                ...categorias.map((c) => (
                  <Link key={`c-${c.slug}`} href={`/catalogo/${c.slug}`} className={CLASE_PILDORA}>
                    {c.nombre}
                  </Link>
                )),
                ...marcas.map((m) => (
                  <Link key={`m-${m.slug}`} href={`/marcas/${m.slug}`} className={CLASE_PILDORA}>
                    {m.nombre}
                  </Link>
                )),
              ]
            : CATEGORIAS_SITIO.map((c) => (
                <Link key={c.slug} href={`/catalogo/${c.slug}`} className={CLASE_PILDORA}>
                  {c.nombre}
                </Link>
              ))}
        </div>
      </div>

      <a
        href={buildWhatsAppUrl(WHATSAPP_NUMBER, mensaje)}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-negro rounded-full px-7 py-3.5 text-[15px] text-white"
      >
        Consultar disponibilidad por WhatsApp
      </a>
    </div>
  );
}
