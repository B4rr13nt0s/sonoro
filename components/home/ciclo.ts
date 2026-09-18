/**
 * El plan del ciclo del carrusel, sin React ni DOM, para poder probarlo.
 *
 * Cada producto recorre siempre lo mismo mientras el carrusel esté a la
 * vista:
 *
 *   espera-previa (3 s)  →  girando (10 s, una vuelta completa)  →
 *   espera-final (3 s)   →  [avanza]  →  espera-previa …
 *
 * Y si el usuario toma el modelo:
 *
 *   interactuando  →  (3 s desde que SUELTA)  →  volviendo  →  girando …
 *
 * O sea: primero se recupera la vista y el zoom predeterminados, y recién
 * entonces arranca el giro.
 *
 * `volviendo` es la única fase sin plazo: no termina por reloj sino cuando
 * el rig de cámara avisa que la interpolación llegó a destino. Ponerle un
 * temporizador la haría cortar antes o después de tiempo según cuánto
 * hubiera que desandar.
 */
export type FaseCarrusel =
  "interactuando" | "volviendo" | "espera-previa" | "girando" | "espera-final";

/** Quietud en la vista predeterminada, antes y después de cada vuelta. */
export const ESPERA_MS = 3000;

/** Lo que tarda una vuelta completa del modelo. */
export const GIRO_MS = 10000;

export interface PasoCiclo {
  siguiente: FaseCarrusel;
  esperaMs: number;
  /** Al terminar esta fase se pasa al producto siguiente. */
  avanza?: boolean;
}

export const PLAN_CICLO: Record<FaseCarrusel, PasoCiclo | null> = {
  "espera-previa": { siguiente: "girando", esperaMs: ESPERA_MS },
  girando: { siguiente: "espera-final", esperaMs: GIRO_MS },
  "espera-final": { siguiente: "espera-previa", esperaMs: ESPERA_MS, avanza: true },
  interactuando: { siguiente: "volviendo", esperaMs: ESPERA_MS },
  volviendo: null,
};

/** Lo que dura un producto en pantalla sin que nadie lo toque. */
export function duracionProductoMs(): number {
  return ESPERA_MS + GIRO_MS + ESPERA_MS;
}

/**
 * Ángulo del modelo, en radianes, según la fase y el tiempo transcurrido.
 *
 * Es un valor ABSOLUTO en función del tiempo, no un acumulador: así el
 * modelo arranca siempre en 0, termina la vuelta exacta, y cambiar de
 * producto no arrastra el ángulo del anterior.
 *
 * El signo es negativo porque una rotación positiva sobre +Y lleva la cara
 * frontal hacia la DERECHA de la pantalla, y el giro va de derecha a
 * izquierda.
 */
export function anguloDelCiclo(fase: FaseCarrusel, transcurridoMs: number): number {
  if (fase !== "girando") return 0;
  const avance = Math.min(Math.max(transcurridoMs, 0) / GIRO_MS, 1);
  // `-2π · 0` da −0, que no es estrictamente igual a 0 y ensucia
  // comparaciones y pruebas sin aportar nada.
  return avance === 0 ? 0 : -2 * Math.PI * avance;
}
