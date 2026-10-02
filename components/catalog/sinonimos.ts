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
  // Marino y motorsports (los nombres dicen «marino», «marine», «powersports»)
  lancha: ["marino", "marina", "marine"],
  bote: ["marino", "marina", "marine"],
  barco: ["marino", "marina", "marine"],
  yate: ["marino", "marina", "marine"],
  nautico: ["marino", "marina", "marine"],
  utv: ["powersports", "side-by-side"],
  atv: ["powersports"],
  moto: ["powersports"],
  motocicleta: ["powersports"],
  // Bobinas
  dvc: ["doble bobina"],
  svc: ["simple bobina"],
};

// Palabras que no dicen nada del producto: conectores, y los términos que
// describen TODO el catálogo (es equipo de audio para carro: «bocinas para
// carro» solo pide «bocinas»). Se descartan de la consulta, salvo que sean
// lo único que se escribió.
export const PALABRAS_VACIAS: ReadonlySet<string> = new Set([
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
  "carro",
  "carros",
  "auto",
  "autos",
  "vehiculo",
  "vehiculos",
]);
