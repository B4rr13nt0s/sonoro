/**
 * La entrada del primer producto, sin React ni three, para poder probarla.
 *
 * Al abrir la página, el primer producto llega deslizándose de derecha a
 * izquierda —el mismo sentido en que avanza el carrusel— desde fuera de
 * cuadro hasta el centro. Es una máquina de cuatro estados:
 *
 *   pendiente   hasta el primer frame en que su .glb ya está montado;
 *   compilando  mientras se compilan los shaders de la escena;
 *   corriendo   la entrada en sí, que avanza con el delta de cada frame
 *               (PASO_MAX_ENTRADA_S), no con el reloj de pared;
 *   hecha       en su lugar.
 *
 * Los efectos —montar el modelo, compilar los shaders— los hace quien la
 * llama (CarouselCanvas.tsx, en su useFrame): esta función solo decide, con
 * lo que ese frame observó, en qué estado queda y cuánto le falta al modelo
 * para llegar. La compilación previa es lo que arregla la primera visita
 * (CLAUDE.md § Entrada del primer producto).
 */
import { easeOutCubic } from "./easing.ts";

/** Duración de la entrada. Más larga que un cambio de slide: es una llegada. */
export const ENTRADA_MS = 900;

/**
 * Lo más que avanza la entrada en un solo frame, en segundos. Un frame trabado
 * (shaders que se compilan, la pestaña que se duerme) la frena en vez de
 * saltársela.
 */
export const PASO_MAX_ENTRADA_S = 0.05;

export type EstadoEntrada = "pendiente" | "compilando" | "corriendo" | "hecha";

export interface Entrada {
  estado: EstadoEntrada;
  /** Cuánto lleva corriendo, en ms de frames (con el tope por frame). */
  avanceMs: number;
}

export const ENTRADA_INICIAL: Entrada = { estado: "pendiente", avanceMs: 0 };

/** La entrada que ya no se anima: cambió el producto, o no hay animación. */
export const ENTRADA_HECHA: Entrada = { estado: "hecha", avanceMs: 0 };

export interface ObservacionEntrada {
  /** `prefers-reduced-motion` apaga la entrada: el producto aparece en su lugar. */
  animar: boolean;
  /** El .glb del producto actual ya está en la escena. */
  modeloMontado: boolean;
  /** `compileAsync` terminó (o falló: se entra igual, dibujar compila lo que falte). */
  compilado: boolean;
  /** Segundos desde el frame anterior. */
  deltaS: number;
}

export interface PasoEntrada {
  entrada: Entrada;
  /** 1 es fuera de cuadro a la derecha, 0 es en su lugar. */
  falta: number;
  /** Este frame hay que lanzar la compilación de shaders. Una sola vez. */
  compilar: boolean;
}

export function pasoEntrada(entrada: Entrada, obs: ObservacionEntrada): PasoEntrada {
  if (!obs.animar || entrada.estado === "hecha") {
    return { entrada: ENTRADA_HECHA, falta: 0, compilar: false };
  }

  if (entrada.estado === "pendiente") {
    // Mientras el .glb carga el Suspense no monta nada: arrancar antes
    // gastaría la entrada en un cuadro sin modelo.
    if (!obs.modeloMontado) return { entrada, falta: 1, compilar: false };
    return { entrada: { estado: "compilando", avanceMs: 0 }, falta: 1, compilar: true };
  }

  if (entrada.estado === "compilando") {
    if (!obs.compilado) return { entrada, falta: 1, compilar: false };
    return { entrada: { estado: "corriendo", avanceMs: 0 }, falta: 1, compilar: false };
  }

  const avanceMs = entrada.avanceMs + Math.min(obs.deltaS, PASO_MAX_ENTRADA_S) * 1000;
  const k = Math.min(avanceMs / ENTRADA_MS, 1);
  if (k >= 1) return { entrada: ENTRADA_HECHA, falta: 0, compilar: false };
  return {
    entrada: { estado: "corriendo", avanceMs },
    falta: 1 - easeOutCubic(k),
    compilar: false,
  };
}
