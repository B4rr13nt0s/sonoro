// Un mensaje que MODIFICA la búsqueda guardada en vez de empezar otra: «y de
// 10?», «solo Memphis», «menos de 2000», «más baratos», «los disponibles»,
// «más», «quita los filtros» (spec 2026-11-03 § Seguimientos). Lógica pura.
//
// La regla que evita adivinar: se quitan del texto los cambios reconocidos,
// los conectores («y», «solo», «mejor»…) y las palabras vacías. Es un
// seguimiento solo si NO QUEDA NADA y hubo al menos un cambio. «y bocinas?»
// deja «bocinas»: nombra otra cosa, así que es una búsqueda nueva.
import { describirAcote, type Acote } from "../busqueda/acotar.ts";
import { canonizar, interpretar, normalizar } from "../busqueda/busqueda.ts";
import { PALABRAS_VACIAS } from "../busqueda/sinonimos.ts";
import { formatQ } from "../format/precio.ts";
import type { BusquedaAcotable } from "./tipos.ts";

export type Cambio =
  | { tipo: "acote"; acote: Acote }
  | { tipo: "quitar"; campo?: Acote["campo"] } // sin campo: todos
  | { tipo: "orden"; orden: "precio_asc" | "precio_desc" }
  | { tipo: "mas" };

type Marca = { nombre: string; slug: string };

interface Opciones {
  marcas: readonly Marca[];
  /** A qué campo va un número suelto («y de 10?»): el que traen los resultados. */
  numeroSuelto: "medida" | "canales" | null;
}

const CONECTORES = new Set([
  // «sí, de 10», «ok, solo Memphis»: la confirmación abre el seguimiento.
  "si",
  "ok",
  "okay",
  "dale",
  "claro",
  "va",
  "vale",
  "listo",
  "perfecto",
  // «está bien, y de 10?»
  "esta",
  "bien",
  "y",
  "solo",
  "nada",
  "pero",
  "mejor",
  "ahora",
  "tambien",
  "entonces",
]);
const RELLENO = new Set([
  "muestrame",
  "ensename",
  "dame",
  "ver",
  "quiero",
  "sean",
  "que",
  "hay",
  "tienes",
  "tienen",
  "otro",
  "otra",
  "por",
  "favor",
  "porfa",
  "pulgadas",
  "pulgada",
]);

// Frases enteras, de la más larga a la más corta dentro de cada grupo, en el
// orden en que se prueban: «más baratos» es orden antes de que «más» sea
// página.
const QUITAR: readonly [string, Acote["campo"] | undefined][] = [
  ["quita los filtros", undefined],
  ["quitar los filtros", undefined],
  ["quita filtros", undefined],
  ["sin filtros", undefined],
  ["quita la marca", "marca"],
  ["quita la medida", "medida"],
  ["quita los canales", "canales"],
  ["quita el precio", "precio"],
  ["todos", undefined],
  ["todas", undefined],
];
const ORDEN: readonly [string, "precio_asc" | "precio_desc"][] = [
  ["de menor a mayor", "precio_asc"],
  ["de mayor a menor", "precio_desc"],
  ...["baratos", "baratas", "barato", "barata", "economicos", "economicas", "economico"].map(
    (p): [string, "precio_asc"] => [`mas ${p}`, "precio_asc"],
  ),
  ...["caros", "caras", "caro", "cara"].map((p): [string, "precio_desc"] => [
    `mas ${p}`,
    "precio_desc",
  ]),
];
const DISPONIBLES = [
  "los que haya",
  "que haya",
  "que tengan",
  "en existencia",
  "disponibles",
  "disponible",
];
const MAS = ["muestrame mas", "ver mas", "hay mas", "mas", "otros", "otras", "siguientes"];

/** Un número suelto se lee como medida o canales solo hasta acá. */
const MAX_SUELTO = 20;

