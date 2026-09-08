"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Entrada del carrusel 3D: traduce mouse, lápiz, dedo y rueda a
 * INCREMENTOS de vista. No toca la cámara ni conoce three: `Camara` es la
 * única que mueve algo, leyendo y vaciando `pendienteRef` en cada frame.
 *
 * Un solo camino para todos los punteros. Lo único que distingue al dedo
 * es la regla de intención, porque en móvil el arrastre de un dedo es el
 * mismo gesto con el que el usuario baja por la página:
 *
 *   - `touch-action: pan-y` en el contenedor.
 *   - Mientras la distancia recorrida sea menor a UMBRAL_PX, nada.
 *   - Superado el umbral se decide UNA vez: si el movimiento está dentro
 *     de 30° del eje horizontal (`|dx| > |dy| · tan60`), es rotar; si no,
 *     es scroll y el navegador se queda con el gesto.
 *   - Ya decidido que es rotar, el mismo arrastre mueve LOS DOS EJES.
 *   - La decisión no se revisa hasta el siguiente `pointerdown`.
 *
 * Con mouse o lápiz NO hay ambigüedad —la página se scrollea con la rueda,
 * no arrastrando— así que el arrastre rota en los dos ejes desde el primer
 * píxel, sin decidir nada.
 *
 * Con DOS dedos tampoco hay ambigüedad: separarlos hace zoom, moverlos
 * juntos desplaza. Con el botón derecho, el del medio o Shift, desplaza.
 */
const UMBRAL_PX = 10;

/** tan(60°) ≈ 1.7320508: |dx| > |dy| · TAN_60 equivale a "dentro de 30° del eje horizontal". */
const TAN_60 = 1.7320508;

/**
 * Paso de zoom por evento de rueda: 1.5%, mirando solo el SIGNO de
 * `deltaY`. Escalarlo con la magnitud —lo que hace OrbitControls— salta de
 * tope a tope en un solo tic en los mouse que mandan deltas grandes.
 *
 * El paso por evento es solo la mitad de la historia: la cámara no salta
 * al valor nuevo sino que lo persigue con suavizado exponencial (ver
 * `SUAVIZADO_ZOOM` en CarouselCanvas). Entre las dos cosas, cada muesca
 * mueve poco y el movimiento es continuo en vez de escalonado.
 */
const PASO_RUEDA = 0.985;

/**
 * Ángulo polar de reposo (desde +Y) y sus topes. La órbita es libre en los
 * dos ejes, pero NO hasta los polos exactos: ahí la dirección de vista
 * queda paralela al vector "arriba" de la cámara, el producto cruz que
 * arma su base da cero y `lookAt` devuelve una matriz con NaN. El síntoma
 * no es un tirón: el cuadro queda completamente vacío.
 *
 * 0.05 rad ≈ 2.9° de margen en cada polo, imperceptible.
 */
/**
 * Pose predeterminada: tres cuartos frontal, evocando la perspectiva
 * caballera — 25° sobre el horizonte (65° medidos desde +Y, que es como se
 * expresa el polar acá), para que la cara principal del producto domine.
 *
 * El azimut es 150°, no 30°: los nueve .glb tienen su FRENTE hacia −Z, así
 * que una cámara en el cuadrante +Z los muestra de espaldas. Verificado
 * mirando el ecualizador, que a 30° enseñaba los jacks traseros en vez de
 * su fila de perillas. 150° pone la cámara frente al producto y corrida
 * 30° hacia un costado, que es lo que da el tres cuartos.
 *
 * NO es caballera estricta: la caballera es una proyección OBLICUA (cara
 * frontal sin deformar, profundidad a 45° y a escala completa) y eso no se
 * consigue moviendo una cámara en perspectiva, hace falta una ortográfica
 * con cizalladura. Acá es deliberadamente una pose equivalente, para no
 * cambiar de proyección al tomar el modelo y soltarlo.
 */
export const AZIMUT_REPOSO = 150 * (Math.PI / 180);
export const POLAR_REPOSO = 65 * (Math.PI / 180);
export const POLAR_MIN = 0.05;
export const POLAR_MAX = Math.PI - 0.05;

/**
 * Topes de zoom y punto de partida, como multiplicador de la distancia de
 * encuadre (menor = más cerca).
 *
 `ZOOM_DEFECTO = 1` deja la vista predeterminada exactamente en el
 * encuadre calculado, que ya es lo más grande que entra sin tocar el
 * chrome ni los bordes (ver `useEncuadre`). Acercarlo más —lo que hacía el
 * 0.85 anterior— recorta el producto: el margen del encuadre es del 10%,
 * así que cualquier valor por debajo de 0.9 se sale.
 */
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.7;
export const ZOOM_DEFECTO = 1;

