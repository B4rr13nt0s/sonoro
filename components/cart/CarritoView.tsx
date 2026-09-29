"use client";

// Client Component completo (CLAUDE.md § Modelo de conversión: el carrito
// vive en localStorage, no hay nada que un Server Component pueda traer de
// antemano) — app/carrito/page.tsx solo aporta metadata estática y renderiza
// esto. Conserva la estructura del resumen del handoff (design/carrito.html):
// subtotal, envío, total en 28px, cuota, botón negro a todo el ancho,
// condiciones en mono al final. El handoff fue diseñado para pago en línea
// ("Continuar al pago" → checkout.html); esta etapa no tiene checkout, así
// que ese botón es «Pedir por WhatsApp» y nunca enlaza a /checkout ni a
// design/checkout.html (CLAUDE.md § reglas).
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { avisosDeCambios } from "@/components/cart/avisos.ts";
import { PildoraDisponibilidad } from "@/components/catalog/PildoraDisponibilidad";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { claseBoton } from "@/components/ui/boton.ts";
import type { Disponibilidad } from "@/lib/catalog/index.ts";
import { calcularCuotaCents, formatQ } from "@/lib/format/precio.ts";
import {
  acumularCambios,
  MAX_CANTIDAD_POR_LINEA,
  useCart,
  type CambioCarrito,
  type CartItem,
} from "@/lib/cart/index.ts";
import {
  buildOrderMessage,
  buildOrderRef,
  buildWhatsAppUrl,
  WHATSAPP_NUMBER,
} from "@/lib/whatsapp/index.ts";
import { buildQuoteLogRequest, sendQuoteLog } from "@/lib/quoteLog/index.ts";
import { trackEvent } from "@/lib/analytics/track.ts";

