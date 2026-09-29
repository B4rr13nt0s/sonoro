"use client";

import { useEffect, useRef, useState } from "react";

import { claseBoton, claseBotonInactivo, type VarianteBoton } from "@/components/ui/boton.ts";
import { trackEvent } from "@/lib/analytics/track.ts";
import { MAX_CANTIDAD_POR_LINEA, useCart } from "@/lib/cart/index.ts";
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
  // Agotado no se puede agregar: el botón queda gris, deshabilitado y dice
  // «Agotado». Sin selector de cantidad, que no tendría a qué sumar.
  const agotado = producto.disponibilidad === "agotado";
  const inactivo = confirmando || agotado;

  function agregar() {
    // Durante la confirmación el botón no se deshabilita de verdad (ver
    // abajo), así que el clic se ignora acá.
    if (inactivo) return;
    const agregadas = addItem({
      sku: producto.sku,
      qty: cantidad,
      unitPriceCents: producto.precioCents,
      currency: producto.moneda,
      nombreSnapshot: producto.nombre,
      imagenSnapshot: producto.imagenes[0]?.url ?? null,
    });
    // Lo que de verdad entró: 0 si el carrito no lo aceptó o la línea ya
    // está en el tope de 99, y menos de lo pedido si lo toca. Eso es lo que se
    // confirma y lo que se mide, no lo que se eligió en el selector.
    if (agregadas === 0) return;
    trackEvent("add_to_quote", {
      item_id: producto.sku,
      item_name: producto.nombre,
      price: producto.precioCents / 100,
      currency: "GTQ",
      quantity: agregadas,
    });

    setAnadidas(agregadas);
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
        // Agotado: deshabilitado de verdad, nunca tuvo el foco. Confirmando:
        // solo aria-disabled. Un `disabled` sobre el botón que el teclado
        // acaba de pulsar le saca el foco —cae en <body>—, el siguiente Tab
        // arranca desde el principio de la página, y el anuncio aria-live
        // queda sobre un control que ya no está en el recorrido.
        disabled={agotado}
        aria-disabled={confirmando || undefined}
        aria-live="polite"
        className={inactivo ? claseBotonInactivo(variante) : claseBoton(variante)}
      >
        {agotado
          ? "Agotado"
          : confirmando
            ? `Has añadido ${anadidas} ${anadidas === 1 ? "ítem" : "ítems"} al carrito.`
            : "Agregar al carrito"}
      </button>

      {/* Mismo control de cantidad que el carrito (CarritoView): píldora con
          borde, 44 px de lado en el teléfono y 38 en escritorio.
          
          Se esconde mientras dura la confirmación (y con el producto
          agotado), y le cede su ancho al
          mensaje. Medido: sin ceder, el botón queda en 201 px en el teléfono
          y 254 en escritorio —la ficha es de dos columnas, no sobra tanto
          como parece— el mensaje se parte en dos líneas y el botón crece de
          54 a 78 px, empujando «Consultar por WhatsApp» justo debajo del dedo
          que acaba de tocar. Con el ancho completo, el mensaje entra en una
          línea y nada se mueve de sitio. */}
      <div
        className={`border-borde-pildora flex-none items-center rounded-full border ${
          inactivo ? "hidden" : "flex"
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
          onClick={() => setCantidad((n) => Math.min(MAX_CANTIDAD_POR_LINEA, n + 1))}
          disabled={cantidad >= MAX_CANTIDAD_POR_LINEA}
          className="flex h-11 w-11 items-center justify-center text-[16px] disabled:opacity-40 lg:h-[38px] lg:w-[38px]"
        >
          +
        </button>
      </div>
    </div>
  );
}
