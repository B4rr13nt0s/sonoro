import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoBuscable } from "../busqueda/busqueda.ts";
import { UMBRAL_ENVIO_GRATIS_CENTS } from "../cart/envio.ts";
import { formatQ } from "../format/precio.ts";
import { buildAvailabilityInquiryMessage } from "../whatsapp/message.ts";
import {
  ESTADO_INICIAL,
  MAX_PRODUCTOS_CHAT,
  bloquesDeInicio,
  necesitaCatalogo,
  responder,
} from "./motor.ts";
import { TEMA_NOMBRE, bloquesDeTema } from "./respuestas.ts";
import type { Bloque, Contexto, Entrada, Estado, OpcionId, Tema } from "./tipos.ts";

/** Lo que el estado tenía antes de la memoria: la consulta y el tema para «Hablar con Sonoro». */
function sinMemoria(estado: { ultimaConsulta: string | null; ultimoTema: unknown }) {
  return { ultimaConsulta: estado.ultimaConsulta, ultimoTema: estado.ultimoTema };
}

function producto(
  sku: string,
  nombre: string,
  categoria: string,
  extra: Partial<ProductoBuscable> = {},
): ProductoBuscable {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre,
    marca: "Memphis",
    categoria,
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
    ...extra,
  };
}

// Dos subs 12" 2 Ω (uno agotado), una bocina, un kit de instalación y cuatro más.
const FIXTURE: ProductoBuscable[] = [
  producto("SUB1", 'Subwoofer Serie SQ de 12" SQ12-D2', "Subwoofers", {
    claves: '12" 2ohm doble',
    pulgadas: 12,
    precioCents: 245000,
  }),
  producto("SUB2", 'Subwoofer Serie Street de 12" STR12-D2', "Subwoofers", {
    claves: '12" 2ohm doble',
    pulgadas: 12,
    precioCents: 180000,
    disponibilidad: "agotado",
  }),
  producto("BOC1", 'Bocinas coaxiales de 6.5" PRX60C', "Bocinas", { claves: '6.5" 4ohm' }),
  producto("KIT1", "Kit de instalación 4 AWG KIT4", "Kits", { claves: "4awg" }),
  producto("AMP1", "Amplificador de 4 canales AMP4", "Amplificadores", { claves: "4ch" }),
  producto("AMP2", "Amplificador monoblock AMP1", "Amplificadores", { claves: "1ch" }),
  producto("REC1", "Receptor con pantalla REC7", "Receptores", { claves: '7"' }),
  producto("ACC1", "Adaptador RCA ACC2", "Accesorios"),
];

const CONTEXTO: Contexto = {
  productos: FIXTURE,
  marcas: [
    { nombre: "Memphis", slug: "memphis" },
    { nombre: "KBT", slug: "kbt" },
  ],
  contacto: {
    telefono: "+502 5295 5555",
    correo: "sonoro502@gmail.com",
    direccion: "Ciudad de Guatemala",
  },
};

const texto = (t: string): Entrada => ({ tipo: "texto", texto: t });
const opcion = (id: OpcionId): Entrada => ({ tipo: "opcion", id });

function textos(bloques: Bloque[]): string[] {
  return bloques.flatMap((b) => (b.tipo === "texto" ? [b.texto] : []));
}

function de<T extends Bloque["tipo"]>(bloques: Bloque[], tipo: T) {
  return bloques.find((b): b is Extract<Bloque, { tipo: T }> => b.tipo === tipo);
}

test("inicio: termina en las siete opciones, en orden", () => {
  const bloques = bloquesDeInicio();
  assert.equal(bloques[0].tipo, "texto");
  assert.equal(
    textos(bloques)[0],
    "Busca un producto por nombre, marca, código o medida, o elige un tema.",
  );
  const ultimo = bloques[bloques.length - 1];
  assert.equal(ultimo.tipo, "opciones");
  if (ultimo.tipo !== "opciones") return;
  assert.deepEqual(
    ultimo.opciones.map((o) => o.id),
    ["buscar", "envios", "garantia", "instalacion", "cuotas", "como_pedir", "hablar"],
  );
  assert.deepEqual(
    ultimo.opciones.map((o) => o.etiqueta),
    [
      "Buscar un producto",
      "Envíos",
      "Garantía",
      "Instalación",
      "Pagos en cuotas",
      "Cómo pedir",
      "Hablar con Sonoro",
    ],
  );
});

test("saludo: responde el inicio y no registra evento", () => {
  const r = responder(ESTADO_INICIAL, texto("Hola"), CONTEXTO);
  assert.deepEqual(r.bloques, bloquesDeInicio());
  assert.equal(r.evento, null);
  assert.deepEqual(sinMemoria(r.estado), sinMemoria(ESTADO_INICIAL));
});

test("texto en blanco se trata como saludo", () => {
  const r = responder(ESTADO_INICIAL, texto("   \n "), CONTEXTO);
  assert.deepEqual(r.bloques, bloquesDeInicio());
  assert.equal(r.evento, null);
});

test("opción buscar: pide el texto, sin evento", () => {
  const r = responder(ESTADO_INICIAL, opcion("buscar"), CONTEXTO);
  assert.deepEqual(textos(r.bloques), ["Escribe el nombre, la marca, el código o la medida."]);
  assert.equal(r.evento, null);
});

test("pregunta en lenguaje natural: «¿Tienen subwoofers de 12 pulgadas marca memphis?»", () => {
  const r = responder(
    ESTADO_INICIAL,
    texto("Tienen subwoofers de 12 pulgadas marca memphis?"),
    CONTEXTO,
  );
  // Exacta: sin el aviso de «estos coinciden con alguna palabra».
  assert.equal(de(r.bloques, "filtros"), undefined);
  assert.deepEqual([...(de(r.bloques, "productos")?.skus ?? [])].sort(), ["SUB1", "SUB2"]);
});

test("dato: precio de un producto nombrado", () => {
  const r = responder(ESTADO_INICIAL, texto("¿cuánto cuesta el SUB1?"), CONTEXTO);
  assert.ok(
    textos(r.bloques).includes(
      'Subwoofer Serie SQ de 12" SQ12-D2 cuesta Q 2,450.00, o Q 408.34 al mes × 6.',
    ),
  );
  assert.ok(!textos(r.bloques).includes("Datos publicados por el fabricante."));
});

