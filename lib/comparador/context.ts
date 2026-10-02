"use client";

// Provider + hook del comparador. Compone ./reducer.ts (mutaciones),
// ./storage.ts (persistencia), ./reconcile.ts (corrección contra el catálogo
// al hidratar) y ./seleccion.ts (la decisión del toggle).
//
// NO conoce el carrito ni WhatsApp: los dos son consumidores de la selección,
// igual que WhatsApp lo es del carrito (CLAUDE.md § Modelo de conversión).
//
// Sin JSX (createElement en vez de <Context.Provider>) a propósito: así el
// archivo es .ts, no .tsx, y ./context.test.ts puede importarlo bajo
// `node --test` sin un transform de JSX. Mismo motivo que lib/cart/context.ts.
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { reconcile, type CambioComparador } from "./reconcile.ts";
import { evaluarToggle, type ResultadoToggle } from "./seleccion.ts";
import { comparadorReducer, type ComparadorAction } from "./reducer.ts";
import { COMPARADOR_STORAGE_KEY, loadSeleccion, saveSeleccion } from "./storage.ts";
import { crearSeleccionVacia, type CatalogoComparable, type Seleccion } from "./types.ts";

export type ProductoComparable = { sku: string; categoria: string };

type ComparadorContextValue = {
  skus: string[];
  categoria: string | null;
  cantidad: number;
  cambios: CambioComparador[];
  // false hasta que el efecto lea localStorage. La barra flotante lo usa para
  // no aparecer y desaparecer en el primer render (localStorage no existe
  // durante SSR, así que el primer render del cliente es inevitablemente una
  // selección vacía).
  hydrated: boolean;
  tiene: (sku: string) => boolean;
  // Devuelve el veredicto para que quien llama muestre el aviso que
  // corresponda. Aplica el cambio solo cuando es "agrega" o "quita".
  alternar: (producto: ProductoComparable) => ResultadoToggle;
  reemplazarCon: (producto: ProductoComparable) => void;
  vaciar: () => void;
};

const ComparadorContext = createContext<ComparadorContextValue | null>(null);

// La selección vive fuera de React, en un almacén que las acciones leen y
// escriben EN EL MISMO LLAMADO, igual que el carrito (lib/cart/context.ts).
// Antes se guardaba desde un efecto con una marca «vino de otra pestaña»: entre
// el cambio y la escritura había una ventana, y si en ella llegaba el evento
// `storage` de otra pestaña, el efecto veía la marca puesta, no guardaba, y el
// producto recién agregado se perdía. Un manejador de eventos corre entero
// antes que el siguiente, así que acá no hay hueco. Además, dos acciones
// seguidas antes de renderizar ven la selección ya actualizada.
//
// React lo lee con useSyncExternalStore (un useRef haría lo mismo, pero la
// regla react-hooks/refs no deja pasar en el contexto funciones que lo leen).
class AlmacenComparador {
  // Un solo objeto, reemplazado entero en cada cambio: la selección y la marca
  // de hidratación llegan a React en el MISMO render.
  #estado: { seleccion: Seleccion; hidratado: boolean };
  #oyentes = new Set<() => void>();

  constructor(inicial: Seleccion) {
    this.#estado = { seleccion: inicial, hidratado: false };
  }

  leer = () => this.#estado;

  suscribir = (oyente: () => void): (() => void) => {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  };

  /**
   * La selección leída de localStorage y reconciliada. Solo se vuelve a
   * guardar si reconcile() la corrigió: reescribirla en cada carga despertaría
   * a todas las demás pestañas sin que nada hubiera cambiado.
   */
  hidratar = (seleccion: Seleccion, corregida: boolean): void => {
    this.#estado = { seleccion, hidratado: true };
    if (corregida) saveSeleccion(seleccion);
    this.#avisar();
  };

