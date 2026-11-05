// Una fila de VEHICULOS → un Vehiculo, o los motivos por los que se rechaza.
// Puro, y junta TODOS los motivos de la fila: quien revisa el libro corrige
// todo de una vez, no un error por corrida.
//
// Los textos (marca, modelo, ubicación, medida) se recortan en los extremos.
// `radio_*`, `accesorio_*` y `revisado` no distinguen mayúsculas.
// `ubicacion_*` y `medida_*` se comparan EXACTOS contra LISTAS: la medida es
// la misma cadena que el campo `medida` de las bocinas del catálogo, y el
// selector compara por igualdad de texto.
import type { Celda } from "../catalogo/contrato.ts";
import { slugificar } from "../slug.ts";
import {
  PIEZAS_NOMBRADAS,
  type Accesorio,
  type EstadoRadio,
  type UbicacionVehiculo,
  type Vehiculo,
} from "../../lib/vehiculos/types.ts";
import type { FilaVehiculoCruda, Listas } from "./contrato.ts";

export interface FilaVehiculo {
  numero: number;
  revisado: boolean;
  vehiculo: Vehiculo;
}

export type ResultadoFila =
  | { ok: true; fila: FilaVehiculo }
  | { ok: false; numero: number; revisado: boolean | null; motivos: string[] };

export interface ContextoFila {
  listas: Listas;
  skusCatalogo: ReadonlySet<string>;
  anioActual: number;
}

const ANIO_MINIMO = 1940;

const RADIOS: Record<string, EstadoRadio> = {
  directo: "directo",
  "con marco": "con_marco",
  "no cabe": "no_cabe",
};

function texto(celda: Celda | undefined): string {
  if (celda === null || celda === undefined) return "";
  return String(celda).trim();
}

// Las medidas se separan con « / », con espacios: «5.25" / 6.5"». Partir
// por «/» a secas rompería las medidas de tweeter, que llevan barra adentro
// (7/8", 3/4").
function partirMedidas(valor: string): string[] {
  const medidas: string[] = [];
  for (const medida of valor.split(" / ").map((m) => m.trim())) {
    if (medida && !medidas.includes(medida)) medidas.push(medida);
  }
  return medidas;
}

export function normalizarFilaVehiculo(fila: FilaVehiculoCruda, ctx: ContextoFila): ResultadoFila {
  const { celdas, numero } = fila;
  const motivos: string[] = [];

  const crudoRevisado = texto(celdas.revisado).toLowerCase();
  let revisado: boolean | null = null;
  if (crudoRevisado === "sí" || crudoRevisado === "si") revisado = true;
  else if (crudoRevisado === "no") revisado = false;
  else motivos.push(`revisado: escribí «sí» o «no» (llegó «${texto(celdas.revisado)}»).`);

  const marca = texto(celdas.marca);
  const modelo = texto(celdas.modelo);
  const versionTexto = texto(celdas.version);
  if (!marca) motivos.push("marca: es obligatoria.");
  if (!modelo) motivos.push("modelo: es obligatorio.");
  const marcaSlug = slugificar(marca);
  const modeloSlug = slugificar(modelo);
  const versionSlug = versionTexto ? slugificar(versionTexto) : null;
  if (marca && !marcaSlug) motivos.push(`marca: «${marca}» no da un slug.`);
  if (modelo && !modeloSlug) motivos.push(`modelo: «${modelo}» no da un slug.`);
  if (versionTexto && !versionSlug) motivos.push(`version: «${versionTexto}» no da un slug.`);

  const maximo = ctx.anioActual + 1;
  const anio = (columna: "desde" | "hasta"): number | null => {
    const celda = celdas[columna];
    if (
      typeof celda === "number" &&
      Number.isInteger(celda) &&
      celda >= ANIO_MINIMO &&
      celda <= maximo
    ) {
      return celda;
    }
    motivos.push(
      `${columna}: tiene que ser un año de ${ANIO_MINIMO} a ${maximo}, escrito como número ` +
        `(llegó «${texto(celda)}»).`,
    );
    return null;
  };
  const desde = anio("desde");
  const hasta = anio("hasta");
  if (desde !== null && hasta !== null && desde > hasta) {
    motivos.push(`desde (${desde}) es mayor que hasta (${hasta}).`);
  }

  const radio = (columna: "radio_1din" | "radio_2din"): EstadoRadio | null => {
    const valor = texto(celdas[columna]);
    if (!valor) return null;
    const estado = RADIOS[valor.toLowerCase()];
    if (!estado) {
      motivos.push(`${columna}: «${valor}» no es «directo», «con marco» ni «no cabe».`);
      return null;
    }
    return estado;
  };
  const radio1din = radio("radio_1din");
  const radio2din = radio("radio_2din");

  const ubicaciones: UbicacionVehiculo[] = [];
  let hayUbicacion = false;
  for (const n of [1, 2, 3, 4]) {
    const ubicacion = texto(celdas[`ubicacion_${n}`]);
    const medida = texto(celdas[`medida_${n}`]);
    const accesorioTexto = texto(celdas[`accesorio_${n}`]);
    if (!ubicacion) {
      if (medida) motivos.push(`medida_${n}: hay una medida sin ubicación (ubicacion_${n}).`);
      if (accesorioTexto) {
        motivos.push(`accesorio_${n}: hay un accesorio sin ubicación (ubicacion_${n}).`);
      }
      continue;
    }
    hayUbicacion = true;
    if (!ctx.listas.ubicaciones.has(ubicacion)) {
      motivos.push(`ubicacion_${n}: «${ubicacion}» no está en LISTAS.`);
    }
    if (ubicaciones.some((u) => u.ubicacion === ubicacion)) {
      motivos.push(`ubicacion_${n}: «${ubicacion}» está repetida en la fila.`);
    }
    const medidas = partirMedidas(medida);
    if (medidas.length === 0) {
      motivos.push(`ubicacion_${n}: «${ubicacion}» no tiene medida (medida_${n}).`);
    }
    for (const m of medidas) {
      if (!ctx.listas.medidas.has(m)) motivos.push(`medida_${n}: «${m}» no está en LISTAS.`);
    }

    let accesorio: Accesorio | null = null;
    if (accesorioTexto) {
      const pieza = PIEZAS_NOMBRADAS.find((sku) => sku === accesorioTexto.toUpperCase());
      if (pieza) {
        accesorio = pieza;
        if (!ctx.skusCatalogo.has(pieza)) {
          motivos.push(`accesorio_${n}: «${pieza}» no existe en el catálogo.`);
        }
      } else if (accesorioTexto.toLowerCase() === "otro") {
        accesorio = "otro";
      } else {
        motivos.push(
          `accesorio_${n}: «${accesorioTexto}» no es ${PIEZAS_NOMBRADAS.join(", ")} ni «otro».`,
        );
      }
    }
    ubicaciones.push({ ubicacion, medidas, accesorio });
  }

  if (!texto(celdas.radio_1din) && !texto(celdas.radio_2din) && !hayUbicacion) {
    motivos.push("la fila no tiene ningún dato: los dos radios vacíos y ninguna ubicación.");
  }

  if (motivos.length > 0 || revisado === null || desde === null || hasta === null) {
    return { ok: false, numero, revisado, motivos };
  }
  return {
    ok: true,
    fila: {
      numero,
      revisado,
      vehiculo: {
        marca,
        marcaSlug,
        modelo,
        modeloSlug,
        version: versionTexto || null,
        versionSlug,
        desde,
        hasta,
        radio1din,
        radio2din,
        ubicaciones,
      },
    },
  };
}