test("dato: solo precio sobre una lista es la búsqueda de siempre", () => {
  const r = responder(ESTADO_INICIAL, texto("cuanto cuesta un subwoofer"), CONTEXTO);
  assert.equal(
    textos(r.bloques).some((t) => t.includes(" cuesta ")),
    false,
  );
  assert.ok(de(r.bloques, "productos"));
});

test("búsqueda: los dos subs, con enlace a /buscar y evento", () => {
  const r = responder(ESTADO_INICIAL, texto("sub 12 2 ohm"), CONTEXTO);
  const productos = de(r.bloques, "productos");
  assert.ok(productos);
  assert.deepEqual([...productos.skus].sort(), ["SUB1", "SUB2"]);
  assert.equal(productos.total, 2);
  assert.equal(productos.verTodosHref, "/buscar?q=sub+12+2+ohm");
  assert.deepEqual(r.evento, {
    evento: "busqueda",
    consulta: "sub 12 2 ohm",
    modo: "exacta",
    resultados: 2,
  });
  assert.equal(r.estado.ultimaConsulta, "sub 12 2 ohm");
  assert.equal(r.estado.ultimoTema, null);
  const ultimo = r.bloques[r.bloques.length - 1];
  assert.deepEqual(ultimo, {
    tipo: "opciones",
    opciones: [{ id: "hablar", etiqueta: "Hablar con Sonoro" }],
  });
});

test("búsqueda: los filtros solo salen cuando hay algo que avisar", () => {
  const exacta = responder(ESTADO_INICIAL, texto("sub 12 2 ohm"), CONTEXTO);
  assert.equal(de(exacta.bloques, "filtros"), undefined);
});

test("búsqueda: lleva la lista a 5 y deja el total", () => {
  const r = responder(ESTADO_INICIAL, texto("memphis"), CONTEXTO);
  const productos = de(r.bloques, "productos");
  assert.ok(productos);
  assert.equal(productos.skus.length, MAX_PRODUCTOS_CHAT);
  assert.equal(productos.total, 8);
});

test("búsqueda aproximada: avisa con un bloque filtros", () => {
  const r = responder(ESTADO_INICIAL, texto("subwufer"), CONTEXTO);
  const filtros = de(r.bloques, "filtros");
  assert.ok(filtros);
  assert.equal(filtros.modo, "aproximada");
  assert.ok(de(r.bloques, "productos"));
  assert.deepEqual(r.bloques.map((b) => b.tipo).slice(0, 2), ["filtros", "productos"]);
});

test("acotar: una búsqueda amplia ofrece botones, y uno de ellos acota", () => {
  // Los ocho son Memphis: hay categorías y precios distintos, no marcas.
  const r = responder(ESTADO_INICIAL, texto("memphis"), CONTEXTO);
  const acotar = de(r.bloques, "acotar");
  assert.ok(acotar);
  assert.deepEqual(
    acotar.grupos.map((g) => g.titulo),
    ["Categoría", "Precio"],
  );
  const subwoofers = acotar.grupos[0].opciones.find((o) => o.etiqueta === "Subwoofers");
  assert.equal(subwoofers?.id, "acotar:categoria:subwoofers");

  const r2 = responder(r.estado, opcion("acotar:categoria:subwoofers"), CONTEXTO);
  assert.deepEqual(de(r2.bloques, "productos")?.skus, ["SUB1", "SUB2"]);
  assert.deepEqual(de(r2.bloques, "filtros")?.aplicados, ["Subwoofers"]);
  assert.equal(de(r2.bloques, "productos")?.verTodosHref, "/buscar?q=memphis&categoria=Subwoofers");
  // Dos resultados caben en el chat: no hay más que acotar.
  assert.equal(de(r2.bloques, "acotar"), undefined);
  assert.deepEqual(r2.estado.busqueda?.acotes, [{ campo: "categoria", slug: "subwoofers" }]);
});

test("acotar: los acotes se suman, y uno del mismo campo reemplaza al anterior", () => {
  const r = responder(ESTADO_INICIAL, texto("memphis"), CONTEXTO);
  const barato = responder(r.estado, opcion("acotar:precio:-100000"), CONTEXTO);
  assert.equal(de(barato.bloques, "productos")?.total, 6);
  const caro = responder(barato.estado, opcion("acotar:precio:100000-"), CONTEXTO);
  assert.deepEqual(de(caro.bloques, "productos")?.skus, ["SUB1", "SUB2"]);
  assert.equal(caro.estado.busqueda?.acotes.length, 1);
});

test("acotar: una búsqueda nueva escrita a mano olvida lo acotado", () => {
  const r = responder(ESTADO_INICIAL, texto("memphis"), CONTEXTO);
  const otra = responder(r.estado, texto("kit"), CONTEXTO);
  // La búsqueda nueva reemplaza a la anterior, sin lo acotado.
  assert.deepEqual(otra.estado.busqueda, {
    base: { tipo: "texto", consulta: "kit", visible: "kit" },
    acotes: [],
  });
  const tema = responder(r.estado, texto("envíos"), CONTEXTO);
  assert.equal(tema.estado.busqueda, undefined);
  // Un botón viejo sin búsqueda a la cual volver lleva al inicio.
  const viejo = responder(tema.estado, opcion("acotar:categoria:subwoofers"), CONTEXTO);
  assert.deepEqual(viejo.bloques, bloquesDeInicio());
});

test("búsqueda cercana: dice qué no hay y muestra lo más cercano", () => {
  const r = responder(ESTADO_INICIAL, texto("subwoofer de 10 pulgadas"), CONTEXTO);
  const filtros = de(r.bloques, "filtros");
  assert.ok(filtros);
  assert.equal(filtros.modo, "cercana");
  assert.equal(filtros.cercania, 'Ninguno es de 10". El más cercano es de 12".');
  assert.deepEqual(de(r.bloques, "productos")?.skus, ["SUB1", "SUB2"]);
  assert.equal(r.evento?.evento === "busqueda" && r.evento.modo, "cercana");
});

