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
  textoGrupoVacio,
  tituloGrupo,
} from "@/lib/vehiculos/textos.ts";

// Lo que cabe en el vehículo elegido en /buscar: receptores y, por cada
// ubicación, las bocinas de su medida. Las tarjetas no dicen si cabe ni con
// qué pieza (decisión del negocio, noviembre de 2026): eso se le pregunta al
// chat. Debajo solo va la anotación de un receptor que la tiene (NOTAS_RECEPTOR).
// Sin paginar: en 6.5" son unas 35.
//
// Regla 2: no hay ganador ni «mejor opción». El orden ya viene dado por
// estado y relevancia (lib/vehiculos/compatibilidad.ts).
const CLASE_SECCION = "text-22 sm:text-26 font-semibold tracking-[-0.02em]";

function Rejilla({ items }: { items: ProductoCompatible[] }) {
  return (
    <div className={CLASES_GRID}>
      {items.map((item) => {
        const nota = notaReceptor(item.producto.sku);
        return (
          <div key={item.producto.sku} className="flex flex-col gap-2">
            <ProductCard producto={item.producto} />
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
