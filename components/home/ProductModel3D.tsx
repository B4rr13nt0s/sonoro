"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

import { DRACO_DECODER_PATH, MODELS, modelUrl, type ModelId } from "@/lib/models3d.ts";

export interface ProductModel3DProps {
  id: ModelId;
  /** Desplazamiento horizontal en el mundo, en metros. Lo usa la transición del carrusel. */
  offsetX?: number;
  /**
   * Ángulo de giro sobre Y, en radianes, por referencia. Es un valor
   * ABSOLUTO, no una velocidad: el ciclo lo calcula desde el instante en
   * que empezó la vuelta. Acumular `+= velocidad · delta` haría que el
   * modelo arrastre el ángulo del producto anterior al cambiar de slide.
   * Va por ref y no por prop para no re-renderizar en cada frame.
   */
  anguloRef?: React.RefObject<number>;
}

export function ProductModel3D({ id, offsetX = 0, anguloRef }: ProductModel3DProps) {
  const entry = MODELS[id];
  // El segundo argumento fija el decoder de Draco en /draco/ (local). Sin
  // él drei cae al CDN de gstatic.com, que es un tercero en el critical
  // path del home — ver Paso 1 del brief.
  const { scene } = useGLTF(modelUrl(id), DRACO_DECODER_PATH);

  // Durante una transición el mismo modelo puede estar montado dos veces
  // (saliente y entrante, o el mismo id en dos posiciones del anillo). Sin
  // el clone ambas instancias comparten el mismo Object3D y las
  // transformaciones se pisan: una de las dos aparece en la posición de la
  // otra.
  const model = useMemo(() => scene.clone(), [scene]);

  const spinner = useRef<Group>(null);

  useFrame(() => {
    // El giro base orienta el producto hacia la cámara en la vista
    // predeterminada; el del ciclo se suma encima.
    if (spinner.current)
      spinner.current.rotation.y = (entry.giroBase ?? 0) + (anguloRef?.current ?? 0);
  });

  // Los .glb apoyan en Y = 0 (Ymin = 0 es convención del pipeline). Para
  // que el modelo quede centrado vertical en el cuadro hay que bajarlo
  // media altura ya escalada.
  const y = -(entry.height * entry.displayScale) / 2;

  return (
    <group position={[offsetX, 0, 0]}>
      <group ref={spinner}>
        <primitive object={model} scale={entry.displayScale} position={[0, y, 0]} />
      </group>
    </group>
  );
}

/** Precarga un .glb en la caché de drei. El carrusel la usa después de que el hero es interactivo. */
export function preloadModel(id: ModelId) {
  useGLTF.preload(modelUrl(id), DRACO_DECODER_PATH);
}
