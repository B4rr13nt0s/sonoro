"use client";

// Cotizador privado (docs/superpowers/specs/2026-11-16-cotizador-design.md):
// busca en el catálogo con el mismo motor de /buscar, arma una cotización y
// deja el mensaje listo para copiar. No es el carrito ni sabe nada de
// WhatsApp: tiene su propio estado (lib/cotizador/borrador.ts) y no registra
// nada en la hoja.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { claseBoton, claseBotonInactivo } from "@/components/ui/boton.ts";
import { buscar, type ProductoBuscable } from "@/lib/busqueda/busqueda.ts";
import { etiquetaDisponibilidad } from "@/lib/catalog/disponibilidad.ts";
import { compararRelevancia } from "@/lib/catalog/orden.ts";
import {
  BORRADOR_VACIO,
  borradorReducer,
  guardarBorrador,
  leerBorrador,
  resolverBorrador,
  type AccionBorrador,
  type Borrador,
} from "@/lib/cotizador/borrador.ts";
import { MAX_CLIENTE, buildQuoteMessage } from "@/lib/cotizador/mensaje.ts";
import { copiarTexto } from "@/lib/cotizador/portapapeles.ts";
import { MAX_CANTIDAD_POR_LINEA } from "@/lib/cart/index.ts";
import { formatQ } from "@/lib/format/precio.ts";

const MAX_RESULTADOS = 12;

// localStorage puede lanzar con solo tocarlo (modo privado, datos de sitio
// bloqueados): sin almacén la cotización funciona igual, solo no sobrevive a
// una recarga.
function almacenLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// El borrador más lo que solo importa a esta pantalla. `hidratado` y `avisados`
// viven en el mismo reductor, y no en useState, para que cargar lo guardado y
// avisar de lo retirado sean UNA actualización cada vez (y porque React no
// quiere setState síncrono dentro de un efecto).
type Estado = { borrador: Borrador; hidratado: boolean; avisados: string[] };
type Accion = AccionBorrador | { type: "retirar"; skus: string[] } | { type: "cerrarAviso" };

const ESTADO_INICIAL: Estado = { borrador: BORRADOR_VACIO, hidratado: false, avisados: [] };

function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.type) {
    case "cargar":
      return { ...estado, borrador: accion.borrador, hidratado: true };
    case "retirar":
      return {
        ...estado,
        borrador: {
          ...estado.borrador,
          lineas: estado.borrador.lineas.filter((l) => !accion.skus.includes(l.sku)),
        },
        avisados: [...new Set([...estado.avisados, ...accion.skus])],
      };
    case "cerrarAviso":
      return { ...estado, avisados: [] };
    default:
      return { ...estado, borrador: borradorReducer(estado.borrador, accion) };
  }
}

const CLASE_CAMPO =
  "border-borde-pildora rounded-field w-full min-w-0 border bg-white px-4 py-3 text-[16px]";

