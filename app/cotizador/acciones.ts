"use server";

// Entrar y salir del cotizador privado
// (docs/superpowers/specs/2026-11-16-cotizador-design.md § Acceso).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ahoraEnSegundos, contrasenaDelServidor } from "@/lib/cotizador/acceso.ts";
import {
  COOKIE_COTIZADOR,
  DURACION_SESION_S,
  contrasenaCorrecta,
  firmarSesion,
} from "@/lib/cotizador/sesion.ts";

export type EstadoEntrada = { error: string | null };

// La cookie solo viaja a /cotizador, donde se necesita; y con el mismo `path`
// se borra al salir (otro `path` dejaría la cookie viva).
const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/cotizador",
} as const;

// Una espera fija ante cada fallo: no frena un ataque repartido, pero hace
// lento adivinar desde un solo cliente. La defensa real es el largo de la
// contraseña (lib/cotizador/sesion.ts).
const ESPERA_FALLO_MS = 1000;

export async function entrar(_estado: EstadoEntrada, datos: FormData): Promise<EstadoEntrada> {
  const contrasena = contrasenaDelServidor();
  const intento = datos.get("contrasena");

  if (
    contrasena === null ||
    typeof intento !== "string" ||
    !contrasenaCorrecta(intento, contrasena)
  ) {
    await new Promise((resolver) => setTimeout(resolver, ESPERA_FALLO_MS));
    return { error: "Contraseña incorrecta." };
  }

  (await cookies()).set(COOKIE_COTIZADOR, firmarSesion(contrasena, ahoraEnSegundos()), {
    ...OPCIONES_COOKIE,
    maxAge: DURACION_SESION_S,
  });
  redirect("/cotizador");
}

export async function salir(): Promise<void> {
  (await cookies()).set(COOKIE_COTIZADOR, "", { ...OPCIONES_COOKIE, maxAge: 0 });
  redirect("/cotizador");
}
