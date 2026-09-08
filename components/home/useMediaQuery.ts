"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Media query como fuente externa, no como estado sincronizado en un
 * efecto: `useSyncExternalStore` lee el valor real en el primer render del
 * cliente en vez de renderizar `false` y corregirlo después, y el snapshot
 * de servidor fijo en `false` evita el desajuste de hidratación.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