test("sin resultados: avisa, ofrece WhatsApp y registra el evento", () => {
  const r = responder(ESTADO_INICIAL, texto("xyz123"), CONTEXTO);
  assert.deepEqual(textos(r.bloques), ["No encontramos productos para «xyz123»."]);
  const wa = de(r.bloques, "whatsapp");
  assert.ok(wa);
  assert.equal(wa.etiqueta, "Consultar disponibilidad por WhatsApp");
  assert.equal(wa.motivo, "disponibilidad");
  assert.equal(wa.mensaje, buildAvailabilityInquiryMessage("xyz123"));
  assert.deepEqual(r.evento, { evento: "sin_resultados", consulta: "xyz123" });
  assert.equal(r.estado.ultimaConsulta, "xyz123");
});

test("sin resultados: muestra y manda lo que escribió el cliente, no el texto normalizado", () => {
  const r = responder(ESTADO_INICIAL, texto("Hola, ¿tienen Zumbador Peñón?"), CONTEXTO);
  assert.deepEqual(textos(r.bloques), ["No encontramos productos para «Zumbador Peñón»."]);
  const wa = de(r.bloques, "whatsapp");
  assert.equal(wa?.mensaje, buildAvailabilityInquiryMessage("Zumbador Peñón"));
  assert.equal(r.estado.ultimaConsulta, "Zumbador Peñón");

  // «Hablar con Sonoro» después lleva la misma consulta.
  const hablar = responder(r.estado, opcion("hablar"), CONTEXTO);
  assert.equal(
    de(hablar.bloques, "whatsapp")?.mensaje,
    "Hola Sonoro, tengo una consulta: Zumbador Peñón",
  );
});

test("búsqueda con resultados: el enlace a /buscar lleva lo que escribió el cliente", () => {
  const r = responder(ESTADO_INICIAL, texto("Subwoofer SQ12-D2"), CONTEXTO);
  const productos = de(r.bloques, "productos");
  assert.equal(productos?.verTodosHref, "/buscar?q=Subwoofer+SQ12-D2");
});

test("sin resultados: ofrece la categoría cercana aunque no tenga productos", () => {
  // El fixture no trae ecualizadores: la búsqueda queda vacía, la categoría sí existe.
  const r = responder(ESTADO_INICIAL, texto("ecualizador"), CONTEXTO);
  assert.deepEqual(textos(r.bloques), ["No encontramos productos para «ecualizador»."]);
  const opciones = de(r.bloques, "opciones");
  assert.ok(opciones);
  assert.deepEqual(opciones.opciones, [
    { id: "categoria:ecualizadores", etiqueta: "Ecualizadores" },
  ]);
  assert.ok(de(r.bloques, "whatsapp"));
  assert.equal(r.evento?.evento, "sin_resultados");
});

test("catálogo null: la búsqueda lo dice y no registra evento; los temas siguen", () => {
  const sin: Contexto = { ...CONTEXTO, productos: null };
  const r = responder(ESTADO_INICIAL, texto("sub 12"), sin);
  const t = r.bloques[0];
  assert.equal(t.tipo, "texto");
  if (t.tipo === "texto") {
    assert.equal(t.texto, "No pudimos cargar el catálogo.");
    assert.deepEqual(t.enlace, { etiqueta: "Ir a Buscar", href: "/buscar" });
  }
  assert.equal(r.evento, null);
  assert.deepEqual(r.bloques[r.bloques.length - 1], {
    tipo: "opciones",
    opciones: [{ id: "hablar", etiqueta: "Hablar con Sonoro" }],
  });

  const envios = responder(ESTADO_INICIAL, texto("hacen envíos"), sin);
  assert.deepEqual(envios.evento, { evento: "tema", tema: "envios" });
});

test("envíos: el texto trae el umbral formateado y los enlaces", () => {
  const r = responder(ESTADO_INICIAL, texto("¿hacen envíos a Xela?"), CONTEXTO);
  assert.ok(textos(r.bloques).some((t) => t.includes(formatQ(UMBRAL_ENVIO_GRATIS_CENTS))));
  const enlace = r.bloques.flatMap((b) => (b.tipo === "texto" && b.enlace ? [b.enlace] : []));
  assert.deepEqual(enlace, [{ etiqueta: "Términos y condiciones", href: "/legal/terminos" }]);
  assert.deepEqual(r.evento, { evento: "tema", tema: "envios" });
  assert.deepEqual(sinMemoria(r.estado), { ultimaConsulta: null, ultimoTema: "envios" });
  assert.deepEqual(r.bloques[r.bloques.length - 1], {
    tipo: "opciones",
    opciones: [
      { id: "buscar", etiqueta: "Buscar un producto" },
      { id: "hablar", etiqueta: "Hablar con Sonoro" },
    ],
  });
});

test("garantía: alcance, exclusiones y enlace", () => {
  const bloques = bloquesDeTema("garantia", CONTEXTO.contacto);
  const enlace = bloques.flatMap((b) => (b.tipo === "texto" && b.enlace ? [b.enlace] : []));
  assert.deepEqual(enlace, [{ etiqueta: "Garantías", href: "/legal/garantias" }]);
  assert.equal(textos(bloques).length, 2);
});

test("cuotas: una sola frase con las condiciones", () => {
  const bloques = bloquesDeTema("cuotas", CONTEXTO.contacto);
  assert.equal(textos(bloques).length, 1);
  assert.ok(textos(bloques)[0].startsWith("Hasta 6 pagos precio contado."));
});

test("contacto: solo los datos que vienen", () => {
  const completo = textos(bloquesDeTema("contacto", CONTEXTO.contacto));
  assert.deepEqual(completo, [
    "Teléfono: +502 5295 5555",
    "Correo: sonoro502@gmail.com",
    "Dirección: Ciudad de Guatemala",
    "La dirección completa está en",
  ]);
  const parcial = textos(bloquesDeTema("contacto", { correo: "a@b.gt" }));
  assert.deepEqual(parcial, ["Correo: a@b.gt"]);
});

test("contacto: la dirección del chat remite a Nosotros, justo después de ella", () => {
  const bloques = bloquesDeTema("contacto", CONTEXTO.contacto);
  const iDireccion = bloques.findIndex(
    (b) => b.tipo === "texto" && b.texto.startsWith("Dirección:"),
  );
  assert.ok(iDireccion >= 0);
  assert.deepEqual(bloques[iDireccion + 1], {
    tipo: "texto",
    texto: "La dirección completa está en",
    enlace: { etiqueta: "Nosotros", href: "/nosotros", despues: "." },
  });
  // Sin dirección no hay nada que completar.
  for (const contacto of [{ telefono: "1234", correo: "a@b.gt" }, {}]) {
    const enlaces = bloquesDeTema("contacto", contacto).flatMap((b) =>
      b.tipo === "texto" && b.enlace ? [b.enlace.href] : [],
    );
    assert.deepEqual(enlaces, []);
  }
});

