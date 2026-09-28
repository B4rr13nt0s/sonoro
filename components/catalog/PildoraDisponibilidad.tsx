import { etiquetaDisponibilidad } from "@/lib/catalog/disponibilidad.ts";
import type { Disponibilidad } from "@/lib/catalog/index.ts";

// La píldora de agotado / bajo pedido, en un solo lugar: la usan la ficha
// (junto al precio) y cada línea del carrito, y tienen que verse igual. Sin
// color de acento (CLAUDE.md § Sistema visual) — el contorno y las versalitas
// en mono bastan. Lo disponible no lleva píldora (ver disponibilidad.ts).
export function PildoraDisponibilidad({
  disponibilidad,
}: {
  disponibilidad: Disponibilidad | undefined;
}) {
  const etiqueta = disponibilidad ? etiquetaDisponibilidad(disponibilidad) : null;
  if (!etiqueta) return null;
  return (
    <span className="border-borde-pildora text-negro rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase">
      {etiqueta}
    </span>
  );
}
