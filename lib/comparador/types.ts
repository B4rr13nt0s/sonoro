// Selección del comparador de especificaciones. Misma arquitectura que
// lib/cart/: zod para la forma, SCHEMA_VERSION para poder migrar o descartar,
// y un estado que no conoce ni el carrito ni WhatsApp — los dos son
// consumidores de la selección, igual que WhatsApp lo es del carrito
// (CLAUDE.md § Modelo de conversión).
import { z } from "zod";

export const SCHEMA_VERSION = 1;

// Cuatro columnas es lo que entra en la columna de 1280px del diseño sin que
// los valores se apilen ilegibles. No es un número arbitrario que se pueda
// subir solo: cambiarlo obliga a rehacer el ancho de columna de la tabla y el
// copy del teaser de la portada.
export const MAX_COMPARAR = 4;

export const SeleccionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  // La categoría de la selección, o null si está vacía. Se GUARDA en vez de
  // derivarse del catálogo para que el reducer —que es puro y no lo tiene—
  // pueda exigir que no se mezclen categorías. reconcile() la recalcula
  // contra el catálogo real al hidratar.
  categoria: z.string().nullable(),
  skus: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});
export type Seleccion = z.infer<typeof SeleccionSchema>;

export function crearSeleccionVacia(now: string): Seleccion {
  return { schemaVersion: SCHEMA_VERSION, categoria: null, skus: [], updatedAt: now };
}

// Vista mínima del catálogo que necesita reconcile() — no el Producto
// completo de lib/catalog. La arma un Server Component (app/layout.tsx),
// porque el adaptador de catálogo lee el filesystem y no corre en el
// navegador. Mismo patrón que CatalogoSku en lib/cart/types.ts.
export type CatalogoComparable = {
  sku: string;
  categoria: string;
  activo: boolean;
};
