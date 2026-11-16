// Cotizador privado: el ÚNICO lugar que decide si hay sesión. Lo llaman la
// página y las acciones; la lógica de firmar y verificar vive aparte, pura y
// probada, en ./sesion.ts. Este archivo solo conecta con lo de afuera: la
// cookie de la petición, la variable de entorno y el reloj.
import { cookies } from "next/headers";

import { COOKIE_COTIZADOR, contrasenaConfigurada, sesionValida } from "./sesion.ts";

/** La contraseña de COTIZADOR_PASSWORD, o `null` si no hay una utilizable (ver `contrasenaConfigurada`). */
export function contrasenaDelServidor(): string | null {
  return contrasenaConfigurada(process.env.COTIZADOR_PASSWORD);
}

export function ahoraEnSegundos(): number {
  return Math.floor(Date.now() / 1000);
}

export async function haySesion(): Promise<boolean> {
  const cookie = (await cookies()).get(COOKIE_COTIZADOR)?.value;
  return sesionValida(cookie, contrasenaDelServidor(), ahoraEnSegundos());
}
