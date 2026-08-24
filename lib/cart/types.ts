// CLAUDE.md § Modelo de conversión: carrito → WhatsApp — estructura del ítem
// "diseñada como si ya hubiera pagos". CartItem guarda un snapshot tomado al
// agregar (precio, nombre, imagen) — la Fase 7 (pagos en línea) lo necesita
// tal cual. reconcile() (./reconcile.ts) corrige ese snapshot contra el
// catálogo actual al hidratar, pero el campo persistido sigue siendo un
// snapshot, no una referencia viva.
import { z } from "zod";

import { MonedaSchema } from "../catalog/types.ts";

export const SCHEMA_VERSION = 1;

export const CartItemSchema = z.object({
  sku: z.string(),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  currency: MonedaSchema,
  nombreSnapshot: z.string(),
  imagenSnapshot: z.string().nullable(),
  addedAt: z.iso.datetime(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  items: z.array(CartItemSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Cart = z.infer<typeof CartSchema>;

export function crearCarritoVacio(now: string): Cart {
  return { schemaVersion: SCHEMA_VERSION, items: [], createdAt: now, updatedAt: now };
}

// Vista mínima del catálogo que necesita reconcile() (./reconcile.ts) — no
// el Producto completo de lib/catalog. Un Server Component (hoy
// app/layout.tsx) la arma desde lib/catalog y se la pasa a CartProvider,
// porque el adaptador de catálogo lee el filesystem y no corre en el
// navegador (mismo patrón que /buscar con SearchExperience).
export type CatalogoSku = {
  sku: string;
  activo: boolean;
  disponibilidad: "disponible" | "bajo_pedido" | "agotado";
  precioCents: number;
};
