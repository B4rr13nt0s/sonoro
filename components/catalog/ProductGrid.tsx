import { ProductCard } from "@/components/catalog/ProductCard";
import type { Producto } from "@/lib/catalog/index.ts";

// Rejilla de tarjetas de producto — CLAUDE.md § Patrones que se repiten no
// define estados de carga ni vacío (el handoff es estático), así que los
// agregamos aquí: `loading` cubre la espera de un fetch/filtro client-side,
// `productos.length === 0` cubre un filtro sin resultados.
const CLASES_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4";

type ProductGridProps = {
  productos: Producto[];
  loading?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
};

export function ProductGrid({
  productos,
  loading = false,
  skeletonCount = 8,
  emptyMessage = "No encontramos productos con estos filtros.",
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={CLASES_GRID} aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonCount }, (_, indice) => (
          <ProductCardSkeleton key={indice} />
        ))}
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="border-borde-tarjeta rounded-card-lg flex flex-col items-center gap-2 border border-dashed px-6 py-16 text-center">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          Sin resultados
        </div>
        <p className="text-texto-secundario text-[15px]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={CLASES_GRID}>
      {productos.map((producto) => (
        <ProductCard key={producto.sku} producto={producto} />
      ))}
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div
      className="rounded-card border-borde-tarjeta flex animate-pulse flex-col overflow-hidden border bg-white"
      aria-hidden="true"
    >
      <div className="bg-fondo-alt h-[200px]" />
      <div className="flex flex-col gap-2 p-5">
        <div className="bg-fondo-alt h-2.5 w-16 rounded-full" />
        <div className="bg-fondo-alt h-3.5 w-4/5 rounded-full" />
        <div className="bg-fondo-alt h-3.5 w-3/5 rounded-full" />
        <div className="bg-fondo-alt mt-2 h-3.5 w-2/5 rounded-full" />
        <div className="bg-fondo-alt h-3 w-3/5 rounded-full" />
      </div>
    </div>
  );
}