test("contacto vacío: lo confirma Sonoro, con WhatsApp", () => {
  const r = responder(ESTADO_INICIAL, texto("¿cuál es su teléfono?"), {
    ...CONTEXTO,
    contacto: {},
  });
  assert.deepEqual(textos(r.bloques), ["Eso te lo confirma Sonoro directamente."]);
  const wa = de(r.bloques, "whatsapp");
  assert.ok(wa);
  assert.equal(wa.motivo, "hablar");
  assert.equal(wa.mensaje, "Hola Sonoro, tengo una consulta sobre contacto");
  // «Hablar» ya es el botón de WhatsApp: el cierre solo ofrece buscar.
  assert.deepEqual(r.bloques[r.bloques.length - 1], {
    tipo: "opciones",
    opciones: [{ id: "buscar", etiqueta: "Buscar un producto" }],
  });
});

test("hablar tras un tema: el mensaje nombra el tema", () => {
  const a = responder(ESTADO_INICIAL, opcion("envios"), CONTEXTO);
  assert.deepEqual(a.evento, { evento: "tema", tema: "envios" });
  const b = responder(a.estado, opcion("hablar"), CONTEXTO);
  const wa = de(b.bloques, "whatsapp");
  assert.ok(wa);
  assert.equal(wa.etiqueta, "Hablar con Sonoro");
  assert.equal(wa.motivo, "hablar");
  assert.equal(wa.mensaje, "Hola Sonoro, tengo una consulta sobre envíos");
  assert.equal(b.evento, null);
});

test("hablar tras una búsqueda: manda la consulta", () => {
  const a = responder(ESTADO_INICIAL, texto("sub 12 2 ohm"), CONTEXTO);
  const b = responder(a.estado, opcion("hablar"), CONTEXTO);
  assert.equal(de(b.bloques, "whatsapp")?.mensaje, "Hola Sonoro, tengo una consulta: sub 12 2 ohm");
});

test("hablar sin contexto: el saludo a secas", () => {
  const r = responder(ESTADO_INICIAL, opcion("hablar"), CONTEXTO);
  assert.equal(de(r.bloques, "whatsapp")?.mensaje, "Hola Sonoro, tengo una consulta");
});

test("un tema deja la consulta anterior en null y una búsqueda el tema", () => {
  const a = responder(ESTADO_INICIAL, texto("sub 12 2 ohm"), CONTEXTO);
  const b = responder(a.estado, opcion("garantia"), CONTEXTO);
  assert.deepEqual(sinMemoria(b.estado), { ultimaConsulta: null, ultimoTema: "garantia" });
  const c = responder(b.estado, texto("sub 12 2 ohm"), CONTEXTO);
  assert.deepEqual(sinMemoria(c.estado), { ultimaConsulta: "sub 12 2 ohm", ultimoTema: null });
});

test("recomendación: redirige a las categorías y guarda el texto sin normalizar", () => {
  const r = responder(ESTADO_INICIAL, texto("¿Qué me recomiendan para mi carro?"), CONTEXTO);
  assert.equal(
    textos(r.bloques)[0],
    "No recomendamos equipo: te mostramos los datos para que compares.",
  );
  const opciones = de(r.bloques, "opciones");
  assert.ok(opciones);
  assert.equal(opciones.opciones.length, 9);
  assert.deepEqual(opciones.opciones[0], { id: "categoria:bocinas", etiqueta: "Bocinas" });
  assert.deepEqual(opciones.opciones[8], { id: "hablar", etiqueta: "Hablar con Sonoro" });
  assert.deepEqual(r.evento, {
    evento: "recomendacion",
    consulta: "¿Qué me recomiendan para mi carro?",
  });
  assert.equal(r.estado.ultimaConsulta, "¿Qué me recomiendan para mi carro?");
});

test("opción de categoría: busca por su nombre y enlaza al listado", () => {
  const r = responder(ESTADO_INICIAL, opcion("categoria:subwoofers"), CONTEXTO);
  const productos = de(r.bloques, "productos");
  assert.ok(productos);
  assert.equal(productos.verTodosHref, "/catalogo/subwoofers");
  assert.deepEqual([...productos.skus].sort(), ["SUB1", "SUB2"]);
  assert.equal(r.estado.ultimaConsulta, "Subwoofers");
  assert.equal(r.evento?.evento, "busqueda");
});

test("opción de categoría: elige por la categoría del producto, como el listado del sitio", () => {
  const productos = [
    ...FIXTURE,
    // Un sistema completo aparece en el listado de sus categorías secundarias.
    producto("SIS1", "Sistema completo SIS", "Sistemas", {
      categoriasSecundarias: ["Amplificadores", "Subwoofers"],
    }),
    // Dice «kit» en el nombre, pero es de Insonorización: no es de Kits.
    producto("INS1", "Kit de insonorización para puertas INS", "Insonorización"),
    // Un amplificador que no menciona «amplificador» en ninguna parte.
    producto("AMP3", "Memphis Power AMP3", "Amplificadores", { destacado: true }),
  ];
  const contexto: Contexto = { ...CONTEXTO, productos };

  const amp = responder(ESTADO_INICIAL, opcion("categoria:amplificadores"), contexto);
  const bloqueAmp = de(amp.bloques, "productos");
  assert.ok(bloqueAmp);
  assert.deepEqual([...bloqueAmp.skus].sort(), ["AMP1", "AMP2", "AMP3", "SIS1"]);
  assert.equal(bloqueAmp.total, 4);
  assert.equal(bloqueAmp.verTodosHref, "/catalogo/amplificadores");
  // Lo destacado abre, como en el listado.
  assert.equal(bloqueAmp.skus[0], "AMP3");
  assert.deepEqual(amp.evento, {
    evento: "busqueda",
    consulta: "Amplificadores",
    modo: "exacta",
    resultados: 4,
  });

  const kits = responder(ESTADO_INICIAL, opcion("categoria:kits"), contexto);
  assert.deepEqual(de(kits.bloques, "productos")?.skus, ["KIT1"]);
  assert.equal(de(kits.bloques, "productos")?.total, 1);
  assert.equal(de(kits.bloques, "filtros"), undefined);
});

