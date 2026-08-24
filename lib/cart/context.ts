"use client";

// Provider + hook del carrito. Compone lib/cart/reducer.ts (mutaciones),
// lib/cart/storage.ts (persistencia) y lib/cart/reconcile.ts (corrección
// contra el catálogo actual al hidratar) — pero no conoce WhatsApp
// (CLAUDE.md § Modelo de conversión). `catalogo` lo trae un Server
// Component (hoy app/layout.tsx) porque el adaptador de lib/catalog lee el
// filesystem y no corre en el navegador — mismo patrón que /buscar.
//
// Sin JSX (createElement en vez de <CartContext.Provider>) a propósito: así
// el archivo es .ts, no .tsx, y lib/cart/context.test.ts puede importarlo
// bajo `node --test` sin un transform de JSX en el loader de pruebas.
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import { cartReducer } from "./reducer.ts";
import { reconcile, type CambioCarrito } from "./reconcile.ts";
import { loadCart, saveCart } from "./storage.ts";
import { itemCount, subtotalCents } from "./totals.ts";
import { crearCarritoVacio, type CartItem, type CatalogoSku } from "./types.ts";

type NuevoItem = Pick<
  CartItem,
  "sku" | "qty" | "unitPriceCents" | "currency" | "nombreSnapshot" | "imagenSnapshot"
>;

type CartContextValue = {
  items: CartItem[];
  // `createdAt` del carrito — estable mientras no se llame clear() ni se
  // agregue el primer ítem de una sesión nueva. lib/whatsapp/ref.ts lo usa
  // para derivar el Ref (CLAUDE.md § Modelo de conversión: "vendedor y
  // cliente hablan del mismo pedido"), sin que lib/cart conozca WhatsApp —
  // solo expone el dato, no arma el Ref.
  createdAt: string;
  subtotalCents: number;
  itemCount: number;
  // Resultado de reconcile() al hidratar — líneas quitadas por dejar de
  // existir o quedar inactivas, marcadas como agotadas, o con precio
  // actualizado. La UI de /carrito los mostrará (Sesión 13); por ahora solo
  // quedan disponibles vía useCart().
  cambios: CambioCarrito[];
  // false hasta que el efecto de abajo lea localStorage — /carrito lo usa
  // para no mostrar "carrito vacío" un instante antes de que aparezca el
  // carrito real (CLAUDE.md § Modelo de conversión: localStorage no existe
  // durante SSR, así que el primer render del cliente es inevitablemente
  // vacío).
  hydrated: boolean;
  addItem: (item: NuevoItem) => void;
  removeItem: (sku: string) => void;
  setQty: (sku: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

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
  const [cart, dispatch] = useReducer(cartReducer, null, () =>
    crearCarritoVacio(new Date().toISOString()),
  );
  // `null` = todavía no se leyó localStorage. Sirve dos propósitos con un
  // solo useState: es el resultado de reconcile() Y la señal de "ya
  // hidraté" que gatea el efecto de guardado de abajo — sin ella, el primer
  // render (carrito vacío) se persistiría antes de leer localStorage y
  // pisaría un carrito real guardado en una sesión anterior.
  const [cambios, setCambios] = useState<CambioCarrito[] | null>(null);
  const hydrated = cambios !== null;

  useEffect(() => {
    // localStorage no existe durante SSR ni en el primer render del
    // cliente — leerlo es inherentemente un efecto secundario que solo
    // puede correr después de montar, no algo derivable en render
    // (CLAUDE.md § Modelo de conversión: "nunca crashear con un carrito
    // viejo"). setCambios aquí es la señal de hidratación, no un valor
    // derivable de props/estado existente.
    const cargado = loadCart();
    const { cart: reconciliado, cambios: cambiosDetectados } = reconcile(cargado, catalogo);
    dispatch({ type: "hydrate", cart: reconciliado });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCambios(cambiosDetectados);
    // `catalogo` es el snapshot que trajo el Server Component contenedor al
    // renderizar esta página — no cambia durante la vida de la pestaña, así
    // que hidratar solo debe correr una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCart(cart);
  }, [cart, hydrated]);

  const value: CartContextValue = {
    items: cart.items,
    createdAt: cart.createdAt,
    subtotalCents: subtotalCents(cart.items),
    itemCount: itemCount(cart.items),
    cambios: cambios ?? [],
    hydrated,
    addItem: (item) => dispatch({ type: "add", item, now: new Date().toISOString() }),
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
