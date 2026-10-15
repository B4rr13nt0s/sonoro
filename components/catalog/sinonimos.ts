// Cómo habla la gente frente a cómo se llama el producto en el catálogo.
// Vocabulario de búsqueda mantenido a mano, como el de lib/seo/textos.ts: el
// catálogo no trae sinónimos y no hay de dónde sacarlos.
//
// Las claves van sin acentos, en minúsculas y en singular (la misma `raiz`
// que aplica busqueda.ts a lo que escribe el cliente). Los valores son
// palabras que SÍ aparecen en nombres, categorías o specs del catálogo: un
// sinónimo hacia una palabra que ningún producto trae no encuentra nada.
//
// Cada palabra de la consulta se busca tal cual Y por estas alternativas, y
// un producto que solo coincide por sinónimo puntúa por debajo del que dice
// la palabra escrita.
export const SINONIMOS: Readonly<Record<string, readonly string[]>> = {
  // Subwoofers
  sub: ["subwoofer"],
  woofer: ["subwoofer"],
  bajo: ["subwoofer"],
  grave: ["subwoofer"],
  // Bocinas
  parlante: ["bocina"],
  altavoz: ["bocina"],
  altoparlante: ["bocina"],
  speaker: ["bocina"],
  bafle: ["bocina"],
  midrange: ["medio rango"],
  mid: ["medio rango"],
  agudo: ["tweeter"],
  twiter: ["tweeter"],
  // Amplificadores
  planta: ["amplificador"],
  amp: ["amplificador"],
  mono: ["monoblock"],
  // Receptores
  radio: ["receptor"],
  estereo: ["receptor"],
  stereo: ["receptor"],
  autoestereo: ["receptor"],
  autoradio: ["receptor"],
  reproductor: ["receptor"],
  bluetooth: ["bt"],
  // Ecualizadores
  eq: ["ecualizador"],
  dsp: ["procesador"],
  // Insonorización
  aislante: ["insonorizacion"],
  aislamiento: ["insonorizacion"],
  antivibracion: ["insonorizacion"],
  ruido: ["insonorizacion"],
  silenciador: ["insonorizacion"],
  // Kits y cables
  cableado: ["cable", "kit"],
  // Potencia en puente (la hoja escribe «… @ 4 Ω puente»)
  bridge: ["puente"],
  bridged: ["puente"],
  puenteado: ["puente"],
  puenteada: ["puente"],
  // Bobinas
  dvc: ["doble bobina"],
  svc: ["simple bobina"],
};

// Palabras que no dicen nada del producto: conectores, y los términos que
// describen TODO el catálogo (es equipo de audio para carro: «bocinas para
// carro» solo pide «bocinas»). Se descartan de la consulta, salvo que sean
// lo único que se escribió.
export const PALABRAS_VACIAS: ReadonlySet<string> = new Set([
  "a",
  "que",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "para",
  "con",
  "por",
  "en",
  "y",
  "o",
  "mi",
  "vehiculo",
  "vehiculos",
  // «potencia mayor a 1000»: la palabra describe el filtro, no el producto.
  "potencia",
  // Lo que queda de una comparación («menos de», «hasta») cuando su número
  // no era un filtro.
  "menos",
  "mas",
  "menor",
  "mayor",
  "maximo",
  "minimo",
  "hasta",
  "desde",
  "entre",
  "estable",
  "estables",
]);

/**
 * Las palabras que nombran una CATEGORÍA de uso (la columna `categoria` del
 * libro: carro, marino, motorsports) y no un producto. No se buscan como
 * texto: filtran por el dato `uso`, así que un producto marino cuyo nombre no
 * diga «marino» también aparece. Un producto sin `uso` cuenta como «carro»,
 * que es de donde viene el catálogo.
 */
export const USO_PALABRAS: Readonly<Record<string, "carro" | "marino" | "motorsports">> = {
  carro: "carro",
  carros: "carro",
  auto: "carro",
  autos: "carro",
  automovil: "carro",
  marino: "marino",
  marinos: "marino",
  marina: "marino",
  marinas: "marino",
  marine: "marino",
  nautico: "marino",
  nautica: "marino",
  lancha: "marino",
  lanchas: "marino",
  bote: "marino",
  botes: "marino",
  barco: "marino",
  barcos: "marino",
  yate: "marino",
  yates: "marino",
  embarcacion: "marino",
  embarcaciones: "marino",
  motorsports: "motorsports",
  motorsport: "motorsports",
  powersports: "motorsports",
  powersport: "motorsports",
  utv: "motorsports",
  utvs: "motorsports",
  atv: "motorsports",
  atvs: "motorsports",
  rzr: "motorsports",
  sxs: "motorsports",
  "side-by-side": "motorsports",
  moto: "motorsports",
  motos: "motorsports",
  motocicleta: "motorsports",
  motocicletas: "motorsports",
  cuatrimoto: "motorsports",
  cuatrimotos: "motorsports",
  todoterreno: "motorsports",
};
