// Iconos de los datos de contacto (pie y /nosotros). Mismo patrón que los
// del header: SVG en línea, sin librería, `aria-hidden` porque el dato que
// acompañan ya se lee como texto.
//
// Dibujados con `currentColor` y no con el negro fijo del header: acá el
// texto va en gris terciario o secundario según dónde se use, y el icono
// tiene que ir del mismo color que su dato.
//
// 14 px: la línea del pie es de 11 px y la de /nosotros de 15, así que un
// icono de 14 lee igual en las dos sin desalinear la línea.
type Props = { className?: string };

const BASE = "shrink-0";

export function IconoTelefono({ className = "" }: Props) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`${BASE} ${className}`}
    >
      <path
        d="M5.6 2.5H3.4c-.5 0-.9.4-.9.9C2.5 9 7 13.5 12.6 13.5c.5 0 .9-.4.9-.9v-2.2l-2.6-.9-1.3 1.3a9.6 9.6 0 0 1-3.4-3.4l1.3-1.3-1.9-3.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconoCorreo({ className = "" }: Props) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`${BASE} ${className}`}
    >
      <rect
        x="1.9"
        y="3.4"
        width="12.2"
        height="9.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="m2.4 4.6 5.6 4 5.6-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconoInstagram({ className = "" }: Props) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`${BASE} ${className}`}
    >
      <rect
        x="1.9"
        y="1.9"
        width="12.2"
        height="12.2"
        rx="3.6"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11.6" cy="4.4" r="0.85" fill="currentColor" />
    </svg>
  );
}
