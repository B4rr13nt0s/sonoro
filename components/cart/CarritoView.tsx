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
import { useEffect, useMemo, useRef } from "react";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { calcularCuotaCents, formatQ } from "@/lib/format/precio.ts";
import { useCart, type CartItem } from "@/lib/cart/index.ts";
import {
  buildOrderMessage,
  buildOrderRef,
  buildWhatsAppUrl,
  WHATSAPP_NUMBER,
} from "@/lib/whatsapp/index.ts";
import { buildQuoteLogRequest, sendQuoteLog } from "@/lib/quoteLog/index.ts";
import { trackEvent } from "@/lib/analytics/track.ts";

export function CarritoView() {
  const { items, createdAt, subtotalCents, itemCount, hydrated, setQty, removeItem } = useCart();

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

      {!hydrated ? null : items.length === 0 ? (
        <CarritoVacio />
      ) : (
        <div className="grid grid-cols-1 gap-8 px-6 pb-16 sm:px-12 sm:pb-22 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-12">
          <div className="flex flex-col">
            {items.map((item) => (
              <CartLineItem
                key={item.sku}
                item={item}
                onSetQty={(qty) => setQty(item.sku, qty)}
                onRemove={() => removeItem(item.sku)}
              />
            ))}
            <div className="border-borde-tarjeta border-t pt-7">
              <Link href="/" className="text-[15px] text-[#565654]">
                ← Seguir comprando
              </Link>
            </div>
          </div>

          <OrderSummary
            items={items}
            createdAt={createdAt}
            subtotalCents={subtotalCents}
            itemCount={itemCount}
          />
        </div>
      )}
    </div>
  );
}

function CarritoVacio() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 pb-24 text-center sm:px-12">
      <p className="text-texto-secundario text-[17px]">Tu carrito está vacío.</p>
      <Link href="/" className="bg-negro rounded-full px-6 py-3.75 text-[16px] text-white">
        Ver catálogo
      </Link>
    </div>
  );
}

function CartLineItem({
  item,
  onSetQty,
  onRemove,
}: {
  item: CartItem;
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
        <div className="text-texto-terciario font-mono text-[10px] tracking-[0.14em] uppercase">
          {item.sku}
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
              className="flex h-11 w-11 items-center justify-center text-[16px] lg:h-[38px] lg:w-[38px]"
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
}: {
  items: CartItem[];
  createdAt: string;
  subtotalCents: number;
  itemCount: number;
}) {
  const ref = useMemo(() => buildOrderRef(createdAt), [createdAt]);
  const cuota = calcularCuotaCents(subtotalCents, 6);

  // El wa.me hay que armarlo en el cliente: necesita origin (window) para el
  // enlace de "más de 15 líneas" y el número sale de
  // NEXT_PUBLIC_WHATSAPP_NUMBER, nunca incrustado (CLAUDE.md § Modelo de
  // conversión). OrderSummary solo se monta cuando `hydrated` ya es true
  // (CarritoView), así que estamos garantizado en el navegador acá.
  const whatsappUrl = useMemo(() => {
    const cartUrl =
      typeof window !== "undefined" ? `${window.location.origin}/carrito` : "/carrito";
    const mensaje = buildOrderMessage({ items, ref, cartUrl });
    return buildWhatsAppUrl(WHATSAPP_NUMBER, mensaje);
  }, [items, ref]);

  return (
    <div className="border-borde-tarjeta rounded-card-lg flex flex-col gap-5 border p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[22px] font-semibold tracking-[-0.02em]">Resumen</div>
        <div className="text-texto-terciario font-mono text-[11px]">Ref: {ref}</div>
      </div>

      <div className="text-texto-secundario flex flex-col gap-3 text-[15px]">
        <div className="flex justify-between">
          <span>Subtotal ({itemCount} artículos)</span>
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
        onClick={() => {
          // docs/PLAN.md § 6.4: se dispara y se olvida — nunca se espera
          // esta llamada ni se le deja frenar la apertura de WhatsApp
          // (CLAUDE.md: "El cliente dispara la petición y abre WhatsApp
          // sin esperar la respuesta"). Por eso no hay preventDefault ni
          // await: el navegador sigue con la navegación del <a> normal.
          sendQuoteLog(
            buildQuoteLogRequest({ items, ref, subtotalCents, userAgent: navigator.userAgent }),
          );
          trackEvent("whatsapp_click", {
            value: subtotalCents / 100,
            currency: "GTQ",
            ref,
          });
        }}
        className="bg-negro mt-1 rounded-full px-6 py-4 text-center text-[16px] text-white"
      >
        Pedir por WhatsApp
      </a>

      <div className="border-borde-tarjeta text-texto-secundario flex flex-col gap-2.5 border-t pt-5 text-[14px]">
        <div className="flex justify-between">
          <span>Entrega</span>
          <span className="text-negro">24 a 72 horas</span>
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
