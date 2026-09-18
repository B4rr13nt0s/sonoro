"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { MODELS, MODEL_IDS } from "@/lib/models3d.ts";

import { useCicloCarrusel } from "./useIdleReturn";
import { useMediaQuery } from "./useMediaQuery";
import { useRotateGesture } from "./useRotateGesture";

/**
 * Alto del cuadro. Son exactamente las medidas que tenía el placeholder
 * del hero (`FOTO — subwoofer y amplificador…`) que este carrusel
 * reemplaza, y el contenedor las reserva antes de que monte el canvas: el
 * fallback de `next/dynamic` no aporta altura propia, así que el CLS del
 * home queda en cero.
 */
const ALTO = "h-[300px] sm:h-[380px] lg:h-[470px]";

/**
 * Lo que ocupa el chrome, en píxeles CSS, para que el encuadre no meta el
 * producto debajo. `v` es el alto de las bandas de arriba y abajo, `h` el
 * ancho de los bloques de las esquinas.
 *
 * Son constantes y no medidas del DOM a propósito: medir obligaría a
 * releer el layout en cada render y el resultado cambiaría con el largo
 * del nombre de cada categoría, así que el producto cambiaría de tamaño
 * de un slide a otro. Están tomadas del caso más ancho («Kits de
 * instalación») con aire de sobra.
 */
const CHROME_MOVIL = { v: 62, h: 230 };
const CHROME_SM = { v: 92, h: 320 };

// `three` no corre en el servidor: rompe el build. El canvas se carga solo
// en cliente. `next/dynamic` con `ssr: false` no está permitido en Server
// Components, por eso el import vive acá, en el componente cliente, y el
// home importa este archivo normalmente.
//
// Y no se pide apenas monta, sino cuando el navegador queda libre (ver
// `useCanvasDiferido`): son ~1 MB de three + drei + R3F, y descargarlos y
// ejecutarlos dentro de la hidratación deja el hilo principal bloqueado justo
// cuando el visitante espera ver el hero. Medido con el procesador frenado
// 4×, el bloqueo total pasa de 2.4 s a 0.02 s. El cuadro ya reserva su alto,
// así que esperar no mueve nada de sitio (CLS sigue en 0).
const CarouselCanvas = dynamic(() => import("./CarouselCanvas").then((m) => m.CarouselCanvas), {
  ssr: false,
  loading: () => null,
});

/**
 * `true` cuando conviene cargar el canvas: al quedar el navegador ocioso
 * después del primer pintado, o a los 2 s como tope.
 *
 * `requestIdleCallback` no existe en Safari, de ahí el `setTimeout` de
 * respaldo. El plazo es corto a propósito: el modelo es lo que el visitante
 * viene a ver, solo no debe competir con el primer pintado.
 */
function useCanvasDiferido(): boolean {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const id = window.setTimeout(() => setListo(true), 200);
      return () => window.clearTimeout(id);
    }
    const id = window.requestIdleCallback(() => setListo(true), { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }, []);

  return listo;
}

