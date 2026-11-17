// La foto de una línea del carrito. El CartItem guarda `imagenSnapshot` (la
// URL de la foto al agregar), pero esa URL envejece: las fotos pasaron de
// /productos/… (public/) a Vercel Blob, y un carrito guardado antes del cambio
// traería una imagen rota. Lo que se muestra se deriva del catálogo, como el
// precio y la disponibilidad (CLAUDE.md § Reglas del carrito).
const PREFIJO_VIEJO = "/productos/";

/**
 * La foto del catálogo si la hay; si no, el snapshot, salvo que sea una ruta
 * vieja de public/ (ya no existe: null → el componente dibuja el placeholder).
 */
export function fotoDeLinea(
  snapshot: string | null,
  fotoCatalogo: string | undefined,
): string | null {
  if (fotoCatalogo) return fotoCatalogo;
  if (!snapshot || snapshot.startsWith(PREFIJO_VIEJO)) return null;
  return snapshot;
}
