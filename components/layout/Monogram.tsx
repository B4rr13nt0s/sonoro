// Monograma v2 (ondas sobre la silueta de un carro), el mismo trazo de
// public/logos/sonoro_v2/sonoro-monograma-*.svg, como SVG en línea para poder
// tokenizar tamaño y radio por lugar de uso (nav: 32px / rounded-nav-mark) en
// vez de depender de un PNG a un tamaño fijo. El cuadro lo pinta el <span>
// (bg-negro + el radio del token); el SVG trae solo las ondas y el carro.
type MonogramProps = {
  className: string;
};

export function Monogram({ className }: MonogramProps) {
  return (
    <span className={`bg-negro inline-flex flex-none items-center justify-center ${className}`}>
      {/* Los trazos toman el color del texto (currentColor → token blanco), no
          un hex escrito a mano (CLAUDE.md § Sistema visual). */}
      <svg viewBox="0 0 2048 2048" className="h-full w-full text-white" aria-hidden="true">
        <g transform="translate(0 30)" fill="none" stroke="currentColor" strokeWidth={100}>
          <path d="M500 758Q1024 362 1548 758" />
          <path d="M612 924Q1024 596 1436 924" />
          <path d="M712 1074Q1024 846 1336 1074" />
        </g>
        <path
          transform="translate(0 30)"
          fill="currentColor"
          d="M430 1478C430 1400 484 1342 560 1332C704 1320 734 1304 806 1252C884 1192 938 1200 1024 1200C1110 1200 1164 1192 1242 1252C1314 1304 1344 1320 1488 1332C1564 1342 1618 1400 1618 1478H1538C1532 1456 1520 1444 1498 1440C1382 1420 1312 1404 1230 1346C1152 1292 1100 1304 1024 1304C948 1304 896 1292 818 1346C736 1404 666 1420 550 1440C528 1444 516 1456 510 1478Z"
        />
      </svg>
    </span>
  );
}
