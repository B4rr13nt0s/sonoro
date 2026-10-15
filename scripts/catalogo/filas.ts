// Normalización y validación de UNA fila. Una falla acá rechaza la fila —
// queda fuera de catalog.json y documentada en reports/import-errors.md—
// pero no aborta el import: obligatorio vacío, valor fuera de lista,
// booleano ilegible, par etiqueta/valor asimétrico, precio con más de dos
// decimales.

import { z } from "zod";

import {
  AtributosSchema,
  DisponibilidadSchema,
  USOS,
  type Atributos,
  type Disponibilidad,
  type Spec,
  type Uso,
} from "../../lib/catalog/types.ts";
import { precioACents } from "../precio.ts";
import { esVacia, separarCategorias, type Celda, type FilaCruda } from "./contrato.ts";
import { ErrorDeFormato, leerDimensiones, leerPotenciaPorCarga } from "./formatos.ts";
import { MAX_SPECS_LIBRES, type CampoHoja, type DefHoja } from "./hojas.ts";

export type FilaNormalizada = {
  sku: string;
  slug: string;
  nombre: string;
  marca: string;
  descripcionCorta: string;
  precioCents: number;
  precioAntesCents?: number;
  disponibilidad: Disponibilidad;
  garantiaMeses?: number;
  destacado: boolean;
  activo: boolean;
  atributos: Atributos;
  libres: Spec[];
  categoriasSecundarias?: string[];
  uso: Uso[];
  // Avisos de la fila (specs sin valor) que no la rechazan.
  omitidas: string[];
};

export type ResultadoFila = { ok: true; fila: FilaNormalizada } | { ok: false; motivo: string };

// Conversión de celda al tipo que espera el esquema. Lo que no se puede
// convertir se deja pasar TAL CUAL para que Zod lo rechace con su tipo real
// a la vista (p. ej. «expected number, received string»), en vez de
// convertirlo en silencio en otra cosa.
function texto(celda: Celda | undefined): string | undefined {
  if (esVacia(celda)) return undefined;
  return String(celda).trim();
}

// Para lo que el cliente LEE (nombre, marca, descripción, specs libres): además
// del trim, los espacios de adentro se colapsan a uno. Un doble espacio no se
// ve en pantalla, pero viaja tal cual al mensaje de WhatsApp, al registro de
// pedidos, al JSON-LD y al título de la página, y suele ser una palabra
// borrada de la hoja: «Bocinas coaxiales  de 6.5"». NO se usa en sku, slug ni
// disponibilidad: ahí un doble espacio es un error que se rechaza, no algo
// que se arregle en silencio.
function textoLibre(celda: Celda | undefined): string | undefined {
  return texto(celda)?.replace(/\s+/g, " ");
}

function numero(celda: Celda | undefined): number | string | boolean | undefined {
  if (esVacia(celda)) return undefined;
  if (typeof celda === "number" || typeof celda === "boolean") return celda;
  const t = String(celda).trim();
  // Las columnas con validación de lista (impedancia, calibre) llegan como
  // texto: «4». Se acepta número escrito como número, nada más.
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}

function booleano(celda: Celda | undefined): boolean | string | number | undefined {
  if (esVacia(celda)) return undefined;
  if (typeof celda === "boolean") return celda;
  const t = String(celda).trim().toUpperCase();
  if (t === "VERDADERO") return true;
  if (t === "FALSO") return false;
  return typeof celda === "number" ? celda : String(celda).trim();
}

// Cómo se lee cada campo específico. Record sobre CampoHoja: agregar un campo
// al esquema sin decir cómo se lee no compila.
const LECTOR: Record<CampoHoja, (celda: Celda | undefined, def: DefHoja) => unknown> = {
  medida: texto,
  // En Amplificadores es «### W @ # Ω · …», una potencia por impedancia; en
  // el resto, un número.
  potencia_rms_w: (celda, def) => {
    if (def.categoria === "Amplificadores") return leerPotenciaPorCarga(celda);
    const n = numero(celda);
    // El esquema admite texto (potencia descriptiva) solo para Amplificadores.
    return typeof n === "string"
      ? new ErrorDeFormato(`«${n}» no es un número (en W, sin unidad)`)
      : n;
  },
  impedancia_ohm: numero,
  bobinas: texto,
  configuracion: texto,
  canales: numero,
  clase: texto,
  formato: texto,
  pantalla_pulg: numero,
  carplay: booleano,
  android_auto: booleano,
  salidas_preamp_pares: numero,
  salidas_preamp_voltaje: numero,
  espesor_mm: numero,
  cobertura_m2: numero,
  material_insono: texto,
  calibre_awg: numero,
  material_conductor: texto,
  tipo_accesorio: texto,
  tipo_ecualizador: texto,
  bandas: numero,
  profundidad_mm: numero,
  sensibilidad_db: numero,
  capacidad_w: numero,
  longitud_m: numero,
  dimensiones: leerDimensiones,
};

const ComunSchema = z.object({
  sku: z.string(),
  slug: z.string(),
  nombre: z.string(),
  marca: z.string(),
  descripcion_corta: z.string(),
  precio: z.number(),
  precio_antes: z.number().optional(),
  disponibilidad: DisponibilidadSchema,
  garantia_meses: z.number().int().positive().optional(),
  destacado: z.boolean(),
  activo: z.boolean(),
});

const OBLIGATORIOS_COMUNES = [
  "sku",
  "slug",
  "nombre",
  "marca",
  "descripcion_corta",
  "precio",
  "disponibilidad",
  "destacado",
  "activo",
] as const;

function motivosZod(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(fila)"}: ${issue.message}`);
}

