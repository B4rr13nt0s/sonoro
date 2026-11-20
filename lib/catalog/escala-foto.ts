// Escala de la foto de una bocina o un subwoofer en la TARJETA del catálogo
// (decisión del negocio, noviembre de 2026): las fotos de producto llenan el
// cuadrado de la tarjeta sin importar el tamaño del producto, y una bocina de
// 4" se veía igual de grande que un subwoofer de 15". Con la escala, el
// tamaño en pantalla acompaña al real. 1 es «el tamaño actual» y es el techo:
// nada se agranda.
//
// Es UNA sola curva para las dos categorías: una bocina de 8" y un subwoofer
// de 8" se dibujan igual de grandes. Antes cada categoría tenía la suya (la
// bocina de 6.5" a 95 % y el subwoofer de 6.5" a 80 %), y un producto de
// 6.5" se veía de dos tamaños según lo que fuera.
//
// Es un dato derivado de la categoría, `atributos.medida` y
// `atributos.configuracion`; no vive en catalog.json. El adaptador estático lo
// agrega a cada producto al leerlo (`escalaFoto`), y de ahí llega a la tarjeta
// de los listados, de /buscar y del selector de vehículos. La ficha y su
// galería NO la usan: ahí la foto va entera.

// Pares [pulgadas, escala], de menor a mayor. Entre dos pares la escala se
// interpola en línea recta; fuera de los extremos se queda en el del extremo.
// Los tamaños que el negocio no nombró (3.5", 4.5", 6.75"…) caen entre los dos
// vecinos en vez de saltar de un escalón al siguiente.
const CURVA: readonly (readonly [number, number])[] = [
  [1, 0.55], // tweeters y bocinas chicas: de 55 %...
  [3.5, 0.65], // ...a 65 % justo antes de las de 4"
  [4, 0.7], // 4" y 4x6"
  [5.25, 0.75], // 5.25" y 5x7"
  [6.5, 0.8], // 6.5" y 6x9"
  [8, 0.85],
  [10, 0.9],
  [12, 0.95],
  [15, 1], // 15" o más
];

// Las dos categorías que llevan escala. Cualquier otra dibuja la foto entera.
const CATEGORIAS = ["Bocinas", "Subwoofers"];

// Un componente (bocina de dos o tres vías con el crossover y el tweeter
// aparte) se vende como juego, y su foto principal es el juego entero, que
// ocupa casi todo el ancho del cuadro. Achicarla lo dejaría más chico que una
// bocina sola de la misma medida, así que el juego no lleva escala.
const CONFIGURACIONES_SIN_ESCALA = ["componentes-2v", "componentes-3v"];

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

function interpolar(pulgadas: number): number {
  const primero = CURVA[0];
  const ultimo = CURVA[CURVA.length - 1];
  if (pulgadas <= primero[0]) return primero[1];
  if (pulgadas >= ultimo[0]) return ultimo[1];
  for (let i = 1; i < CURVA.length; i += 1) {
    const [x1, y1] = CURVA[i];
    if (pulgadas <= x1) {
      const [x0, y0] = CURVA[i - 1];
      return y0 + ((y1 - y0) * (pulgadas - x0)) / (x1 - x0);
    }
  }
  return ultimo[1];
}

/**
 * La escala (entre 0.55 y 1) con que se dibuja la foto de la tarjeta, o
 * `undefined` si el producto no la lleva: otra categoría, un componente, o una
 * medida que no se puede leer. Sin valor, la tarjeta dibuja la foto al tamaño
 * de siempre.
 */
export function escalaFotoCatalogo(producto: {
  categoria: string;
  medida?: string;
  configuracion?: string;
}): number | undefined {
  const { categoria, medida, configuracion } = producto;
  if (!CATEGORIAS.includes(categoria) || !medida) return undefined;
  if (configuracion && CONFIGURACIONES_SIN_ESCALA.includes(configuracion)) return undefined;
  const pulgadas = pulgadasEquivalentes(medida);
  if (pulgadas === undefined) return undefined;
  return Math.round(interpolar(pulgadas) * 1000) / 1000;
}
