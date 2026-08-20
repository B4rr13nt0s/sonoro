"use client";

import { useMemo, useState } from "react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import type { Producto } from "@/lib/catalog/index.ts";

const INCREMENTO = 8;

// Marcas diacríticas combinantes (U+0300–U+036F) que quedan sueltas después
// de normalize("NFD") — construido con RegExp + \\u en vez de un literal de
// clase de caracteres para no dejar marcas combinantes invisibles pegadas al
// código fuente.
const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLowerCase().trim();
}

function coincide(producto: Producto, consultaNormalizada: string): boolean {
  return (
    normalizar(producto.nombre).includes(consultaNormalizada) ||
    normalizar(producto.marca).includes(consultaNormalizada) ||
    normalizar(producto.sku).includes(consultaNormalizada)
  );
}

// Relevancia simple, no una búsqueda con backend: match exacto de sku o
// nombre pesa más que "empieza con", que pesa más que "contiene en
// cualquier parte". Suficiente para ordenar sin depender de nada externo.
function puntuarRelevancia(producto: Producto, consultaNormalizada: string): number {
  const nombre = normalizar(producto.nombre);
  const marca = normalizar(producto.marca);
  const sku = normalizar(producto.sku);

  if (sku === consultaNormalizada) return 100;
  if (nombre === consultaNormalizada) return 90;
  if (sku.startsWith(consultaNormalizada)) return 80;
  if (nombre.startsWith(consultaNormalizada)) return 70;
  if (marca.startsWith(consultaNormalizada)) return 60;
  if (nombre.includes(consultaNormalizada)) return 50;
  if (marca.includes(consultaNormalizada)) return 40;
  return 30; // sku.includes — ya se sabe que coincide() dio true en algún campo
}

export function SearchExperience({ productos }: { productos: Producto[] }) {
  const [borrador, setBorrador] = useState("");
  const [consulta, setConsulta] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(INCREMENTO);

  function ejecutarBusqueda(valor: string) {
    setConsulta(valor.trim());
    setCategoriaActiva(null);
    setVisibles(INCREMENTO);
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
    return productos
      .filter((producto) => coincide(producto, q))
      .map((producto) => ({ producto, puntaje: puntuarRelevancia(producto, q) }))
      .sort((a, b) => b.puntaje - a.puntaje)
      .map((r) => r.producto);
  }, [productos, consulta]);

  const conteoPorCategoria = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const producto of resultados) {
      conteo.set(producto.categoria, (conteo.get(producto.categoria) ?? 0) + 1);
    }
    return conteo;
  }, [resultados]);

  const resultadosFiltrados = categoriaActiva
    ? resultados.filter((producto) => producto.categoria === categoriaActiva)
    : resultados;
  const resultadosVisibles = resultadosFiltrados.slice(0, visibles);
  const restantes = resultadosFiltrados.length - resultadosVisibles.length;

  return (
    <div className="flex flex-col">
      <section className="px-6 pt-10 sm:px-12 sm:pt-14">
        <div className="border-negro rounded-card flex items-center gap-4 border px-5 py-4 sm:px-6 sm:py-5">
          <span className="text-texto-terciario text-[20px]" aria-hidden="true">
            ⌕
          </span>
          <input
            type="text"
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
              <h1 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">
                {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}
              </h1>
              <div className="text-texto-secundario text-[15px]">para «{consulta}»</div>
            </div>
            {resultados.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    setCategoriaActiva(null);
                    setVisibles(INCREMENTO);
                  }}
                  className={`rounded-full border px-4.5 py-2 ${
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
                    onClick={() => {
                      setCategoriaActiva(categoria);
                      setVisibles(INCREMENTO);
                    }}
                    className={`rounded-full border px-4.5 py-2 ${
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
                <span className="border-negro bg-negro rounded-full border px-4.5 py-2 text-white">
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
                  onClick={() => setVisibles((valor) => valor + INCREMENTO)}
                  className="rounded-full border border-[#d6d6d2] px-7 py-3.5 text-[15px]"
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
