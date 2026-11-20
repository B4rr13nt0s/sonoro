// Escala de la foto de una bocina o un subwoofer en la TARJETA del catálogo
// (decisión del negocio, noviembre de 2026): las fotos de producto llenan el
// cuadrado de la tarjeta sin importar el tamaño del producto, y una bocina de
// 4" se veía igual de grande que un subwoofer de 15". Con la escala, el
// tamaño en pantalla acompaña al real. 1 es «el tamaño actual» y es el techo:
// nada se agranda.
//
// Es un dato derivado de `categoria` y `atributos.medida`; no vive en
// catalog.json. El adaptador estático lo agrega a cada producto al leerlo
// (`escalaFoto`), y de ahí llega a la tarjeta de los listados, de /buscar y del
// selector de vehículos. La ficha y su galería NO la usan: ahí la foto va
// entera.

// Pares [pulgadas, escala], de menor a mayor. Entre dos pares la escala se
// interpola en línea recta; fuera de los extremos se queda en el del extremo.
// Los pares son los valores que fijó el negocio, y los tamaños intermedios que
// el negocio no nombró (3.5", 4.5", 6.75"…) caen entre los dos vecinos en vez
// de saltar de un escalón al siguiente.
type Tramo = readonly (readonly [number, number])[];

const BOCINAS: Tramo = [
  [1, 0.65], // tweeters y bocinas chicas: de 65 %...
  [3.5, 0.75], // ...a 75 % justo antes de las de 4"
  [4, 0.8], // 4" y 4x6"
  [5.25, 0.85], // 5.25" y 5x7"
  [6.5, 0.95], // 6.5" y 6x9"
  [8, 1], // 8" y más
];

const SUBWOOFERS: Tramo = [
  [6.5, 0.8],
  [8, 0.85],
  [10, 0.9],
  [12, 0.95],
  [15, 1],
];

const TRAMOS: Readonly<Record<string, Tramo>> = {
  Bocinas: BOCINAS,
  Subwoofers: SUBWOOFERS,
};

// Una ovalada se mide con la redonda de su clase, como la agrupó el negocio:
// una 4x6" va con las de 4", una 5x7" con las de 5.25" y una 6x9" con las de
// 6.5". El resto de las ovaladas usa su primera cifra, el lado corto.
const OVALADAS: Readonly<Record<string, number>> = {
  "4x6": 4,
  "5x7": 5.25,
  "6x9": 6.5,
};

/** La medida del catálogo (`6.5"`, `4x6"`, `3/4"`, `40 mm`) en pulgadas redondas equivalentes. */
export function pulgadasEquivalentes(medida: string): number | undefined {
  const texto = medida.trim();
  const ovalada = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/.exec(texto);
  if (ovalada) return OVALADAS[`${ovalada[1]}x${ovalada[2]}`] ?? Number(ovalada[1]);
  const fraccion = /^(\d+)\/(\d+)"$/.exec(texto);
  if (fraccion) return Number(fraccion[1]) / Number(fraccion[2]);
  const primero = /\d+(?:\.\d+)?/.exec(texto);
  if (!primero) return undefined;
  const n = Number(primero[0]);
  return /mm$/.test(texto) ? n / 25.4 : n;
}

function interpolar(tramo: Tramo, pulgadas: number): number {
  const primero = tramo[0];
  const ultimo = tramo[tramo.length - 1];
  if (pulgadas <= primero[0]) return primero[1];
  if (pulgadas >= ultimo[0]) return ultimo[1];
  for (let i = 1; i < tramo.length; i += 1) {
    const [x1, y1] = tramo[i];
    if (pulgadas <= x1) {
      const [x0, y0] = tramo[i - 1];
      return y0 + ((y1 - y0) * (pulgadas - x0)) / (x1 - x0);
    }
  }
  return ultimo[1];
}

/**
 * La escala (entre 0.65 y 1) con que se dibuja la foto de la tarjeta, o
 * `undefined` si el producto no la lleva: otra categoría, o una medida que no
 * se puede leer. Sin valor, la tarjeta dibuja la foto al tamaño de siempre.
 */
export function escalaFotoCatalogo(
  categoria: string,
  medida: string | undefined,
): number | undefined {
  const tramo = Object.hasOwn(TRAMOS, categoria) ? TRAMOS[categoria] : undefined;
  if (!tramo || !medida) return undefined;
  const pulgadas = pulgadasEquivalentes(medida);
  if (pulgadas === undefined) return undefined;
  return Math.round(interpolar(tramo, pulgadas) * 1000) / 1000;
}
