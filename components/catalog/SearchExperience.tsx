"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { SinResultadosBusqueda } from "@/components/catalog/SinResultadosBusqueda";
import { SugerenciasBusqueda, type ItemSugerencia } from "@/components/catalog/SugerenciasBusqueda";
import type { Disponibilidad } from "@/lib/catalog/index.ts";
import {
  CATEGORIA_SISTEMAS,
  CATEGORIAS_SITIO,
  perteneceACategoria,
} from "@/lib/catalog/categorias.ts";
import {
  compararPrecioAsc,
  compararPrecioDesc,
  compararRelevancia,
  compararTexto,
} from "@/lib/catalog/orden.ts";
import { formatQ } from "@/lib/format/precio.ts";

import { buscar, sugerir, type ProductoBuscable } from "./busqueda.ts";

const INCREMENTO = 8;

type Marca = { nombre: string; slug: string };

const ORDENES = {
  relevancia: "Ordenar: relevancia",
  precio_asc: "Ordenar: precio de menor a mayor",
  precio_desc: "Ordenar: precio de mayor a menor",
} as const;
type Orden = keyof typeof ORDENES;

const DISPONIBILIDADES: Record<Disponibilidad, string> = {
  disponible: "Disponible",
  bajo_pedido: "Bajo pedido",
  agotado: "Agotado",
};

const CLASE_PILDORA = "rounded-full border px-4.5 py-3 lg:py-2";
const CLASE_SELECT =
  "border-borde-pildora text-texto-nav rounded-full border bg-white px-4.5 py-3 text-[13px] lg:py-2";

/**
 * Lee la búsqueda de la URL. Aparte de `Busqueda` para que app/buscar/page.tsx
 * pueda envolver SOLO esto en un <Suspense>: useSearchParams no existe al
 * prerenderizar, y el fallback dibuja la misma búsqueda vacía mientras tanto.
 */
export function SearchExperience({
  productos,
  marcas,
}: {
  productos: ProductoBuscable[];
  marcas: Marca[];
}) {
  return <Busqueda productos={productos} marcas={marcas} busqueda={useSearchParams().toString()} />;
}

/** «Ver más» empieza en INCREMENTO; lo que no sea un entero mayor, también. */
function leerVisibles(valor: string | null): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > INCREMENTO ? numero : INCREMENTO;
}

function leerOrden(valor: string | null): Orden {
  return valor !== null && Object.hasOwn(ORDENES, valor) ? (valor as Orden) : "relevancia";
}

function leerDisponibilidad(valor: string | null): Disponibilidad | null {
  return valor !== null && Object.hasOwn(DISPONIBILIDADES, valor)
    ? (valor as Disponibilidad)
    : null;
}

interface Estado {
  q: string;
  categoria?: string | null;
  marca?: string | null;
  disp?: Disponibilidad | null;
  orden?: Orden;
  ver?: number;
}

interface Filtros {
  categoria: string | null;
  marca: string | null;
  disp: Disponibilidad | null;
}

/** Pasa los filtros activos; `omitir` deja uno por fuera, para contar sus opciones. */
function pasa(producto: ProductoBuscable, filtros: Filtros, omitir?: keyof Filtros): boolean {
  return (
    (omitir === "categoria" ||
      !filtros.categoria ||
      perteneceACategoria(producto, filtros.categoria)) &&
    (omitir === "marca" || !filtros.marca || producto.marca === filtros.marca) &&
    (omitir === "disp" || !filtros.disp || producto.disponibilidad === filtros.disp)
  );
}

/**
 * La búsqueda entera vive en la URL
 * —`/buscar?q=memphis&categoria=Amplificadores&marca=Memphis&orden=precio_asc&ver=24`—,
 * no en el estado: con ella solo en React, volver atrás desde un resultado la
 * dejaba en blanco —y la búsqueda es la ruta principal de navegación
 * (CLAUDE.md § Patrones)—, y no se podía compartir. Con solo la consulta en
 * la URL, el filtro por categoría y los «Ver más» se perdían igual, y el
 * resultado del que se volvía ya no estaba en pantalla.
 */
