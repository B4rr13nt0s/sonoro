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
 * Cuánto lleva la fase actual SIN contar el tiempo en pausa. Es la única
 * fuente de ese dato: de acá leen el plazo de cada fase (useIdleReturn.ts) y
 * el ángulo del giro, frame a frame (CarouselCanvas.tsx).
 *
 * Mientras está en pausa el tiempo queda clavado donde se pausó, y al
 * reanudar sigue desde ahí. Antes la pausa se descontaba corriendo un
 * `faseInicio` en un efecto de React, que llegaba un render tarde: cada
 * lector tenía que compensarlo por su cuenta —el temporizador con un parche
 * que dependía del orden de los efectos— y el que no lo hacía, el canvas,
 * dibujaba uno o dos frames con la pausa incluida: el modelo saltaba a su
 * orientación inicial y volvía. Acá no hay nada que llegue tarde: quien
 * pregunta entre la reanudación y el re-render ve el tiempo todavía clavado,
 * que es exactamente el que había.
 *
 * Cada fase lleva un NÚMERO, y quien dibuja pregunta por la fase con la
 * que se renderizó. El reloj cambia de fase en el acto, pero la fase nueva
 * le llega al canvas un render después —y el canvas de three.js es otro
 * árbol de React, que puede llegar todavía más tarde—: si en ese hueco se
 * dibujaba con la fase vieja y el tiempo nuevo (≈ 0), un modelo agarrado a
 * media vuelta saltaba al ángulo del inicio de la vuelta y se quedaba ahí.
 * Con el número, quien todavía está en la fase anterior recibe el tiempo
 * clavado donde esa fase terminó.
 *
 * Recibe `ahora` en cada llamada en vez de leer el reloj: sin DOM, y con
 * test.
 */
export class RelojFase {
  #origen: number;
  #pausadoDesde: number | null = null;
  #numero = 0;
  // Cuánto llevaba la fase anterior cuando terminó.
  #finAnterior = 0;

  constructor(ahora: number) {
    this.#origen = ahora;
  }

  /** El número de la fase en curso. */
  get numero(): number {
    return this.#numero;
  }

  /**
   * Fase nueva: el tiempo vuelve a cero. Si estaba en pausa, sigue en pausa.
   * Devuelve el número de la fase nueva.
   */
  reiniciar(ahora: number): number {
    this.#finAnterior = this.transcurrido(ahora);
    this.#numero += 1;
    this.#origen = ahora;
    if (this.#pausadoDesde !== null) this.#pausadoDesde = ahora;
    return this.#numero;
  }

  pausar(ahora: number): void {
    this.#pausadoDesde ??= ahora;
  }

  reanudar(ahora: number): void {
    if (this.#pausadoDesde === null) return;
    this.#origen += ahora - this.#pausadoDesde;
    this.#pausadoDesde = null;
  }

  /**
   * Cuánto lleva la fase `numero` (por defecto, la en curso). Para una fase
   * que ya terminó, lo que llevaba al terminar.
   */
  transcurrido(ahora: number, numero: number = this.#numero): number {
    if (numero !== this.#numero) return this.#finAnterior;
    return (this.#pausadoDesde ?? ahora) - this.#origen;
  }
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
