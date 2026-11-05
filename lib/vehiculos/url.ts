// El vehículo elegido vive en la dirección de /buscar, como el resto de la
// búsqueda: /buscar?vehiculo=toyota&modelo=corolla&anio=2010, más
// &version=tablero-gris cuando ese año tiene más de un tablero de fábrica.
//
// La marca del vehículo va en `vehiculo` y no en `marca` porque /buscar ya
// usa `marca` para filtrar por marca de PRODUCTO (Memphis, Pioneer…).
//
// Lógica pura. Un valor que no existe —un enlace compartido que quedó viejo
// porque el libro cambió— no rompe nada: el selector se queda en el primer
// nivel inválido, con lo anterior ya elegido.
import { compararTexto } from "../catalog/orden.ts";
import type { Vehiculo } from "./types.ts";

/** Slugs de lo elegido. En la dirección, `marca` viaja como `vehiculo`. */
export interface Seleccion {
  marca?: string;
  modelo?: string;
  anio?: number;
  version?: string;
}

export interface Opcion {
  slug: string;
  nombre: string;
}

export interface SeleccionResuelta {
  marca: Opcion | null;
  modelo: Opcion | null;
  anio: number | null;
  version: Opcion | null;
  /** El vehículo completo, cuando la selección alcanza para uno solo. */
  vehiculo: Vehiculo | null;
  opciones: { marcas: Opcion[]; modelos: Opcion[]; anios: number[]; versiones: Opcion[] };
}

export function leerSeleccion(busqueda: string): Seleccion {
  const params = new URLSearchParams(busqueda);
  const texto = (clave: string) => params.get(clave)?.trim() || undefined;
  const anio = texto("anio");
  const sel: Seleccion = {};
  const marca = texto("vehiculo");
  const modelo = texto("modelo");
  const version = texto("version");
  if (marca) sel.marca = marca;
  if (modelo) sel.modelo = modelo;
  if (anio && /^\d{4}$/.test(anio)) sel.anio = Number(anio);
  if (version) sel.version = version;
  return sel;
}

// Orden fijo, y un nivel solo si está el anterior: un modelo sin marca no
// significa nada.
export function escribirSeleccion(sel: Seleccion): string {
  const params = new URLSearchParams();
  if (sel.marca) {
    params.set("vehiculo", sel.marca);
    if (sel.modelo) {
      params.set("modelo", sel.modelo);
      if (sel.anio !== undefined) {
        params.set("anio", String(sel.anio));
        if (sel.version) params.set("version", sel.version);
      }
    }
  }
  return params.toString();
}

function opcionesDe(
  vehiculos: readonly Vehiculo[],
  slug: (v: Vehiculo) => string | null,
  nombre: (v: Vehiculo) => string | null,
): Opcion[] {
  const porSlug = new Map<string, string>();
  for (const v of vehiculos) {
    const s = slug(v);
    const n = nombre(v);
    if (s !== null && n !== null && !porSlug.has(s)) porSlug.set(s, n);
  }
  return [...porSlug.entries()]
    .map(([s, n]) => ({ slug: s, nombre: n }))
    .sort((a, b) => compararTexto(a.nombre, b.nombre));
}

export function resolverSeleccion(
  vehiculos: readonly Vehiculo[],
  sel: Seleccion,
): SeleccionResuelta {
  const marcas = opcionesDe(
    vehiculos,
    (v) => v.marcaSlug,
    (v) => v.marca,
  );
  const resuelta: SeleccionResuelta = {
    marca: null,
    modelo: null,
    anio: null,
    version: null,
    vehiculo: null,
    opciones: { marcas, modelos: [], anios: [], versiones: [] },
  };

  const marca = marcas.find((o) => o.slug === sel.marca) ?? null;
  if (!marca) return resuelta;
  resuelta.marca = marca;
  const deMarca = vehiculos.filter((v) => v.marcaSlug === marca.slug);
  resuelta.opciones.modelos = opcionesDe(
    deMarca,
    (v) => v.modeloSlug,
    (v) => v.modelo,
  );

  const modelo = resuelta.opciones.modelos.find((o) => o.slug === sel.modelo) ?? null;
  if (!modelo) return resuelta;
  resuelta.modelo = modelo;
  const deModelo = deMarca.filter((v) => v.modeloSlug === modelo.slug);
  const anios = new Set<number>();
  for (const v of deModelo) for (let a = v.desde; a <= v.hasta; a += 1) anios.add(a);
  resuelta.opciones.anios = [...anios].sort((a, b) => b - a);

  const anio = sel.anio !== undefined && anios.has(sel.anio) ? sel.anio : null;
  if (anio === null) return resuelta;
  resuelta.anio = anio;
  const delAnio = deModelo.filter((v) => v.desde <= anio && anio <= v.hasta);

  // Un solo vehículo en ese año: queda elegido, aunque la dirección traiga
  // otra versión, y el título lleva la versión de esa fila si la tiene.
  if (delAnio.length === 1) {
    const [unico] = delAnio;
    resuelta.vehiculo = unico;
    resuelta.version =
      unico.version !== null && unico.versionSlug !== null
        ? { slug: unico.versionSlug, nombre: unico.version }
        : null;
    return resuelta;
  }

  resuelta.opciones.versiones = opcionesDe(
    delAnio,
    (v) => v.versionSlug,
    (v) => v.version,
  );
  const version = resuelta.opciones.versiones.find((o) => o.slug === sel.version) ?? null;
  if (!version) return resuelta;
  resuelta.version = version;
  resuelta.vehiculo = delAnio.find((v) => v.versionSlug === version.slug) ?? null;
  return resuelta;
}