export function normalizarFila(fila: FilaCruda, def: DefHoja): ResultadoFila {
  const c = fila.celdas;
  const motivos: string[] = [];

  const comun = {
    sku: texto(c.sku),
    // Mayúsculas en el slug (p. ej. «…srx1244V», copiado del sku) se llevan a
    // minúsculas; todo lo demás inválido sigue rechazando la fila.
    slug: texto(c.slug)?.toLowerCase(),
    nombre: textoLibre(c.nombre),
    marca: textoLibre(c.marca),
    descripcion_corta: textoLibre(c.descripcion_corta),
    precio: numero(c.precio),
    precio_antes: numero(c.precio_antes),
    disponibilidad: texto(c.disponibilidad),
    garantia_meses: numero(c.garantia_meses),
    destacado: booleano(c.destacado),
    activo: booleano(c.activo),
  };
  const atributosCrudos: Record<string, unknown> = {};
  // Con formato ilegible ya tienen su motivo: no se repiten como «vacíos».
  const ilegibles = new Set<CampoHoja>();
  for (const campo of def.campos) {
    const valor = LECTOR[campo](c[campo], def);
    if (valor instanceof ErrorDeFormato) {
      motivos.push(`${campo}: ${valor.message}`);
      ilegibles.add(campo);
    } else if (valor !== undefined) atributosCrudos[campo] = valor;
  }

  // Obligatorios primero, con un mensaje que dice lo que pasó: «obligatorio
  // vacío» se entiende mejor que «expected string, received undefined».
  for (const campo of OBLIGATORIOS_COMUNES) {
    if (comun[campo] === undefined) motivos.push(`${campo}: obligatorio vacío`);
  }
  for (const campo of def.obligatorios) {
    if (atributosCrudos[campo] === undefined && !ilegibles.has(campo))
      motivos.push(`${campo}: obligatorio vacío`);
  }
  // Columna `categoria` del libro: el uso. Valor desconocido o repetido
  // rechaza la fila, igual que una categoría inexistente en ESPECIALES.
  const uso: Uso[] = [];
  for (const valor of separarCategorias(c.categoria)) {
    if (!(USOS as readonly string[]).includes(valor)) {
      motivos.push(`categoria: "${valor}" no es un uso válido (${USOS.join(", ")})`);
    } else if (uso.includes(valor as Uso)) {
      motivos.push(`categoria: "${valor}" repetido`);
    } else uso.push(valor as Uso);
  }
  if (esVacia(c.categoria)) motivos.push("categoria: obligatorio vacío");
  let categoriasSecundarias: string[] | undefined;
  if (def.multicategoria) {
    categoriasSecundarias = separarCategorias(c.categorias);
    if (categoriasSecundarias.length === 0) motivos.push("categorias: obligatorio vacío");
  }

  const libres: Spec[] = [];
  const omitidas: string[] = [];
  for (let n = 1; n <= MAX_SPECS_LIBRES; n++) {
    const etiqueta = textoLibre(c[`spec_${n}_etiqueta`]);
    const valor = textoLibre(c[`spec_${n}_valor`]);
    if (etiqueta === undefined && valor === undefined) continue;
    // Etiqueta sin valor = dato que el fabricante no publica: no hay qué
    // mostrar, la spec se omite y queda en las alertas. Un valor sin
    // etiqueta sí rechaza la fila: no se sabe de qué es.
    if (etiqueta !== undefined && valor === undefined) {
      omitidas.push(`spec_${n} «${etiqueta}» no tiene valor: no se publica`);
      continue;
    }
    if (etiqueta === undefined || valor === undefined) {
      motivos.push(
        `spec_${n} tiene solo etiqueta o solo valor (etiqueta="${etiqueta ?? ""}", valor="${valor ?? ""}")`,
      );
      continue;
    }
    libres.push({ etiqueta, valor });
  }

  if (motivos.length > 0) return { ok: false, motivo: motivos.join("; ") };

  const parseoComun = ComunSchema.safeParse(comun);
  const parseoAtributos = AtributosSchema.safeParse(atributosCrudos);
  if (!parseoComun.success) motivos.push(...motivosZod(parseoComun.error));
  if (!parseoAtributos.success) motivos.push(...motivosZod(parseoAtributos.error));
  if (!parseoComun.success || !parseoAtributos.success) {
    return { ok: false, motivo: motivos.join("; ") };
  }
  const base = parseoComun.data;

  // Centavos por manipulación de cadena (scripts/precio.ts), nunca
  // `n * 100`. Un precio con más de dos decimales o negativo no es un
  // precio: la fila se rechaza.
  let precioCents: number;
  let precioAntesCents: number | undefined;
  try {
    precioCents = precioACents(String(base.precio));
    precioAntesCents =
      base.precio_antes === undefined ? undefined : precioACents(String(base.precio_antes));
  } catch (error) {
    return { ok: false, motivo: (error as Error).message };
  }

  const normalizada: FilaNormalizada = {
    sku: base.sku,
    slug: base.slug,
    nombre: base.nombre,
    marca: base.marca,
    descripcionCorta: base.descripcion_corta,
    precioCents,
    disponibilidad: base.disponibilidad,
    destacado: base.destacado,
    activo: base.activo,
    atributos: parseoAtributos.data,
    libres,
    uso,
    omitidas,
  };
  if (precioAntesCents !== undefined) normalizada.precioAntesCents = precioAntesCents;
  if (base.garantia_meses !== undefined) normalizada.garantiaMeses = base.garantia_meses;
  if (categoriasSecundarias !== undefined)
    normalizada.categoriasSecundarias = categoriasSecundarias;
  return { ok: true, fila: normalizada };
}
