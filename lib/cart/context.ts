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
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { cartReducer, type CartAction } from "./reducer.ts";
import { reconcile, revisarEntrada, SIN_CAMBIOS, type CambioCarrito } from "./reconcile.ts";
import { CART_STORAGE_KEY, limpiarClavesViejas, loadCart, saveCart } from "./storage.ts";
import { itemCount, subtotalCents } from "./totals.ts";
import type { Disponibilidad } from "../catalog/types.ts";
import {
  crearCarritoVacio,
  MAX_CANTIDAD_POR_LINEA,
  type Cart,
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

// El carrito guardado vive fuera de React, en un almacén que las acciones
// leen y escriben EN EL MISMO LLAMADO, sin esperar al re-render:
//
// - Dos addItem() seguidos (doble clic) antes de renderizar veían el mismo
//   carrito viejo, y el segundo decía «Has añadido 1» aunque la línea ya
//   estuviera en el tope.
// - Guardar en localStorage desde un efecto, como antes, dejaba una ventana
//   entre el cambio y la escritura: si en ese hueco llegaba el evento
//   `storage` de otra pestaña, React corría el efecto pendiente ya con la
//   marca de «vino de otra pestaña» puesta, no guardaba el cambio local y el
//   producto recién agregado se perdía. Un manejador de eventos corre entero
//   antes que el siguiente, así que acá no hay hueco.
//
// React lo lee con useSyncExternalStore. (Un useRef hacía lo mismo, pero la
// regla react-hooks/refs no deja pasar en el contexto funciones que lo leen.)
class AlmacenCarrito {
  // Un solo objeto, reemplazado entero en cada cambio: el carrito y la marca
  // de hidratación llegan a React en el MISMO render. Con la marca en un
  // useState aparte, un frame mostraba el carrito recién leído sin corregir.
  #estado: { guardado: Cart; hidratado: boolean };
  #oyentes = new Set<() => void>();

  constructor(inicial: Cart) {
    this.#estado = { guardado: inicial, hidratado: false };
  }

  leer = () => this.#estado;

  suscribir = (oyente: () => void): (() => void) => {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  };

  /**
   * El carrito leído de localStorage. Se vuelve a guardar para dejar
   * persistida una migración o un tope aplicado por loadCart().
   */
  hidratar = (cart: Cart): void => {
    this.#estado = { guardado: cart, hidratado: true };
    saveCart(cart);
    this.#avisar();
  };

  /**
   * Toda mutación pasa por acá. `guardar: false` es para lo que ya está
   * guardado (lo que llega de otra pestaña). Antes de hidratar no se guarda
   * nada: el carrito vacío inicial pisaría uno real.
   */
  aplicar = (accion: CartAction, guardar: boolean): void => {
    const siguiente = cartReducer(this.#estado.guardado, accion);
    if (siguiente === this.#estado.guardado) return;
    this.#estado = { ...this.#estado, guardado: siguiente };
    if (guardar && this.#estado.hidratado) saveCart(siguiente);
    this.#avisar();
  };

  #avisar(): void {
    for (const oyente of this.#oyentes) oyente();
  }
}

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
//
// Consecuencia asumida: una línea agotada queda guardada, oculta, hasta que
// /carrito la quita; si el producto vuelve antes, la línea reaparece. El
// cliente nunca vio el aviso de que se había ido, así que no hay nada que
// desdecir.
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
  const [almacen] = useState(() => new AlmacenCarrito(crearCarritoVacio(new Date().toISOString())));
  const { guardado, hidratado: hydrated } = useSyncExternalStore(
    almacen.suscribir,
    almacen.leer,
    almacen.leer,
  );
  const aplicar = almacen.aplicar;

  useEffect(() => {
    // localStorage no existe durante SSR ni en el primer render del
    // cliente — leerlo es inherentemente un efecto secundario que solo
    // puede correr después de montar (CLAUDE.md § Modelo de conversión:
    // "nunca crashear con un carrito viejo").
    almacen.hidratar(loadCart());
    limpiarClavesViejas();
  }, [almacen]);

  // Otra pestaña cambió el carrito. Sin esto, cada pestaña guardaba SU copia
  // y la última en escribir borraba lo que agregó la otra: abrir una ficha
  // desde un enlace de WhatsApp, agregarla, y seguir en la pestaña de antes
  // perdía ese producto al siguiente cambio. `storage` solo se dispara en las
  // OTRAS pestañas, nunca en la que escribió. Lo que llega se adopta tal cual
  // y no se vuelve a guardar: es exactamente lo que ya está guardado.
  useEffect(() => {
    if (!hydrated) return;
    function alCambiarEnOtraPestaña(evento: StorageEvent) {
      if (evento.key !== CART_STORAGE_KEY && evento.key !== null) return;
      aplicar({ type: "hydrate", cart: loadCart() }, false);
    }
    window.addEventListener("storage", alCambiarEnOtraPestaña);
    return () => window.removeEventListener("storage", alCambiarEnOtraPestaña);
  }, [hydrated, aplicar]);

  // Lo que se muestra: el guardado corregido contra el catálogo. Antes de
  // hidratar no hay nada que corregir ni que avisar.
  const { cart, cambios } = useMemo(
    () => (hydrated ? reconcile(guardado, catalogo) : { cart: guardado, cambios: SIN_CAMBIOS }),
    [guardado, catalogo, hydrated],
  );

  const disponibilidadPorSku = useMemo(
    () => Object.fromEntries(catalogo.map((p) => [p.sku, p.disponibilidad])),
    [catalogo],
  );

  const catalogoPorSku = useMemo(() => new Map(catalogo.map((p) => [p.sku, p])), [catalogo]);

  // Corrige lo guardado AHORA, no el carrito del último render: entre ese
  // render y la llamada pudo entrar un cambio.
  const descartarCambios = useCallback(() => {
    aplicar({ type: "hydrate", cart: reconcile(almacen.leer().guardado, catalogo).cart }, true);
  }, [almacen, aplicar, catalogo]);

  // Lo que reconcile() quitaría no entra, aunque un botón se olvide de
  // impedirlo: la regla vive acá y no solo en la interfaz, igual que el
  // tope por línea vive en el reducer (CLAUDE.md § Modelo de conversión).
  const addItem = useCallback(
    (item: NuevoItem) => {
      if ("motivo" in revisarEntrada(catalogoPorSku.get(item.sku))) return 0;
      const enCarrito = almacen.leer().guardado.items.find((i) => i.sku === item.sku)?.qty ?? 0;
      const agregadas = Math.min(MAX_CANTIDAD_POR_LINEA, enCarrito + item.qty) - enCarrito;
      if (agregadas <= 0) return 0;
      aplicar({ type: "add", item, now: new Date().toISOString() }, true);
      return agregadas;
    },
    [almacen, aplicar, catalogoPorSku],
  );

  const acciones = useMemo(
    () => ({
      removeItem: (sku: string) =>
        aplicar({ type: "remove", sku, now: new Date().toISOString() }, true),
      setQty: (sku: string, qty: number) =>
        aplicar({ type: "setQty", sku, qty, now: new Date().toISOString() }, true),
      clear: () => aplicar({ type: "clear", now: new Date().toISOString() }, true),
    }),
    [aplicar],
  );

  const value: CartContextValue = {
    items: cart.items,
    createdAt: cart.createdAt,
    subtotalCents: subtotalCents(cart.items),
    itemCount: itemCount(cart.items),
    cambios,
    descartarCambios,
    disponibilidadPorSku,
    hydrated,
    addItem,
    ...acciones,
  };

  return createElement(CartContext.Provider, { value }, children);
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return context;
}
