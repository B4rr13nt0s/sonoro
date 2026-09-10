// Reconciliación de la selección guardada contra el catálogo actual. Corre al
// hidratar (./context.ts), fuera del reducer — función pura que no muta nada,
// solo calcula la selección corregida y la lista de cambios. Mismo criterio
// que lib/cart/reconcile.ts.
import type { CatalogoComparable, Seleccion } from "./types.ts";

export type CambioComparador =
  | { tipo: "eliminado_no_existe"; sku: string }
  | { tipo: "eliminado_inactivo"; sku: string }
  // El producto sigue existiendo y activo, pero cambió de categoría en la
  // hoja. CLAUDE.md § Mantenimiento solo declara permanentes `sku` y `slug`,
  // así que esto puede pasar y dejaría una selección mezclada.
  | { tipo: "eliminado_otra_categoria"; sku: string };

export function reconcile(
  seleccion: Seleccion,
  catalogo: CatalogoComparable[],
): { seleccion: Seleccion; cambios: CambioComparador[] } {
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));
  const cambios: CambioComparador[] = [];

  // Primera pasada: los que siguen existiendo y activos, en el orden en que
  // el usuario los eligió.
  const vivos: CatalogoComparable[] = [];
  for (const sku of seleccion.skus) {
    const actual = porSku.get(sku);
    if (!actual) {
      cambios.push({ tipo: "eliminado_no_existe", sku });
      continue;
    }
    if (!actual.activo) {
      cambios.push({ tipo: "eliminado_inactivo", sku });
      continue;
    }
    vivos.push(actual);
  }

  // Segunda pasada: manda la categoría del primer sobreviviente. Se recalcula
  // del catálogo en vez de confiar en la guardada, que es la que pudo quedar
  // desactualizada.
  const categoria = vivos.length > 0 ? vivos[0].categoria : null;
  const skus: string[] = [];
  for (const producto of vivos) {
    if (producto.categoria !== categoria) {
      cambios.push({ tipo: "eliminado_otra_categoria", sku: producto.sku });
      continue;
    }
    skus.push(producto.sku);
  }

  return { seleccion: { ...seleccion, categoria, skus }, cambios };
}
