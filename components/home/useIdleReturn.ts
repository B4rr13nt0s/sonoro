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
  pausarAvance = false,
  onAvanzar,
}: {
  /** El carrusel está a la vista y la pestaña visible. Con `false` el ciclo se congela. */
  activo: boolean;
  /** Con `prefers-reduced-motion` no hay giro ni avance automáticos. */
  reducedMotion: boolean;
  /**
   * Detiene SOLO el paso al producto siguiente; el giro sigue. Lo usa el
   * carrusel mientras el foco del teclado está adentro (WCAG 2.2.2): lo que
   * no puede pasar es que el producto cambie mientras alguien lo lee.
   */
  pausarAvance?: boolean;
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

  // La fase vigente, leída por alVolver sin pasar por un updater de setFase:
  // Camara lo llama en CADA frame hasta que la fase cambia, y un updater con
  // efectos (antes llamaba a setFaseInicio adentro) React lo puede correr dos
  // veces. El ref se adelanta en el mismo llamado para que los frames que
  // llegan antes del re-render no repitan el cambio.
  const faseRef = useRef(fase);
  useEffect(() => {
    faseRef.current = fase;
  }, [fase]);

  const alVolver = useCallback(() => {
    if (faseRef.current !== "volviendo") return;
    // La vista ya está en su sitio: el giro arranca acá, sin esperar de
    // nuevo los 3 s (esos ya pasaron antes de empezar a volver). Con
    // prefers-reduced-motion no hay giro automático: el modelo se queda
    // quieto en la vista predeterminada, y como con reduced motion no hay
    // plazos (efecto de abajo), ahí se queda hasta el próximo gesto.
    const siguiente: FaseCarrusel = reducedMotion ? "espera-previa" : "girando";
    faseRef.current = siguiente;
    ir(siguiente);
  }, [ir, reducedMotion]);

  const reiniciar = useCallback(() => {
    gestoActivo.current = false;
    ir("espera-previa");
  }, [ir]);

  // Mientras el carrusel no está a la vista, el tiempo de la fase no corre:
  // el ángulo del giro sale de `performance.now() - faseInicio`, y si
  // faseInicio no se corriera, al volver después de una pausa larga el
  // modelo aparecía clavado al final de la vuelta (el ángulo ya pasado de
  // largo) y se quedaba quieto el giro entero más la espera final, ~13 s.
  const pausadoDesde = useRef<number | null>(null);
  useEffect(() => {
    if (!activo) {
      pausadoDesde.current ??= performance.now();
      return;
    }
    if (pausadoDesde.current === null) return;
    const pausa = performance.now() - pausadoDesde.current;
    pausadoDesde.current = null;
    // Correr el origen de la fase es sincronizar con el reloj, algo que
    // solo se sabe al reanudar: no es un valor derivable en el render.
    setFaseInicio((inicio) => inicio + pausa);
  }, [activo]);

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
    // Con el avance en pausa, la espera final no se cumple: el modelo se
    // queda en cuadro hasta que el foco sale, y ahí sigue el ciclo.
    if (plan.avanza && pausarAvance) return;

    // Lo que FALTA de la fase, no el plazo entero: al reanudar tras una
    // pausa, la fase ya había consumido parte de su tiempo.
    const restante = Math.max(0, plan.esperaMs - (performance.now() - faseInicio));
    timer.current = setTimeout(() => {
      if (plan.avanza) onAvanzarRef.current();
      ir(plan.siguiente);
    }, restante);
  }, [fase, faseInicio, activo, reducedMotion, pausarAvance, ir, limpiar]);

  useEffect(() => limpiar, [limpiar]);

  return { fase, faseInicio, beginGesture, endGesture, notifyInteraction, alVolver, reiniciar };
}
