/**
 * El plan del ciclo del carrusel, sin React ni DOM, para poder probarlo.
 *
 * Cada producto recorre siempre lo mismo mientras el carrusel esté a la
 * vista:
 *
 *   espera-previa (2 s; 1 s si se llegó solo)  →
 *   girando (10 s, una vuelta completa)  →
 *   espera-final (1 s; 2 s si el usuario tocó el modelo)  →
 *   [avanza]  →  espera-previa …
 *
 * Y si el usuario toma el modelo:
 *
 *   interactuando  →  (2 s desde que SUELTA)  →  volviendo  →  girando …
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

/**
 * Quietud en la vista predeterminada antes de girar, y tras soltar el modelo
 * antes de volver. También es la espera de un producto al que se llegó por
 * pedido del usuario (flecha o punto).
 */
export const ESPERA_MS = 2000;

/**
 * La espera corta, para cuando nadie tocó nada: el producto al que se llegó
 * solo, por el paso del tiempo, y el final de una vuelta que el usuario no
 * interrumpió. Sin interacción, el carrusel no tiene por qué quedarse quieto
 * tanto como cuando alguien lo está mirando de cerca.
 */
export const ESPERA_CORTA_MS = 1000;

/** Lo que tarda una vuelta completa del modelo. */
export const GIRO_MS = 10000;

export interface PasoCiclo {
  siguiente: FaseCarrusel;
  esperaMs: number;
  /** Al terminar esta fase se pasa al producto siguiente. */
  avanza?: boolean;
}

/** Lo que decide cuál de las dos esperas corresponde. */
export interface ContextoCiclo {
  /** Se llegó a este producto solo, por el paso del tiempo (no por el usuario). */
  llegoSolo: boolean;
  /** El usuario tocó el modelo mientras estaba en este producto. */
  interactuo: boolean;
}

/**
 * El plazo de la fase. `PLAN_CICLO` trae el largo; las dos esperas de
 * quietud acortan a `ESPERA_CORTA_MS` cuando nadie intervino:
 *
 * - `espera-previa` de un producto al que se llegó solo.
 * - `espera-final` de una vuelta que el usuario no tocó. Si la tocó, el
 *   modelo volvió y giró después de una interacción, y se queda el plazo
 *   largo.
 */
export function esperaDeFaseMs(fase: FaseCarrusel, contexto: ContextoCiclo): number {
  const plan = PLAN_CICLO[fase];
  if (!plan) return 0;
  if (fase === "espera-previa" && contexto.llegoSolo) return ESPERA_CORTA_MS;
  if (fase === "espera-final" && !contexto.interactuo) return ESPERA_CORTA_MS;
  return plan.esperaMs;
}

export const PLAN_CICLO: Record<FaseCarrusel, PasoCiclo | null> = {
  "espera-previa": { siguiente: "girando", esperaMs: ESPERA_MS },
  girando: { siguiente: "espera-final", esperaMs: GIRO_MS },
  "espera-final": { siguiente: "espera-previa", esperaMs: ESPERA_MS, avanza: true },
  interactuando: { siguiente: "volviendo", esperaMs: ESPERA_MS },
  volviendo: null,
};

/**
 * Lo que dura un producto en pantalla sin que nadie lo toque, cuando se
 * llegó a él solo: espera corta, una vuelta, espera corta.
 */
export function duracionProductoMs(): number {
  return ESPERA_CORTA_MS + GIRO_MS + ESPERA_CORTA_MS;
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
 * El reloj sabe EN QUÉ FASE está, y quien pregunta dice por cuál fase
 * pregunta: la que tiene renderizada. El reloj cambia de fase en el acto,
 * pero la fase nueva le llega al canvas un render después —y el canvas de
 * three.js es otro árbol de React, que puede llegar todavía más tarde—. Si
 * en ese hueco el canvas dibujaba con la fase vieja y el tiempo de la nueva
 * (≈ 0), un modelo agarrado a media vuelta saltaba al ángulo del inicio de
 * la vuelta y se quedaba ahí. Por eso, preguntar por una fase que ya no es
 * la actual devuelve lo que ESA fase llevaba la última vez que terminó.
 *
 * Por tipo de fase y no por un número de cambio: hasta septiembre de 2026 se
 * guardaba solo el final de la fase inmediatamente anterior, y dos cambios
 * antes del render (dos eventos de rueda seguidos: `girando → interactuando
 * → interactuando`) le devolvían al canvas, todavía en `girando`, los
 * milisegundos de la intermedia — el mismo salto. Por tipo, `girando`
 * conserva su final pase lo que pase después. Lo único que eso no distingue
 * es una vuelta de la siguiente, y no hace falta: entre dos vueltas hay por
 * lo menos 1 s y una fase (`espera-previa` o `volviendo`) que el canvas
 * tiene que dibujar — `volviendo` solo termina cuando el canvas avisa.
 *
 * Recibe `ahora` en cada llamada en vez de leer el reloj: sin DOM, y con
 * test.
 */
export class RelojFase {
  #fase: FaseCarrusel;
  #origen: number;
  #pausadoDesde: number | null = null;
  // Lo que llevaba cada fase la última vez que terminó.
  #finales: Partial<Record<FaseCarrusel, number>> = {};

  constructor(fase: FaseCarrusel, ahora: number) {
    this.#fase = fase;
    this.#origen = ahora;
  }

  /** La fase en curso, ya cambiada aunque React todavía no haya re-renderizado. */
  get fase(): FaseCarrusel {
    return this.#fase;
  }

  /**
   * Pasa a `fase` (puede ser la misma: otra interacción en plena
   * `interactuando` vuelve a contar desde cero). Si estaba en pausa, sigue en
   * pausa.
   */
  cambiar(fase: FaseCarrusel, ahora: number): void {
    this.#finales[this.#fase] = this.transcurrido(this.#fase, ahora);
    this.#fase = fase;
    this.#origen = ahora;
    if (this.#pausadoDesde !== null) this.#pausadoDesde = ahora;
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
   * Cuánto lleva `fase` si es la en curso; si no, lo que llevaba la última
   * vez que terminó (0 si nunca corrió).
   */
  transcurrido(fase: FaseCarrusel, ahora: number): number {
    if (fase !== this.#fase) return this.#finales[fase] ?? 0;
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
