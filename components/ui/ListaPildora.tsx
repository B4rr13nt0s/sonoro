import type { ReactNode } from "react";

// La lista nativa (<select>) en píldora del selector de vehículos, con la
// flecha dibujada más adentro. Va más grande que las de los filtros (texto de
// 15 px, CLASE_SELECT en campos.ts): es lo único de la pestaña y quedaban
// chicas al lado del campo.
//
// `appearance-none` quita la flecha nativa, que el navegador pega al borde de
// la píldora, y con ella el atenuado de una lista deshabilitada: por eso el
// <select> es `peer` y la flecha se apaga con `peer-disabled`. El pr-12 le
// deja sitio. La flecha y la lista viajan juntas en este componente: un
// <select> con esta clase suelto se quedaría sin ninguna flecha.
//
// Sigue siendo un <select> nativo: teclado, lector de pantalla y selector del
// teléfono funcionan sin menús propios.
const CLASE_LISTA =
  "peer border-borde-pildora text-texto-nav w-full appearance-none rounded-full border bg-white py-3.5 pr-12 pl-5 text-[15px] disabled:opacity-50 sm:min-w-40";

export function ListaPildora({
  etiqueta,
  valor,
  deshabilitada = false,
  alCambiar,
  children,
}: {
  /** El nombre accesible de la lista. */
  etiqueta: string;
  valor: string;
  deshabilitada?: boolean;
  alCambiar: (valor: string) => void;
  /** Las <option>. */
  children: ReactNode;
}) {
  return (
    <div className="relative w-full sm:w-auto">
      <select
        aria-label={etiqueta}
        value={valor}
        disabled={deshabilitada}
        onChange={(e) => alCambiar(e.target.value)}
        className={CLASE_LISTA}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 8"
        className="text-texto-nav pointer-events-none absolute top-1/2 right-5 h-2 w-3 -translate-y-1/2 peer-disabled:opacity-50"
      >
        <path
          d="M1 1.5 6 6.5l5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
