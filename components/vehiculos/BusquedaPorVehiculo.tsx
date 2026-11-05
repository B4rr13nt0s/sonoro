"use client";

import { useEffect, useMemo, useState } from "react";

import { claseBoton } from "@/components/ui/boton.ts";
import { CLASE_SELECT } from "@/components/ui/campos.ts";
import { ResultadosVehiculo } from "@/components/vehiculos/ResultadosVehiculo";
import { descargarDatosVehiculos } from "@/lib/vehiculos/carga.ts";
import { compatibilidad } from "@/lib/vehiculos/compatibilidad.ts";
import { ERROR_CARGA, tituloVehiculo } from "@/lib/vehiculos/textos.ts";
import type { DatosVehiculos } from "@/lib/vehiculos/types.ts";
import {
  escribirSeleccion,
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
// ese año tiene más de un tablero), y lo que cabe en ese vehículo. Vive en el
// estado vacío de la búsqueda —sin nada escrito—, porque el enlace propio no
// entraba en el nav a 1280 px (docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md).
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

const CLASE_LISTA = `${CLASE_SELECT} w-full sm:w-auto`;
const CLASE_ENLACE = "text-negro underline underline-offset-2";

export function BusquedaPorVehiculo({
  busqueda,
  urlBuscar,
}: {
  /** Los query params actuales, como texto: los mismos que lee la búsqueda. */
  busqueda: string;
  /** La URL absoluta de /buscar, resuelta en el servidor. */
  urlBuscar: string;
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

  function cambiar(sel: Seleccion) {
    const q = escribirSeleccion(sel);
    window.history.replaceState(null, "", q ? `/buscar?${q}` : "/buscar");
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
    <section className="px-6 pt-10 sm:px-12">
      <h2 className="text-22 font-semibold tracking-[-0.02em]">
        Receptores y bocinas por vehículo
      </h2>

      {carga.estado === "error" ? (
        <div className="mt-4 flex flex-col items-start gap-3">
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
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
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
          <select
            aria-label="Año"
            value={anio ?? ""}
            disabled={!modelo}
            onChange={(e) =>
              cambiar({ marca, modelo, anio: e.target.value ? Number(e.target.value) : undefined })
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
          {conVersiones ? (
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
          ) : null}
        </div>
      )}

      <p className="text-texto-secundario mt-4 text-[13px]">
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
          urlConsulta={`${urlBuscar}?${escribirSeleccion({
            marca,
            modelo,
            anio,
            version: conVersiones ? resuelta.version?.slug : undefined,
          })}`}
        />
      ) : null}
    </section>
  );
}
