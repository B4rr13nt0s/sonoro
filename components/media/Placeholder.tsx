// Placeholder de imagen — CLAUDE.md § Imágenes: "El placeholder es un estado
// de renderizado, no un dato". Se muestra cuando `producto.imagenes` está
// vacío; nunca se escriben rutas de placeholder en el catálogo.
type PlaceholderProps = {
  label: string;
  dark?: boolean;
  className?: string;
};

export function Placeholder({ label, dark = false, className }: PlaceholderProps) {
  return (
    <div
      className={`flex items-end p-3 ${
        dark
          ? "bg-[repeating-linear-gradient(135deg,#16161a_0_10px,#1d1d22_10px_20px)]"
          : "bg-[repeating-linear-gradient(135deg,#efefec_0_10px,#f7f7f5_10px_20px)]"
      } ${className ?? ""}`}
    >
      <span
        className={`font-mono text-[10px] tracking-[0.08em] ${dark ? "text-texto-sobre-negro" : "text-texto-terciario"}`}
      >
        {label}
      </span>
    </div>
  );
}
