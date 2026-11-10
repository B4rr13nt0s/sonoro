"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { claseBoton } from "@/components/ui/boton.ts";
import { ResultadosVehiculo } from "@/components/vehiculos/ResultadosVehiculo";
import { descargarDatosVehiculos } from "@/lib/vehiculos/carga.ts";
import { compatibilidad } from "@/lib/vehiculos/compatibilidad.ts";
import { ERROR_CARGA, tituloVehiculo } from "@/lib/vehiculos/textos.ts";
import type { DatosVehiculos } from "@/lib/vehiculos/types.ts";
import {
  hrefVehiculo,
  leerSeleccion,
  resolverSeleccion,
  type Seleccion,
} from "@/lib/vehiculos/url.ts";
import {
  buildVehicleInquiryMessage,
  buildWhatsAppUrl,
  WHATSAPP_NUMBER,
} from "@/lib/whatsapp/index.ts";

// El selector de vehículos de /buscar: marca, modelo y año (y versión cuando
// ese año tiene más de un tablero, o una sola fila que no es de todos los
// carros), y lo que cabe en ese vehículo. Es el panel de la pestaña «Por
// vehículo» de /buscar: el enlace propio no entraba en el nav a 1280 px
// (docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md y
// 2026-11-05-buscar-interfaz-design.md).
//
// Como el resto de /buscar, lo elegido vive en la dirección
// (/buscar?vehiculo=toyota&modelo=corolla&anio=2010) y cada cambio la
// REEMPLAZA: atrás sale de /buscar, y el enlace se puede compartir.

// La descarga se memoiza para toda la página: el fallback del <Suspense> y el
// bloque de adentro montan cada uno su selector, y no hace falta bajar el
// archivo dos veces. Un fallo se olvida, así «Reintentar» vuelve a pedirlo.
let descarga: Promise<DatosVehiculos | null> | null = null;
function obtenerDatos(): Promise<DatosVehiculos | null> {
  if (!descarga) {
    descarga = descargarDatosVehiculos().then((datos) => {
      if (!datos) descarga = null;
      return datos;
    });
  }
  return descarga;
}

type Carga =
  { estado: "cargando" } | { estado: "error" } | { estado: "listo"; datos: DatosVehiculos };

// Las listas del vehículo van más grandes que las de los filtros (texto de
// 15 px): son lo único de la pestaña y quedaban chicas al lado del campo.
// `appearance-none` quita la flecha nativa, que el navegador pega al borde de
// la píldora; la flecha la dibuja <ListaPildora>, más adentro. El pr-12 le
// deja sitio.
const CLASE_LISTA =
  "border-borde-pildora text-texto-nav w-full appearance-none rounded-full border bg-white py-3.5 pr-12 pl-5 text-[15px] sm:min-w-40";

function ListaPildora({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full sm:w-auto">
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 8"
        className="text-texto-nav pointer-events-none absolute top-1/2 right-5 h-2 w-3 -translate-y-1/2"
      >
        <path
          d="M1 1.5 6 6.5l5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
const CLASE_ENLACE = "text-negro underline underline-offset-2";

export function BusquedaPorVehiculo({
  busqueda,
}: {
  /** Los query params actuales, como texto: los mismos que lee la búsqueda. */
  busqueda: string;
}) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerDatos().then((datos) => {
      if (vigente) setCarga(datos ? { estado: "listo", datos } : { estado: "error" });
    });
    return () => {
      vigente = false;
    };
  }, [intento]);

  const datos = carga.estado === "listo" ? carga.datos : null;
  const resuelta = useMemo(
    () => (datos ? resolverSeleccion(datos.vehiculos, leerSeleccion(busqueda)) : null),
    [datos, busqueda],
  );
  const compat = useMemo(
    () => (datos && resuelta?.vehiculo ? compatibilidad(resuelta.vehiculo, datos) : null),
    [datos, resuelta],
  );

  // Sin nada elegido, hrefVehiculo deja `?por=vehiculo`: `/buscar` a secas
  // pasaría a la pestaña «Por producto».
  function cambiar(sel: Seleccion) {
    window.history.replaceState(null, "", hrefVehiculo(sel));
  }

  function reintentar() {
    setCarga({ estado: "cargando" });
    setIntento((n) => n + 1);
  }

  const marca = resuelta?.marca?.slug;
  const modelo = resuelta?.modelo?.slug;
  const anio = resuelta?.anio ?? undefined;
  const opciones = resuelta?.opciones;
  const conVersiones = (opciones?.versiones.length ?? 0) > 0;

  return (
    <section className="px-6 pt-6 sm:px-12 sm:pt-8">
      {carga.estado === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-texto-secundario text-[15px]">{ERROR_CARGA}</p>
          <div>
            <button
              type="button"
              onClick={reintentar}
              className={claseBoton("secundario", "compacto")}
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <ListaPildora>
            <select
              aria-label="Marca"
              value={marca ?? ""}
              disabled={!opciones}
              onChange={(e) => cambiar({ marca: e.target.value || undefined })}
              className={CLASE_LISTA}
            >
              <option value="">Marca</option>
              {opciones?.marcas.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </ListaPildora>
          <ListaPildora>
            <select
              aria-label="Modelo"
              value={modelo ?? ""}
              disabled={!marca}
              onChange={(e) => cambiar({ marca, modelo: e.target.value || undefined })}
              className={CLASE_LISTA}
            >
              <option value="">Modelo</option>
              {opciones?.modelos.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </ListaPildora>
          <ListaPildora>
            <select
              aria-label="Año"
              value={anio ?? ""}
              disabled={!modelo}
              onChange={(e) =>
                cambiar({
                  marca,
                  modelo,
                  anio: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={CLASE_LISTA}
            >
              <option value="">Año</option>
              {opciones?.anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </ListaPildora>
          {conVersiones ? (
            <ListaPildora>
              <select
                aria-label="Versión"
                value={resuelta?.version?.slug ?? ""}
                onChange={(e) =>
                  cambiar({ marca, modelo, anio, version: e.target.value || undefined })
                }
                className={CLASE_LISTA}
              >
                <option value="">Versión</option>
                {opciones?.versiones.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </ListaPildora>
          ) : null}
        </div>
      )}

      {/* pl-6 y mt-8: el texto se separa de las píldoras, y las pestañas de
          arriba (PestanasBuscar) arrancan en su mismo borde izquierdo. */}
      <p className="text-texto-secundario mt-8 pl-6 text-[14px]">
        ¿No está tu vehículo?{" "}
        <a
          href={buildWhatsAppUrl(WHATSAPP_NUMBER, buildVehicleInquiryMessage())}
          target="_blank"
          rel="noopener noreferrer"
          className={CLASE_ENLACE}
        >
          Escríbenos por WhatsApp
        </a>
        .
      </p>

      {resuelta?.vehiculo && resuelta.anio !== null && compat ? (
        <ResultadosVehiculo
          titulo={tituloVehiculo(resuelta.vehiculo, resuelta.anio)}
          compat={compat}
        />
      ) : null}
    </section>
  );
}