export function Busqueda({
  productos,
  marcas,
  busqueda,
}: {
  productos: ProductoBuscable[];
  marcas: Marca[];
  /** Los query params actuales, como texto (`q=memphis&ver=16`). */
  busqueda: string;
}) {
  const router = useRouter();
  const idLista = useId();
  const params = useMemo(() => new URLSearchParams(busqueda), [busqueda]);
  const consulta = (params.get("q") ?? "").trim();
  const categoriaPedida = params.get("categoria");
  const marcaPedida = params.get("marca");
  const dispPedida = leerDisponibilidad(params.get("disp"));
  const ordenActivo = leerOrden(params.get("orden"));
  const visibles = leerVisibles(params.get("ver"));
  const [borrador, setBorrador] = useState(consulta);
  // La lista de sugerencias: abierta solo mientras se teclea, no al volver al
  // campo con la consulta ya ejecutada.
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);

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
  function irA({ q, categoria, marca, disp, orden, ver }: Estado) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (q && categoria) query.set("categoria", categoria);
    if (q && marca) query.set("marca", marca);
    if (q && disp) query.set("disp", disp);
    if (q && orden && orden !== "relevancia") query.set("orden", orden);
    if (q && ver && ver > INCREMENTO) query.set("ver", String(ver));
    const texto = query.toString();
    window.history.replaceState(null, "", texto ? `/buscar?${texto}` : "/buscar");
  }

  function ejecutarBusqueda(valor: string) {
    setAbierto(false);
    setActivo(-1);
    irA({ q: valor.trim() });
  }

  // La búsqueda completa de la consulta ejecutada: ya viene por puntaje de
  // coincidencia de TEXTO, y los empates se rompen con el orden «relevancia»
  // de los listados (destacado → precio ↓ → sku). Sin él, los cubos grandes
  // salían en el orden crudo de la hoja de cálculo.
  const resultado = useMemo(
    () => (consulta ? buscar(productos, consulta, compararRelevancia) : null),
    [productos, consulta],
  );
  const base = useMemo(() => resultado?.productos ?? [], [resultado]);

  // Los filtros pedidos en la URL que no existen entre los resultados (enlace
  // viejo, o una consulta nueva) no filtran: se ve «Todo».
  const filtros: Filtros = useMemo(() => {
    const categorias = new Set<string>();
    const marcasEnBase = new Set<string>();
    for (const producto of base) {
      for (const c of [producto.categoria, ...(producto.categoriasSecundarias ?? [])]) {
        categorias.add(c);
      }
      marcasEnBase.add(producto.marca);
    }
    return {
      categoria: categoriaPedida && categorias.has(categoriaPedida) ? categoriaPedida : null,
      marca: marcaPedida && marcasEnBase.has(marcaPedida) ? marcaPedida : null,
      disp: dispPedida && base.some((p) => p.disponibilidad === dispPedida) ? dispPedida : null,
    };
  }, [base, categoriaPedida, marcaPedida, dispPedida]);

  // Las píldoras cuentan con la misma regla que los listados
  // (perteneceACategoria): un Sistema cuenta en las categorías que trae como
  // secundarias, y «Sistemas» no es píldora porque no tiene página. Con solo
  // la categoría principal aparecía una píldora «Sistemas», y al filtrar por
  // Subwoofers desaparecía un sistema que /catalogo/subwoofers sí lista.
  // Cada grupo de opciones cuenta con los OTROS filtros puestos, no con el suyo.
  const conteoPorCategoria = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const producto of base) {
      if (!pasa(producto, filtros, "categoria")) continue;
      for (const c of [producto.categoria, ...(producto.categoriasSecundarias ?? [])]) {
        if (c === CATEGORIA_SISTEMAS) continue;
        conteo.set(c, (conteo.get(c) ?? 0) + 1);
      }
    }
    return conteo;
  }, [base, filtros]);

  const conteoPorMarca = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const producto of base) {
      if (pasa(producto, filtros, "marca")) {
        conteo.set(producto.marca, (conteo.get(producto.marca) ?? 0) + 1);
      }
    }
    return [...conteo.entries()].sort((a, b) => b[1] - a[1] || compararTexto(a[0], b[0]));
  }, [base, filtros]);

  const conteoPorDisp = useMemo(() => {
    const conteo = new Map<Disponibilidad, number>();
    for (const producto of base) {
      if (pasa(producto, filtros, "disp")) {
        conteo.set(producto.disponibilidad, (conteo.get(producto.disponibilidad) ?? 0) + 1);
      }
    }
    return conteo;
  }, [base, filtros]);

  const resultadosFiltrados = useMemo(() => {
    const lista = base.filter((producto) => pasa(producto, filtros));
    if (ordenActivo === "precio_asc") return [...lista].sort(compararPrecioAsc);
    if (ordenActivo === "precio_desc") return [...lista].sort(compararPrecioDesc);
    return lista;
  }, [base, filtros, ordenActivo]);
  const resultadosVisibles = resultadosFiltrados.slice(0, visibles);
  const restantes = resultadosFiltrados.length - resultadosVisibles.length;
  const hayFiltros = Boolean(filtros.categoria || filtros.marca || filtros.disp);

  // Los filtros de hoy, para cambiar solo uno. Al cambiar la lista, «Ver más»
  // vuelve a empezar.
  const actual: Estado = {
    q: consulta,
    categoria: filtros.categoria,
    marca: filtros.marca,
    disp: filtros.disp,
    orden: ordenActivo,
  };
  const cambiar = (parcial: Partial<Estado>) => irA({ ...actual, ...parcial });

  // Lo que se ofrece mientras se teclea.
  const sugerencias = useMemo(
    () => sugerir(productos, marcas, CATEGORIAS_SITIO, borrador, compararRelevancia),
    [productos, marcas, borrador],
  );
  const items: ItemSugerencia[] = useMemo(() => {
    const lista: ItemSugerencia[] = [
      ...sugerencias.marcas.map((m) => ({
        id: `marca-${m.slug}`,
        tipo: "marca" as const,
        texto: m.nombre,
        href: `/marcas/${m.slug}`,
      })),
      ...sugerencias.categorias.map((c) => ({
        id: `categoria-${c.slug}`,
        tipo: "categoria" as const,
        texto: c.nombre,
        href: `/catalogo/${c.slug}`,
      })),
      ...sugerencias.productos.map((p) => ({
        id: `producto-${p.sku}`,
        tipo: "producto" as const,
        texto: p.nombre,
        detalle: `${p.marca} · ${p.sku}`,
        precio: formatQ(p.precioCents),
        href: `/producto/${p.slug}`,
      })),
    ];
    // La salida de siempre al final: buscar lo escrito, sin elegir nada.
    return lista.length > 0
      ? [...lista, { id: "buscar", tipo: "buscar" as const, texto: `Buscar «${borrador.trim()}»` }]
      : lista;
  }, [sugerencias, borrador]);
  const mostrarSugerencias = abierto && borrador.trim().length >= 2 && items.length > 0;

  function elegir(item: ItemSugerencia) {
    setAbierto(false);
    setActivo(-1);
    if (item.href) router.push(item.href);
    else ejecutarBusqueda(borrador);
  }

  function alTecleo(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      if (!mostrarSugerencias) return;
      evento.preventDefault();
      const paso = evento.key === "ArrowDown" ? 1 : -1;
      // De -1 (ninguna) a la última opción, dando la vuelta.
      setActivo((a) => ((a + 1 + paso + items.length + 1) % (items.length + 1)) - 1);
    } else if (evento.key === "Enter") {
      const elegido = mostrarSugerencias ? items[activo] : undefined;
      if (elegido) elegir(elegido);
      else ejecutarBusqueda(borrador);
    } else if (evento.key === "Escape") {
      // Primero cierra la lista; con la lista cerrada, limpia.
      if (mostrarSugerencias) {
        setAbierto(false);
        setActivo(-1);
      } else {
        setBorrador("");
        ejecutarBusqueda("");
      }
    }
  }

  // Marcas y categorías cercanas a lo escrito, para la página sin resultados.
  const relacionadas = useMemo(() => {
    const marcasCerca = new Map<string, Marca>();
    const categoriasCerca = new Map<string, Marca>();
    if (consulta && base.length === 0) {
      for (const palabra of consulta.split(/\s+/)) {
        const s = sugerir(productos, marcas, CATEGORIAS_SITIO, palabra, compararRelevancia);
        for (const m of s.marcas) marcasCerca.set(m.slug, m);
        for (const c of s.categorias) categoriasCerca.set(c.slug, c);
      }
    }
    return { marcas: [...marcasCerca.values()], categorias: [...categoriasCerca.values()] };
  }, [consulta, base, productos, marcas]);

  const opcionesMarca = conteoPorMarca.filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col">
      <section className="px-6 pt-10 sm:px-12 sm:pt-14">
        {/* La página no tenía NINGÚN encabezado: el diseño abre directo con el
            campo. El h1 le dice a Google y al lector de pantalla de qué trata
            sin agregar un titular que el diseño no tiene — mismo patrón que
            /marcas/[marca]. */}
        <h1 className="sr-only">Buscar en el catálogo</h1>
        <div className="relative">
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
              role="combobox"
              aria-expanded={mostrarSugerencias}
              aria-controls={mostrarSugerencias ? idLista : undefined}
              aria-activedescendant={
                mostrarSugerencias && activo >= 0 ? `${idLista}-${activo}` : undefined
              }
              aria-autocomplete="list"
              autoComplete="off"
              value={borrador}
              onChange={(evento) => {
                setBorrador(evento.target.value);
                setAbierto(true);
                setActivo(-1);
              }}
              onKeyDown={alTecleo}
              onBlur={() => setAbierto(false)}
              placeholder="Buscar por nombre, marca o código…"
              aria-label="Buscar en el catálogo"
              className="min-w-0 flex-1 bg-transparent text-[19px] tracking-[-0.02em] outline-none sm:text-[24px]"
            />
            <span className="text-texto-terciario hidden font-mono text-[11px] sm:ml-auto sm:block">
              Enter para buscar · Esc para limpiar
            </span>
          </div>
          {mostrarSugerencias ? (
            <SugerenciasBusqueda id={idLista} items={items} activo={activo} alElegir={elegir} />
          ) : null}
        </div>
      </section>

      {!consulta ? (
        <section className="px-6 pt-6 sm:px-12">
          <p className="text-texto-terciario text-[15px]">Escribe para buscar en el catálogo.</p>
        </section>
      ) : (
        <>
          <section className="flex flex-col items-start gap-4 px-6 pt-8 pb-3 sm:px-12">
            <div className="flex flex-col gap-2.5">
              {/* h2, no h1: el h1 de la página es el «Buscar en el catálogo»
                  de arriba, y un lector de pantalla anunciaba dos títulos de
                  primer nivel. Se ve igual. */}
              <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">
                {base.length} {base.length === 1 ? "resultado" : "resultados"}
              </h2>
              <div className="text-texto-secundario text-[15px]">para «{consulta}»</div>
            </div>

            {/* Lo que la búsqueda hizo por su cuenta, dicho: nunca se
                cambian los resultados sin avisar. */}
            {resultado && resultado.modo !== "exacta" && base.length > 0 ? (
              <p role="status" className="text-texto-secundario text-[15px]">
                {resultado.modo === "parcial"
                  ? "Ningún producto coincide con todo lo que escribiste; estos coinciden con alguna palabra."
                  : "No hay coincidencias exactas; estos se le parecen."}
                {resultado.correccion ? (
                  <>
                    {" "}
                    Quizá quisiste decir{" "}
                    <button
                      type="button"
                      onClick={() => ejecutarBusqueda(resultado.correccion ?? "")}
                      className="text-negro underline"
                    >
                      «{resultado.correccion}»
                    </button>
                    .
                  </>
                ) : null}
              </p>
            ) : null}

            {base.length > 0 ? (
              <div className="flex flex-col gap-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => cambiar({ categoria: null })}
                    className={`${CLASE_PILDORA} ${
                      !filtros.categoria
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
                      onClick={() => cambiar({ categoria })}
                      className={`${CLASE_PILDORA} ${
                        filtros.categoria === categoria
                          ? "border-negro bg-negro text-white"
                          : "border-borde-pildora text-texto-nav"
                      }`}
                    >
                      {categoria}{" "}
                      <span
                        className={
                          filtros.categoria === categoria
                            ? "text-texto-sobre-negro"
                            : "text-texto-terciario"
                        }
                      >
                        {cantidad}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {opcionesMarca.length > 1 || filtros.marca ? (
                    <select
                      aria-label="Filtrar por marca"
                      value={filtros.marca ?? ""}
                      onChange={(e) => cambiar({ marca: e.target.value || null })}
                      className={CLASE_SELECT}
                    >
                      <option value="">Todas las marcas</option>
                      {opcionesMarca.map(([marca, cantidad]) => (
                        <option key={marca} value={marca}>
                          {marca} ({cantidad})
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <select
                    aria-label="Filtrar por disponibilidad"
                    value={filtros.disp ?? ""}
                    onChange={(e) => cambiar({ disp: leerDisponibilidad(e.target.value) })}
                    className={CLASE_SELECT}
                  >
                    <option value="">Cualquier disponibilidad</option>
                    {(Object.keys(DISPONIBILIDADES) as Disponibilidad[]).map((d) => {
                      const cantidad = conteoPorDisp.get(d) ?? 0;
                      return (
                        <option key={d} value={d} disabled={cantidad === 0 && filtros.disp !== d}>
                          {DISPONIBILIDADES[d]} ({cantidad})
                        </option>
                      );
                    })}
                  </select>
                  <select
                    aria-label="Ordenar resultados"
                    value={ordenActivo}
                    onChange={(e) => cambiar({ orden: leerOrden(e.target.value) })}
                    className={`${CLASE_SELECT} border-negro`}
                  >
                    {(Object.keys(ORDENES) as Orden[]).map((o) => (
                      <option key={o} value={o}>
                        {ORDENES[o]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </section>

          <section className="px-6 pt-7 pb-16 sm:px-12 sm:pb-22">
            {base.length === 0 ? (
              <SinResultadosBusqueda
                consulta={consulta}
                correccion={resultado?.correccion ?? null}
                marcas={relacionadas.marcas}
                categorias={relacionadas.categorias}
                alCorregir={ejecutarBusqueda}
              />
            ) : (
              <>
                <ProductGrid
                  productos={resultadosVisibles}
                  emptyMessage="Ningún resultado con estos filtros."
                />
                {resultadosFiltrados.length === 0 && hayFiltros ? (
                  <div className="flex justify-center pt-6">
                    <button
                      type="button"
                      onClick={() => cambiar({ categoria: null, marca: null, disp: null })}
                      className="border-borde-boton rounded-full border px-7 py-3.5 text-[15px]"
                    >
                      Quitar filtros
                    </button>
                  </div>
                ) : null}
                {restantes > 0 ? (
                  <div className="flex justify-center pt-10">
                    <button
                      type="button"
                      onClick={() => cambiar({ ver: visibles + INCREMENTO })}
                      className="border-borde-boton rounded-full border px-7 py-3.5 text-[15px]"
                    >
                      Ver {Math.min(restantes, INCREMENTO)} resultados más
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
