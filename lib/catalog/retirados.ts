// Productos que Sonoro dejó de manejar y cuya fila ya no está en el libro
// (data/retirados.json). Su ficha responde 410 como la de una fila con
// activo = FALSO (proxy.ts), pero no hay producto del que leer nada: solo el
// nombre, para decir qué fue lo que se retiró.
import retiradosRaw from "../../data/retirados.json";

export type Retirado = {
  sku: string;
  slug: string;
  nombre: string;
  motivo: string;
  /**
   * Slug del producto que lo sustituye: su URL redirige (permanente) en vez de dar 410.
   * Igual a `slug` cuando cambió solo el código: ni redirección ni 410.
   */
  reemplazo?: string;
};

export const RETIRADOS: readonly Retirado[] = retiradosRaw;

/** Los que dan 410: los que no tienen sustituto. Los demás redirigen (next.config.ts). */
export const RETIRADOS_A_410: readonly Retirado[] = RETIRADOS.filter((r) => !r.reemplazo);

export function retiradoPorSlug(slug: string): Retirado | undefined {
  return RETIRADOS_A_410.find((r) => r.slug === slug);
}
