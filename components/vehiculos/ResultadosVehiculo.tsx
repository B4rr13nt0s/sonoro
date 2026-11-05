import Link from "next/link";

import { ProductCard } from "@/components/catalog/ProductCard";
import { CLASES_GRID } from "@/components/catalog/ProductGrid";
import { INSTALACION } from "@/lib/politicas.ts";
import {
  hayResultados,
  type Compatibilidad,
  type ProductoCompatible,
} from "@/lib/vehiculos/compatibilidad.ts";
import {
  SIN_RESULTADOS,
  TEXTOS_ESTADO,
  textoGrupoVacio,
  tituloGrupo,
} from "@/lib/vehiculos/textos.ts";
import {
  buildVehicleProductInquiryMessage,
  buildWhatsAppUrl,
  WHATSAPP_NUMBER,
} from "@/lib/whatsapp/index.ts";

// Lo que cabe en el vehículo elegido en /buscar: receptores y, por cada
// ubicación, las bocinas de su medida. Debajo de cada tarjeta —fuera de ella
// y de su enlace estirado— va el estado, en el gris de la línea de
// especificación. Sin paginar: en 6.5" son unas 35.
//
// Regla 2: no hay ganador ni «mejor opción». El orden ya viene dado por
// estado y relevancia (lib/vehiculos/compatibilidad.ts).
const CLASE_ETIQUETA = "text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase";
const CLASE_ENLACE = "text-negro underline underline-offset-2";

function Estado({
  item,
  titulo,
  urlConsulta,
}: {
  item: ProductoCompatible;
  titulo: string;
  urlConsulta: string;
}) {
  const { estado, producto } = item;
  if (estado.tipo === "con_pieza") {
    return (
      <>
        {TEXTOS_ESTADO.con_pieza}{" "}
        <Link href={`/producto/${estado.pieza.slug}`} className={CLASE_ENLACE}>
          {estado.pieza.nombre}
        </Link>
      </>
    );
  }
  if (estado.tipo === "consultar") {
    const mensaje = buildVehicleProductInquiryMessage({
      nombre: producto.nombre,
      sku: producto.sku,
      vehiculo: titulo,
      url: urlConsulta,
    });
    return (
      <>
        {TEXTOS_ESTADO.consultar}{" "}
        <a
          href={buildWhatsAppUrl(WHATSAPP_NUMBER, mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className={CLASE_ENLACE}
        >
          Escríbenos por WhatsApp
        </a>
      </>
    );
  }
  return <>{TEXTOS_ESTADO[estado.tipo]}</>;
}

function Rejilla({
  items,
  titulo,
  urlConsulta,
}: {
  items: ProductoCompatible[];
  titulo: string;
  urlConsulta: string;
}) {
  return (
    <div className={CLASES_GRID}>
      {items.map((item) => (
        <div key={item.producto.sku} className="flex flex-col gap-2">
          <ProductCard producto={item.producto} />
          <p className="text-texto-secundario text-[13px]">
            <Estado item={item} titulo={titulo} urlConsulta={urlConsulta} />
          </p>
        </div>
      ))}
    </div>
  );
}

export function ResultadosVehiculo({
  titulo,
  compat,
  urlConsulta,
}: {
  titulo: string;
  compat: Compatibilidad;
  urlConsulta: string;
}) {
  return (
    <div className="pt-10 pb-16 sm:pb-22">
      <h3 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">{titulo}</h3>

      {!hayResultados(compat) ? (
        <p className="text-texto-secundario mt-4 text-[15px]">{SIN_RESULTADOS}</p>
      ) : (
        <>
          {compat.receptores.length > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h4 className={CLASE_ETIQUETA}>Receptores</h4>
              <Rejilla items={compat.receptores} titulo={titulo} urlConsulta={urlConsulta} />
            </section>
          ) : null}

          {compat.grupos.length > 0 ? (
            <section className="mt-12 flex flex-col gap-8">
              <h4 className={CLASE_ETIQUETA}>Bocinas</h4>
              {compat.grupos.map((grupo) => (
                <div key={grupo.ubicacion} className="flex flex-col gap-4">
                  <h5 className="text-[15px] font-semibold">{tituloGrupo(grupo)}</h5>
                  {grupo.bocinas.length > 0 ? (
                    <Rejilla items={grupo.bocinas} titulo={titulo} urlConsulta={urlConsulta} />
                  ) : (
                    <p className="text-texto-secundario text-[15px]">{textoGrupoVacio(grupo)}</p>
                  )}
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}

      <p className="text-texto-secundario mt-12 max-w-[640px] text-[13px]">{INSTALACION}</p>
    </div>
  );
}
