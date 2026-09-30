"use client";

import { Component, type ReactNode } from "react";

/**
 * Si el canvas 3D falla —un .glb que no baja en una red móvil inestable, un
 * modelo renombrado en un deploy mientras la pestaña seguía abierta, el
 * decoder de Draco o el propio bloque de three que no llegan—, el error sale
 * del <Canvas> de R3F, que lo vuelve a lanzar hacia afuera. Sin un límite
 * propio, el más cercano era el de Next y el inicio entero se cambiaba por
 * «Application error». Con esto se pierde solo el modelo: el cuadro queda con
 * su fondo, y la categoría, las flechas y los enlaces siguen funcionando.
 */
export class SinCanvasSiFalla extends Component<
  { children: ReactNode; alFallar?: () => void },
  { fallo: boolean }
> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[carrusel 3D] no se pudo dibujar el modelo:", error);
    this.props.alFallar?.();
  }

  render() {
    return this.state.fallo ? null : this.props.children;
  }
}
