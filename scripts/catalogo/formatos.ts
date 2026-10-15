// Lectura de las dos columnas de Amplificadores que NO son un número suelto.
// Puro. Una celda que no tiene el formato no se «adivina»: se rechaza con el
// formato esperado a la vista, y la fila queda fuera de catalog.json.
//
//   potencia_rms_w   «900 W @ 4 Ω · 1,600 W @ 2 Ω · 3,000 W @ 1 Ω»
//   dimensiones      «300 × 200 × 50 mm»

import type { Dimensiones, PotenciaPorCarga } from "../../lib/catalog/labels.ts";
import { esVacia, type Celda } from "./contrato.ts";

// Un valor que no se pudo leer, con el motivo. No es una excepción: el lector
// de la fila lo recoge junto con los demás motivos de esa fila.
export class ErrorDeFormato {
  readonly message: string;
  constructor(message: string) {
    this.message = message;
  }
}

export const FORMATO_POTENCIA = "### W @ # Ω · ### W @ # Ω · ### W @ # Ω";
export const FORMATO_DIMENSIONES = "## × ## × ## mm";

const NUMERO = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const aNumero = (texto: string) => Number(texto.replace(/,/g, ""));

// U+2126 (signo de ohm) se ve igual que U+03A9 (omega) y es lo que a veces
// pega el teclado o una página web: se lleva a la omega antes de leer.
const limpiar = (texto: string) => texto.replace(/Ω/g, "Ω").trim();

const CARGA = new RegExp(String.raw`^(${NUMERO})\s*W\s*@\s*(${NUMERO})\s*(?:Ω|ohms?)$`, "i");

export function leerPotenciaPorCarga(
  celda: Celda | undefined,
): PotenciaPorCarga[] | string | ErrorDeFormato | undefined {
  if (esVacia(celda)) return undefined;
  const texto = limpiar(String(celda));
  const falla = (detalle: string) =>
    new ErrorDeFormato(`«${texto}» ${detalle}; el formato es «${FORMATO_POTENCIA}»`);

  const cargas: PotenciaPorCarga[] = [];
  for (const parte of texto.split("·")) {
    const m = CARGA.exec(parte.trim());
    if (!m) {
      // Amplificadores multicanal: «180 W × 4 @ 2 Ω · 360 W × 2 @ 4 Ω puente».
      // No cabe en {w, ohm}: se guarda el texto, con la condición de que
      // nombre al menos una potencia y una impedancia.
      if (/\d\s*W/i.test(texto) && /\d\s*(?:Ω|ohms?)/i.test(texto)) {
        return texto.replace(/\s+/g, " ");
      }
      return falla("no tiene el formato de potencia por impedancia");
    }
    const w = aNumero(m[1]);
    const ohm = aNumero(m[2]);
    if (w <= 0 || ohm <= 0) return falla("tiene una potencia o una impedancia en cero");
    if (cargas.some((c) => c.ohm === ohm)) return falla(`repite la impedancia de ${ohm} Ω`);
    cargas.push({ w, ohm });
  }
  return cargas;
}

const SEPARADOR = String.raw`\s*[×xX]\s*`;
const DIMENSIONES = new RegExp(
  String.raw`^(${NUMERO})${SEPARADOR}(${NUMERO})${SEPARADOR}(${NUMERO})\s*mm$`,
  "i",
);

export function leerDimensiones(
  celda: Celda | undefined,
): Dimensiones | ErrorDeFormato | undefined {
  if (esVacia(celda)) return undefined;
  const texto = String(celda).trim();
  const m = DIMENSIONES.exec(texto);
  const medidas = m ? ([m[1], m[2], m[3]].map(aNumero) as Dimensiones) : null;
  if (!medidas || medidas.some((n) => n <= 0)) {
    return new ErrorDeFormato(
      `«${texto}» no tiene el formato de dimensiones; el formato es «${FORMATO_DIMENSIONES}», con la unidad`,
    );
  }
  return medidas;
}
