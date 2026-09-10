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
  useReducer,
  useState,
  type ReactNode,
} from "react";

import { reconcile, type CambioComparador } from "./reconcile.ts";
import { evaluarToggle, type ResultadoToggle } from "./seleccion.ts";
import { comparadorReducer } from "./reducer.ts";
import { loadSeleccion, saveSeleccion } from "./storage.ts";
import { crearSeleccionVacia, type CatalogoComparable } from "./types.ts";

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
  const [seleccion, dispatch] = useReducer(comparadorReducer, null, () =>
    crearSeleccionVacia(new Date().toISOString()),
  );
  // `null` = todavía no se leyó localStorage. Hace doble papel: es el
  // resultado de reconcile() Y la señal de "ya hidraté" que gatea el efecto
  // de guardado — sin ella, el primer render (selección vacía) se
  // persistiría antes de leer localStorage y pisaría la selección guardada.
  const [cambios, setCambios] = useState<CambioComparador[] | null>(null);
  const hydrated = cambios !== null;

  useEffect(() => {
    const cargada = loadSeleccion();
    const { seleccion: reconciliada, cambios: detectados } = reconcile(cargada, catalogo);
    dispatch({ type: "hidratar", seleccion: reconciliada });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCambios(detectados);
    // `catalogo` es el snapshot que trajo el Server Component contenedor — no
    // cambia durante la vida de la pestaña, así que hidratar corre una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSeleccion(seleccion);
  }, [seleccion, hydrated]);

  const value: ComparadorContextValue = {
    skus: seleccion.skus,
    categoria: seleccion.categoria,
    cantidad: seleccion.skus.length,
    cambios: cambios ?? [],
    hydrated,
    tiene: (sku) => seleccion.skus.includes(sku),
    alternar: (producto) => {
      const veredicto = evaluarToggle(seleccion, producto);
      const now = new Date().toISOString();
      if (veredicto.tipo === "agrega") {
        dispatch({ type: "agregar", sku: producto.sku, categoria: producto.categoria, now });
      } else if (veredicto.tipo === "quita") {
        dispatch({ type: "quitar", sku: producto.sku, now });
      }
      // "lleno" y "otra_categoria" no mutan nada: los resuelve la UI.
      return veredicto;
    },
    reemplazarCon: (producto) =>
      dispatch({
        type: "reemplazar",
        sku: producto.sku,
        categoria: producto.categoria,
        now: new Date().toISOString(),
      }),
    vaciar: () => dispatch({ type: "vaciar", now: new Date().toISOString() }),
  };

  return createElement(ComparadorContext.Provider, { value }, children);
}

export function useComparador(): ComparadorContextValue {
  const context = useContext(ComparadorContext);
  if (!context) throw new Error("useComparador debe usarse dentro de <ComparadorProvider>");
  return context;
}
