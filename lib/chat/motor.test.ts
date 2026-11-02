import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoBuscable } from "../busqueda/busqueda.ts";
import { UMBRAL_ENVIO_GRATIS_CENTS } from "../cart/envio.ts";
import { formatQ } from "../format/precio.ts";
import { buildAvailabilityInquiryMessage } from "../whatsapp/message.ts";
import { ESTADO_INICIAL, MAX_PRODUCTOS_CHAT, bloquesDeInicio, responder } from "./motor.ts";
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
    "Hola. Busca un producto por nombre, marca, código o medida, o elige un tema.",
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
  ]);
  const parcial = textos(bloquesDeTema("contacto", { correo: "a@b.gt" }));
  assert.deepEqual(parcial, ["Correo: a@b.gt"]);
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

test("texto largo: se corta a 200 antes de todo", () => {
  const r = responder(ESTADO_INICIAL, texto("subwoofer ".repeat(100)), CONTEXTO);
  assert.ok(r.evento && "consulta" in r.evento);
  if (r.evento && "consulta" in r.evento) assert.ok(r.evento.consulta.length <= 200);
  assert.ok((r.estado.ultimaConsulta ?? "").length <= 200);
  const rec = responder(ESTADO_INICIAL, texto(`recomienda ${"x".repeat(1000)}`), CONTEXTO);
  assert.ok((rec.estado.ultimaConsulta ?? "").length <= 200);
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
