// ¿Hay, detrás de esta página, otra página DEL SITIO a la que volver?
//
// «Volver» no puede llamar a history.back() a ciegas: quien abre un enlace
// compartido por WhatsApp o por Google llega con el sitio como primera entrada
// de su historial, y un back() lo sacaría del sitio (o no haría nada). Ahí el
// botón lleva a la portada.
//
// Dos fuentes, de la mejor a la peor:
//  - La Navigation API (`navigation.canGoBack`), cuando el navegador la trae:
//    solo cuenta entradas del MISMO origen, que es justo la pregunta. Cubre
//    también las vueltas atrás que no cambian de ruta (filtros de un listado).
//  - Sin ella: las páginas que el botón vio en esta carga (el componente vive
//    en el layout y sobrevive a las navegaciones del cliente), o un historial
//    con más de una entrada cuyo origen anterior es el propio sitio (la carga
//    llegó desde otra página del sitio, p. ej. tras recargar).
export type EstadoNavegacion = {
  /** `navigation.canGoBack`, o `undefined` si el navegador no tiene la Navigation API. */
  canGoBack: boolean | undefined;
  /** Cuántas rutas distintas vio el botón desde que se cargó el documento (la actual incluida). */
  paginasVistas: number;
  /** `history.length`. */
  longitudHistorial: number;
  /** El `document.referrer` es del mismo origen que el sitio. */
  referrerMismoOrigen: boolean;
};

export function hayPaginaAnterior(estado: EstadoNavegacion): boolean {
  if (typeof estado.canGoBack === "boolean") return estado.canGoBack;
  return estado.paginasVistas > 1 || (estado.longitudHistorial > 1 && estado.referrerMismoOrigen);
}
