"use client";

// Suspense no atrapa errores. Si el import() del panel se rechaza (sin red al
// primer clic, un chunk que ya no existe tras un deploy) o el panel lanza al
// dibujarse, el error subiría hasta el límite de error de la app, desde un
// componente del layout: se caería la página entera por un extra. Aquí se
// contiene: no se dibuja nada y se avisa para cerrar el panel; el siguiente
// clic reintenta (ver LanzadorChat).
import { Component, type ReactNode } from "react";

interface Props {
  alFallar: () => void;
  children: ReactNode;
}

export class LimiteErrorChat extends Component<Props, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch() {
    this.props.alFallar();
  }

  render() {
    return this.state.fallo ? null : this.props.children;
  }
}