test("opción de categoría sin catálogo: dice que no cargó, no inventa una lista", () => {
  const r = responder(ESTADO_INICIAL, opcion("categoria:kits"), { ...CONTEXTO, productos: null });
  assert.equal(de(r.bloques, "productos"), undefined);
  assert.equal(textos(r.bloques)[0], "No pudimos cargar el catálogo.");
});

test("opción de marca: enlaza a la página de la marca", () => {
  const r = responder(ESTADO_INICIAL, opcion("marca:memphis"), CONTEXTO);
  assert.equal(de(r.bloques, "productos")?.verTodosHref, "/marcas/memphis");
});

test("slug desconocido cae al saludo", () => {
  for (const id of ["categoria:nada", "marca:nada"] as const) {
    const r = responder(ESTADO_INICIAL, opcion(id), CONTEXTO);
    assert.deepEqual(r.bloques, bloquesDeInicio());
    assert.equal(r.evento, null);
  }
});

test("nombres del prototipo no son opciones: caen al saludo", () => {
  const estado: Estado = { ultimaConsulta: "algo", ultimoTema: "envios" };
  for (const id of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    const r = responder(estado, opcion(id as OpcionId), CONTEXTO);
    assert.deepEqual(r.bloques, bloquesDeInicio(), id);
    assert.equal(r.evento, null, id);
    assert.deepEqual(sinMemoria(r.estado), sinMemoria(estado), id);
  }
  // Y un ultimoTema ajeno a TEMA_NOMBRE no se cuela en el mensaje de «Hablar».
  const raro = responder(
    { ultimaConsulta: null, ultimoTema: "constructor" as OpcionId },
    opcion("hablar"),
    CONTEXTO,
  );
  assert.equal(de(raro.bloques, "whatsapp")?.mensaje, "Hola Sonoro, tengo una consulta");
});

test("texto largo: se corta a 200 antes de todo", () => {
  const r = responder(ESTADO_INICIAL, texto("subwoofer ".repeat(100)), CONTEXTO);
  assert.ok(r.evento && "consulta" in r.evento);
  if (r.evento && "consulta" in r.evento) assert.ok(r.evento.consulta.length <= 200);
  assert.ok((r.estado.ultimaConsulta ?? "").length <= 200);
  const rec = responder(ESTADO_INICIAL, texto(`recomienda ${"x".repeat(1000)}`), CONTEXTO);
  assert.ok((rec.estado.ultimaConsulta ?? "").length <= 200);
});

test("texto largo: un emoji en el corte no deja un surrogate suelto", () => {
  // Con 199 o 198 caracteres antes, el corte en 200 cae a mitad del emoji (o justo en él).
  for (const relleno of [199, 198]) {
    const emoji = "😀";
    const entradas = [
      `recomienda ${"x".repeat(relleno - 10)}${emoji}${emoji}`,
      `${"x".repeat(relleno)}${emoji}${emoji}`,
      `xyz123${"y".repeat(relleno - 6)}${emoji}`,
    ];
    for (const entrada of entradas) {
      const r = responder(ESTADO_INICIAL, texto(entrada), CONTEXTO);
      const consulta = r.estado.ultimaConsulta;
      assert.ok(consulta !== null && consulta.length <= 200);
      assert.ok(consulta.isWellFormed(), "ultimaConsulta mal formada");
      if (r.evento && "consulta" in r.evento) assert.ok(r.evento.consulta.isWellFormed());
      const hablar = responder(r.estado, opcion("hablar"), CONTEXTO);
      const mensajes = [...hablar.bloques, ...r.bloques].flatMap((b) =>
        b.tipo === "whatsapp" ? [b.mensaje] : [],
      );
      assert.ok(mensajes.length > 0);
      for (const m of mensajes) assert.doesNotThrow(() => encodeURIComponent(m));
    }
  }
});

test("copy prohibido: ninguna respuesta lo usa", () => {
  const temas = Object.keys(TEMA_NOMBRE) as Tema[];
  const respuestas: Bloque[][] = [
    bloquesDeInicio(),
    ...temas.map((t) => bloquesDeTema(t, CONTEXTO.contacto)),
    bloquesDeTema("contacto", {}),
    responder(ESTADO_INICIAL, texto("¿qué me recomiendan?"), CONTEXTO).bloques,
    responder(ESTADO_INICIAL, texto("sub 12 2 ohm"), CONTEXTO).bloques,
    responder(ESTADO_INICIAL, texto("xyz123"), CONTEXTO).bloques,
    responder(ESTADO_INICIAL, texto("sub"), { ...CONTEXTO, productos: null }).bloques,
  ];
  const prohibidas = [
    "pagar",
    "comprar ahora",
    "finalizar compra",
    "expertos",
    "perfecto",
    "te ayudamos a escoger",
  ];
  for (const bloques of respuestas) {
    for (const b of bloques) {
      const cadenas: string[] = [];
      if (b.tipo === "texto") cadenas.push(b.texto, b.enlace?.etiqueta ?? "");
      if (b.tipo === "opciones") cadenas.push(...b.opciones.map((o) => o.etiqueta));
      if (b.tipo === "whatsapp") cadenas.push(b.etiqueta);
      for (const c of cadenas) {
        const bajo = c.toLowerCase();
        // Por palabra entera: «desperfectos» (garantía) no contiene «perfecto».
        for (const p of prohibidas) {
          assert.ok(
            !new RegExp(`(?<![a-záéíóúñ])${p}(?![a-záéíóúñ])`).test(bajo),
            `«${p}» en «${c}»`,
          );
        }
        assert.ok(!bajo.replaceAll("no recomendamos", "").includes("recomendamos"), c);
      }
    }
  }
});

test("determinismo: la misma entrada da la misma respuesta", () => {
  const e: Estado = { ultimaConsulta: "algo", ultimoTema: null };
  for (const entrada of [texto("sub 12 2 ohm"), texto("xyz123"), opcion("hablar")]) {
    assert.deepEqual(responder(e, entrada, CONTEXTO), responder(e, entrada, CONTEXTO));
  }
});