/** Incrementos acumulados desde el último frame. `Camara` los aplica y los pone en cero. */
export interface GestoPendiente {
  dAzimut: number;
  dPolar: number;
  /** Factor multiplicativo de distancia: <1 acerca, >1 aleja. */
  factorZoom: number;
  /** Desplazamiento en píxeles de pantalla. */
  dPanX: number;
  dPanY: number;
}

export const SIN_PENDIENTE: GestoPendiente = {
  dAzimut: 0,
  dPolar: 0,
  factorZoom: 1,
  dPanX: 0,
  dPanY: 0,
};

/** Qué está haciendo el gesto en curso. */
type Modo = "indefinido" | "rotar" | "desplazar" | "scroll";

export interface RotateGesture {
  pendienteRef: React.RefObject<GestoPendiente>;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
    onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  };
}

export function useRotateGesture(
  /** Contenedor del carrusel: sobre él se engancha la rueda a mano. */
  contenedorRef: React.RefObject<HTMLElement | null>,
  /** Extremos del gesto: mientras dura, no corre la cuenta de inactividad. */
  onGestureStart: () => void,
  onGestureEnd: () => void,
  /** Input suelto sin extremos claros (la rueda): reinicia la cuenta. */
  onInteraction: () => void,
): RotateGesture {
  const pendienteRef = useRef<GestoPendiente>({ ...SIN_PENDIENTE });
  const activos = useRef(new Map<number, { x: number; y: number }>());
  const origen = useRef({ x: 0, y: 0 });
  const ultimo = useRef({ x: 0, y: 0 });
  const modo = useRef<Modo>("indefinido");
  /** Radianes por píxel: una vuelta completa por alto de cuadro, como OrbitControls. */
  const radPorPx = useRef(0.0134);
  /** Distancia y punto medio entre los dos dedos en el evento anterior. */
  const pellizco = useRef<{ dist: number; x: number; y: number } | null>(null);
  /** ¿Ya se avisó del comienzo de este gesto? */
  const avisado = useRef(false);

  const medirPellizco = () => {
    const pts = [...activos.current.values()];
    if (pts.length < 2) return null;
    return {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  };

  const empezar = useCallback(() => {
    if (avisado.current) return;
    avisado.current = true;
    onGestureStart();
  }, [onGestureStart]);

  /**
   * Mientras hay un arrastre en curso, `pointermove` y `pointerup` se
   * escuchan en `window`, no en el contenedor. Así el gesto no se corta
   * si el cursor se sale del cuadro, si React vuelve a renderizar la capa
   * de controles, o si `setPointerCapture` falla — que puede pasar y
   * dejaría el arrastre muerto a mitad de camino. Van con
   * `{ passive: false }` porque el dedo necesita `preventDefault`.
   */
  const escuchando = useRef(false);
  const soltarTodo = useRef<(() => void) | null>(null);

  const mover = useCallback(
    (e: PointerEvent) => {
      if (!activos.current.has(e.pointerId)) return;
      activos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pend = pendienteRef.current;

      // --- dos dedos: zoom por separación, desplazamiento por punto medio
      if (activos.current.size >= 2) {
        if (e.cancelable) e.preventDefault();
        const ahora = medirPellizco();
        const antes = pellizco.current;
        if (ahora && antes && antes.dist > 0 && ahora.dist > 0) {
          // Separar los dedos acerca la cámara: el factor de distancia va al
          // revés de la separación.
          pend.factorZoom *= antes.dist / ahora.dist;
          pend.dPanX += ahora.x - antes.x;
          pend.dPanY += ahora.y - antes.y;
        }
        pellizco.current = ahora;
        return;
      }

      // --- un dedo sin decidir: rotar o dejar scrollear
      if (modo.current === "indefinido") {
        const dx = e.clientX - origen.current.x;
        const dy = e.clientY - origen.current.y;
        // Por debajo del umbral no se decide nada: un toque con temblor no
        // debería robarle el scroll al usuario.
        if (Math.hypot(dx, dy) < UMBRAL_PX) return;
        modo.current = Math.abs(dx) > Math.abs(dy) * TAN_60 ? "rotar" : "scroll";
        // El origen se recalibra al punto donde se decidió, para que el
        // modelo no pegue un salto de UMBRAL_PX al empezar a rotar.
        ultimo.current = { x: e.clientX, y: e.clientY };
        if (modo.current === "rotar") empezar();
      }

      if (modo.current !== "rotar" && modo.current !== "desplazar") return;

      const dx = e.clientX - ultimo.current.x;
      const dy = e.clientY - ultimo.current.y;
      ultimo.current = { x: e.clientX, y: e.clientY };

      // Con el dedo hay que cancelar el gesto del navegador; con mouse el
      // evento no es cancelable y no hace falta.
      if (e.pointerType === "touch" && e.cancelable) e.preventDefault();

      if (modo.current === "desplazar") {
        pend.dPanX += dx;
        pend.dPanY += dy;
        return;
      }

      // Rotar: LOS DOS EJES, siempre. El horizontal gira el azimut y el
      // vertical inclina el polar; no hay ninguna rama que descarte uno.
      pend.dAzimut -= dx * radPorPx.current;
      pend.dPolar -= dy * radPorPx.current;
    },
    [empezar],
  );

  const terminar = useCallback(
    (e: PointerEvent) => {
      if (!activos.current.delete(e.pointerId)) return;
      pellizco.current = activos.current.size >= 2 ? medirPellizco() : null;
      if (activos.current.size > 0) return;
      soltarTodo.current?.();
      modo.current = "indefinido";
      // Se soltó el último puntero: recién ahora arranca la cuenta de
      // inactividad. Mientras el gesto duraba no corría ningún reloj.
      if (avisado.current) {
        avisado.current = false;
        onGestureEnd();
      }
    },
    [onGestureEnd],
  );

  const escuchar = useCallback(() => {
    if (escuchando.current) return;
    escuchando.current = true;
    const alMover = mover as EventListener;
    const alTerminar = terminar as EventListener;
    window.addEventListener("pointermove", alMover, { passive: false });
    window.addEventListener("pointerup", alTerminar, { passive: false });
    window.addEventListener("pointercancel", alTerminar, { passive: false });
    soltarTodo.current = () => {
      escuchando.current = false;
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alTerminar);
      window.removeEventListener("pointercancel", alTerminar);
      soltarTodo.current = null;
    };
  }, [mover, terminar]);

  useEffect(() => () => soltarTodo.current?.(), []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      activos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      escuchar();

      if (activos.current.size === 1) {
        const caja = e.currentTarget.getBoundingClientRect();
        radPorPx.current = (2 * Math.PI) / Math.max(caja.height, 1);
        origen.current = { x: e.clientX, y: e.clientY };
        ultimo.current = { x: e.clientX, y: e.clientY };
        pellizco.current = null;

        if (e.pointerType === "touch") {
          // Todavía puede ser un scroll de página: se decide al moverse.
          modo.current = "indefinido";
        } else {
          // Mouse o lápiz: sin ambigüedad. Botón derecho, botón del medio
          // o Shift desplazan; cualquier otro rota.
          modo.current = e.button === 2 || e.button === 1 || e.shiftKey ? "desplazar" : "rotar";
          empezar();
        }
      } else if (activos.current.size === 2) {
        // Dos dedos: pellizco. Nunca es scroll de página.
        modo.current = "desplazar";
        pellizco.current = medirPellizco();
        empezar();
      }
    },
    [empezar, escuchar],
  );

  /**
   * La rueda va enganchada A MANO, no por `onWheel` de React.
   *
   * React registra los listeners de `wheel` en la raíz como PASIVOS, y en
   * un listener pasivo `preventDefault()` no hace nada: el zoom ocurría y
   * la página scrolleaba al mismo tiempo. Con `{ passive: false }` sobre
   * el contenedor, la rueda encima del carrusel hace zoom y nada más.
   *
   * Consecuencia asumida: con el cursor sobre el cuadro la rueda no
   * scrollea la página. Hay que salir del cuadro para seguir bajando.
   */
  useEffect(() => {
    const nodo = contenedorRef.current;
    if (!nodo) return;
    const alGirarRueda = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (e.cancelable) e.preventDefault();
      pendienteRef.current.factorZoom *= e.deltaY > 0 ? 1 / PASO_RUEDA : PASO_RUEDA;
      onInteraction();
    };
    nodo.addEventListener("wheel", alGirarRueda, { passive: false });
    return () => nodo.removeEventListener("wheel", alGirarRueda);
  }, [contenedorRef, onInteraction]);

  // El botón derecho desplaza, así que no debe abrir el menú contextual;
  // y arrastrar sobre el canvas no debe iniciar un arrastre nativo.
  const onContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => e.preventDefault(), []);
  const onDragStart = useCallback((e: React.DragEvent<HTMLElement>) => e.preventDefault(), []);

  return {
    pendienteRef,
    handlers: { onPointerDown, onContextMenu, onDragStart },
  };
}
