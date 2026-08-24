// Persistencia en localStorage. CLAUDE.md § Modelo de conversión: "Nunca
// crashear con un carrito viejo" — loadCart() nunca lanza. JSON corrupto,
// forma inválida, o un schemaVersion sin ruta de migración conocida
// producen un carrito vacío nuevo, no un error.
import { CartSchema, SCHEMA_VERSION, crearCarritoVacio, type Cart } from "./types.ts";

export const CART_STORAGE_KEY = "sonoro:cart";

// Una entrada por versión ANTERIOR a la actual: recibe el JSON crudo ya
// parseado (todavía sin validar contra CartSchema) y devuelve un Cart de la
// versión actual, o `null` si no se puede migrar de forma confiable — en
// ese caso el carrito se descarta limpiamente. Vacía hoy a propósito: solo
// existe la v1. El primer cambio de schemaVersion agrega su primera entrada
// aquí en vez de improvisar la migración en loadCart().
// Exportada solo para que storage.test.ts pueda registrar una migración de
// prueba temporal y comprobar que loadCart() la usa de verdad — no la
// reexporta lib/cart/index.ts, no es API pública del módulo.
export type Migracion = (raw: Record<string, unknown>) => Cart | null;
export const MIGRATIONS: Record<number, Migracion> = {};

export function loadCart(): Cart {
  if (typeof window === "undefined") return crearCarritoVacio(new Date().toISOString());

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return crearCarritoVacio(new Date().toISOString());

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return crearCarritoVacio(new Date().toISOString());
    }

    const version = (parsed as Record<string, unknown>).schemaVersion;
    if (version !== SCHEMA_VERSION) {
      const migrar = typeof version === "number" ? MIGRATIONS[version] : undefined;
      const migrado = migrar ? migrar(parsed as Record<string, unknown>) : null;
      if (!migrado) return crearCarritoVacio(new Date().toISOString());

      const resultado = CartSchema.safeParse(migrado);
      return resultado.success ? resultado.data : crearCarritoVacio(new Date().toISOString());
    }

    const resultado = CartSchema.safeParse(parsed);
    return resultado.success ? resultado.data : crearCarritoVacio(new Date().toISOString());
  } catch {
    return crearCarritoVacio(new Date().toISOString());
  }
}

export function saveCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // localStorage puede fallar (modo privado, cuota excedida, etc.) — no
    // hay nada que hacer salvo no crashear el carrito en memoria.
  }
}
