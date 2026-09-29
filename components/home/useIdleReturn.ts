"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PLAN_CICLO, RelojFase, type FaseCarrusel } from "./ciclo.ts";

export { ESPERA_MS, GIRO_MS, anguloDelCiclo, type FaseCarrusel } from "./ciclo.ts";

/**
 * Ciclo del carrusel. Cada producto pasa por el mismo recorrido, y el
 * ciclo corre siempre mientras el carrusel esté a la vista:
 *
 *   espera-previa (3 s)  →  girando (10 s, una vuelta)  →
 *   espera-final (3 s)   →  siguiente producto  →  espera-previa …
 *
 * Y si el usuario toma el modelo:
 *
 *   interactuando  →  (3 s desde que SUELTA)  →  volviendo (≈0.8 s)  →
 *   girando …
 *
 * Es decir: primero se recupera la vista y el zoom predeterminados, y
 * recién entonces arranca el giro. La cuenta de los 3 s no corre mientras
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
  /**
   * Cuánto lleva `fase`, en ms, sin contar las pausas (RelojFase en
   * ciclo.ts). El giro se calcula desde acá, frame a frame, pasando la
   * `fase` con la que se renderizó: si el reloj ya pasó a otra y el render
   * todavía no llegó, devuelve lo que esa fase llevaba al terminar.
   */
  transcurrido: (fase: FaseCarrusel) => number;
  /** Empieza un gesto sostenido: pausa el ciclo hasta que termine. */
  beginGesture: () => void;
  /** Termina el gesto y arranca la cuenta de los 3 s. */
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
  // `fase` es la RENDERIZADA; la vigente, adelantada al render, es
  // `reloj.fase` (ciclo.ts explica por qué las dos).
  const [fase, setFase] = useState<FaseCarrusel>("espera-previa");
  const [reloj] = useState(
    () =>
      new RelojFase("espera-previa", typeof performance === "undefined" ? 0 : performance.now()),
  );
  // Cambia en cada ir(), aunque la fase sea la misma (otra interacción en
  // plena `interactuando`): es lo que rearma el plazo.
  const [cambios, setCambios] = useState(0);
  const transcurrido = useCallback(
    (de: FaseCarrusel) => reloj.transcurrido(de, performance.now()),
    [reloj],
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
      reloj.cambiar(siguiente, performance.now());
      setFase(siguiente);
      setCambios((n) => n + 1);
    },
    [limpiar, reloj],
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

  // Camara la llama en CADA frame mientras dibuja `volviendo` y ya llegó a
  // destino. Mira la fase VIGENTE del reloj, no la renderizada: los frames
  // que llegan antes del re-render no repiten el cambio, y si en el medio el
  // usuario volvió a agarrar el modelo (el reloj ya está en
  // `interactuando`), no se pisa su gesto con un giro. Con un ref que se
  // actualizaba en un efecto, esos frames todavía veían `volviendo`.
  const alVolver = useCallback(() => {
    if (reloj.fase !== "volviendo") return;
    // La vista ya está en su sitio: el giro arranca acá, sin esperar de
    // nuevo los 3 s (esos ya pasaron antes de empezar a volver). Con
    // prefers-reduced-motion no hay giro automático: el modelo se queda
    // quieto en la vista predeterminada, y como con reduced motion no hay
    // plazos (efecto de abajo), ahí se queda hasta el próximo gesto.
    ir(reducedMotion ? "espera-previa" : "girando");
  }, [ir, reducedMotion, reloj]);

  const reiniciar = useCallback(() => {
    gestoActivo.current = false;
    ir("espera-previa");
  }, [ir]);

  // Mientras el carrusel no está a la vista, el tiempo de la fase no corre:
  // si corriera, al volver después de una pausa larga el modelo aparecía
  // clavado al final de la vuelta (el ángulo ya pasado de largo) y se
  // quedaba quieto el giro entero más la espera final, ~13 s.
  //
  // Lo mismo con el avance en pausa (foco del teclado adentro) durante la
  // fase que avanza: si el tiempo corriera, al salir el foco el plazo ya
  // estaba vencido y el producto cambiaba en el mismo instante, sin su
  // espera final.
  //
  // El reloj (RelojFase) guarda la pausa, así que el orden entre este efecto
  // y el de los plazos no importa: si el de los plazos corre antes, todavía
  // ve el tiempo clavado, que es el mismo que verá después de reanudar.
  const congelado = !activo || (pausarAvance && (PLAN_CICLO[fase]?.avanza ?? false));
  useEffect(() => {
    if (congelado) reloj.pausar(performance.now());
    else reloj.reanudar(performance.now());
  }, [congelado, reloj]);

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
    // Entre este render y su efecto el reloj ya pasó a otra fase (un evento
    // en el medio): este plazo es de una fase terminada, y armarlo podía
    // pisar la nueva al vencer. El cambio ya pidió otro render, cuyo efecto
    // arma el plazo que corresponde.
    if (reloj.fase !== fase) return;

    // Lo que FALTA de la fase, no el plazo entero: al reanudar tras una
    // pausa, la fase ya había consumido parte de su tiempo.
    const restante = Math.max(0, plan.esperaMs - transcurrido(fase));
    timer.current = setTimeout(() => {
      if (plan.avanza) onAvanzarRef.current();
      ir(plan.siguiente);
    }, restante);
  }, [fase, cambios, activo, reducedMotion, pausarAvance, ir, limpiar, reloj, transcurrido]);

  useEffect(() => limpiar, [limpiar]);

  return {
    fase,
    transcurrido,
    beginGesture,
    endGesture,
    notifyInteraction,
    alVolver,
    reiniciar,
  };
}
