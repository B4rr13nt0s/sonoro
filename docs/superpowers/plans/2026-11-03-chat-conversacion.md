# Chat con memoria: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el chat converse: seguimientos sobre la búsqueda guardada, referencias a los productos mostrados, charla, frases que presentan resultados y preguntas cuando la búsqueda es vaga, todo sin LLM.

**Architecture:** Tres módulos puros nuevos en `lib/chat/` (`charla.ts`, `referencia.ts`, `seguimiento.ts`) reconocen lo nuevo y devuelven datos; `intencion.ts` los consulta en orden con el `Estado`; `motor.ts` responde y escribe la memoria en `Estado`. `acotar.ts` suma el acote de disponibilidad, el orden en el enlace y los valores más cercanos dentro de una lista.

**Tech Stack:** TypeScript, `node --test`, Playwright (e2e). Next.js 16 solo para el e2e.

**Spec:** `docs/superpowers/specs/2026-11-03-chat-conversacion-design.md` (amplía `docs/superpowers/specs/2026-11-02-chatbot-design.md`).

## Global Constraints

- Sin LLM. Todo es vocabulario a mano y reglas, comparado sobre `normalizar()` (sin acentos ni mayúsculas), por palabras o frases enteras.
- Regla 2: nunca «te recomendamos», «el mejor», «ideal», ni adjetivos de venta. El chat no elige por el cliente.
- El chat **siempre dice qué entendió** de un seguimiento; si el mensaje nombra otra cosa, es búsqueda nueva.
- Precios con `formatQ` y cuota con `lineaCuota` (`lib/format/precio.ts`). Nunca formateo a mano.
- Sin regex con lookbehind (Safari < 16.4).
- Los módulos de `lib/chat/` y `lib/busqueda/` no importan React, DOM ni variables de entorno.
- Los campos nuevos de `Estado` son opcionales: ausentes valen «sin memoria».
- Sin componentes nuevos: solo los bloques que existen (`texto`, `filtros`, `productos`, `acotar`, `opciones`, `whatsapp`).
- Español de Guatemala, sin emoji.
- Comentarios y nombres en español, con la densidad del código vecino.
- Commits solo con permiso del usuario; cada uno termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Se agrega por ruta, nunca `git add -A`.

## Review Focus

1. **Un seguimiento que en realidad es búsqueda nueva:** «y bocinas?», «y amplificadores de 4 canales?» deben buscar de cero, no acotar la búsqueda anterior. *Test en Task 5.*
2. **Una búsqueda escrita que parece seguimiento:** «12» sin búsqueda guardada, o «memphis» tras hablar de envíos, debe buscar como hoy. *Test en Task 6.*
3. **«ese» sin a qué referirse:** sin `enfoque` y con varios mostrados no es referencia; el texto sigue al paso siguiente. *Test en Task 4.*
4. **Un cambio que deja cero productos** no toca la memoria, y la búsqueda anterior sigue acotable con los mismos botones. *Test en Task 7.*
5. **«gracias» en medio de una conversación** no borra la búsqueda: «gracias» → «y de 10?» sigue siendo seguimiento. *Test en Task 8.*

---

### Task 1: Precio como dato de la ficha

**Files:**
- Modify: `lib/chat/datos.ts`, `lib/chat/intencion.ts`, `lib/chat/motor.ts` (`responderDato`)
- Test: `lib/chat/intencion.test.ts`, `lib/chat/motor.test.ts`

**Interfaces:**
- Produces: `Campo` gana `{ tipo: "precio" }`. `VOCABULARIO_DATOS` gana su entrada con las palabras `"precio"`, `"cuesta"`, `"vale"`, `"sale"`, `"cuanto cuesta"`, `"cuanto vale"`, `"cuanto sale"`. `frasePrecio(nombre: string, precioCents: number): string` en `datos.ts` → `«<nombre> cuesta <formatQ>, o <lineaCuota>.»` (con `lineaCuota` en minúscula inicial tal como la devuelve: «o Q 408.34 al mes × 6»; la frase queda «X cuesta Q 2,450.00, o Q 408.34 al mes × 6.» sin duplicar la «o»).

- [ ] **Step 1: Tests que fallan**

