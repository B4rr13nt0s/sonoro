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
  notaReceptor,
  SIN_RESULTADOS,
  TEXTOS_ESTADO,
  textoGrupoVacio,
  tituloGrupo,
} from "@/lib/vehiculos/textos.ts";

// Lo que cabe en el vehículo elegido en /buscar: receptores y, por cada
// ubicación, las bocinas de su medida. Debajo de cada tarjeta —fuera de ella
// y de su enlace estirado— va el estado, en el gris de la línea de
// especificación, solo cuando el estado tiene texto («Cabe», «Cabe con…»).
// Sin paginar: en 6.5" son unas 35.
//
// Regla 2: no hay ganador ni «mejor opción». El orden ya viene dado por
// estado y relevancia (lib/vehiculos/compatibilidad.ts).
const CLASE_SECCION = "text-22 sm:text-26 font-semibold tracking-[-0.02em]";
const CLASE_ENLACE = "text-negro underline underline-offset-2";

function Estado({ item }: { item: ProductoCompatible }) {
  const { estado } = item;
  if (estado.tipo === "con_pieza") {
    return (
      <p className="text-texto-secundario text-[13px]">
        {TEXTOS_ESTADO.con_pieza}{" "}
        <Link href={`/producto/${estado.pieza.slug}`} className={CLASE_ENLACE}>
          {estado.pieza.nombre}
        </Link>
      </p>
    );
  }
  const texto = TEXTOS_ESTADO[estado.tipo];
  return texto ? <p className="text-texto-secundario text-[13px]">{texto}</p> : null;
}

function Rejilla({ items }: { items: ProductoCompatible[] }) {
  return (
    <div className={CLASES_GRID}>
      {items.map((item) => {
        const nota = notaReceptor(item.producto.sku);
        return (
          <div key={item.producto.sku} className="flex flex-col gap-2">
            <ProductCard producto={item.producto} />
            <Estado item={item} />
            {nota ? <p className="text-texto-secundario text-[13px]">{nota}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function ResultadosVehiculo({ titulo, compat }: { titulo: string; compat: Compatibilidad }) {
  return (
    <div className="pt-10 pb-16 sm:pb-22">
      <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">{titulo}</h2>

      {!hayResultados(compat) ? (
        <p className="text-texto-secundario mt-4 text-[15px]">{SIN_RESULTADOS}</p>
      ) : (
        <>
          {compat.receptores.length > 0 ? (
            <section className="mt-10 flex flex-col gap-5">
              <h3 className={CLASE_SECCION}>Receptores</h3>
              <Rejilla items={compat.receptores} />
            </section>
          ) : null}

          {compat.grupos.length > 0 ? (
            <section className="mt-14 flex flex-col gap-8">
              <h3 className={CLASE_SECCION}>Bocinas</h3>
              {compat.grupos.map((grupo) => (
                <div key={grupo.ubicacion} className="flex flex-col gap-4">
                  <h4 className="text-[17px] font-semibold">{tituloGrupo(grupo)}</h4>
                  {grupo.bocinas.length > 0 ? (
                    <Rejilla items={grupo.bocinas} />
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
