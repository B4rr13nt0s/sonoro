import type { Metadata } from "next";
import Link from "next/link";

import { claseBoton } from "@/components/ui/boton.ts";
import { CATEGORIAS_SITIO } from "@/lib/catalog/categorias.ts";

// La 404 de todo el sitio: una ruta que no existe, un producto, una
// categoría o una marca con slug inválido, o una página de listado más allá
// de la última. Next le agrega `noindex` solo; el título y la descripción
// son los de la plantilla del layout (sin canonical, a propósito).
//
// Tres salidas, en el orden en que alguien las necesita: el catálogo y la
// búsqueda —quien llega acá casi siempre buscaba un producto, con un enlace
// viejo o mal copiado—, las categorías para ir directo, y la portada.
export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <section className="flex flex-col gap-8 px-6 pt-14 pb-24 sm:px-12 sm:pt-20 sm:pb-32">
      <div className="flex max-w-[640px] flex-col gap-4">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          Error 404
        </div>
        <h1 className="text-34 sm:text-40 lg:text-48 font-semibold tracking-[-0.03em]">
          Esta página no existe
        </h1>
        <p className="text-texto-secundario text-[17px]">
          El enlace puede estar mal copiado, o el producto ya no está en el catálogo. Busca por
          nombre, marca o código, o recorre el catálogo completo.
        </p>
      </div>

      <div className="flex max-w-[480px] flex-col gap-3 sm:flex-row">
        <Link href="/catalogo" className={claseBoton("principal")}>
          Ver el catálogo
        </Link>
        <Link href="/buscar" className={claseBoton("secundario")}>
          Buscar un producto
        </Link>
      </div>

      <nav aria-label="Categorías" className="flex flex-col gap-3">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          Categorías
        </div>
        <ul className="flex flex-wrap gap-2.5">
          {CATEGORIAS_SITIO.map((categoria) => (
            <li key={categoria.slug}>
              <Link
                href={`/catalogo/${categoria.slug}`}
                className="border-borde-pildora text-texto-nav inline-block rounded-full border px-4.5 py-3 text-[13px] lg:py-2"
              >
                {categoria.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        href="/"
        className="text-texto-secundario hover:text-negro w-fit text-[14px] underline underline-offset-4"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