export function Cotizador({ productos }: { productos: ProductoBuscable[] }) {
  const [{ borrador, hidratado, avisados }, despachar] = useReducer(reducir, ESTADO_INICIAL);
  const [consulta, setConsulta] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [copia, setCopia] = useState<{ mensaje: string; ok: boolean } | null>(null);
  const areaMensaje = useRef<HTMLTextAreaElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    despachar({ type: "cargar", borrador: leerBorrador(almacenLocal()) });
  }, []);

  // Hasta leer lo guardado NO se guarda: el borrador inicial es el vacío, y
  // escribirlo pisaría la cotización que quedó de la visita anterior.
  useEffect(() => {
    if (hidratado) guardarBorrador(almacenLocal(), borrador);
  }, [borrador, hidratado]);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const { lineas, quitados } = useMemo(
    () => resolverBorrador(borrador, productos),
    [borrador, productos],
  );

  // Lo que ya no está a la venta se quita del borrador y se avisa, como en
  // /carrito. Solo tras hidratar: antes el borrador es el vacío.
  useEffect(() => {
    if (!hidratado || quitados.length === 0) return;
    despachar({ type: "retirar", skus: quitados });
  }, [hidratado, quitados]);

  // El resultado ENTERO, no solo `.productos`: el motor avisa cuando lo que
  // devuelve no es lo que se escribió (aproximado, parcial, la medida más
  // cercana) y qué filtros salieron de la consulta. Sin eso, «subwoofer 6
  // pulgadas» listaba los de 6.5" como si fueran de 6".
  const resultado = useMemo(
    () => (consulta.trim() ? buscar(productos, consulta, compararRelevancia) : null),
    [productos, consulta],
  );
  const encontrados = resultado?.productos ?? [];
  const resultados = verTodos ? encontrados : encontrados.slice(0, MAX_RESULTADOS);

  const mensaje = buildQuoteMessage({ cliente: borrador.cliente, lineas });

  // «Copiado» solo vale para el mensaje que se copió: si la cotización cambia
  // en los 2 s siguientes, el botón vuelve a «Copiar» (el portapapeles tiene la
  // versión anterior). Y si la copia falla, el botón lo dice: Byron no pega lo
  // que hubiera de antes creyendo que es esta cotización.
  const textoBoton =
    copia && copia.mensaje === mensaje ? (copia.ok ? "Copiado" : "No se pudo copiar") : "Copiar";

  async function copiar() {
    const ok = await copiarTexto(mensaje, {
      escribir: navigator.clipboard?.writeText.bind(navigator.clipboard),
      // La vía vieja deja el texto seleccionado: si también falla, se puede
      // copiar a mano con Ctrl+C.
      copiarSeleccion: () => {
        areaMensaje.current?.select();
        return document.execCommand("copy");
      },
    });
    setCopia({ mensaje, ok });
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopia(null), 2000);
  }

  return (
    <div className="grid grid-cols-1 gap-8 px-6 pb-16 sm:px-12 sm:pb-22 lg:grid-cols-[1fr_420px] lg:items-start lg:gap-12">
      <section className="flex flex-col gap-4" aria-label="Buscar productos">
        <input
          type="text"
          value={consulta}
          onChange={(evento) => {
            setConsulta(evento.target.value);
            setVerTodos(false);
          }}
          placeholder="Nombre, marca o código"
          aria-label="Buscar productos"
          autoComplete="off"
          className={CLASE_CAMPO}
        />
        {resultado && resultado.aplicados.length > 0 ? (
          <p className="text-texto-secundario text-[14px]">
            Filtros de la búsqueda: {resultado.aplicados.join(" · ")}
          </p>
        ) : null}
        {resultado && resultado.modo !== "exacta" && encontrados.length > 0 ? (
          <p role="status" className="text-texto-secundario text-[14px]">
            {resultado.modo === "cercana"
              ? resultado.cercania
              : resultado.modo === "parcial"
                ? "Ninguno coincide con todo lo escrito; estos coinciden con alguna palabra."
                : "No hay coincidencias exactas; estos se le parecen."}
            {resultado.correccion ? (
              <>
                {" "}
                Quizá quisiste decir{" "}
                <button
                  type="button"
                  onClick={() => {
                    setConsulta(resultado.correccion ?? "");
                    setVerTodos(false);
                  }}
                  className="text-negro underline"
                >
                  «{resultado.correccion}»
                </button>
                .
              </>
            ) : null}
          </p>
        ) : null}
        {resultado && encontrados.length === 0 ? (
          <p className="text-texto-secundario text-[15px]">Sin resultados.</p>
        ) : null}
        <ul className="flex flex-col">
          {resultados.map((producto) => {
            const etiqueta = etiquetaDisponibilidad(producto.disponibilidad);
            const agotado = producto.disponibilidad === "agotado";
            return (
              <li
                key={producto.sku}
                className="border-borde-tarjeta flex items-center gap-4 border-t py-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[16px] font-semibold tracking-[-0.015em]">
                    {producto.nombre}
                  </span>
                  <span className="text-texto-secundario text-[14px]">
                    {formatQ(producto.precioCents)}
                    {etiqueta ? ` · ${etiqueta}` : ""}
                  </span>
                </div>
                <div className="flex w-[110px] flex-none">
                  <button
                    type="button"
                    disabled={agotado}
                    onClick={() => despachar({ type: "agregar", sku: producto.sku })}
                    aria-label={
                      agotado ? `${producto.nombre}: agotado` : `Agregar ${producto.nombre}`
                    }
                    className={
                      agotado
                        ? claseBotonInactivo("secundario", "compacto")
                        : claseBoton("secundario", "compacto")
                    }
                  >
                    {agotado ? "Agotado" : "Agregar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {encontrados.length > resultados.length ? (
          <div className="text-texto-secundario flex items-center justify-between gap-3 text-[14px]">
            <span>
              Mostrando {resultados.length} de {encontrados.length}.
            </span>
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              className="text-negro underline"
            >
              Ver todos
            </button>
          </div>
        ) : null}
      </section>

      <section
        className="border-borde-tarjeta rounded-card-lg flex flex-col gap-5 border p-6 sm:p-8"
        aria-label="Cotización"
      >
        <label className="flex flex-col gap-2 text-[14px]">
          <span className="text-texto-secundario">Cliente (opcional)</span>
          <input
            type="text"
            value={borrador.cliente}
            maxLength={MAX_CLIENTE}
            onChange={(evento) => despachar({ type: "cliente", texto: evento.target.value })}
            autoComplete="off"
            className={CLASE_CAMPO}
          />
        </label>

        {avisados.length > 0 ? (
          <div
            role="status"
            className="border-borde-tarjeta rounded-card text-texto-secundario flex items-start justify-between gap-3 border p-4 text-[14px]"
          >
            <span>
              Se quitaron de la cotización productos que ya no están disponibles:{" "}
              {avisados.join(", ")}.
            </span>
            <button
              type="button"
              onClick={() => despachar({ type: "cerrarAviso" })}
              className="flex-none"
            >
              Cerrar
            </button>
          </div>
        ) : null}

        <ul className="flex flex-col">
          {lineas.map((linea) => (
            <li key={linea.sku} className="border-borde-tarjeta flex flex-col gap-2 border-t py-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[15px] font-semibold">{linea.nombre}</span>
                <span className="flex-none text-[15px] font-semibold">
                  {formatQ(linea.qty * linea.unitPriceCents)}
                </span>
              </div>
              <div className="text-texto-secundario flex items-center justify-between gap-3 text-[14px]">
                <div className="border-borde-pildora flex items-center rounded-full border">
                  <button
                    type="button"
                    aria-label={`Quitar una unidad de ${linea.nombre}`}
                    onClick={() =>
                      despachar({ type: "cantidad", sku: linea.sku, qty: linea.qty - 1 })
                    }
                    className="flex h-10 w-10 items-center justify-center text-[16px]"
                  >
                    −
                  </button>
                  <span className="text-negro min-w-[24px] text-center text-[15px] font-medium">
                    {linea.qty}
                  </span>
                  <button
                    type="button"
                    aria-label={`Agregar una unidad de ${linea.nombre}`}
                    disabled={linea.qty >= MAX_CANTIDAD_POR_LINEA}
                    onClick={() =>
                      despachar({ type: "cantidad", sku: linea.sku, qty: linea.qty + 1 })
                    }
                    className="flex h-10 w-10 items-center justify-center text-[16px] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <span>{formatQ(linea.unitPriceCents)} c/u</span>
                <button
                  type="button"
                  aria-label={`Quitar ${linea.nombre} de la cotización`}
                  onClick={() => despachar({ type: "quitar", sku: linea.sku })}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <label className="flex flex-col gap-2 text-[14px]">
          <span className="text-texto-secundario">Mensaje</span>
          <textarea
            ref={areaMensaje}
            readOnly
            value={mensaje}
            rows={12}
            aria-label="Mensaje de la cotización"
            className={`${CLASE_CAMPO} resize-y font-mono text-[13px]`}
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={mensaje === ""}
            onClick={copiar}
            className={mensaje === "" ? claseBotonInactivo("principal") : claseBoton("principal")}
          >
            {textoBoton}
          </button>
          <button
            type="button"
            onClick={() => despachar({ type: "vaciar" })}
            className={claseBoton("secundario")}
          >
            Vaciar
          </button>
        </div>
      </section>
    </div>
  );
}
