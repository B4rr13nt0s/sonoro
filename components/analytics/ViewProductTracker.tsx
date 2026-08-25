"use client";

// La ficha de producto (app/producto/[slug]/page.tsx) es un Server
// Component — igual que AddToCartButton, este tracker es el único pedazo
// interactivo aislado en su propio Client Component, solo para disparar
// view_product al montar.
import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics/track.ts";

type ViewProductTrackerProps = {
  sku: string;
  nombre: string;
  precioCents: number;
};

export function ViewProductTracker({ sku, nombre, precioCents }: ViewProductTrackerProps) {
  useEffect(() => {
    trackEvent("view_product", {
      item_id: sku,
      item_name: nombre,
      price: precioCents / 100,
      currency: "GTQ",
    });
  }, [sku, nombre, precioCents]);

  return null;
}