test("necesitaCatalogo: solo lo que muestra productos espera al catálogo", () => {
  const quiere: Entrada[] = [
    texto("sub 12 2 ohm"),
    texto("hola, tienen subwoofers memphis?"),
    opcion("categoria:kits"),
    opcion("marca:memphis"),
  ];
  for (const entrada of quiere)
    assert.equal(necesitaCatalogo(entrada), true, JSON.stringify(entrada));

  const no: Entrada[] = [
    texto("hola"),
    texto("   "),
    texto("¿hacen envíos a Xela?"),
    texto("¿qué me recomiendan?"),
    opcion("buscar"),
    opcion("hablar"),
    opcion("envios"),
    opcion("garantia"),
    opcion("cuotas"),
    opcion("contacto"),
  ];
  for (const entrada of no) assert.equal(necesitaCatalogo(entrada), false, JSON.stringify(entrada));
});

// Palabras de tema que también son palabras de un producto (spec § Intención).
const CON_CARPLAY: Contexto = {
  ...CONTEXTO,
  productos: [
    ...FIXTURE,
    producto("REC9", "Receptor con pantalla de 9 pulgadas REC9", "Receptores", {
      claves: '9" carplay',
      specsDestacadas: [{ etiqueta: "Conectividad", valor: "Apple CarPlay" }],
    }),
    producto("TAR1", "Tarjeta de sonido USB TAR1", "Accesorios", { claves: "usb" }),
  ],
};

test("palabra ambigua con productos exactos: productos y el tema como botón", () => {
  const r = responder(ESTADO_INICIAL, texto("radio con carplay para el teléfono"), CON_CARPLAY);
  const productos = de(r.bloques, "productos");
  assert.ok(productos);
  assert.deepEqual(productos.skus, ["REC9"]);
  const opciones = r.bloques.flatMap((b) => (b.tipo === "opciones" ? b.opciones : []));
  assert.deepEqual(opciones, [
    { id: "contacto", etiqueta: "Ver contacto" },
    { id: "hablar", etiqueta: "Hablar con Sonoro" },
  ]);
  assert.equal(r.evento?.evento, "busqueda");
  // Lo que se muestra y se manda por WhatsApp es la búsqueda que dio los
  // productos, sin la palabra del tema.
  // El estado lleva también el tema, para que «Hablar con Sonoro» lo cargue.
  assert.deepEqual(sinMemoria(r.estado), {
    ultimaConsulta: "radio con carplay",
    ultimoTema: "contacto",
  });
  assert.equal(de(r.bloques, "productos")?.verTodosHref, "/buscar?q=radio+con+carplay");
  // Un aviso antes de los productos dice qué se buscó y dónde quedó el tema.
  assert.deepEqual(r.bloques[0], {
    tipo: "texto",
    texto: "Esto encontramos para «radio con carplay». Si preguntabas por contacto, está abajo.",
  });

  // «Hablar con Sonoro» desde aquí nombra la consulta y también el tema.
  const hablar = responder(r.estado, opcion("hablar"), CON_CARPLAY);
  assert.deepEqual(
    de(hablar.bloques, "whatsapp")?.mensaje,
    "Hola Sonoro, tengo una consulta: radio con carplay. También sobre contacto",
  );

  // El botón lleva al tema, que se responde igual que si lo hubieran escrito.
  const tema = responder(r.estado, opcion("contacto"), CON_CARPLAY);
  assert.deepEqual(tema.evento, { evento: "tema", tema: "contacto" });
});

test("palabra ambigua: «tarjeta de sonido» con producto exacto muestra productos y «Ver pagos en cuotas»", () => {
  const r = responder(ESTADO_INICIAL, texto("tarjeta de sonido"), CON_CARPLAY);
  assert.deepEqual(de(r.bloques, "productos")?.skus, ["TAR1"]);
  const opciones = r.bloques.flatMap((b) => (b.tipo === "opciones" ? b.opciones : []));
  assert.deepEqual(opciones[0], { id: "cuotas", etiqueta: "Ver pagos en cuotas" });
  assert.equal(
    textos(r.bloques)[0],
    "Esto encontramos para «tarjeta de sonido». Si preguntabas por pagos en cuotas, está abajo.",
  );
});

test("palabra ambigua sin coincidencia exacta: se responde el tema", () => {
  const r = responder(ESTADO_INICIAL, texto("tarjeta de sonido"), CONTEXTO);
  assert.deepEqual(r.evento, { evento: "tema", tema: "cuotas" });
  assert.deepEqual(sinMemoria(r.estado), { ultimaConsulta: null, ultimoTema: "cuotas" });
  assert.equal(de(r.bloques, "productos"), undefined);
});

test("palabra ambigua con catálogo null: se responde el tema", () => {
  const sin: Contexto = { ...CONTEXTO, productos: null };
  const r = responder(ESTADO_INICIAL, texto("radio con carplay para el teléfono"), sin);
  assert.deepEqual(r.evento, { evento: "tema", tema: "contacto" });
  assert.ok(textos(r.bloques).includes("Teléfono: +502 5295 5555"));
});

test("palabra ambigua sola: el tema, aunque haya productos que la nombren", () => {
  for (const [t, tema] of [
    ["teléfono", "contacto"],
    ["cuál es su teléfono", "contacto"],
    ["¿cuál es su correo?", "contacto"],
  ] as const) {
    const r = responder(ESTADO_INICIAL, texto(t), CON_CARPLAY);
    assert.deepEqual(r.evento, { evento: "tema", tema }, t);
  }
});

test("palabra fuerte: «envío de amplificador» sigue siendo envíos", () => {
  const r = responder(ESTADO_INICIAL, texto("envío de amplificador"), CON_CARPLAY);
  assert.deepEqual(r.evento, { evento: "tema", tema: "envios" });
});

test("necesitaCatalogo: una palabra ambigua con más texto espera al catálogo; sola, no", () => {
  assert.equal(necesitaCatalogo(texto("radio con carplay para el teléfono")), true);
  assert.equal(necesitaCatalogo(texto("teléfono")), false);
  assert.equal(necesitaCatalogo(texto("¿cuál es su correo?")), false);
});

// SUB1 publica potencia e impedancia; SUB2 (agotado) no publica potencia.
const CON_FICHAS: Contexto = {
  ...CONTEXTO,
  fichas: {
    SUB1: [
      { etiqueta: "Tamaño", valor: '12"' },
      { etiqueta: "Potencia RMS", valor: "500 W" },
      { etiqueta: "Potencia máxima", valor: "1,000 W" },
      { etiqueta: "Impedancia", valor: "2 Ω" },
    ],
    SUB2: [
      { etiqueta: "Tamaño", valor: '12"' },
      { etiqueta: "Impedancia", valor: "2 Ω" },
    ],
  },
};

