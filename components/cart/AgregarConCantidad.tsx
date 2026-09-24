"use client";

import { useEffect, useRef, useState } from "react";

import { claseBoton, type VarianteBoton } from "@/components/ui/boton.ts";
import { trackEvent } from "@/lib/analytics/track.ts";
import { useCart } from "@/lib/cart/index.ts";
import type { Producto } from "@/lib/catalog/index.ts";

/**
 * «Agregar al carrito» con selector de cantidad, para la ficha de producto.
 *
 * Vive aparte de AddToCartButton, que sigue siendo el botón pelado: ese se
 * usa también en las columnas de la tabla comparativa, que en móvil miden
 * 132 px y no tienen sitio para un selector.
 */

/** Cuánto dura el mensaje de confirmación, con el botón sin responder. */
const CONFIRMACION_MS = 5000;

/**
 * Tope del selector. No es una regla del negocio —un instalador puede pedir
 * veinte bocinas— sino un freno a la cantidad absurda: el registro de
 * cotizaciones descarta las líneas con más de 999 unidades
 * (lib/quoteLog/types.ts), así que un pedido que pase de ahí se cerraría por
 * WhatsApp sin quedar registrado.
 */
const MAX_CANTIDAD = 99;

export function AgregarConCantidad({
  producto,
  variante = "principal",
}: {
  producto: Producto;
  variante?: VarianteBoton;
}) {
  const { addItem } = useCart();
  const [cantidad, setCantidad] = useState(1);
  // Cuántas unidades se acaban de agregar; null = el botón está normal.
  const [anadidas, setAnadidas] = useState<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si el visitante navega a otra ficha antes de que pasen los 5 s, el
  // temporizador seguiría vivo y llamaría a setAnadidas sobre un componente
  // desmontado.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const confirmando = anadidas !== null;

  function agregar() {
    addItem({
      sku: producto.sku,
      qty: cantidad,
      unitPriceCents: producto.precioCents,
      currency: producto.moneda,
      nombreSnapshot: producto.nombre,
      imagenSnapshot: producto.imagenes[0]?.url ?? null,
    });
    trackEvent("add_to_quote", {
      item_id: producto.sku,
      item_name: producto.nombre,
      price: producto.precioCents / 100,
      currency: "GTQ",
      quantity: cantidad,
    });

    setAnadidas(cantidad);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAnadidas(null), CONFIRMACION_MS);
  }

  return (
    <div className="flex items-stretch gap-3">
      {/* `aria-live` para que un lector de pantalla cante el cambio de texto:
          sin esto la confirmación es solo visual, y quien no ve la pantalla
          no se entera de que su clic hizo algo. */}
      <button
        type="button"
        onClick={agregar}
        disabled={confirmando}
        aria-live="polite"
        className={
          confirmando
            ? // El mismo botón, en negro al 60 % sobre blanco (≈ #6D6D6D, 5.0:1
              // contra el texto blanco) y sin el hover ni el `scale` del
              // original: mientras no responde, no debe parecer que responde.
              `${claseBoton(variante)} bg-negro/60 pointer-events-none border-transparent text-white`
            : claseBoton(variante)
        }
      >
        {confirmando
          ? `Has añadido ${anadidas} ${anadidas === 1 ? "ítem" : "ítems"} al carrito.`
          : "Agregar al carrito"}
      </button>

      {/* Mismo control de cantidad que el carrito (CarritoView): píldora con
          borde, 44 px de lado en el teléfono y 38 en escritorio.
          
          Se esconde mientras dura la confirmación, y le cede su ancho al
          mensaje. Medido: sin ceder, el botón queda en 201 px en el teléfono
          y 254 en escritorio —la ficha es de dos columnas, no sobra tanto
          como parece— el mensaje se parte en dos líneas y el botón crece de
          54 a 78 px, empujando «Consultar por WhatsApp» justo debajo del dedo
          que acaba de tocar. Con el ancho completo, el mensaje entra en una
          línea y nada se mueve de sitio. */}
      <div
        className={`border-borde-pildora flex-none items-center rounded-full border ${
          confirmando ? "hidden" : "flex"
        }`}
      >
        <button
          type="button"
          aria-label={`Quitar una unidad de ${producto.nombre}`}
          onClick={() => setCantidad((n) => Math.max(1, n - 1))}
          disabled={cantidad <= 1}
          className="text-texto-secundario flex h-11 w-11 items-center justify-center text-[16px] disabled:opacity-40 lg:h-[38px] lg:w-[38px]"
        >
          −
        </button>
        {/* El número no es un campo de texto: con uno habría que validar lo
            que se escriba, y aquí solo hay que sumar y restar de a uno. */}
        <span
          aria-label={`Cantidad: ${cantidad}`}
          className="min-w-[24px] text-center text-[15px] font-medium"
        >
          {cantidad}
        </span>
        <button
          type="button"
          aria-label={`Agregar una unidad de ${producto.nombre}`}
          onClick={() => setCantidad((n) => Math.min(MAX_CANTIDAD, n + 1))}
          disabled={cantidad >= MAX_CANTIDAD}
          className="flex h-11 w-11 items-center justify-center text-[16px] disabled:opacity-40 lg:h-[38px] lg:w-[38px]"
        >
          +
        </button>
      </div>
    </div>
  );
}
