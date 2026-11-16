// Cotizador privado: conecta la decisión de acceso con lo de afuera —la cookie
// de la petición, la variable de entorno y el reloj—. La decisión en sí
// (`estadoAcceso`) vive en ./sesion.ts, pura y probada; la página es quien la
// llama, y las acciones solo comprueban la contraseña (`entrar`) o borran la
// cookie de quien las invoca (`salir`).
import { cookies } from "next/headers";

import {
  COOKIE_COTIZADOR,
  contrasenaConfigurada,
  estadoAcceso,
  type EstadoAcceso,
} from "./sesion.ts";

/** La contraseña de COTIZADOR_PASSWORD, o `null` si no hay una utilizable (ver `contrasenaConfigurada`). */
export function contrasenaDelServidor(): string | null {
  return contrasenaConfigurada(process.env.COTIZADOR_PASSWORD);
}

export function ahoraEnSegundos(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Lee la cookie ANTES de decidir: así la página es siempre dinámica y el 404
 * de `cerrada` nunca queda horneado en el build.
 */
export async function estadoDelAcceso(): Promise<EstadoAcceso> {
  const cookie = (await cookies()).get(COOKIE_COTIZADOR)?.value;
  return estadoAcceso(process.env.COTIZADOR_PASSWORD, cookie, ahoraEnSegundos());
}
