// Problemas ENTRE filas de VEHICULOS, que ninguna fila ve sola:
//
//   - dos filas del mismo modelo cuyos años se tocan, y alguna no trae
//     versión o las dos traen la misma: el selector no sabría cuál mostrar;
//   - grafías distintas de una marca, un modelo o una versión que dan el
//     mismo slug («Mazda» y «MAZDA»): el selector las juntaría en una opción.
//
// Regla de anotación: si TODAS las filas involucradas están revisadas, el
// problema se anota en todas (y el importador las rechaza). Si alguna no lo
// está, se anota solo en las que no están revisadas: una fila del borrador no
// frena el build ni despublica una fila revisada.
import type { FilaVehiculo } from "./filas.ts";

type Problemas = Map<number, string[]>;

function anotar(
  problemas: Problemas,
  involucradas: readonly FilaVehiculo[],
  motivo: (fila: FilaVehiculo) => string,
) {
  const todasRevisadas = involucradas.every((f) => f.revisado);
  for (const fila of involucradas) {
    if (todasRevisadas || !fila.revisado) {
      problemas.set(fila.numero, [...(problemas.get(fila.numero) ?? []), motivo(fila)]);
    }
  }
}

function seCruzan(a: FilaVehiculo, b: FilaVehiculo): boolean {
  const va = a.vehiculo;
  const vb = b.vehiculo;
  if (va.marcaSlug !== vb.marcaSlug || va.modeloSlug !== vb.modeloSlug) return false;
  if (va.desde > vb.hasta || vb.desde > va.hasta) return false;
  return va.versionSlug === null || vb.versionSlug === null || va.versionSlug === vb.versionSlug;
}

function colisiones(
  problemas: Problemas,
  filas: readonly FilaVehiculo[],
  campo: string,
  clave: (f: FilaVehiculo) => string | null,
  grafia: (f: FilaVehiculo) => string | null,
) {
  const grupos = new Map<string, Map<string, FilaVehiculo[]>>();
  for (const fila of filas) {
    const k = clave(fila);
    const g = grafia(fila);
    if (k === null || g === null) continue;
    const porGrafia = grupos.get(k) ?? new Map<string, FilaVehiculo[]>();
    porGrafia.set(g, [...(porGrafia.get(g) ?? []), fila]);
    grupos.set(k, porGrafia);
  }
  for (const porGrafia of grupos.values()) {
    if (porGrafia.size < 2) continue;
    const grafias = [...porGrafia.keys()].map((g) => `«${g}»`).join(" y ");
    anotar(
      problemas,
      [...porGrafia.values()].flat(),
      () => `${campo}: ${grafias} dan el mismo slug; unificá la grafía en el libro.`,
    );
  }
}

export function problemasEntreFilas(filas: readonly FilaVehiculo[]): Problemas {
  const problemas: Problemas = new Map();

  for (let i = 0; i < filas.length; i += 1) {
    for (let j = i + 1; j < filas.length; j += 1) {
      const a = filas[i];
      const b = filas[j];
      if (!seCruzan(a, b)) continue;
      anotar(problemas, [a, b], (fila) => {
        const otra = fila === a ? b : a;
        return (
          `se cruza en años con la fila ${otra.numero} (${otra.vehiculo.marca} ` +
          `${otra.vehiculo.modelo} ${otra.vehiculo.desde}–${otra.vehiculo.hasta}); si son ` +
          "tableros distintos, poné una versión distinta en cada una."
        );
      });
    }
  }

  colisiones(
    problemas,
    filas,
    "marca",
    (f) => f.vehiculo.marcaSlug,
    (f) => f.vehiculo.marca,
  );
  colisiones(
    problemas,
    filas,
    "modelo",
    (f) => `${f.vehiculo.marcaSlug}|${f.vehiculo.modeloSlug}`,
    (f) => f.vehiculo.modelo,
  );
  colisiones(
    problemas,
    filas,
    "version",
    (f) =>
      f.vehiculo.versionSlug === null
        ? null
        : `${f.vehiculo.marcaSlug}|${f.vehiculo.modeloSlug}|${f.vehiculo.versionSlug}`,
    (f) => f.vehiculo.version,
  );

  return problemas;
}