```ts
// intencion.test.ts
test("dato: precio de un código", () => {
  const i = detectarIntencion("¿cuánto cuesta el MJP1244?");
  assert.equal(i.tipo, "dato");
  assert.deepEqual(i.tipo === "dato" && i.campos.map((c) => c.tipo), ["precio"]);
  assert.equal(i.tipo === "dato" && i.consulta, "mjp1244");
});
test("dato: «cuánto cuesta» de una búsqueda amplia sigue siendo dato de precio", () => {
  assert.equal(detectarIntencion("cuanto cuesta el subwoofer de 12 memphis").tipo, "dato");
});
// motor.test.ts (fixture: SUB1 'Subwoofer Serie SQ de 12" SQ12-D2', 245000)
test("dato: precio de un producto nombrado", () => {
  const r = responder(ESTADO_INICIAL, texto("¿cuánto cuesta el SUB1?"), CONTEXTO);
  assert.ok(textos(r.bloques).includes(
    'Subwoofer Serie SQ de 12" SQ12-D2 cuesta Q 2,450.00, o Q 408.34 al mes × 6.'));
});
test("dato: solo precio sobre una lista es la búsqueda de siempre", () => {
  const r = responder(ESTADO_INICIAL, texto("cuanto cuesta un subwoofer"), CONTEXTO);
  assert.equal(textos(r.bloques).some((t) => t.includes(" cuesta ")), false);
  assert.ok(de(r.bloques, "productos"));
});
```

- [ ] **Step 2:** `node --no-warnings --test lib/chat/intencion.test.ts lib/chat/motor.test.ts` → los cuatro fallan.
- [ ] **Step 3: Implementar.** `detectarDato` hoy quita `APERTURAS` antes de buscar el vocabulario, y «cuánto cuesta» es una apertura: el campo precio se busca sobre el texto **antes** de quitar las aperturas, y después se quitan como hoy. En `responderDato`: con un producto nombrado, el campo precio agrega `frasePrecio` a los avisos (sin el bloque «Datos publicados por el fabricante» si solo se preguntó precio); sin producto nombrado y solo con precio, `return responderBusqueda(consulta, visible, contexto)`; en una lista con otros campos, precio no agrega fila (la fila ya lleva el precio).
- [ ] **Step 4:** los mismos tests pasan; `npm test` sigue en verde.
- [ ] **Step 5: Commit** `feat(chat): contesta el precio de un producto`.

---

### Task 2: `acotar.ts`: disponibilidad, orden en el enlace y lo más cercano en una lista

**Files:**
- Modify: `lib/busqueda/acotar.ts`
- Test: `lib/busqueda/acotar.test.ts`

**Interfaces:**
- Produces:
  - `Acote` gana `{ campo: "disponibilidad" }` (filtra `disponibilidad === "disponible"`). `describirAcote` → `"Disponibles"`. `idDeAcote`/`acoteDeId`: `acotar:disponibilidad:si`. `gruposDeAcote` **no** lo ofrece como grupo.
  - `hrefAcotado(visible, acotes, marcas, orden?: "precio_asc" | "precio_desc")`: el acote escribe `disp=disponible`; el orden, `orden=<valor>`.
  - `cercanosEnLista(lista: readonly ProductoBuscable[], campo: "medida" | "canales", valor: number): { productos: ProductoBuscable[]; valores: number[] } | null` — el valor más cercano de abajo y el de arriba presentes en `lista`, primero el más cercano; `null` si `lista` ya trae `valor` o no trae ninguno.

- [ ] **Step 1: Tests que fallan**

```ts
test("disponibilidad: filtra lo disponible y viaja como disp=disponible", () => {
  const lista = [producto("A"), producto("B", { disponibilidad: "bajo_pedido" })];
  assert.deepEqual(aplicarAcotes(lista, [{ campo: "disponibilidad" }], MARCAS).map((p) => p.sku), ["A"]);
  assert.equal(describirAcote({ campo: "disponibilidad" }, MARCAS), "Disponibles");
  assert.deepEqual(acoteDeId(idDeAcote({ campo: "disponibilidad" })), { campo: "disponibilidad" });
  assert.equal(hrefAcotado("sub", [{ campo: "disponibilidad" }], MARCAS, "precio_asc"),
    "/buscar?q=sub&disp=disponible&orden=precio_asc");
  assert.ok(!gruposDeAcote(lista, MARCAS).some((g) => g.campo === "disponibilidad"));
});
test("cercanosEnLista: el de abajo y el de arriba, primero el más cercano", () => {
  const r = cercanosEnLista(SUBS, "medida", 13);
  assert.deepEqual(r?.valores, [12, 15]);
  assert.deepEqual(r?.productos.map((p) => p.sku), ["C", "D", "E", "F"]);
  assert.equal(cercanosEnLista(SUBS, "medida", 12), null);
});
```

