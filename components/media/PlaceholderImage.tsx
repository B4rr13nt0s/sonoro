// CLAUDE.md § Imágenes: patrón del handoff adoptado tal cual — rayas
// diagonales con etiqueta mono describiendo la foto. Es el componente de más
// bajo nivel: solo dibuja el patrón, no decide cuándo usarlo (eso es
// ProductImage para fotos de producto; otros usos —hero, tarjetas de
// categoría— lo llaman directo porque no tienen un campo `imagenes`).
type PlaceholderImageProps = {
  label: string;
  dark?: boolean;
  className?: string;
};

export function PlaceholderImage({ label, dark = false, className }: PlaceholderImageProps) {
  return (
    <div
      className={`flex items-end overflow-hidden p-3 ${
        dark
          ? "bg-[repeating-linear-gradient(135deg,#16161a_0_10px,#1d1d22_10px_20px)]"
          : "bg-[repeating-linear-gradient(135deg,#efefec_0_10px,#f7f7f5_10px_20px)]"
      } ${className ?? ""}`}
    >
      {/* line-clamp-3 + overflow-hidden: el nombre de producto no tiene
          límite de longitud en el esquema (lib/catalog/types.ts), y esta
          etiqueta vive en cajas de tamaño fijo (p. ej. la línea del
          carrito, 100×110px) — sin esto, un nombre suficientemente largo
          se desborda de la caja y termina flotando sobre el contenido de
          arriba. */}
      <span
        className={`line-clamp-3 font-mono text-[10px] tracking-[0.08em] ${dark ? "text-texto-sobre-negro" : "text-texto-terciario"}`}
      >
        {label}
      </span>
    </div>
  );
}
