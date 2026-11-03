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
  assert.deepEqual(r.estado, ESTADO_INICIAL);
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
  assert.deepEqual(r.estado, { ultimaConsulta: null, ultimoTema: "envios" });
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
    enlace: { etiqueta: "Nosotros", href: "/nosotros" },
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
  assert.deepEqual(b.estado, { ultimaConsulta: null, ultimoTema: "garantia" });
  const c = responder(b.estado, texto("sub 12 2 ohm"), CONTEXTO);
  assert.deepEqual(c.estado, { ultimaConsulta: "sub 12 2 ohm", ultimoTema: null });
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
    assert.deepEqual(r.estado, estado, id);
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
  assert.deepEqual(r.estado, { ultimaConsulta: "radio con carplay", ultimoTema: null });
  assert.equal(de(r.bloques, "productos")?.verTodosHref, "/buscar?q=radio+con+carplay");

  // El botón lleva al tema, que se responde igual que si lo hubieran escrito.
  const tema = responder(r.estado, opcion("contacto"), CON_CARPLAY);
  assert.deepEqual(tema.evento, { evento: "tema", tema: "contacto" });
});

test("palabra ambigua: «tarjeta de sonido» con producto exacto muestra productos y «Ver pagos en cuotas»", () => {
  const r = responder(ESTADO_INICIAL, texto("tarjeta de sonido"), CON_CARPLAY);
  assert.deepEqual(de(r.bloques, "productos")?.skus, ["TAR1"]);
  const opciones = r.bloques.flatMap((b) => (b.tipo === "opciones" ? b.opciones : []));
  assert.deepEqual(opciones[0], { id: "cuotas", etiqueta: "Ver pagos en cuotas" });
});

test("palabra ambigua sin coincidencia exacta: se responde el tema", () => {
  const r = responder(ESTADO_INICIAL, texto("tarjeta de sonido"), CONTEXTO);
  assert.deepEqual(r.evento, { evento: "tema", tema: "cuotas" });
  assert.deepEqual(r.estado, { ultimaConsulta: null, ultimoTema: "cuotas" });
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