function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function ProductCarousel3D() {
  const total = MODEL_IDS.length;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [enCuadro, setEnCuadro] = useState(false);
  const [pestanaVisible, setPestanaVisible] = useState(true);

  const contenedor = useRef<HTMLDivElement>(null);
  const canvasListo = useCanvasDiferido();
  const reducedMotion = usePrefersReducedMotion();
  const anchoSm = useMediaQuery("(min-width: 640px)");
  const chrome = anchoSm ? CHROME_SM : CHROME_MOVIL;

  const avanzar = useCallback(() => {
    setDirection(1);
    setIndex((actual) => (actual + 1) % MODEL_IDS.length);
  }, []);

  const { fase, faseInicio, notifyInteraction, beginGesture, endGesture, alVolver, reiniciar } =
    useCicloCarrusel({
      activo: enCuadro && pestanaVisible,
      reducedMotion,
      onAvanzar: avanzar,
    });

  const { pendienteRef, handlers } = useRotateGesture(
    contenedor,
    beginGesture,
    endGesture,
    notifyInteraction,
  );

  // Navegación manual: se salta al producto pedido y el ciclo arranca de
  // cero. La cámara repone la vista predeterminada al ver que cambió el
  // índice, así que se llega al producto ya encuadrado.
  const ir = useCallback(
    (siguiente: number, dir: number) => {
      setDirection(dir);
      setIndex(((siguiente % MODEL_IDS.length) + MODEL_IDS.length) % MODEL_IDS.length);
      reiniciar();
    },
    [reiniciar],
  );

  const anterior = useCallback(() => ir(index - 1, -1), [ir, index]);
  const siguiente = useCallback(() => ir(index + 1, 1), [ir, index]);

  // IntersectionObserver: fuera del viewport el render pasa de 'always' a
  // 'never'. Un carrusel 3D que nadie está viendo no debe consumir GPU.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    const observer = new IntersectionObserver(([entrada]) => setEnCuadro(entrada.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  // Pestaña oculta: mismo criterio. requestAnimationFrame ya se frena solo
  // en la mayoría de navegadores, pero no en todos ni en todas las
  // situaciones (ventana de fondo visible, por ejemplo).
  useEffect(() => {
    const onChange = () => setPestanaVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const actual = MODELS[MODEL_IDS[index]];
  const frameloop = enCuadro && pestanaVisible ? "always" : "never";

  const botonRedondo =
    "border-borde-pildora text-negro bg-blanco/70 flex h-10 w-10 items-center justify-center rounded-full border text-[15px] backdrop-blur-sm";

  return (
    <div
      ref={contenedor}
      // `pan-y` deja pasar el scroll vertical del dedo. La decisión de
      // rotar o scrollear la toma useRotateGesture en los primeros píxeles
      // del arrastre.
      style={{ touchAction: "pan-y" }}
      className={`bg-fondo-alt relative mt-7 w-full cursor-grab touch-pan-y overflow-hidden rounded-t-2xl select-none active:cursor-grabbing ${ALTO}`}
      {...handlers}
    >
      {canvasListo ? (
        <CarouselCanvas
          index={index}
          direction={direction}
          fase={fase}
          faseInicio={faseInicio}
          chrome={chrome}
          pendienteRef={pendienteRef}
          alVolver={alVolver}
          frameloop={frameloop}
        />
      ) : null}

      {/* Toda la interfaz vive en el DOM, encima del canvas, nunca dentro.
          Un <canvas> es opaco para lectores de pantalla y para el
          indexado: si el nombre de la categoría vive solo adentro, no
          existe para Google. El enlace es un <a> real; el clic sobre el
          modelo puede ser un atajo, nunca el único camino.

          Cada bloque se ancla a su esquina por separado, en vez de ir en
          una sola barra: así el modelo queda con el centro del cuadro
          libre. `pointer-events-none` en cada capa deja pasar el arrastre
          al canvas y cada control lo reactiva para sí. */}

      {/* Arriba a la izquierda: la categoría */}
      <div className="pointer-events-none absolute top-0 left-0 p-5 sm:p-7">
        <Link
          href={actual.href}
          className="text-22 sm:text-26 pointer-events-auto font-semibold tracking-[-0.02em] underline-offset-4 hover:underline"
        >
          {actual.label}
        </Link>
      </div>

      {/* Abajo a la izquierda: en qué producto vamos */}
      <div
        aria-live="polite"
        className="text-texto-terciario pointer-events-none absolute bottom-0 left-0 p-5 font-mono text-[11px] tracking-[0.14em] uppercase sm:p-7"
      >
        {index + 1} / {total}
      </div>

      {/* Abajo a la derecha: puntos y flechas */}
      <div className="pointer-events-none absolute right-0 bottom-0 flex flex-col items-end gap-3 p-5 sm:p-7">
        <ul
          className="pointer-events-auto hidden gap-2 sm:flex"
          aria-label="Categorías del carrusel"
        >
          {MODEL_IDS.map((id, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => ir(i, i > index ? 1 : -1)}
                aria-label={`Ver ${MODELS[id].label}`}
                aria-current={i === index ? "true" : undefined}
                // El punto inactivo va relleno, no con borde: sobre
                // fondo-alt (#F5F5F3) el borde de píldora (#E4E4E0) da
                // 1.1:1 y desaparece.
                className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-negro" : "bg-negro/25"}`}
              />
            </li>
          ))}
        </ul>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={anterior}
            aria-label="Categoría anterior"
            className={botonRedondo}
          >
            ←
          </button>
          <button
            type="button"
            onClick={siguiente}
            aria-label="Categoría siguiente"
            className={botonRedondo}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
