// Las listas nativas (<select>) en píldora de /buscar. Son dos, a propósito:
//
//   - CLASE_SELECT, abajo: las de la barra de filtros de «Por producto» (texto
//     de 13 px, la flecha nativa del navegador).
//   - ListaPildora (components/ui/ListaPildora.tsx): las del selector de
//     vehículos, más grandes (15 px) y con la flecha dibujada más adentro. Su
//     `appearance-none` exige llevar la flecha en el mismo componente, y el
//     envoltorio que eso pide no entra sin más en la barra de filtros, cuyas
//     listas son hijos directos de una fila que se parte en las líneas que
//     haga falta (`sm:contents`).
//
// Si algún día la barra de filtros también lleva la flecha dibujada, pasa por
// ListaPildora y este archivo se borra.
export const CLASE_SELECT =
  "border-borde-pildora text-texto-nav rounded-full border bg-white px-4.5 py-3 text-[13px] lg:py-2";
