"use client";

// Provider + hook del carrito. Compone lib/cart/reducer.ts (mutaciones),
// lib/cart/storage.ts (persistencia) y lib/cart/reconcile.ts (corrección
// contra el catálogo actual, derivada en cada render) — pero no conoce
// WhatsApp (CLAUDE.md § Modelo de conversión). `catalogo` lo trae un Server
// Component (hoy app/layout.tsx) porque el adaptador de lib/catalog lee el
// filesystem y no corre en el navegador — mismo patrón que /buscar.
//
// Sin JSX (createElement en vez de <CartContext.Provider>) a propósito: así
// el archivo es .ts, no .tsx, y lib/cart/context.test.ts puede importarlo
// bajo `node --test` sin un transform de JSX en el loader de pruebas.
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cartReducer } from "./reducer.ts";
import { reconcile, revisarEntrada, type CambioCarrito } from "./reconcile.ts";
import { CART_STORAGE_KEY, limpiarClavesViejas, loadCart, saveCart } from "./storage.ts";
import { itemCount, subtotalCents } from "./totals.ts";
import type { Disponibilidad } from "../catalog/types.ts";
import {
  crearCarritoVacio,
  MAX_CANTIDAD_POR_LINEA,
  type CartItem,
  type CatalogoSku,
} from "./types.ts";

type NuevoItem = Pick<
  CartItem,
  "sku" | "qty" | "unitPriceCents" | "currency" | "nombreSnapshot" | "imagenSnapshot"
>;

