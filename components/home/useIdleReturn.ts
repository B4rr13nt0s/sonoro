"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PLAN_CICLO, type FaseCarrusel } from "./ciclo.ts";

export { ESPERA_MS, GIRO_MS, anguloDelCiclo, type FaseCarrusel } from "./ciclo.ts";

/**
 * Ciclo del carrusel. Cada producto pasa por el mismo recorrido, y el
 * ciclo corre siempre mientras el carrusel esté a la vista:
 *
 *   espera-previa (5 s)  →  girando (15 s, una vuelta)  →
 *   espera-final (5 s)   →  siguiente producto  →  espera-previa …
 *
 * Y si el usuario toma el modelo:
 *
 *   interactuando  →  (5 s desde que SUELTA)  →  volviendo (≈0.8 s)  →
 *   girando …
 *
 * Es decir: primero se recupera la vista y el zoom predeterminados, y
 * recién entonces arranca el giro. La cuenta de los 5 s no corre mientras
 * hay un gesto en curso — con un solo aviso en el `pointerdown`, un
 * arrastre lento más largo que ese plazo se cancelaba solo a mitad de
 * camino, y se veía como si el modelo se negara a quedarse donde uno lo
 * dejaba. Por eso `beginGesture`/`endGesture` marcan los extremos y
 * `notifyInteraction` queda para el input suelto (la rueda).
 */
/** Duración de la interpolación de vuelta a la vista predeterminada. */
export const RETURN_DURATION_MS = 800;

/**
 * Umbral bajo el cual se considera que la cámara ya volvió. ~0.6° en los
 * ángulos y 1 cm en la distancia: por debajo de eso el salto es
 * imperceptible y seguir interpolando solo retrasa el giro.
 */
export const RETURN_EPSILON = 0.01;

export interface CicloCarrusel {
  fase: FaseCarrusel;
  /** `performance.now()` de cuando empezó la fase actual. El giro se calcula desde acá. */
  faseInicio: number;
  /** Empieza un gesto sostenido: pausa el ciclo hasta que termine. */
  beginGesture: () => void;
  /** Termina el gesto y arranca la cuenta de los 5 s. */
  endGesture: () => void;
  /** Input suelto (la rueda): reinicia la cuenta si no hay gesto activo. */
  notifyInteraction: () => void;
  /** La llama el rig cuando la cámara terminó de volver a la vista predeterminada. */
  alVolver: () => void;
  /** Navegación manual: el ciclo arranca de cero en la vista predeterminada. */
  reiniciar: () => void;
}

export function useCicloCarrusel({
  activo,
  reducedMotion,
  onAvanzar,
}: {
  /** El carrusel está a la vista y la pestaña visible. Con `false` el ciclo se congela. */
  activo: boolean;
  /** Con `prefers-reduced-motion` no hay giro ni avance automáticos. */
  reducedMotion: boolean;
  onAvanzar: () => void;
}): CicloCarrusel {
  const [fase, setFase] = useState<FaseCarrusel>("espera-previa");
  const [faseInicio, setFaseInicio] = useState(() =>
    typeof performance === "undefined" ? 0 : performance.now(),
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestoActivo = useRef(false);
  const onAvanzarRef = useRef(onAvanzar);
  useEffect(() => {
    onAvanzarRef.current = onAvanzar;
  }, [onAvanzar]);

  const limpiar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const ir = useCallback(
    (siguiente: FaseCarrusel) => {
      limpiar();
      setFase(siguiente);
      setFaseInicio(performance.now());
    },
    [limpiar],
  );

  const beginGesture = useCallback(() => {
    gestoActivo.current = true;
    ir("interactuando");
  }, [ir]);

  const endGesture = useCallback(() => {
    gestoActivo.current = false;
    ir("interactuando");
  }, [ir]);

  const notifyInteraction = useCallback(() => {
    if (gestoActivo.current) {
      limpiar();
      return;
    }
    ir("interactuando");
  }, [ir, limpiar]);

  const alVolver = useCallback(() => {
    setFase((actual) => {
      if (actual !== "volviendo") return actual;
      setFaseInicio(performance.now());
      // La vista ya está en su sitio: el giro arranca acá, sin esperar de
      // nuevo los 5 s (esos ya pasaron antes de empezar a volver).
      return "girando";
    });
  }, []);

  const reiniciar = useCallback(() => {
    gestoActivo.current = false;
    ir("espera-previa");
  }, [ir]);

  // Los plazos de cada fase salen de PLAN_CICLO (ver ciclo.ts, con test).
  // Se rearman en cada cambio de fase y se congelan cuando el carrusel no
  // está a la vista: si siguieran corriendo, el usuario volvería a un
  // producto distinto del que dejó, y el giro habría avanzado sin
  // dibujarse.
  useEffect(() => {
    limpiar();
    if (!activo || gestoActivo.current) return;

    // Con prefers-reduced-motion no hay giro ni avance automáticos: solo
    // se mantiene el regreso a la vista predeterminada tras interactuar.
    if (reducedMotion && fase !== "interactuando") return;

    const plan = PLAN_CICLO[fase];
    if (!plan) return; // 'volviendo' termina cuando el rig avisa

    timer.current = setTimeout(() => {
      if (plan.avanza) onAvanzarRef.current();
      ir(plan.siguiente);
    }, plan.esperaMs);
  }, [fase, faseInicio, activo, reducedMotion, ir, limpiar]);

  useEffect(() => limpiar, [limpiar]);

  return { fase, faseInicio, beginGesture, endGesture, notifyInteraction, alVolver, reiniciar };
}
