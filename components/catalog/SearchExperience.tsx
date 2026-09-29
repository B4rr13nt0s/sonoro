"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import type { ProductoTarjeta } from "@/lib/catalog/index.ts";
import { CATEGORIA_SISTEMAS, perteneceACategoria } from "@/lib/catalog/categorias.ts";
import { compararRelevancia } from "@/lib/catalog/orden.ts";

import { coincide, normalizar, puntuarRelevancia } from "./busqueda.ts";

const INCREMENTO = 8;

/**
 * Lee la búsqueda de la URL. Aparte de `Busqueda` para que app/buscar/page.tsx
 * pueda envolver SOLO esto en un <Suspense>: useSearchParams no existe al
 * prerenderizar, y el fallback dibuja la misma búsqueda vacía mientras tanto.
 */
export function SearchExperience({ productos }: { productos: ProductoTarjeta[] }) {
  return <Busqueda productos={productos} busqueda={useSearchParams().toString()} />;
}

/** «Ver más» empieza en INCREMENTO; lo que no sea un entero mayor, también. */
function leerVisibles(valor: string | null): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > INCREMENTO ? numero : INCREMENTO;
}

/**
 * La búsqueda entera vive en la URL —`/buscar?q=memphis&categoria=Amplificadores&ver=24`—,
 * no en el estado: con ella solo en React, volver atrás desde un resultado la
 * dejaba en blanco —y la búsqueda es la ruta principal de navegación
 * (CLAUDE.md § Patrones)—, y no se podía compartir. Con solo la consulta en
 * la URL, el filtro por categoría y los «Ver más» se perdían igual, y el
 * resultado del que se volvía ya no estaba en pantalla.
 */