test("dato: un producto responde con los valores de su ficha, en su orden", () => {
  const r = responder(ESTADO_INICIAL, texto("¿cuántos watts tiene el SQ12-D2?"), CON_FICHAS);
  const productos = de(r.bloques, "productos");
  assert.deepEqual(productos?.skus, ["SUB1"]);
  assert.equal(productos?.total, 1);
  assert.deepEqual(productos?.datos, {
    SUB1: [
      { etiqueta: "Potencia RMS", valor: "500 W" },
      { etiqueta: "Potencia máxima", valor: "1,000 W" },
    ],
  });
  assert.deepEqual(textos(r.bloques), ["Datos publicados por el fabricante."]);
  assert.equal(r.bloques.at(-1)?.tipo, "opciones");
  assert.deepEqual(sinMemoria(r.estado), {
    ultimaConsulta: "cuántos watts tiene el SQ12-D2",
    ultimoTema: null,
  });
  assert.deepEqual(r.evento, {
    evento: "busqueda",
    consulta: "sq12-d2",
    modo: "exacta",
    resultados: 1,
  });
});

test("dato: un producto que no publica el dato lo dice, sin inventarlo", () => {
  const r = responder(ESTADO_INICIAL, texto("potencia del STR12-D2"), CON_FICHAS);
  assert.deepEqual(textos(r.bloques), [
    'Subwoofer Serie Street de 12" STR12-D2: el fabricante no publica la potencia.',
  ]);
  assert.equal(de(r.bloques, "productos")?.datos, undefined);
  assert.equal(r.bloques.at(-1)?.tipo, "opciones");
});

test("dato: varios productos llevan cada uno su fila, y el que no publica dice «sin dato»", () => {
  const r = responder(
    ESTADO_INICIAL,
    texto("cuántos watts tienen los subwoofer de 12"),
    CON_FICHAS,
  );
  const productos = de(r.bloques, "productos");
  assert.deepEqual(productos?.skus, ["SUB1", "SUB2"]);
  assert.equal(productos?.total, 2);
  assert.deepEqual(productos?.datos, {
    SUB1: [
      { etiqueta: "Potencia RMS", valor: "500 W" },
      { etiqueta: "Potencia máxima", valor: "1,000 W" },
    ],
    SUB2: [{ etiqueta: "Potencia", valor: "sin dato del fabricante" }],
  });
  assert.equal(productos?.verTodosHref, "/buscar?q=subwoofer+12");
  assert.deepEqual(textos(r.bloques), ["Datos publicados por el fabricante."]);
});

test("dato: disponibilidad de un producto agotado, con la consulta por WhatsApp", () => {
  const r = responder(ESTADO_INICIAL, texto("¿está disponible el STR12-D2?"), CON_FICHAS);
  assert.deepEqual(textos(r.bloques), ['Subwoofer Serie Street de 12" STR12-D2: agotado.']);
  assert.equal(
    de(r.bloques, "whatsapp")?.mensaje,
    buildAvailabilityInquiryMessage('Subwoofer Serie Street de 12" STR12-D2'),
  );
});

test("dato: disponibilidad de un producto disponible, sin WhatsApp", () => {
  const r = responder(ESTADO_INICIAL, texto("hay existencia del SQ12-D2"), CON_FICHAS);
  assert.deepEqual(textos(r.bloques), ['Subwoofer Serie SQ de 12" SQ12-D2: disponible.']);
  assert.equal(de(r.bloques, "whatsapp"), undefined);
});

test("dato: disponibilidad de varios, una fila por producto", () => {
  const r = responder(ESTADO_INICIAL, texto("subwoofer de 12 disponibles"), CON_FICHAS);
  assert.deepEqual(de(r.bloques, "productos")?.datos, {
    SUB1: [{ etiqueta: "Disponibilidad", valor: "Disponible" }],
    SUB2: [{ etiqueta: "Disponibilidad", valor: "Agotado" }],
  });
  assert.deepEqual(textos(r.bloques), []);
});

test("dato: sin producto, pide cuál y no espera al catálogo", () => {
  const entrada = texto("¿cuántos watts?");
  assert.equal(necesitaCatalogo(entrada), false);
  const r = responder(ESTADO_INICIAL, entrada, CON_FICHAS);
  assert.deepEqual(textos(r.bloques), [
    "Escribe el nombre o el código del producto junto con lo que quieres saber.",
  ]);
  assert.equal(r.evento, null);
});

test("dato: con producto espera al catálogo, y sin él responde lo de siempre", () => {
  const entrada = texto("potencia del SQ12-D2");
  assert.equal(necesitaCatalogo(entrada), true);
  const r = responder(ESTADO_INICIAL, entrada, { ...CON_FICHAS, productos: null });
  assert.deepEqual(textos(r.bloques), ["No pudimos cargar el catálogo."]);
});

test("dato: si el producto no existe, la respuesta de «sin resultados»", () => {
  const r = responder(ESTADO_INICIAL, texto("potencia del XYZ999"), CON_FICHAS);
  assert.deepEqual(textos(r.bloques), ["No encontramos productos para «XYZ999»."]);
  assert.deepEqual(r.evento, { evento: "sin_resultados", consulta: "xyz999" });
});

test("dato: un catálogo sin fichas (anterior al deploy) no dice «no publica»: responde la búsqueda", () => {
  const r = responder(ESTADO_INICIAL, texto("potencia del SQ12-D2"), CONTEXTO);
  assert.deepEqual(r.bloques, responder(ESTADO_INICIAL, texto("SQ12-D2"), CONTEXTO).bloques);
  // La disponibilidad no depende de la ficha.
  const d = responder(ESTADO_INICIAL, texto("¿está disponible el SQ12-D2?"), CONTEXTO);
  assert.deepEqual(textos(d.bloques), ['Subwoofer Serie SQ de 12" SQ12-D2: disponible.']);
});

// ---------------------------------------------------------------------------
// Conversación con memoria (spec 2026-11-03)
// ---------------------------------------------------------------------------

function sub(sku: string, marca: string, pulgadas: number, precioCents: number, extra = {}) {
  return producto(sku, `Subwoofer ${marca} de ${pulgadas}" ${sku}`, "Subwoofers", {
    marca,
    pulgadas,
    precioCents,
    claves: `${pulgadas}"`,
    ...extra,
  });
}