- [ ] **Step 2:** `node --no-warnings --test lib/busqueda/acotar.test.ts` → fallan.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** pasan; `npm test` en verde.
- [ ] **Step 5: Commit** `feat(busqueda): acote de disponibilidad y lo más cercano dentro de una lista`.

---

### Task 3: `charla.ts`

**Files:**
- Create: `lib/chat/charla.ts`, `lib/chat/charla.test.ts`

**Interfaces:**
- Produces:
  - `type ClaseCharla = "gracias" | "como_estas" | "quien_eres" | "adios" | "confirmacion" | "negacion" | "groseria"`
  - `detectarCharla(texto: string): ClaseCharla | null` — el texto entero, sin puntuación y normalizado, es una frase de la tabla de § Charla de la spec, sola o precedida de un saludo («hola, ¿cómo estás?»). La grosería se reconoce si **alguna** palabra es de la lista (lista corta a criterio del implementador, en el archivo).
  - `TEXTOS_CHARLA: Record<Exclude<ClaseCharla, "confirmacion">, string>` con las respuestas exactas de la spec; `TEXTO_QUE_MAS = "¿Qué más buscas?"`.
  - `esVago(texto: string): boolean` — la frase entera está en la lista de § Preguntar cuando es vago («algo para mi carro», «quiero mejorar el sonido», «quiero más bajo», «que suene más fuerte», «busco equipo», «quiero armar mi sistema», con y sin «mi carro» / «para el carro» al final).
  - `fraseResultados(total: number, turno: number): string` — `1` → «Encontré 1 resultado.»; si no, variantes `["Encontré N resultados.", "Estos son los N resultados."]` elegidas con `turno % 2`.
  - `TEXTO_TIPO_EQUIPO = "¿Qué tipo de equipo buscas?"`, `preguntaVaga(total: number, pendiente: "medida" | "canales" | "categoria"): string` → «Hay N resultados. ¿Qué medida buscas?» / «… ¿De cuántos canales?» / «… ¿Qué tipo de equipo buscas?».

- [ ] **Step 1: Tests que fallan** — una por clase, con todas las frases de la tabla de la spec en un `for`; más:

```ts
test("charla: con saludo delante", () => assert.equal(detectarCharla("hola, ¿cómo estás?"), "como_estas"));
test("charla: no se come una búsqueda", () => {
  assert.equal(detectarCharla("gracias, y de 10?"), null);
  assert.equal(detectarCharla("nada más memphis"), null);
  assert.equal(detectarCharla("hola"), null); // sigue siendo saludo
});
test("vago: «quiero más bajo» sí, «bajo de 12» no", () => {
  assert.equal(esVago("quiero más bajo"), true);
  assert.equal(esVago("bajo de 12"), false);
});
test("fraseResultados: rota con el turno y no pluraliza 1", () => {
  assert.equal(fraseResultados(1, 0), "Encontré 1 resultado.");
  assert.equal(fraseResultados(28, 0), "Encontré 28 resultados.");
  assert.equal(fraseResultados(28, 1), "Estos son los 28 resultados.");
});
```

- [ ] **Step 2:** `node --no-warnings --test lib/chat/charla.test.ts` → falla (módulo inexistente).
- [ ] **Step 3:** implementar. Reutilizar `normalizar` de `lib/busqueda/busqueda.ts` y la lista de saludos de apertura de `intencion.ts` (exportarla si hace falta; no duplicarla).
- [ ] **Step 4:** pasa.
- [ ] **Step 5: Commit** `feat(chat): vocabulario de charla y frases de resultados`.

---

### Task 4: `referencia.ts`

**Files:**
- Create: `lib/chat/referencia.ts`, `lib/chat/referencia.test.ts`

**Interfaces:**
- Consumes: `Estado` con `mostrados?: string[]` y `enfoque?: string | null` (los agrega Task 6 a `tipos.ts`; este task los lee como `Pick<Estado, "mostrados" | "enfoque">` y declara ese tipo local hasta entonces, o agrega los dos campos a `tipos.ts` ya mismo).
- Produces:
  - `encontrarReferencia(texto: string, memoria: { mostrados?: readonly string[]; enfoque?: string | null }): { sku: string; resto: string } | null` — según la tabla de § Referencias. `resto` va normalizado y sin la referencia ni las palabras de relleno que la rodeaban («el», «la», «y»).
  - `type Accion = "carrito" | "precio" | null` y `accionDe(resto: string): Accion` — carrito: «agregalo», «agregar», «agrega», «lo quiero», «me lo llevo», «me llevo», «compralo», «anadir», «añadelo»; precio: las palabras del campo precio de Task 1.

