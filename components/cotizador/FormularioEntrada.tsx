"use client";

import { useActionState } from "react";

import { entrar, type EstadoEntrada } from "@/app/cotizador/acciones.ts";
import { claseBoton } from "@/components/ui/boton.ts";

const ESTADO_INICIAL: EstadoEntrada = { error: null };

export function FormularioEntrada() {
  const [estado, accion, pendiente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex max-w-[420px] flex-col gap-4">
      <label className="flex flex-col gap-2 text-[14px]">
        <span className="text-texto-secundario">Contraseña</span>
        <input
          type="password"
          name="contrasena"
          autoComplete="current-password"
          required
          className="border-borde-pildora rounded-field w-full border bg-white px-4 py-3 text-[16px]"
        />
      </label>
      {estado.error ? (
        <p role="alert" className="text-[14px]">
          {estado.error}
        </p>
      ) : null}
      <div className="flex">
        <button type="submit" disabled={pendiente} className={claseBoton("principal")}>
          Entrar
        </button>
      </div>
    </form>
  );
}