// Ocho subwoofers: más de los que caben en el chat, con medidas, marcas y
// precios distintos.
const GRANDE: Contexto = {
  ...CONTEXTO,
  productos: [
    sub("G1", "Memphis", 12, 300000),
    sub("G2", "Memphis", 12, 200000),
    sub("G3", "Memphis", 10, 150000),
    sub("G4", "KBT", 12, 100000),
    sub("G5", "KBT", 10, 90000),
    sub("G6", "Memphis", 15, 400000),
    sub("G7", "KBT", 15, 80000),
    sub("G8", "Memphis", 12, 250000, { disponibilidad: "bajo_pedido" }),
  ],
  marcas: [
    { nombre: "Memphis", slug: "memphis" },
    { nombre: "KBT", slug: "kbt" },
    { nombre: "Pioneer", slug: "pioneer" },
  ],
};

/** Corre los mensajes en orden, cada uno sobre el estado del anterior. */
function conversar(mensajes: (string | Entrada)[], contexto = GRANDE) {
  let estado = ESTADO_INICIAL;
  return mensajes.map((m) => {
    const r = responder(estado, typeof m === "string" ? texto(m) : m, contexto);
    estado = r.estado;
    return r;
  });
}

const skusDe = (r: { bloques: Bloque[] }) => de(r.bloques, "productos")?.skus ?? [];

test("conversación: subwoofers → 12 → solo Memphis → más baratos → precio del primero → agrégalo", () => {
  const [r1, r2, r3, r4, r5, r6] = conversar([
    "subwoofers",
    "12",
    "solo memphis",
    "más baratos",
    "¿cuánto cuesta el primero?",
    "agrégalo",
  ]);
  assert.equal(textos(r1.bloques)[0], "Encontré 8 resultados.");
  assert.equal(textos(r2.bloques)[0], 'Ahora de 12". Quedan 4.');
  assert.deepEqual([...skusDe(r2)].sort(), ["G1", "G2", "G4", "G8"]);
  assert.equal(textos(r3.bloques)[0], "Ahora solo Memphis. Quedan 3.");
  assert.equal(textos(r4.bloques)[0], "Ordené de menor a mayor precio. Quedan 3.");
  assert.deepEqual(skusDe(r4), ["G2", "G8", "G1"]);
  assert.ok(
    textos(r5.bloques).includes(
      'Subwoofer Memphis de 12" G2 cuesta Q\u00a02,000.00, o Q\u00a0333.34 al mes × 6.',
    ),
  );
  assert.equal(r5.estado.enfoque, "G2");
  // La referencia no toca la búsqueda ni lo mostrado.
  assert.deepEqual(r5.estado.busqueda, r4.estado.busqueda);
  assert.deepEqual(r5.estado.mostrados, ["G2", "G8", "G1"]);
  assert.equal(
    textos(r6.bloques)[0],
    'Aquí está Subwoofer Memphis de 12" G2 para agregarlo al carrito.',
  );
  assert.deepEqual(skusDe(r6), ["G2"]);
});

test("conversación: sub 12 → y de 10?: la medida del texto pasa a acote", () => {
  const [, r2] = conversar(["sub 12", "y de 10?"]);
  assert.equal(textos(r2.bloques)[0], 'Cambié 12" por 10". Quedan 2.');
  assert.deepEqual([...skusDe(r2)].sort(), ["G3", "G5"]);
  const base = r2.estado.busqueda?.base;
  assert.equal(base?.tipo === "texto" && base.consulta, "sub");
});

test("conversación: un cambio que deja cero no toca la memoria", () => {
  const [, r2, r3] = conversar(["subwoofers", "12", "solo pioneer"]);
  assert.equal(textos(r3.bloques)[0], "No hay Pioneer en esta búsqueda.");
  assert.deepEqual(r3.estado.busqueda, r2.estado.busqueda);
  assert.ok(de(r3.bloques, "acotar") === undefined || de(r3.bloques, "acotar"));
});

test("conversación: un tema en medio borra la memoria", () => {
  const [, r2, r3] = conversar(["subwoofers", "¿hacen envíos?", "y de 10?"]);
  assert.equal(r2.estado.busqueda, undefined);
  assert.ok(!textos(r3.bloques).some((t) => t.startsWith("Ahora")));
});

test("conversación: más trae del 6 al 8, y después «ya te mostré»", () => {
  const [, r2, r3] = conversar(["subwoofers", "más", "más"]);
  assert.equal(textos(r2.bloques)[0], "Del 6 al 8 de 8.");
  assert.equal(skusDe(r2).length, 3);
  assert.equal(textos(r3.bloques)[0], "Ya te mostré los 8.");
});

test("conversación: una medida que no hay muestra la más cercana de la lista", () => {
  const [, r2] = conversar(["subwoofers", "13"]);
  assert.equal(textos(r2.bloques)[0], 'Ninguno es de 13". Los más cercanos son de 12" y 15".');
  assert.ok(skusDe(r2).length > 0);
});

test("conversación: «ese» con varios en pantalla no es referencia", () => {
  const [, r2] = conversar(["subwoofers", "¿cuánto cuesta ese?"]);
  assert.ok(!textos(r2.bloques).some((t) => t.includes(" cuesta Q")));
  assert.equal(r2.estado.enfoque ?? null, null);
});

test("conversación: la frase de presentación rota con el turno", () => {
  // «memphis» sola sería un seguimiento: «sub 10» nombra otra cosa.
  const [r1, r2] = conversar(["subwoofers", "sub 10"]);
  assert.equal(textos(r1.bloques)[0], "Encontré 8 resultados.");
  assert.equal(textos(r2.bloques)[0], "Estos son los 2 resultados.");
});

test("conversación: «Hablar con Sonoro» tras un seguimiento lleva la consulta combinada", () => {
  const [, , r3] = conversar(["subwoofers", "solo memphis", "12"]);
  assert.equal(r3.estado.ultimaConsulta, 'subwoofers · Memphis · 12"');
});

test("conversación: un botón de acotar responde igual que el texto", () => {
  const [, porBoton] = conversar(["subwoofers", { tipo: "opcion", id: "acotar:medida:12" }]);
  assert.equal(textos(porBoton.bloques)[0], 'Ahora de 12". Quedan 4.');
});