- [ ] **Step 1: Tests que fallan**

```ts
const M = { mostrados: ["A", "B", "C"], enfoque: null };
test("ordinales y números", () => {
  assert.equal(encontrarReferencia("¿cuánto cuesta el primero?", M)?.sku, "A");
  assert.equal(encontrarReferencia("y el segundo?", M)?.sku, "B");
  assert.equal(encontrarReferencia("el 3", M)?.sku, "C");
  assert.equal(encontrarReferencia("el último", M)?.sku, "C");
});
test("una posición que no existe no es referencia", () =>
  assert.equal(encontrarReferencia("el quinto", M), null));
test("«ese»: el enfoque, o el único mostrado; si no, nada", () => {
  assert.equal(encontrarReferencia("agrégalo", { ...M, enfoque: "B" })?.sku, "B");
  assert.equal(encontrarReferencia("cuánto cuesta ese", { mostrados: ["A"] })?.sku, "A");
  assert.equal(encontrarReferencia("cuánto cuesta ese", M), null); // Review Focus 3
});
test("el resto conserva la pregunta", () => {
  assert.equal(encontrarReferencia("¿cuántos watts tiene el primero?", M)?.resto, "cuantos watts tiene");
});
test("acción", () => {
  assert.equal(accionDe("agregalo"), "carrito");
  assert.equal(accionDe("me llevo"), "carrito");
  assert.equal(accionDe("cuanto cuesta"), "precio");
  assert.equal(accionDe("cuantos watts tiene"), null);
});
test("sin mostrados no hay referencia", () =>
  assert.equal(encontrarReferencia("el primero", {}), null));
```

- [ ] **Step 2:** falla. **Step 3:** implementar. **Step 4:** pasa.
- [ ] **Step 5: Commit** `feat(chat): referencias a los productos mostrados`.

---

### Task 5: `seguimiento.ts`

**Files:**
- Create: `lib/chat/seguimiento.ts`, `lib/chat/seguimiento.test.ts`

**Interfaces:**
- Consumes: `Acote`, `describirAcote` (`acotar.ts`, con disponibilidad de Task 2); `interpretar`, `normalizar`, `canonizar` (`busqueda.ts`); `BusquedaAcotable` (`tipos.ts`).
- Produces:

```ts
export type Cambio =
  | { tipo: "acote"; acote: Acote }
  | { tipo: "quitar"; campo?: Acote["campo"] } // sin campo: todos
  | { tipo: "orden"; orden: "precio_asc" | "precio_desc" }
  | { tipo: "mas" };

export function interpretarSeguimiento(
  texto: string,
  opciones: { marcas: readonly { nombre: string; slug: string }[]; numeroSuelto: "medida" | "canales" | null },
): Cambio[] | null;

export function aplicarCambios(busqueda: BusquedaAcotable, cambios: readonly Cambio[]): BusquedaAcotable;

export function fraseCambios(
  antes: BusquedaAcotable,
  cambios: readonly Cambio[],
  marcas: readonly { nombre: string; slug: string }[],
): string;

/** La consulta de texto sin sus medidas escritas («sub 12» → «sub»), para pasarlas a acote. */
export function sinMedidas(consulta: string): string;
```

**Regla de «no nombra otra cosa» (decisión de este plan, la concreta de la spec):** del texto normalizado se quitan, en este orden, los cambios reconocidos, los conectores («y», «solo», «nada mas», «pero», «mejor», «ahora», «tambien», «entonces»), `PALABRAS_VACIAS` y un relleno propio de seguimientos («muestrame», «ensename», «dame», «ver», «quiero», «sean», «que», «hay», «tienes», «tienen», «otro», «otra», «por favor»). Es seguimiento solo si **no queda nada** y hubo al menos un cambio. Así «y bocinas?» deja «bocinas» y es búsqueda nueva.

