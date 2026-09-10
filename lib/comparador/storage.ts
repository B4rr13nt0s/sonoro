// Persistencia en localStorage. Mismo contrato que lib/cart/storage.ts:
// loadSeleccion() NUNCA lanza. JSON corrupto, forma inválida, o un
// schemaVersion sin ruta de migración conocida producen una selección vacía,
// no un error.
import { SeleccionSchema, SCHEMA_VERSION, crearSeleccionVacia, type Seleccion } from "./types.ts";

export const COMPARADOR_STORAGE_KEY = "sonoro:comparador";

// Una entrada por versión ANTERIOR a la actual: recibe el JSON crudo ya
// parseado (todavía sin validar) y devuelve una Seleccion de la versión
// actual, o `null` si no se puede migrar de forma confiable — en ese caso se
// descarta limpiamente. Vacía hoy a propósito: solo existe la v1. El primer
// cambio de schemaVersion agrega su primera entrada aquí en vez de improvisar
// la migración dentro de loadSeleccion().
// Exportada solo para que storage.test.ts pueda registrar una migración de
// prueba — no la reexporta index.ts, no es API pública del módulo.
export type Migracion = (raw: Record<string, unknown>) => Seleccion | null;
export const MIGRATIONS: Record<number, Migracion> = {};

export function loadSeleccion(): Seleccion {
  if (typeof window === "undefined") return crearSeleccionVacia(new Date().toISOString());

  try {
    const raw = window.localStorage.getItem(COMPARADOR_STORAGE_KEY);
    if (!raw) return crearSeleccionVacia(new Date().toISOString());

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return crearSeleccionVacia(new Date().toISOString());
    }

    const version = (parsed as Record<string, unknown>).schemaVersion;
    if (version !== SCHEMA_VERSION) {
      const migrar = typeof version === "number" ? MIGRATIONS[version] : undefined;
      const migrado = migrar ? migrar(parsed as Record<string, unknown>) : null;
      if (!migrado) return crearSeleccionVacia(new Date().toISOString());

      // La salida de una migración tampoco se cree a ciegas.
      const resultado = SeleccionSchema.safeParse(migrado);
      return resultado.success ? resultado.data : crearSeleccionVacia(new Date().toISOString());
    }

    const resultado = SeleccionSchema.safeParse(parsed);
    return resultado.success ? resultado.data : crearSeleccionVacia(new Date().toISOString());
  } catch {
    return crearSeleccionVacia(new Date().toISOString());
  }
}

export function saveSeleccion(seleccion: Seleccion): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPARADOR_STORAGE_KEY, JSON.stringify(seleccion));
  } catch {
    // localStorage puede fallar (modo privado, cuota excedida) — no hay nada
    // que hacer salvo no romper la selección en memoria.
  }
}