export function Busqueda({
  productos,
  busqueda,
}: {
  productos: ProductoTarjeta[];
  /** Los query params actuales, como texto (`q=memphis&ver=16`). */
  busqueda: string;
}) {
  const params = useMemo(() => new URLSearchParams(busqueda), [busqueda]);
  const consulta = (params.get("q") ?? "").trim();
  const categoriaPedida = params.get("categoria");
  const visibles = leerVisibles(params.get("ver"));
  const [borrador, setBorrador] = useState(consulta);

  // Si la consulta cambia desde afuera —atrás/adelante, o «Buscar» del
  // encabezado, que lleva a /buscar sin `q`—, el campo la sigue. Se ajusta
  // durante el render, no en un efecto: es el patrón de React para derivar
  // estado de algo que cambió.
  const [consultaVista, setConsultaVista] = useState(consulta);
  if (consulta !== consultaVista) {
    setConsultaVista(consulta);
    setBorrador(consulta);
  }

  // replaceState y no pushState: cada cambio reemplaza al anterior, así que
  // atrás sale de /buscar en vez de recorrer cada consulta o filtro. Next
  // sincroniza useSearchParams con la historia nativa, sin pedir la página de
  // nuevo al servidor. Sin consulta no hay filtros que guardar.
  function irA({ q, categoria, ver }: { q: string; categoria?: string | null; ver?: number }) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (q && categoria) query.set("categoria", categoria);
    if (q && ver && ver > INCREMENTO) query.set("ver", String(ver));
    const texto = query.toString();
    window.history.replaceState(null, "", texto ? `/buscar?${texto}` : "/buscar");
  }

  function ejecutarBusqueda(valor: string) {
    irA({ q: valor.trim() });
  }

  function alTecleo(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter") {
      ejecutarBusqueda(borrador);
    } else if (evento.key === "Escape") {
      setBorrador("");
      ejecutarBusqueda("");
    }
  }

  const resultados = useMemo(() => {
    if (!consulta) return [];
    const q = normalizar(consulta);
    // El puntaje de texto manda; el desempate usa el mismo criterio que el
    // orden "relevancia" de los listados (destacado → precio ↓ → sku). Sin él,
    // los cubos grandes —los de puntaje 30/40/50, donde la consulta apenas
    // "contiene"— salían en el orden crudo de la hoja de cálculo.
    return productos
      .filter((producto) => coincide(producto, q))
      .map((producto) => ({ producto, puntaje: puntuarRelevancia(producto, q) }))
      .sort((a, b) => b.puntaje - a.puntaje || compararRelevancia(a.producto, b.producto))
      .map((r) => r.producto);
  }, [productos, consulta]);

  // Las píldoras cuentan con la misma regla que los listados
  // (perteneceACategoria): un Sistema cuenta en las categorías que trae como
  // secundarias, y «Sistemas» no es píldora porque no tiene página. Con solo
  // la categoría principal aparecía una píldora «Sistemas», y al filtrar por
  // Subwoofers desaparecía un sistema que /catalogo/subwoofers sí lista.
  const conteoPorCategoria = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const producto of resultados) {
      const categorias = [producto.categoria, ...(producto.categoriasSecundarias ?? [])];
      for (const categoria of categorias) {
        if (categoria === CATEGORIA_SISTEMAS) continue;
        conteo.set(categoria, (conteo.get(categoria) ?? 0) + 1);
      }
    }
    return conteo;
  }, [resultados]);

  // Una categoría de la URL que no está entre los resultados (enlace viejo,
  // o una consulta nueva) no filtra: se ve «Todo».
  const categoriaActiva =
    categoriaPedida && conteoPorCategoria.has(categoriaPedida) ? categoriaPedida : null;
  const resultadosFiltrados = categoriaActiva
    ? resultados.filter((producto) => perteneceACategoria(producto, categoriaActiva))
    : resultados;
  const resultadosVisibles = resultadosFiltrados.slice(0, visibles);
  const restantes = resultadosFiltrados.length - resultadosVisibles.length;

  return (
    <div className="flex flex-col">
      <section className="px-6 pt-10 sm:px-12 sm:pt-14">
        {/* La página no tenía NINGÚN encabezado: el diseño abre directo con el
            campo. El h1 le dice a Google y al lector de pantalla de qué trata
            sin agregar un titular que el diseño no tiene — mismo patrón que
            /marcas/[marca]. */}
        <h1 className="sr-only">Buscar en el catálogo</h1>
        {/* El foco se marca en el RECUADRO, no en el input: el campo es
            transparente y ocupa solo su renglón, así que un anillo en él se
            vería partido. `outline` y no `ring`, que en Tailwind es una
            sombra (CLAUDE.md § Sistema visual: sin sombras), y outline no
            empuja el layout. */}
        <div className="border-negro rounded-card focus-within:outline-negro flex items-center gap-4 border px-5 py-4 focus-within:outline-2 focus-within:outline-offset-2 sm:px-6 sm:py-5">
          <span className="text-texto-terciario text-[20px]" aria-hidden="true">
            ⌕
          </span>
          <input
            type="text"
            name="q"
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            onKeyDown={alTecleo}
            placeholder="Buscar por nombre, marca o código…"
            aria-label="Buscar en el catálogo"
            className="min-w-0 flex-1 bg-transparent text-[19px] tracking-[-0.02em] outline-none sm:text-[24px]"
          />
          <span className="text-texto-terciario hidden font-mono text-[11px] sm:ml-auto sm:block">
            Enter para buscar · Esc para limpiar
          </span>
        </div>
      </section>

      {!consulta ? (
        <section className="px-6 pt-6 sm:px-12">
          <p className="text-texto-terciario text-[15px]">Escribe para buscar en el catálogo.</p>
        </section>
      ) : (
        <>
          <section className="flex flex-col items-start gap-4 px-6 pt-8 pb-3 sm:flex-row sm:items-end sm:justify-between sm:px-12">
            <div className="flex flex-col gap-2.5">
              {/* h2, no h1: el h1 de la página es el «Buscar en el catálogo»
                  de arriba, y un lector de pantalla anunciaba dos títulos de
                  primer nivel. Se ve igual. */}
              <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">
                {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}
              </h2>
              <div className="text-texto-secundario text-[15px]">para «{consulta}»</div>
            </div>
            {resultados.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
                <button
                  type="button"
                  onClick={() => irA({ q: consulta })}
                  className={`rounded-full border px-4.5 py-3 lg:py-2 ${
                    !categoriaActiva
                      ? "border-negro bg-negro text-white"
                      : "border-borde-pildora text-texto-nav"
                  }`}
                >
                  Todo
                </button>
                {[...conteoPorCategoria.entries()].map(([categoria, cantidad]) => (
                  <button
                    key={categoria}
                    type="button"
                    onClick={() => irA({ q: consulta, categoria })}
                    className={`rounded-full border px-4.5 py-3 lg:py-2 ${
                      categoriaActiva === categoria
                        ? "border-negro bg-negro text-white"
                        : "border-borde-pildora text-texto-nav"
                    }`}
                  >
                    {categoria}{" "}
                    <span
                      className={
                        categoriaActiva === categoria
                          ? "text-texto-sobre-negro"
                          : "text-texto-terciario"
                      }
                    >
                      {cantidad}
                    </span>
                  </button>
                ))}
                <span className="border-negro bg-negro rounded-full border px-4.5 py-3 text-white lg:py-2">
                  Ordenar: relevancia
                </span>
              </div>
            ) : null}
          </section>

          <section className="px-6 pt-7 pb-16 sm:px-12 sm:pb-22">
            <ProductGrid
              productos={resultadosVisibles}
              emptyMessage={`No encontramos productos para «${consulta}».`}
            />
            {restantes > 0 ? (
              <div className="flex justify-center pt-10">
                <button
                  type="button"
                  onClick={() =>
                    irA({ q: consulta, categoria: categoriaActiva, ver: visibles + INCREMENTO })
                  }
                  className="border-borde-boton rounded-full border px-7 py-3.5 text-[15px]"
                >
                  Ver {Math.min(restantes, INCREMENTO)} resultados más
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