function limpio(texto: string): string {
  return (
    normalizar(texto)
      // La coma de miles se queda («menos de 2,000»): `interpretar` la entiende.
      .replace(/(^|\D),/g, "$1 ")
      .replace(/,(\D|$)/g, " $1")
      .replace(/[¿?¡!;:]/g, " ")
      .replace(/\.(?=\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Quita `frase` de `texto` (con espacios alrededor) si está; dice si estaba. */
function quitarFrase(texto: { valor: string }, frase: string): boolean {
  const antes = ` ${texto.valor} `;
  if (!antes.includes(` ${frase} `)) return false;
  texto.valor = antes.replace(` ${frase} `, " ").trim();
  return true;
}

function marcaDe(palabras: readonly string[], i: number, marcas: readonly Marca[]) {
  for (const m of marcas) {
    const nombre = normalizar(m.nombre).split(/\s+/);
    if (nombre.every((p, j) => palabras[i + j] === p)) return { marca: m, largo: nombre.length };
  }
  // «rockford» por «Rockford Fosgate», si ninguna otra marca empieza igual.
  const primera = marcas.filter((m) => normalizar(m.nombre).split(/\s+/)[0] === palabras[i]);
  if (primera.length === 1 && palabras[i].length >= 4) return { marca: primera[0], largo: 1 };
  return null;
}

export function interpretarSeguimiento(texto: string, opciones: Opciones): Cambio[] | null {
  const cambios: Cambio[] = [];
  const i = interpretar(limpio(texto));
  // Otro uso («y marinos?») o un rango que no es de precio no son seguimientos:
  // la búsqueda nueva los entiende mejor.
  if (i.usos.length > 0) return null;
  for (const r of i.restricciones) {
    if (r.campo !== "precio") return null;
    cambios.push({
      tipo: "acote",
      acote: {
        campo: "precio",
        ...(r.min !== undefined ? { min: Math.round(r.min * 100) } : {}),
        ...(r.max !== undefined ? { max: Math.round(r.max * 100) } : {}),
      },
    });
  }

  const resto = { valor: i.resto };
  for (const [frase, campo] of QUITAR) {
    if (quitarFrase(resto, frase)) {
      cambios.push(campo ? { tipo: "quitar", campo } : { tipo: "quitar" });
      break;
    }
  }
  for (const [frase, orden] of ORDEN) {
    if (quitarFrase(resto, frase)) {
      cambios.push({ tipo: "orden", orden });
      break;
    }
  }
  if (DISPONIBLES.some((f) => quitarFrase(resto, f))) {
    cambios.push({ tipo: "acote", acote: { campo: "disponibilidad" } });
  }
  // «más» se quita siempre, pero solo pide la página siguiente si es lo único
  // que se pidió: en «nada más Memphis» o «más de Memphis» acompaña a otro
  // cambio, y pasar de página saltaría los primeros cinco.
  const pideMas = MAS.some((f) => quitarFrase(resto, f));

  const palabras = resto.valor.split(" ").filter(Boolean);
  const quedan: string[] = [];
  for (let k = 0; k < palabras.length; k++) {
    const p = palabras[k];
    const pulgadas = /^(\d+(?:\.\d+)?)"$/.exec(p);
    const canales = /^(\d+)ch$/.exec(p);
    const suelto = /^\d+(?:\.\d+)?$/.test(p) ? Number(p) : null;
    const marca = marcaDe(palabras, k, opciones.marcas);
    if (pulgadas) {
      cambios.push({ tipo: "acote", acote: { campo: "medida", pulgadas: Number(pulgadas[1]) } });
    } else if (canales) {
      cambios.push({ tipo: "acote", acote: { campo: "canales", canales: Number(canales[1]) } });
      if (palabras[k + 1] === "canales") k++;
    } else if (suelto !== null && suelto > 0 && suelto <= MAX_SUELTO && opciones.numeroSuelto) {
      cambios.push({
        tipo: "acote",
        acote:
          opciones.numeroSuelto === "medida"
            ? { campo: "medida", pulgadas: suelto }
            : { campo: "canales", canales: suelto },
      });
    } else if (marca) {
      cambios.push({ tipo: "acote", acote: { campo: "marca", slug: marca.marca.slug } });
      k += marca.largo - 1;
    } else if (!CONECTORES.has(p) && !PALABRAS_VACIAS.has(p) && !RELLENO.has(p)) {
      quedan.push(p);
    }
  }
  if (pideMas && cambios.length === 0) cambios.push({ tipo: "mas" });
  return quedan.length === 0 && cambios.length > 0 ? cambios : null;
}

/** Las medidas escritas de una consulta: `N"` y los números sueltos de 1 a 20. */
function esMedida(palabra: string): boolean {
  if (/^\d+(?:\.\d+)?"$/.test(palabra)) return true;
  const n = /^\d+(?:\.\d+)?$/.test(palabra) ? Number(palabra) : NaN;
  return n > 0 && n <= MAX_SUELTO;
}

/**
 * La consulta sin sus medidas ni canales escritos («sub 12» → «sub»,
 * «amplificador de 4 canales» → «amplificador de»), para pasarlos a acote.
 */
export function sinMedidas(consulta: string): string {
  const palabras = canonizar(normalizar(consulta)).split(/\s+/).filter(Boolean);
  return palabras
    .filter((p, i) => {
      if (esMedida(p) || /^\d+ch$/.test(p)) return false;
      // `canonizar` deja «4ch canales»: la palabra va con el número.
      return !(p === "canales" && /^\d+ch$/.test(palabras[i - 1] ?? ""));
    })
    .join(" ");
}

/** La medida que traía la consulta escrita, si trae una («sub 12» → 12). */
function medidaEscrita(consulta: string): number | null {
  const p = canonizar(normalizar(consulta)).split(/\s+/).find(esMedida);
  return p ? Number(p.replace('"', "")) : null;
}

export function aplicarCambios(
  busqueda: BusquedaAcotable,
  cambios: readonly Cambio[],
): BusquedaAcotable {
  const pagina = busqueda.pagina ?? 0;
  let { base, acotes, orden } = busqueda;
  let paginaNueva = 0;
  for (const c of cambios) {
    if (c.tipo === "mas") paginaNueva = pagina + 1;
    else if (c.tipo === "orden") orden = c.orden;
    else if (c.tipo === "quitar") acotes = c.campo ? acotes.filter((a) => a.campo !== c.campo) : [];
    else {
      acotes = [...acotes.filter((a) => a.campo !== c.acote.campo), c.acote];
      // La medida que venía escrita en la consulta pasa a acote: si se quedara,
      // «y de 10?» sobre «sub 12» buscaría 12 Y 10.
      if ((c.acote.campo === "medida" || c.acote.campo === "canales") && base.tipo === "texto") {
        base = { ...base, consulta: sinMedidas(base.consulta), visible: sinMedidas(base.visible) };
      }
    }
  }
  return { base, acotes, ...(orden ? { orden } : {}), pagina: paginaNueva };
}

function textoPrecio(acote: Extract<Acote, { campo: "precio" }>): string {
  if (acote.min === undefined) return `hasta ${formatQ(acote.max ?? 0)}`;
  if (acote.max === undefined) return `de más de ${formatQ(acote.min)}`;
  return `de ${formatQ(acote.min)} a ${formatQ(acote.max)}`;
}

const NOMBRE_DE_CAMPO: Readonly<Record<Acote["campo"], string>> = {
  categoria: "la categoría",
  medida: "la medida",
  canales: "los canales",
  marca: "la marca",
  precio: "el precio",
  disponibilidad: "la disponibilidad",
};

/** Lo que entendió el chat, dicho: «Cambié 12" por 10".», «Ahora solo Memphis de 10".» */
export function fraseCambios(
  antes: BusquedaAcotable,
  cambios: readonly Cambio[],
  marcas: readonly Marca[],
): string {
  const frases: string[] = [];
  const acotes = cambios.flatMap((c) => (c.tipo === "acote" ? [c.acote] : []));
  const medida = acotes.find((a) => a.campo === "medida");
  const anterior =
    antes.acotes.find((a): a is Extract<Acote, { campo: "medida" }> => a.campo === "medida")
      ?.pulgadas ?? (antes.base.tipo === "texto" ? medidaEscrita(antes.base.consulta) : null);

  const partes: string[] = [];
  for (const a of acotes) {
    if (a.campo === "marca") partes.push(`solo ${describirAcote(a, marcas)}`);
    else if (a.campo === "medida") partes.push(`de ${a.pulgadas}"`);
    else if (a.campo === "canales") partes.push(`de ${describirAcote(a, marcas)}`);
    else if (a.campo === "precio") partes.push(textoPrecio(a));
    else if (a.campo === "categoria") partes.push(`solo ${describirAcote(a, marcas)}`);
  }
  if (medida && acotes.length === 1 && anterior !== null && anterior !== medida.pulgadas) {
    frases.push(`Cambié ${anterior}" por ${medida.pulgadas}".`);
  } else if (partes.length > 0) {
    frases.push(`Ahora ${partes.join(" ")}.`);
  }
  if (acotes.some((a) => a.campo === "disponibilidad")) frases.push("Solo los disponibles.");
  for (const c of cambios) {
    if (c.tipo === "orden") {
      frases.push(
        c.orden === "precio_asc"
          ? "Ordené de menor a mayor precio."
          : "Ordené de mayor a menor precio.",
      );
    }
    if (c.tipo === "quitar") {
      frases.push(c.campo ? `Quité ${NOMBRE_DE_CAMPO[c.campo]}.` : "Quité los filtros.");
    }
  }
  return frases.join(" ");
}
