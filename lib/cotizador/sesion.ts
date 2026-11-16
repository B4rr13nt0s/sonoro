// Cotizador privado (docs/superpowers/specs/2026-11-16-cotizador-design.md):
// sesión de un solo usuario, sin cuentas ni base de datos. La contraseña vive
// en la variable de servidor COTIZADOR_PASSWORD; la cookie lleva su propia
// fecha de expiración firmada con esa misma contraseña, así que cambiarla
// cierra todas las sesiones abiertas.
//
// Lógica pura, con el reloj inyectado (`ahoraS`, segundos), para probarla con
// node --test. Quien lee la cookie y la variable de entorno es
// lib/cotizador/acceso.ts: este archivo no toca ninguna de las dos.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_COTIZADOR = "cotizador";

/** Siete días, en segundos. */
export const DURACION_SESION_S = 7 * 24 * 60 * 60;

/**
 * Menos que esto se trata como «sin contraseña»: la ruta cierra en vez de
 * quedar protegida por algo adivinable. La seguridad del cotizador ES la
 * contraseña, y no hay límite de intentos que valga entre instancias.
 */
export const LARGO_MINIMO_CONTRASENA = 12;

const EXPIRA = /^\d{1,12}$/;
const HEX_HMAC = /^[0-9a-f]{64}$/;

/**
 * La contraseña tal cual (sin `trim`: un espacio al borde es parte de ella) o
 * `null` si falta, está vacía, es solo espacios o es demasiado corta.
 */
export function contrasenaConfigurada(valor: string | undefined): string | null {
  if (valor === undefined) return null;
  if (valor.trim() === "") return null;
  if (valor.length < LARGO_MINIMO_CONTRASENA) return null;
  return valor;
}

function sha256(texto: string): Buffer {
  return createHash("sha256").update(texto).digest();
}

/**
 * Comparación en tiempo constante. Se comparan los SHA-256 de las dos cadenas,
 * que miden siempre 32 bytes: así `timingSafeEqual` no lanza con largos
 * distintos y el largo de la contraseña real no se filtra por el tiempo.
 */
export function contrasenaCorrecta(intento: string, contrasena: string): boolean {
  return timingSafeEqual(sha256(intento), sha256(contrasena));
}

function firma(contrasena: string, expira: string): string {
  return createHmac("sha256", contrasena).update(`cotizador-v1.${expira}`).digest("hex");
}

/** `"<expira>.<hex>"`: el valor de la cookie. */
export function firmarSesion(contrasena: string, ahoraS: number): string {
  const expira = String(ahoraS + DURACION_SESION_S);
  return `${expira}.${firma(contrasena, expira)}`;
}

/**
 * Cualquier forma inesperada devuelve `false`: esta función no lanza, porque
 * la cookie la manda el navegador de quien sea.
 */
export function sesionValida(
  valor: string | undefined,
  contrasena: string | null,
  ahoraS: number,
): boolean {
  if (contrasena === null || valor === undefined) return false;
  const partes = valor.split(".");
  if (partes.length !== 2) return false;
  const [expira, hex] = partes;
  if (!EXPIRA.test(expira) || !HEX_HMAC.test(hex)) return false;
  if (Number(expira) <= ahoraS) return false;
  return timingSafeEqual(Buffer.from(hex, "hex"), Buffer.from(firma(contrasena, expira), "hex"));
}