  /**
   * Toda mutación pasa por acá. `guardar: false` es para lo que ya está
   * guardado (lo que llega de otra pestaña). Antes de hidratar no se guarda
   * nada —la selección vacía inicial pisaría una real—.
   */
  aplicar = (accion: ComparadorAction, guardar: boolean): void => {
    const siguiente = comparadorReducer(this.#estado.seleccion, accion);
    if (siguiente === this.#estado.seleccion) return;
    this.#estado = { ...this.#estado, seleccion: siguiente };
    if (this.#estado.hidratado && guardar) saveSeleccion(siguiente);
    this.#avisar();
  };

  #avisar(): void {
    for (const oyente of this.#oyentes) oyente();
  }
}

export function ComparadorProvider({
  catalogo,
  children,
}: {
  catalogo: CatalogoComparable[];
  children: ReactNode;
}) {
  // Estado vacío tanto en el server como en el primer render del cliente —
  // localStorage no existe en el server, así que hidratar ahí produciría
  // contenido distinto entre ambos.
  const [almacen] = useState(
    () => new AlmacenComparador(crearSeleccionVacia(new Date().toISOString())),
  );
  const { seleccion, hidratado: hydrated } = useSyncExternalStore(
    almacen.suscribir,
    almacen.leer,
    almacen.leer,
  );
  const [cambios, setCambios] = useState<CambioComparador[]>([]);

  useEffect(() => {
    const { seleccion: reconciliada, cambios: detectados } = reconcile(loadSeleccion(), catalogo);
    almacen.hidratar(reconciliada, detectados.length > 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCambios(detectados);

    // Otra pestaña cambió la selección: se adopta tal cual y no se vuelve a
    // guardar —ya está guardada—, para que dos pestañas con catálogos
    // distintos no se corrijan una a la otra en bucle. En el MISMO efecto que
    // la lectura, sin que corra nada entre las dos.
    function alCambiarEnOtraPestaña(evento: StorageEvent) {
      if (evento.key !== COMPARADOR_STORAGE_KEY && evento.key !== null) return;
      const { seleccion: externa } = reconcile(loadSeleccion(), catalogo);
      almacen.aplicar({ type: "hidratar", seleccion: externa }, false);
    }
    window.addEventListener("storage", alCambiarEnOtraPestaña);
    return () => window.removeEventListener("storage", alCambiarEnOtraPestaña);
    // `catalogo` es el snapshot que trajo el Server Component contenedor — no
    // cambia durante la vida de la pestaña, así que esto corre una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacen]);

  const acciones = useMemo(
    () => ({
      alternar: (producto: ProductoComparable): ResultadoToggle => {
        // Contra lo guardado AHORA, no contra la selección del último render.
        const veredicto = evaluarToggle(almacen.leer().seleccion, producto);
        const now = new Date().toISOString();
        if (veredicto.tipo === "agrega") {
          almacen.aplicar(
            { type: "agregar", sku: producto.sku, categoria: producto.categoria, now },
            true,
          );
        } else if (veredicto.tipo === "quita") {
          almacen.aplicar({ type: "quitar", sku: producto.sku, now }, true);
        }
        // "lleno" y "otra_categoria" no mutan nada: los resuelve la UI.
        return veredicto;
      },
      reemplazarCon: (producto: ProductoComparable) =>
        almacen.aplicar(
          {
            type: "reemplazar",
            sku: producto.sku,
            categoria: producto.categoria,
            now: new Date().toISOString(),
          },
          true,
        ),
      vaciar: () => almacen.aplicar({ type: "vaciar", now: new Date().toISOString() }, true),
    }),
    [almacen],
  );

  const value: ComparadorContextValue = {
    skus: seleccion.skus,
    categoria: seleccion.categoria,
    cantidad: seleccion.skus.length,
    cambios,
    hydrated,
    tiene: (sku) => seleccion.skus.includes(sku),
    ...acciones,
  };

  return createElement(ComparadorContext.Provider, { value }, children);
}

export function useComparador(): ComparadorContextValue {
  const context = useContext(ComparadorContext);
  if (!context) throw new Error("useComparador debe usarse dentro de <ComparadorProvider>");
  return context;
}
