"use client";

// El aviso pendiente del comparador: lo levanta CompararToggle desde una
// tarjeta o desde la ficha, y lo dibuja BarraComparador.
//
// Vive aparte del estado de la selección (lib/comparador/) a propósito: la
// selección es lo que se persiste y se comparte, esto es efímero de la
// pantalla. Mezclarlos habría metido texto de UI dentro de lo que se guarda
// en localStorage.
//
// Sin JSX (createElement) por la misma razón que lib/cart/context.ts: mantiene
// el archivo en .ts.
import { usePathname } from "next/navigation";
import { createContext, createElement, useContext, useState, type ReactNode } from "react";

import type { ProductoComparable } from "@/lib/comparador/index.ts";

export type AvisoComparador =
  // Se intentó agregar por encima del máximo.
  | { tipo: "lleno" }
  // Se intentó agregar de otra categoría: hay que ofrecer reemplazar.
  | {
      tipo: "otra_categoria";
      categoriaActual: string;
      producto: ProductoComparable;
      nombre: string;
    };

type AvisoContextValue = {
  aviso: AvisoComparador | null;
  levantar: (aviso: AvisoComparador) => void;
  descartar: () => void;
};

const AvisoContext = createContext<AvisoContextValue | null>(null);

export function AvisoComparadorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // La ruta viaja DENTRO del estado, y el aviso se descarta comparándola
  // durante el render — el patrón que React documenta para reiniciar estado
  // cuando cambia una entrada. Hacerlo en un efecto dejaría pintar un frame
  // con el aviso viejo, además de disparar la regla set-state-in-effect.
  //
  // Hace falta porque el provider vive en el layout: sin esto, una pregunta
  // lanzada en /catalogo/bocinas seguiría viva después de navegar a
  // /producto/x, ya sin relación con lo que el usuario está viendo.
  const [estado, setEstado] = useState<{ aviso: AvisoComparador | null; pathname: string }>({
    aviso: null,
    pathname,
  });

  if (estado.pathname !== pathname) {
    setEstado({ aviso: null, pathname });
  }

  const value: AvisoContextValue = {
    aviso: estado.pathname === pathname ? estado.aviso : null,
    levantar: (aviso) => setEstado({ aviso, pathname }),
    descartar: () => setEstado({ aviso: null, pathname }),
  };

  return createElement(AvisoContext.Provider, { value }, children);
}

export function useAvisoComparador(): AvisoContextValue {
  const context = useContext(AvisoContext);
  if (!context) {
    throw new Error("useAvisoComparador debe usarse dentro de <AvisoComparadorProvider>");
  }
  return context;
}
