// docs/PLAN.md § Fase 9: eventos de analítica con nombres estándar de
// e-commerce (view_product, add_to_quote, open_quote, whatsapp_click) desde
// ahora, para no rehacer reportes después.
//
// Capa fina y agnóstica del proveedor: quien dispara un evento
// (AddToCartButton, CarritoView, ViewProductTracker) no sabe que hoy es
// GA4 — si algún día cambia, se toca este archivo y GoogleAnalytics.tsx,
// no cada punto de disparo.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, string | number>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", name, params);
  } catch {
    // Un evento de analítica nunca debe romper la UI — mismo criterio que
    // sendQuoteLog (lib/quoteLog/send.ts): fire-and-forget, sin excepción
    // visible para el usuario.
  }
}