- **Número suelto** (1 a 20) va al campo de `numeroSuelto`; con `null` no es cambio.
- `aplicarCambios`: un acote reemplaza el del mismo campo; `quitar` borra; `orden` lo fija; `mas` suma 1 a `pagina`; todo lo demás vuelve `pagina` a 0. Un acote de medida o canales sobre una base de texto reemplaza `base.consulta` por `sinMedidas(base.consulta)` (y lo mismo `visible`).
- `fraseCambios`, con las frases de la tabla de Cambios de la spec; varios cambios se juntan en una («Ahora solo Memphis de 10".»). Medida con una anterior: «Cambié 12" por 10".»

- [ ] **Step 1: Tests que fallan** — uno por fila de la tabla de Cambios de la spec, más:

```ts
const OP = { marcas: MARCAS, numeroSuelto: "medida" as const };
test("y bocinas? es búsqueda nueva", () => assert.equal(interpretarSeguimiento("y bocinas?", OP), null)); // Review Focus 1
test("y amplificadores de 4 canales? es búsqueda nueva", () =>
  assert.equal(interpretarSeguimiento("y amplificadores de 4 canales?", OP), null));
test("y entonces? no cambia nada", () => assert.equal(interpretarSeguimiento("y entonces?", OP), null));
test("más baratos es orden, más de 3000 es precio, más es página", () => {
  assert.deepEqual(interpretarSeguimiento("más baratos", OP), [{ tipo: "orden", orden: "precio_asc" }]);
  assert.deepEqual(interpretarSeguimiento("más de 3000", OP), [{ tipo: "acote", acote: { campo: "precio", min: 300000 } }]);
  assert.deepEqual(interpretarSeguimiento("muéstrame más", OP), [{ tipo: "mas" }]);
});
test("solo memphis de 10: dos cambios y una frase", () => {
  const cambios = interpretarSeguimiento("solo memphis de 10", OP);
  assert.equal(cambios?.length, 2);
  const base = { base: { tipo: "texto" as const, consulta: "sub 12", visible: "sub 12" }, acotes: [] };
  assert.equal(fraseCambios(base, cambios ?? [], MARCAS), 'Ahora solo Memphis de 10".');
});
test("la medida escrita en la base pasa a acote", () => {
  const base = { base: { tipo: "texto" as const, consulta: "sub 12", visible: "sub 12" }, acotes: [] };
  const nueva = aplicarCambios(base, [{ tipo: "acote", acote: { campo: "medida", pulgadas: 10 } }]);
  assert.equal(nueva.base.tipo === "texto" && nueva.base.consulta, "sub");
  assert.deepEqual(nueva.acotes, [{ campo: "medida", pulgadas: 10 }]);
});
test("número suelto sin campo no es cambio", () =>
  assert.equal(interpretarSeguimiento("10", { ...OP, numeroSuelto: null }), null));
```

  El precio de «más de 3000» sale de `interpretar()` (quetzales) pasado a centavos con `Math.round(n * 100)`; «más de» excluye el mínimo, igual que el acote de precio.

- [ ] **Step 2:** falla. **Step 3:** implementar. **Step 4:** pasa.
- [ ] **Step 5: Commit** `feat(chat): seguimientos sobre la búsqueda guardada`.

---

### Task 6: Memoria en `Estado` e intenciones nuevas

**Files:**
- Modify: `lib/chat/tipos.ts`, `lib/chat/intencion.ts`
- Test: `lib/chat/intencion.test.ts`

**Interfaces:**
- Produces:
  - `Estado` gana, opcionales: `mostrados?: string[]`, `enfoque?: string | null`, `ultimosCampos?: Campo[]`, `pendiente?: "medida" | "canales" | "categoria" | null`, `turno?: number` (cuántas respuestas lleva la conversación; lo usa la rotación de frases). `BusquedaAcotable` gana `orden?: "precio_asc" | "precio_desc"` y `pagina?: number`.
  - `Intencion` gana:
    - `{ tipo: "charla"; clase: ClaseCharla }`
    - `{ tipo: "respuesta_pendiente"; categoria: string }` (slug; solo para `pendiente === "categoria"`: el texto es el nombre o un sinónimo de una categoría del sitio)
    - `{ tipo: "referencia"; sku: string; resto: string }`
    - `{ tipo: "seguimiento"; cambios: Cambio[] }`
    - `{ tipo: "vago" }`
  - `detectarIntencion(texto: string, estado?: Estado, contexto?: Pick<Contexto, "marcas"> & { numeroSuelto?: "medida" | "canales" | null }): Intencion` — orden de § Intención de la spec: charla → saludo → recomendación → tema → respuesta_pendiente → referencia → seguimiento → vago → dato → búsqueda. Sin `estado`, los pasos de memoria no aplican.
  - `necesitaCatalogo(entrada, estado?)` (`motor.ts`, mismo task si hace falta para compilar): true también para referencia, seguimiento y respuesta_pendiente.
- `SALUDOS` pierde «gracias», «muchas gracias», «ok» y «adios» (pasan a charla). Los tests de saludo de `intencion.test.ts` líneas 8 y 255–258 se actualizan: esas frases dan `charla`.

- [ ] **Step 1: Tests que fallan**

```ts
const conBusqueda: Estado = { ...ESTADO_INICIAL, busqueda: { base: { tipo: "texto", consulta: "subwoofer", visible: "subwoofer" }, acotes: [] }, mostrados: ["A", "B"] };
const CTX = { marcas: [{ nombre: "Memphis", slug: "memphis" }], numeroSuelto: "medida" as const };
test("con memoria: seguimiento, referencia", () => {
  assert.equal(detectarIntencion("y de 10?", conBusqueda, CTX).tipo, "seguimiento");
  assert.equal(detectarIntencion("¿cuánto cuesta el primero?", conBusqueda, CTX).tipo, "referencia");
});
test("sin memoria, lo mismo es búsqueda como hoy", () => { // Review Focus 2
  assert.equal(detectarIntencion("12", ESTADO_INICIAL, CTX).tipo, "busqueda");
  assert.equal(detectarIntencion("memphis").tipo, "busqueda");
});
test("el tema gana a un seguimiento", () =>
  assert.equal(detectarIntencion("y el envío?", conBusqueda, CTX).tipo, "tema"));
test("charla antes que saludo; hola sigue siendo saludo", () => {
  assert.deepEqual(detectarIntencion("gracias"), { tipo: "charla", clase: "gracias" });
  assert.equal(detectarIntencion("hola").tipo, "saludo");
});
test("respuesta pendiente de categoría", () =>
  assert.deepEqual(detectarIntencion("subwoofers", { ...ESTADO_INICIAL, pendiente: "categoria" }, CTX),
    { tipo: "respuesta_pendiente", categoria: "subwoofers" }));
test("vago", () => assert.equal(detectarIntencion("algo para mi carro").tipo, "vago"));
```

- [ ] **Step 2:** falla. **Step 3:** implementar. **Step 4:** pasa; `npm test` en verde salvo lo que dependa del motor (Task 7 lo cierra; si algo del motor falla por el cambio de `gracias`, corregir aquí el test esperado).
- [ ] **Step 5: Commit** `feat(chat): intenciones de conversación con memoria`.

---

### Task 7: Motor: memoria, seguimientos y referencias

**Files:**
- Modify: `lib/chat/motor.ts`, `lib/chat/panel.ts` (`resumenDeMensaje` lee la frase de presentación: ya es un bloque `texto`, verificar que entre), `lib/chat/respuestas.ts`
- Test: `lib/chat/motor.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `responder(estado, entrada, contexto)` igual firma. Internamente:
  - `responder` incrementa `turno` en todo Estado que devuelve.
  - `responderSeguimiento(estado, cambios, contexto): Respuesta` — aplica con `aplicarCambios`, filtra con `aplicarAcotes` sobre `productosDeBase`, ordena según `orden` (`compararPrecioAsc/Desc` si existen en `lib/catalog/orden.ts`; si no, por `precioCents` con desempate `compararRelevancia`), y pagina de a `MAX_PRODUCTOS_CHAT`. Bloques: texto con `fraseCambios` (o «Del 6 al 10 de 28.» para `mas`), filtros, productos (`verTodosHref` con `hrefAcotado(..., orden)`), acotar, «Hablar con Sonoro».
    - Cero resultados por medida o canales: `cercanosEnLista` → texto «Ninguno es de 13". Los más cercanos son de 12" y 15".» (mismo formato que `fraseCercania` de `busqueda.ts`) y esos productos; la memoria guarda el acote **no**, queda como estaba más `mostrados` nuevos.
    - Cero por otro campo: texto «No hay <descripción> en esta búsqueda.» (`describirAcote`) + el bloque acotar de la búsqueda sin el cambio; Estado sin cambios.
    - `mas` sin más: «Ya te mostré los <N>.»
  - `responderReferencia(estado, sku, resto, contexto): Respuesta` — según la tabla de Qué se hace con el producto: dato (reusar `responderDato` con ese producto como `nombrado`; extraer de `responderDato` la parte que arma bloques para un producto en `bloquesDeDato(producto, campos, contexto)`), precio (`frasePrecio` + la fila), carrito («Aquí está <nombre> para agregarlo al carrito.» + bloque productos de ese sku), «¿y el segundo?» con `ultimosCampos`, o solo la fila. Escribe `enfoque` (y `ultimosCampos` si hubo dato); no toca `busqueda` ni `mostrados`.
  - Memoria: toda respuesta con bloque `productos` escribe `mostrados` con sus skus; búsqueda nueva, categoría y marca borran `enfoque`, `ultimosCampos` y `pendiente`; tema, recomendación e inicio devuelven `ESTADO_INICIAL` (con `turno`); `ultimaConsulta` de un seguimiento es la consulta combinada `[visible, ...describirAcote].join(" · ")`.
  - Las frases de presentación (`fraseResultados`) van como primer bloque `texto` en las respuestas exactas con productos (búsqueda, categoría, marca); no en aproximada, cercana ni parcial.
- Registro: un seguimiento registra `busqueda` con la consulta combinada; una referencia con dato registra `busqueda` con el código; la charla no registra.
- Errores: sin catálogo, seguimiento y referencia responden `sinCatalogo`; un sku de `mostrados` que ya no está en `contexto.productos` no es referencia (el texto sigue como búsqueda).
- `responderAcote` (los botones) pasa a usar `responderSeguimiento` con `[{ tipo: "acote", acote }]`, para que botón y texto respondan igual.
- `numeroSuelto` para `detectarIntencion`: el motor lo deriva de la búsqueda guardada (`medidasDe` con ≥1 valor → `"medida"`; si no, `canalesDe` → `"canales"`; si no, `null`).

- [ ] **Step 1: Tests que fallan** (fixture de `motor.test.ts`; donde haga falta, un fixture más grande con medidas, marcas y precios distintos dentro del mismo archivo)

```ts
test("conversación: subwoofers → 12 → solo Memphis → más baratos → precio del primero → agrégalo", () => { … cada paso afirma el texto del cambio, los skus y el estado … });
test("sub 12 → y de 10?: la medida del texto pasa a acote", () => { … });
test("un cambio que deja cero no toca la memoria", () => { … estado.busqueda igual antes y después … }); // Review Focus 4
test("un tema en medio borra la memoria", () => { … después, «y de 10?» es búsqueda nueva … });
test("más: del 6 al 10, y «ya te mostré» al final", () => { … });
test("13 que no existe: los más cercanos de la lista", () => { … texto «Ninguno es de 13"…» … });
test("referencia sin a qué referirse sigue como búsqueda", () => { … });
test("la frase de presentación rota con el turno", () => { … dos búsquedas seguidas, dos frases distintas … });
test("«Hablar con Sonoro» tras un seguimiento lleva la consulta combinada", () => { … «subwoofer · 10" · Memphis» … });
```

  Cada `…` es la conversación concreta con `responder` encadenado sobre `r.estado`; afirmar textos exactos de la spec.

- [ ] **Step 2:** fallan. **Step 3:** implementar. **Step 4:** `npm test` en verde.
- [ ] **Step 5: Commit** `feat(chat): seguimientos y referencias en el motor`.

---

### Task 8: Motor: charla y preguntas cuando es vago

**Files:**
- Modify: `lib/chat/motor.ts`, `lib/chat/respuestas.ts`
- Test: `lib/chat/motor.test.ts`

**Interfaces:**
- Consumes: `detectarCharla`, `TEXTOS_CHARLA`, `TEXTO_QUE_MAS`, `preguntaVaga`, `TEXTO_TIPO_EQUIPO` (Task 3).
- Produces:
  - Charla: un bloque `texto` con la respuesta; «quién eres» suma `opcionesHablar()`; grosería suma `bloquesDeInicio()` sin su primer texto; confirmación con `pendiente` repite la pregunta y el bloque acotar de la búsqueda guardada; adiós devuelve `ESTADO_INICIAL`; las demás no tocan el Estado (salvo `turno`). Evento: `null`.
  - Vago (`vago`): texto `TEXTO_TIPO_EQUIPO` + opciones de categorías (`categoria:<slug>`) + «Hablar con Sonoro»; `pendiente: "categoria"`.
  - `respuesta_pendiente`: con `busqueda` guardada, seguimiento con acote de categoría; sin ella, `responderCategoria`.
  - Búsqueda/categoría/marca exacta con **más de 20** resultados y sin medida ni canales en el texto: la frase de presentación es `preguntaVaga(total, pendiente)` y `pendiente` queda escrito (medida si `medidasDe` trae ≥2 valores, si no canales, si no categoría cuando hay ≥2 categorías). El bloque acotar pone ese grupo primero.

- [ ] **Step 1: Tests que fallan**

```ts
test("gracias en medio no borra la búsqueda", () => { // Review Focus 5
  const r1 = responder(ESTADO_INICIAL, texto("memphis"), CONTEXTO_GRANDE);
  const r2 = responder(r1.estado, texto("gracias"), CONTEXTO_GRANDE);
  assert.deepEqual(textos(r2.bloques), ["Con gusto. ¿Te ayudo con algo más?"]);
  assert.equal(responder(r2.estado, texto("y de 10?"), CONTEXTO_GRANDE).estado.busqueda?.acotes[0]?.campo, "medida");
});
test("¿eres un bot?: dice qué es y ofrece a una persona", () => { … texto exacto de la spec + opción hablar … });
test("adiós borra la memoria", () => { … });
test("grosería: respuesta neutra y menú, sin repetir la palabra", () => { … });
test("ok con pregunta pendiente repite la pregunta", () => { … });
test("bocinas con más de 20: pregunta la medida y «12» la contesta", () => { … «Hay N resultados. ¿Qué medida buscas?» y luego acote 12" … });
test("algo para mi carro: pregunta el tipo de equipo con categorías", () => { … });
```

- [ ] **Step 2:** fallan. **Step 3:** implementar. **Step 4:** `npm test` en verde.
- [ ] **Step 5: Commit** `feat(chat): charla y preguntas cuando la búsqueda es vaga`.

---

### Task 9: Conversaciones contra el catálogo real, e2e y documentación

**Files:**
- Create: `lib/chat/conversaciones.test.ts`
- Modify: `e2e/chat.spec.ts`, `CLAUDE.md` (§ Chatbot), `docs/superpowers/specs/2026-11-02-chatbot-design.md` (§ Fuera de alcance, la línea de memoria)

- [ ] **Step 1: `conversaciones.test.ts`** — con `tarjetasBuscables(await listAllProducts({ activo: true }))`, `listBrands()` y `crearContexto`, como `lib/busqueda/consultas.test.ts`. Cuatro conversaciones, afirmando cualidades (categoría, `pulgadas`, marca, orden de precio no decreciente), no skus:
  1. «subwoofers» → «12» → «solo memphis» → «más baratos» → «¿cuánto cuesta el primero?» → «agrégalo».
  2. «amplificador» → «de 4 canales» → «los disponibles» → «muéstrame más».
  3. «bocinas» → (pregunta de medida) → «6.5» → «y de rockford?».
  4. «sub 12» → «gracias» → «y de 10?» → «¿envían a Quetzaltenango?» → «y de 8?» (el último es búsqueda nueva).
- [ ] **Step 2:** `node --no-warnings --test lib/chat/conversaciones.test.ts` → pasa (si algo falla aquí, el error está en Tasks 5–8: corregir allá).
- [ ] **Step 3: e2e** — en `e2e/chat.spec.ts`, con `abrirChat` y `preguntar`: «subwoofers» → «12» → «¿cuánto cuesta el primero?» → afirmar el texto «… cuesta Q …» y que el botón «Agregar al carrito» de esa fila está visible.
- [ ] **Step 4:** `npx playwright test e2e/chat.spec.ts` → pasa.
- [ ] **Step 5: Docs.** `CLAUDE.md` § Chatbot: un bullet «**Conversa con memoria**» con la regla (siempre dice qué entendió; si el mensaje nombra otra cosa, es búsqueda nueva; un tema la borra, la charla no) y los módulos (`charla.ts`, `referencia.ts`, `seguimiento.ts`). En el spec viejo, la línea «Memoria de contexto entre mensajes…» se reemplaza por «Memoria de contexto entre mensajes: ver `2026-11-03-chat-conversacion-design.md`.».
- [ ] **Step 6:** `npm test`, `npx tsc --noEmit -p .`, `npx eslint lib/chat lib/busqueda components/chat` en verde.
- [ ] **Step 7: Commit** `test(chat): conversaciones contra el catálogo real y documentación`.

---

## Verificación final

- `npm test`, tipos, lint y e2e en verde.
- En el servidor de desarrollo con `NEXT_PUBLIC_CHAT_ENABLED=true`, la conversación 1 de Task 9 a mano, en el panel, en escritorio y a 375 px.
