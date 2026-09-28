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
import { reconcile, type CambioCarrito } from "./reconcile.ts";
import {
  agregarCambiosPendientes,
  CAMBIOS_STORAGE_KEY,
  CAMBIOS_VISTOS_STORAGE_KEY,
  CART_STORAGE_KEY,
  loadCambiosPendientes,
  loadCart,
  marcarCambiosVistos,
  saveCart,
} from "./storage.ts";
import { itemCount, subtotalCents } from "./totals.ts";
import type { Disponibilidad } from "../catalog/types.ts";
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
  // Lo que reconcile() corrigió y el cliente todavía no vio: líneas quitadas
  // por dejar de existir, quedar inactivas o agotarse, o con precio
  // actualizado. Se
  // guardan en localStorage hasta que /carrito los muestra y llama a
  // descartarCambios() — así salen una sola vez, aunque la corrección haya
  // pasado en otra página o en otra pestaña (components/cart/avisos.ts).
  cambios: CambioCarrito[];
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
    // El carrito se guarda ya corregido (efecto de abajo), así que lo que se
    // corrigió se guarda también, sumado a lo que quedó sin avisar de antes
    // DEL MISMO carrito (lib/cart/storage.ts).
    const pendientes = agregarCambiosPendientes(
      reconciliado.createdAt,
      cambiosDetectados,
      Date.now(),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCambios(pendientes);
    // `catalogo` es el snapshot que trajo el Server Component contenedor al
    // renderizar esta página — no cambia durante la vida de la pestaña, así
    // que hidratar solo debe correr una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Otra pestaña cambió el carrito. Sin esto, cada pestaña guardaba SU copia
  // y la última en escribir borraba lo que agregó la otra: abrir una ficha
  // desde un enlace de WhatsApp, agregarla, y seguir en la pestaña de antes
  // perdía ese producto al siguiente cambio. `storage` solo se dispara en las
  // OTRAS pestañas, nunca en la que escribió.
  //
  // Lo que llega de afuera se aplica pero NO se vuelve a guardar
  // (`vinoDeOtraPestaña`): reconcile() puede corregir un precio, y si dos
  // pestañas cargaron catálogos distintos —una abierta antes de un deploy—
  // cada una corregiría a su versión y lo reescribiría, pisándose en bucle.
  // Se guarda recién cuando esta pestaña cambie algo por su cuenta.
  const vinoDeOtraPestaña = useRef(false);
  // El listener de abajo vive mientras dure la pestaña; lee el carrito
  // actual de acá para saber de qué carrito son los avisos que llegan.
  const createdAtActual = useRef(cart.createdAt);
  useEffect(() => {
    createdAtActual.current = cart.createdAt;
  }, [cart.createdAt]);
  useEffect(() => {
    if (!hydrated) return;
    function alCambiarEnOtraPestaña(evento: StorageEvent) {
      // Otra pestaña guardó avisos nuevos o ya los mostró: esta se queda con
      // la misma lista, para no volver a avisar lo que el cliente ya vio.
      if (
        evento.key === CAMBIOS_STORAGE_KEY ||
        evento.key === CAMBIOS_VISTOS_STORAGE_KEY ||
        evento.key === null
      ) {
        setCambios(loadCambiosPendientes(createdAtActual.current));
      }
      if (evento.key !== CART_STORAGE_KEY && evento.key !== null) return;
      const { cart: reconciliado } = reconcile(loadCart(), catalogo);
      vinoDeOtraPestaña.current = true;
      dispatch({ type: "hydrate", cart: reconciliado });
    }
    window.addEventListener("storage", alCambiarEnOtraPestaña);
    return () => window.removeEventListener("storage", alCambiarEnOtraPestaña);
  }, [hydrated, catalogo]);

  useEffect(() => {
    if (!hydrated) return;
    if (vinoDeOtraPestaña.current) {
      vinoDeOtraPestaña.current = false;
      return;
    }
    saveCart(cart);
  }, [cart, hydrated]);

  const disponibilidadPorSku = useMemo(
    () => Object.fromEntries(catalogo.map((p) => [p.sku, p.disponibilidad])),
    [catalogo],
  );

  const descartarCambios = useCallback(() => {
    marcarCambiosVistos(Date.now());
    setCambios([]);
  }, []);

  const value: CartContextValue = {
    items: cart.items,
    createdAt: cart.createdAt,
    subtotalCents: subtotalCents(cart.items),
    itemCount: itemCount(cart.items),
    cambios: cambios ?? [],
    descartarCambios,
    disponibilidadPorSku,
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