type CartContextValue = {
  // El carrito YA CORREGIDO contra el catálogo (ver «Guardado vs. mostrado»
  // abajo): es lo que se muestra, se suma y se pide por WhatsApp.
  items: CartItem[];
  // `createdAt` del carrito — estable mientras no se llame clear() ni se
  // agregue el primer ítem de una sesión nueva. lib/whatsapp/ref.ts lo usa
  // para derivar el Ref (CLAUDE.md § Modelo de conversión: "vendedor y
  // cliente hablan del mismo pedido"), sin que lib/cart conozca WhatsApp —
  // solo expone el dato, no arma el Ref.
  createdAt: string;
  subtotalCents: number;
  itemCount: number;
  // La diferencia entre el carrito guardado y el corregido: líneas quitadas
  // por dejar de existir, quedar inactivas o agotarse, o con precio
  // actualizado. components/cart/avisos.ts arma las frases. Desaparecen
  // cuando /carrito los muestra y llama a descartarCambios().
  cambios: CambioCarrito[];
  // Guarda el carrito corregido: a partir de ahí no hay diferencia que avisar.
  descartarCambios: () => void;
  // Disponibilidad ACTUAL de cada sku, del mismo catálogo que usa
  // reconcile(). El CartItem no la guarda —es un snapshot de lo que se
  // agregó, y la disponibilidad cambia—, así que /carrito la lee de acá para
  // etiquetar lo bajo pedido, y para marcarlo en el mensaje. (Lo agotado no
  // llega a /carrito: reconcile() lo quita.)
  disponibilidadPorSku: Readonly<Record<string, Disponibilidad>>;
  // false hasta que el efecto de abajo lea localStorage — /carrito lo usa
  // para no mostrar "carrito vacío" un instante antes de que aparezca el
  // carrito real (CLAUDE.md § Modelo de conversión: localStorage no existe
  // durante SSR, así que el primer render del cliente es inevitablemente
  // vacío).
  hydrated: boolean;
  // Devuelve las unidades que de verdad entraron: 0 si no acepta el producto
  // —lo que reconcile() quitaría: agotado, inactivo, fuera del catálogo— o si
  // la línea ya está en el tope de 99, y menos de las pedidas si lo toca. Con
  // un booleano, 99 en el carrito + 5 decía «Has añadido 5» y lo medía así.
  addItem: (item: NuevoItem) => number;
  removeItem: (sku: string) => void;
  setQty: (sku: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// Guardado vs. mostrado.
//
// localStorage guarda el carrito TAL COMO LO ARMÓ EL CLIENTE, sin corregir.
// Lo que se muestra se DERIVA en cada render con reconcile() contra el
// catálogo actual, y los avisos son la diferencia entre los dos. Solo
// /carrito, al mostrar los avisos con la pestaña a la vista, guarda el
// carrito corregido (descartarCambios), y ahí la diferencia desaparece sola.
//
// Hasta septiembre de 2026 se hacía al revés: cada carga guardaba el carrito
// ya corregido, y eso borraba la evidencia de qué había cambiado. Para no
// perder los avisos había que guardarlos aparte, con su hora, una marca de
// «visto hasta» contra carreras entre pestañas, avisos solo en memoria para
// lo corregido de un carrito ajeno y una deduplicación de esos — y cada
// revisión encontraba un bug nuevo en esa maquinaria. Derivando, ninguna
// pestaña escribe correcciones por su cuenta, así que tampoco hay dos
// pestañas con catálogos distintos corrigiéndose una a la otra en bucle.
export function CartProvider({
  catalogo,
  children,
}: {
  catalogo: CatalogoSku[];
  children: ReactNode;
}) {
  // Estado inicial vacío tanto en el server como en el primer render del
  // cliente — localStorage no existe en el server, así que hidratar ahí
  // produciría contenido distinto entre ambos. El carrito real llega en el
  // efecto de abajo, después de montar.
  const [guardado, dispatch] = useReducer(cartReducer, null, () =>
    crearCarritoVacio(new Date().toISOString()),
  );
  // Gatea el efecto de guardado: sin él, el primer render (carrito vacío) se
  // persistiría antes de leer localStorage y pisaría un carrito real.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage no existe durante SSR ni en el primer render del
    // cliente — leerlo es inherentemente un efecto secundario que solo
    // puede correr después de montar (CLAUDE.md § Modelo de conversión:
    // "nunca crashear con un carrito viejo").
    dispatch({ type: "hydrate", cart: loadCart() });
    limpiarClavesViejas();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  // Otra pestaña cambió el carrito. Sin esto, cada pestaña guardaba SU copia
  // y la última en escribir borraba lo que agregó la otra: abrir una ficha
  // desde un enlace de WhatsApp, agregarla, y seguir en la pestaña de antes
  // perdía ese producto al siguiente cambio. `storage` solo se dispara en las
  // OTRAS pestañas, nunca en la que escribió. Lo que llega se adopta tal cual
  // y no se vuelve a guardar: es exactamente lo que ya está guardado.
  const vinoDeOtraPestaña = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    function alCambiarEnOtraPestaña(evento: StorageEvent) {
      if (evento.key !== CART_STORAGE_KEY && evento.key !== null) return;
      vinoDeOtraPestaña.current = true;
      dispatch({ type: "hydrate", cart: loadCart() });
    }
    window.addEventListener("storage", alCambiarEnOtraPestaña);
    return () => window.removeEventListener("storage", alCambiarEnOtraPestaña);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (vinoDeOtraPestaña.current) {
      vinoDeOtraPestaña.current = false;
      return;
    }
    saveCart(guardado);
  }, [guardado, hydrated]);

  // Lo que se muestra: el guardado corregido contra el catálogo. Antes de
  // hidratar no hay nada que corregir ni que avisar.
  const { cart, cambios } = useMemo(
    () =>
      hydrated ? reconcile(guardado, catalogo) : { cart: guardado, cambios: [] as CambioCarrito[] },
    [guardado, catalogo, hydrated],
  );

  const disponibilidadPorSku = useMemo(
    () => Object.fromEntries(catalogo.map((p) => [p.sku, p.disponibilidad])),
    [catalogo],
  );

  const catalogoPorSku = useMemo(() => new Map(catalogo.map((p) => [p.sku, p])), [catalogo]);

  const descartarCambios = useCallback(() => {
    dispatch({ type: "hydrate", cart });
  }, [cart]);

  const value: CartContextValue = {
    items: cart.items,
    createdAt: cart.createdAt,
    subtotalCents: subtotalCents(cart.items),
    itemCount: itemCount(cart.items),
    cambios,
    descartarCambios,
    disponibilidadPorSku,
    hydrated,
    // Lo que reconcile() quitaría no entra, aunque un botón se olvide de
    // impedirlo: la regla vive acá y no solo en la interfaz, igual que el
    // tope por línea vive en el reducer (CLAUDE.md § Modelo de conversión).
    addItem: (item) => {
      if ("motivo" in revisarEntrada(catalogoPorSku.get(item.sku))) return 0;
      const enCarrito = guardado.items.find((i) => i.sku === item.sku)?.qty ?? 0;
      const agregadas = Math.min(MAX_CANTIDAD_POR_LINEA, enCarrito + item.qty) - enCarrito;
      if (agregadas <= 0) return 0;
      dispatch({ type: "add", item, now: new Date().toISOString() });
      return agregadas;
    },
    removeItem: (sku) => dispatch({ type: "remove", sku, now: new Date().toISOString() }),
    setQty: (sku, qty) => dispatch({ type: "setQty", sku, qty, now: new Date().toISOString() }),
    clear: () => dispatch({ type: "clear", now: new Date().toISOString() }),
  };

  return createElement(CartContext.Provider, { value }, children);
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return context;
}