export function CarritoView() {
  const {
    items,
    createdAt,
    subtotalCents,
    itemCount,
    hydrated,
    cambios,
    descartarCambios,
    disponibilidadPorSku,
    setQty,
    removeItem,
    clear,
  } = useCart();

  // Los avisos salen UNA vez: al llegar a esta página se copian acá y se
  // descartan del carrito (y de localStorage), así que la próxima visita ya
  // no los trae. Quedan atados al carrito en el que se mostraron: al pedir
  // por WhatsApp el carrito se vacía con un `createdAt` nuevo, y un «Se quitó
  // X» sobre el pedido que ya salió no dice nada.
  //
  // Solo con la pestaña a la vista: una pestaña de /carrito abierta en
  // segundo plano también recibe los avisos que escribe otra (evento
  // `storage`), y si los tomara los descartaría sin que nadie los viera.
  const visible = useSyncExternalStore(suscribirVisibilidad, pestañaVisible, () => false);
  const [vistos, setVistos] = useState<{ createdAt: string; cambios: CambioCarrito[] } | null>(
    null,
  );
  useEffect(() => {
    if (!hydrated || !visible || cambios.length === 0) return;
    // Copiar al estado local ES el propósito: el contexto los descarta en la
    // línea siguiente y esta visita todavía tiene que mostrarlos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVistos((previos) => ({
      createdAt,
      cambios:
        previos && previos.createdAt === createdAt
          ? acumularCambios(previos.cambios, cambios)
          : cambios,
    }));
    descartarCambios();
  }, [hydrated, visible, cambios, createdAt, descartarCambios]);

  const avisos = useMemo(
    () =>
      vistos && vistos.createdAt === createdAt
        ? avisosDeCambios(vistos.cambios, new Set(items.map((item) => item.sku)))
        : [],
    [vistos, createdAt, items],
  );

  // Una sola vez por carrito con contenido — mismo patrón de ref-guard que
  // CartLink en SiteHeader.tsx usa para su animación, para no disparar
  // open_quote en cada re-render (p. ej. al cambiar una cantidad).
  const yaDisparado = useRef(false);
  useEffect(() => {
    if (!hydrated || items.length === 0 || yaDisparado.current) return;
    yaDisparado.current = true;
    trackEvent("open_quote", {
      value: subtotalCents / 100,
      currency: "GTQ",
      items_count: itemCount,
    });
  }, [hydrated, items.length, subtotalCents, itemCount]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-12 pb-8 sm:px-12 sm:pt-16 sm:pb-10">
        <h1 className="text-40 sm:text-48 font-semibold tracking-[-0.035em]">Carrito</h1>
      </div>

      {/* Fuera de las dos ramas de abajo: si reconcile() quitó todas las
          líneas, el carrito queda vacío y el cliente igual tiene que saber
          por qué. Misma tarjeta que los productos omitidos de /comparar.
          La región `status` está SIEMPRE montada y el contenido llega
          después: un lector de pantalla no anuncia una región viva que
          aparece ya con su texto adentro. */}
      <div role="status">
        {avisos.length > 0 ? (
          <div className="px-6 pb-8 sm:px-12">
            <div className="border-borde-tarjeta rounded-card text-texto-secundario flex flex-col gap-1 border p-5 text-[14px]">
              {/* Índice como key: la lista no se reordena, y dos avisos
                  pueden decir lo mismo (dos productos con el mismo nombre). */}
              {avisos.map((aviso, i) => (
                <span key={i}>{aviso}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {!hydrated ? null : items.length === 0 ? (
        <CarritoVacio />
      ) : (
        <div className="grid grid-cols-1 gap-8 px-6 pb-16 sm:px-12 sm:pb-22 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-12">
          <div className="flex flex-col">
            {items.map((item) => (
              <CartLineItem
                key={item.sku}
                item={item}
                disponibilidad={disponibilidadPorSku[item.sku]}
                onSetQty={(qty) => setQty(item.sku, qty)}
                onRemove={() => removeItem(item.sku)}
              />
            ))}
            <div className="border-borde-tarjeta border-t pt-7">
              <Link href="/catalogo" className="text-texto-suave text-[15px]">
                ← Seguir comprando
              </Link>
            </div>
          </div>

          <OrderSummary
            onPedidoEnviado={clear}
            items={items}
            createdAt={createdAt}
            subtotalCents={subtotalCents}
            itemCount={itemCount}
            disponibilidadPorSku={disponibilidadPorSku}
          />
        </div>
      )}
    </div>
  );
}

function suscribirVisibilidad(alCambiar: () => void) {
  document.addEventListener("visibilitychange", alCambiar);
  return () => document.removeEventListener("visibilitychange", alCambiar);
}

function pestañaVisible() {
  return document.visibilityState === "visible";
}

function CarritoVacio() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 pb-24 text-center sm:px-12">
      <p className="text-texto-secundario text-[17px]">Tu carrito está vacío.</p>
      <Link href="/catalogo" className={claseBoton("principal")}>
        Ver catálogo
      </Link>
    </div>
  );
}

function CartLineItem({
  item,
  disponibilidad,
  onSetQty,
  onRemove,
}: {
  item: CartItem;
  disponibilidad: Disponibilidad | undefined;
  onSetQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const totalLinea = item.unitPriceCents * item.qty;

  return (
    <div className="border-borde-tarjeta flex gap-4 border-t py-6 sm:gap-6 sm:py-7">
      {item.imagenSnapshot ? (
        <div className="relative h-[110px] w-[100px] flex-none overflow-hidden rounded-[10px] sm:w-[140px]">
          <Image
            src={item.imagenSnapshot}
            alt={item.nombreSnapshot}
            fill
            // La miniatura mide 100 px (140 en sm): sin `sizes`, `fill`
            // bajaba una imagen del ancho de la ventana.
            sizes="140px"
            className="object-cover"
          />
        </div>
      ) : (
        <PlaceholderImage
          label={`FOTO — ${item.nombreSnapshot}`}
          className="h-[110px] w-[100px] flex-none rounded-[10px] sm:w-[140px]"
        />
      )}

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-texto-terciario font-mono text-[10px] tracking-[0.14em] uppercase">
            {item.sku}
          </span>
          {/* Bajo pedido se puede pedir igual —el vendedor confirma—, pero
              el cliente tiene que verlo antes de mandar el pedido. La misma
              píldora que la ficha. (Lo agotado no llega acá: reconcile() lo
              quita del carrito.) */}
          <PildoraDisponibilidad disponibilidad={disponibilidad} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[17px] font-semibold tracking-[-0.015em] sm:text-[19px]">
            {item.nombreSnapshot}
          </div>
          <div className="flex-none text-[17px] font-semibold sm:text-[19px]">
            {formatQ(totalLinea)}
          </div>
        </div>
        <div className="flex items-center gap-4 pt-3.5">
          <div className="border-borde-pildora flex items-center rounded-full border">
            <button
              type="button"
              aria-label={`Quitar una unidad de ${item.nombreSnapshot}`}
              onClick={() => onSetQty(item.qty - 1)}
              className="text-texto-secundario flex h-11 w-11 items-center justify-center text-[16px] lg:h-[38px] lg:w-[38px]"
            >
              −
            </button>
            <span className="min-w-[24px] text-center text-[15px] font-medium">{item.qty}</span>
            <button
              type="button"
              aria-label={`Agregar una unidad de ${item.nombreSnapshot}`}
              onClick={() => onSetQty(item.qty + 1)}
              disabled={item.qty >= MAX_CANTIDAD_POR_LINEA}
              className="flex h-11 w-11 items-center justify-center text-[16px] disabled:opacity-40 lg:h-[38px] lg:w-[38px]"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-texto-secundario px-2 py-3 text-[14px] lg:p-0"
          >
            Quitar
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({
  items,
  createdAt,
  subtotalCents,
  itemCount,
  onPedidoEnviado,
  disponibilidadPorSku,
}: {
  disponibilidadPorSku: Readonly<Record<string, Disponibilidad>>;
  items: CartItem[];
  createdAt: string;
  subtotalCents: number;
  itemCount: number;
  onPedidoEnviado: () => void;
}) {
  // El Ref sale del carrito ENTERO —cuándo nació y qué lleva— para que dos
  // pedidos distintos del mismo carrito no compartan identificador (ver
  // lib/whatsapp/ref.ts).
  const ref = useMemo(() => buildOrderRef(createdAt, items), [createdAt, items]);
  const cuota = calcularCuotaCents(subtotalCents, 6);

  // El número sale de NEXT_PUBLIC_WHATSAPP_NUMBER, nunca incrustado
  // (CLAUDE.md § Modelo de conversión). El mensaje lleva siempre la lista
  // completa: ver lib/whatsapp/message.ts.
  const whatsappUrl = useMemo(
    () =>
      buildWhatsAppUrl(
        WHATSAPP_NUMBER,
        buildOrderMessage({ items, ref, disponibilidad: disponibilidadPorSku }),
      ),
    [items, ref, disponibilidadPorSku],
  );

  // Lo que pasa al pedir. Va en onClick Y en onAuxClick: con clic medio
  // (o la rueda) el navegador abre WhatsApp en otra pestaña sin disparar
  // `click`, y el pedido salía sin registrarse ni vaciar el carrito. «Abrir
  // en pestaña nueva» desde el menú contextual no dispara ningún evento: ese
  // camino sigue sin cubrirse.
  function registrarPedido() {
    // docs/PLAN.md § 6.4: se dispara y se olvida — nunca se espera
    // esta llamada ni se le deja frenar la apertura de WhatsApp
    // (CLAUDE.md: "El cliente dispara la petición y abre WhatsApp
    // sin esperar la respuesta"). Por eso no hay preventDefault ni
    // await: el navegador sigue con la navegación del <a> normal.
    sendQuoteLog(
      buildQuoteLogRequest({
        items,
        ref,
        subtotalCents,
        userAgent: navigator.userAgent,
        disponibilidad: disponibilidadPorSku,
      }),
    );
    trackEvent("whatsapp_click", {
      value: subtotalCents / 100,
      currency: "GTQ",
      ref,
    });
    // El pedido ya salió: el carrito se vacía para que el siguiente
    // empiece de cero, con su propio `createdAt` y su propio Ref.
    //
    // En un setTimeout y no aquí mismo: vaciar sincrónicamente hace que
    // React re-renderice DENTRO del clic —el carrito pasa a vacío y este
    // <a> se desmonta— antes de que el navegador ejecute la navegación
    // del enlace, y WhatsApp no llega a abrirse. Con el temporizador, la
    // navegación ya arrancó cuando el carrito se limpia.
    setTimeout(onPedidoEnviado, 0);
  }

  return (
    <div className="border-borde-tarjeta rounded-card-lg flex flex-col gap-5 border p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[22px] font-semibold tracking-[-0.02em]">Resumen</div>
        <div className="text-texto-terciario font-mono text-[11px]">Ref: {ref}</div>
      </div>

      <div className="text-texto-secundario flex flex-col gap-3 text-[15px]">
        <div className="flex justify-between">
          <span>
            Subtotal ({itemCount} {itemCount === 1 ? "artículo" : "artículos"})
          </span>
          <span className="text-negro">{formatQ(subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Envío</span>
          <span className="text-negro">Gratis</span>
        </div>
      </div>

      <div className="border-borde-tarjeta flex items-baseline justify-between border-t pt-5">
        <span className="text-[17px] font-semibold">Total</span>
        <span className="text-[28px] font-semibold tracking-[-0.025em]">
          {formatQ(subtotalCents)}
        </span>
      </div>
      <div className="text-texto-secundario text-[14px]">
        o {formatQ(cuota)} al mes × 6 · IVA incluido
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={registrarPedido}
        onAuxClick={(evento) => {
          if (evento.button === 1) registrarPedido();
        }}
        className="bg-negro mt-1 rounded-full px-6 py-4 text-center text-[16px] text-white"
      >
        Pedir por WhatsApp
      </a>

      <div className="border-borde-tarjeta text-texto-secundario flex flex-col gap-2.5 border-t pt-5 text-[14px]">
        <div className="flex justify-between">
          <span>Entrega</span>
          <span className="text-negro">Según el departamento</span>
        </div>
        <div className="flex justify-between">
          <span>Pagos</span>
          <span className="text-negro">Hasta 6 pagos precio contado.</span>
        </div>
      </div>
      <div className="text-texto-terciario font-mono text-[11px]">
        Envíos gratis a todo el país. Aplican restricciones según destino y volumen del pedido.
      </div>
    </div>
  );
}
