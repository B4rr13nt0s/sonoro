// Persistencia en localStorage. CLAUDE.md § Modelo de conversión: "Nunca
// crashear con un carrito viejo" — loadCart() nunca lanza. JSON corrupto,
// forma inválida, o un schemaVersion sin ruta de migración conocida
// producen un carrito vacío nuevo, no un error.
import { z } from "zod";

import { acumularCambios, CambioCarritoSchema, type CambioCarrito } from "./reconcile.ts";
import {
  CartSchema,
  MAX_CANTIDAD_POR_LINEA,
  SCHEMA_VERSION,
  crearCarritoVacio,
  type Cart,
} from "./types.ts";

export const CART_STORAGE_KEY = "sonoro:cart";
export const CAMBIOS_STORAGE_KEY = "sonoro:cart-cambios";

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

// Un carrito guardado antes del tope de 99 por línea (septiembre de 2026)
// puede traer 198 —agregar 99 dos veces desde la ficha sumaba eso—. Sin
// toparlo al cargar, salía así en /carrito y en el mensaje de WhatsApp, y el
// «−» lo bajaba de golpe a 99. Acá es donde entra todo carrito guardado.
function toparCantidades(cart: Cart): Cart {
  if (cart.items.every((item) => item.qty <= MAX_CANTIDAD_POR_LINEA)) return cart;
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      qty: Math.min(item.qty, MAX_CANTIDAD_POR_LINEA),
    })),
  };
}

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
      return resultado.success
        ? toparCantidades(resultado.data)
        : crearCarritoVacio(new Date().toISOString());
    }

    const resultado = CartSchema.safeParse(parsed);
    return resultado.success
      ? toparCantidades(resultado.data)
      : crearCarritoVacio(new Date().toISOString());
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

// Lo que reconcile() corrigió y el cliente todavía no vio en /carrito. Se
// guarda aparte del carrito porque el carrito se guarda YA corregido: sin
// esto, si la corrección pasa en otra página (o en otra pestaña) y /carrito
// se abre con una carga completa, reconcile() ya no encuentra nada que
// avisar y el total cambia sin explicación.
//
// Dos resguardos:
//
// - `carrito` es el createdAt del carrito al que se refieren. Si el carrito
//   guardado se descartó (corrupto, versión sin migración) o ya se pidió,
//   el carrito actual es otro y estos avisos no hablan de nada en pantalla.
// - Descartar NO reescribe la lista: sube la marca `sonoro:cart-cambios-
//   vistos` (hasta cuándo ya se mostró todo). Leer-sumar-escribir la lista
//   no es atómico entre pestañas, y una pestaña que hidrata a la vez que
//   /carrito descarta volvía a escribir lo ya visto. Con la marca, lo que
//   se detectó antes de ella queda fuera aunque alguien lo reescriba.
export const CAMBIOS_VISTOS_STORAGE_KEY = "sonoro:cart-cambios-vistos";

const PendientesSchema = z.object({
  carrito: z.string(),
  cambios: z.array(z.object({ cambio: CambioCarritoSchema, detectadoEn: z.number() })),
});
type Pendientes = z.infer<typeof PendientesSchema>;

function leerPendientes(createdAt: string): Pendientes["cambios"] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CAMBIOS_STORAGE_KEY);
    if (!raw) return [];
    const resultado = PendientesSchema.safeParse(JSON.parse(raw));
    if (!resultado.success || resultado.data.carrito !== createdAt) return [];
    const vistosHasta = Number(window.localStorage.getItem(CAMBIOS_VISTOS_STORAGE_KEY)) || 0;
    return resultado.data.cambios.filter((c) => c.detectadoEn > vistosHasta);
  } catch {
    return [];
  }
}

/** Los avisos pendientes del carrito `createdAt`. Nunca lanza. */
export function loadCambiosPendientes(createdAt: string): CambioCarrito[] {
  return leerPendientes(createdAt).map((c) => c.cambio);
}

/**
 * Suma `nuevos` a lo pendiente del carrito `createdAt` (acumularCambios) y lo
 * guarda. Lo nuevo lleva la hora `ahora`; lo que ya estaba conserva la suya,
 * para que la marca de vistos lo siga reconociendo. Devuelve la lista.
 */
export function agregarCambiosPendientes(
  createdAt: string,
  nuevos: readonly CambioCarrito[],
  ahora: number,
): CambioCarrito[] {
  const previos = leerPendientes(createdAt);
  const horaPrevia = new Map(previos.map((c) => [c.cambio.sku, c.detectadoEn]));
  const skusNuevos = new Set(nuevos.map((c) => c.sku));
  const cambios = acumularCambios(
    previos.map((c) => c.cambio),
    nuevos,
  );
  if (typeof window !== "undefined" && nuevos.length > 0) {
    const pendientes: Pendientes = {
      carrito: createdAt,
      cambios: cambios.map((cambio) => ({
        cambio,
        detectadoEn: skusNuevos.has(cambio.sku) ? ahora : (horaPrevia.get(cambio.sku) ?? ahora),
      })),
    };
    try {
      window.localStorage.setItem(CAMBIOS_STORAGE_KEY, JSON.stringify(pendientes));
    } catch {
      // Igual que saveCart: sin storage, los avisos quedan solo en memoria.
    }
  }
  return cambios;
}

/** Todo lo detectado hasta `ahora` ya se mostró. */
export function marcarCambiosVistos(ahora: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAMBIOS_VISTOS_STORAGE_KEY, String(ahora));
    window.localStorage.removeItem(CAMBIOS_STORAGE_KEY);
  } catch {
    // Sin storage no hay nada guardado que descartar.
  }
}
