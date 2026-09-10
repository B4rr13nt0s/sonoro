"use client";

// Isla cliente para agregar o quitar un producto del comparador. Va dentro de
// ProductCard y de la ficha, que siguen siendo Server Components: ponerles
// "use client" arrastraría ProductImage, formatQ y la rejilla entera al
// bundle de cinco páginas.
//
// No decide nada por su cuenta — llama a alternar(), que devuelve el
// veredicto, y los dos casos que no puede resolver ("lleno" y
// "otra_categoria") los levanta a la barra flotante, que es la que tiene
// espacio para avisar y para ofrecer el reemplazo.
import { useComparador } from "@/lib/comparador/index.ts";
import { useAvisoComparador } from "./avisoComparador.ts";

export function CompararToggle({
  sku,
  categoria,
  nombre,
  className,
}: {
  sku: string;
  categoria: string;
  nombre: string;
  className?: string;
}) {
  const { tiene, alternar, hydrated } = useComparador();
  const { levantar } = useAvisoComparador();

  const seleccionado = hydrated && tiene(sku);

  return (
    <button
      type="button"
      // Una rejilla renderiza 24 de estos y «Comparar» a secas no distingue
      // ninguno para quien navega por lista de botones.
      aria-label={seleccionado ? `Quitar ${nombre} del comparador` : `Comparar ${nombre}`}
      aria-pressed={seleccionado}
      onClick={() => {
        const veredicto = alternar({ sku, categoria });
        if (veredicto.tipo === "lleno") {
          levantar({ tipo: "lleno" });
        } else if (veredicto.tipo === "otra_categoria") {
          levantar({
            tipo: "otra_categoria",
            categoriaActual: veredicto.categoriaActual,
            producto: { sku, categoria },
            nombre,
          });
        }
      }}
      className={`rounded-full border px-4 py-2 text-[13px] ${
        seleccionado ? "border-negro bg-negro text-white" : "border-borde-pildora text-texto-nav"
      } ${className ?? ""}`}
    >
      {seleccionado ? "Quitar" : "Comparar"}
    </button>
  );
}
