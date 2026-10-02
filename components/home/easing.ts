/** Curvas de easing del carrusel, de 0 a 1. Sin React ni three. */
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOutCubic = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
