"use client";

import { useEffect, useMemo, useState } from "react";

import { claseBoton } from "@/components/ui/boton.ts";
import { ListaPildora } from "@/components/ui/ListaPildora";
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

// Las <option> de una lista de {slug, nombre}, con la primera vacía («Marca»).
function Opciones({
  vacia,
  lista,
}: {
  vacia: string;
  lista: readonly { slug: string; nombre: string }[] | undefined;
}) {
  return (
    <>
      <option value="">{vacia}</option>
      {lista?.map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.nombre}
        </option>
      ))}
    </>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ListaPildora
            etiqueta="Marca"
            valor={marca ?? ""}
            deshabilitada={!opciones}
            alCambiar={(v) => cambiar({ marca: v || undefined })}
          >
            <Opciones vacia="Marca" lista={opciones?.marcas} />
          </ListaPildora>
          <ListaPildora
            etiqueta="Modelo"
            valor={modelo ?? ""}
            deshabilitada={!marca}
            alCambiar={(v) => cambiar({ marca, modelo: v || undefined })}
          >
            <Opciones vacia="Modelo" lista={opciones?.modelos} />
          </ListaPildora>
          <ListaPildora
            etiqueta="Año"
            valor={anio === undefined ? "" : String(anio)}
            deshabilitada={!modelo}
            alCambiar={(v) => cambiar({ marca, modelo, anio: v ? Number(v) : undefined })}
          >
            <option value="">Año</option>
            {opciones?.anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </ListaPildora>
          {conVersiones ? (
            <ListaPildora
              etiqueta="Versión"
              valor={resuelta?.version?.slug ?? ""}
              alCambiar={(v) => cambiar({ marca, modelo, anio, version: v || undefined })}
            >
              <Opciones vacia="Versión" lista={opciones?.versiones} />
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
