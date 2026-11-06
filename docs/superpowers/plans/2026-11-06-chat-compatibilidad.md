# El chat contesta «¿qué le queda a mi carro?» — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El chat reconoce un carro escrito («corolla 2010»), pide con botones lo que falte y responde un resumen de qué receptores y bocinas caben y cómo, con un botón por grupo que muestra sus productos.

**Architecture:** Dos módulos puros nuevos en `lib/chat/` (leer el vehículo; armar los bloques) sobre las funciones del selector (`resolverSeleccion`, `compatibilidad`). El motor los prueba en lo que hoy sale como `recomendacion` o `busqueda`, y responde los botones `vehiculo:`. El panel baja `/buscar/vehiculos.json` junto con el catálogo del chat y lo pasa en el `Contexto`.

**Tech Stack:** TypeScript, Next.js 16.3 (app router), React 19, Tailwind 4 con tokens, `node --test` para unitarias, Playwright para e2e.

**Spec:** `docs/superpowers/specs/2026-11-06-chat-compatibilidad-design.md`

## Global Constraints

- Rama `feat/chat-compatibilidad` (sale de `feat/buscar-interfaz`). No se hace push sin que el usuario lo pida.
- Regla 2: nada ranquea ni recomienda; el orden es el de `compatibilidad()` (estado, luego `compararRelevancia`).
- Copy al cliente con tú; español de Guatemala. Sin emoji, sin hex a mano, sin degradados ni sombras.
- La frase de instalación sale de `INSTALACION` (`lib/politicas.ts`); no se reescribe.
- Los módulos de `lib/chat/` siguen sin React, sin DOM y sin leer variables de entorno.
- No se toca el Apps Script.
- Comandos: unitarias `node --test lib/chat/<archivo>.test.ts` (o `npm test` para todas), `npm run lint`, `npx tsc --noEmit`, e2e `npx playwright test e2e/chat.spec.ts`.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Texto con modelo y otra intención fuerte.** «¿instalan en un corolla 2010?» debe seguir siendo el tema instalación; «cuántos watts tiene el corolla» sigue siendo un dato (sin producto). Prueba en Task 4.
2. **Vehículos sin cargar mientras el catálogo sí cargó.** «corolla 2010» debe seguir como búsqueda normal; «qué le queda a mi carro» dice `ERROR_CARGA` con el enlace. Prueba en Task 4.
3. **Botón viejo** (`vehiculo:` con un modelo o una versión que el libro ya no trae) no rompe: vuelve a preguntar desde el primer nivel que falta. Prueba en Task 3.
4. **Separadores en el nombre**: «crv», «cr-v», «rav 4», «cx5» se leen como CR-V, RAV4 y CX-5; «4runner» como 4Runner, sin que el «4» se tome por año. Prueba en Task 2.
5. **Singular y plural** de las líneas («1 bocina, cabe.», «1 cabe con accesorios.»). Prueba en Task 3.

---

### Task 1: Tipos del chat y evento `vehiculo` en el registro

**Files:**
- Modify: `lib/chat/tipos.ts`
- Modify: `lib/chatLog/types.ts:38`
- Test: `lib/chatLog/decide.test.ts`

**Interfaces:**
- Produces (en `lib/chat/tipos.ts`):
  - `OpcionId` suma `` | `vehiculo:${string}` ``.
  - `Bloque` de tipo `"productos"` suma `notas?: Record<string, string>` (anotación por sku).
  - `EventoChat` suma `| { evento: "vehiculo"; consulta: string; resultados: number }`.
  - `export interface VehiculosChat { datos: DatosVehiculos; ambiguos: ReadonlySet<string> }` (los `ambiguos` son `modeloSlug`).
  - `Contexto` suma `vehiculos?: VehiculosChat | null` (ausente o `null` = no cargaron).

- [ ] **Step 1: Write the failing test** — en `lib/chatLog/decide.test.ts`, agregar a la lista de «eventos con pocos campos son válidos» `{ evento: "vehiculo", consulta: "Toyota Corolla 2010", resultados: 58 }`.
- [ ] **Step 2: Run** `node --test lib/chatLog/decide.test.ts` — Expected: FAIL en ese caso (enum).
- [ ] **Step 3: Implement** — sumar `"vehiculo"` al `z.enum` de `ChatLogRequestSchema`; los tipos de arriba en `tipos.ts` (importar `DatosVehiculos` como `import type` de `../vehiculos/types.ts`).
- [ ] **Step 4: Run** `node --test lib/chatLog/decide.test.ts && npx tsc --noEmit` — Expected: PASS, sin errores de tipos.
- [ ] **Step 5: Commit** `feat(chat): tipos y evento de compatibilidad por vehículo`

---

### Task 2: Leer el vehículo escrito (`lib/chat/vehiculo.ts`)

**Files:**
- Create: `lib/chat/vehiculo.ts`
- Test: `lib/chat/vehiculo.test.ts`

**Interfaces:**
- Consumes: `Vehiculo` (`lib/vehiculos/types.ts`), `Seleccion` (`lib/vehiculos/url.ts`), `normalizar`, `buscar`, `ProductoBuscable` (`lib/busqueda/busqueda.ts`), `compararRelevancia` (`lib/catalog/orden.ts`).
- Produces:
  - `leerVehiculo(texto: string, vehiculos: readonly Vehiculo[], ambiguos: ReadonlySet<string>, anioActual?: number): Seleccion | null` — `null` si no nombra ni marca ni modelo. Con modelo, `marca` es la de ese modelo. `anio` es el año ESCRITO (válido o no para el modelo); `resolverSeleccion` decide si existe.
  - `tieneFraseVehiculo(texto: string): boolean`
  - `nombresAmbiguos(vehiculos: readonly Vehiculo[], productos: readonly ProductoBuscable[]): Set<string>` — `modeloSlug` cuyo `modelo`, pasado a `buscar(productos, normalizar(modelo), compararRelevancia)`, da modo `"exacta"` con al menos un producto.
  - `interface Generacion { desde: number; hasta: number }`
  - `generaciones(vehiculos: readonly Vehiculo[], marcaSlug: string, modeloSlug: string): Generacion[]` — rangos distintos, de `desde` mayor a menor.
  - `etiquetaGeneracion(g: Generacion): string` — `"2003–2018"` (raya –, U+2013) o `"2018"` si `desde === hasta`.
  - `FRASES_VEHICULO: readonly string[]` = `["que le queda", "cual le queda", "que le cabe", "que cabe en"]` (normalizadas).

Reglas de lectura (spec § Cómo entiende el carro):
- Texto y nombres pasan por `clave(s) = normalizar(s).replace(/[^a-z0-9]+/g, " ").trim()`; se comparan por palabras enteras.
- Un modelo calza si su secuencia de palabras aparece en el texto, o si su forma compacta (sin espacios) es igual a una palabra del texto o a dos palabras seguidas unidas («crv», «rav 4» → `rav4`). Entre varios, gana el de más caracteres de clave.
- Un modelo en `ambiguos` solo calza si el texto trae también su marca o un año.
- Sin modelo, una marca (por `clave(marca)`) da `{ marca }`.
- Año: la primera palabra de cuatro dígitos entre 1940 y `anioActual + 1` (por defecto `new Date().getFullYear()`).
- Las frases se buscan como secuencia de palabras en `clave(texto)`.

- [ ] **Step 1: Write the failing tests** — con `data/vehiculos.json` real (`JSON.parse(readFileSync(...)).vehiculos`) y `ambiguos = new Set(["fit", "protege"])` (slugs; comprobar en el test que existen en los datos):
  - `leerVehiculo("corolla 2010")` → `{ marca: "toyota", modelo: "corolla", anio: 2010 }`
  - `"¿Qué le queda a mi Toyota Corolla 2010?"` → igual
  - `"civic si 2004"` → modelo `civic-si`; `"corolla im"` → `corolla-im`
  - `"crv 2010"`, `"CR-V 2010"` → modelo `cr-v`; `"rav 4"` → `rav4`; `"cx5"` → `cx-5`; `"4runner 2005"` → modelo `4runner`, anio 2005
  - `"fit"` → `null`; `"honda fit"` → modelo `fit`; `"fit 2010"` → modelo `fit`, anio 2010
  - `"protege 2001"` → modelo `protege`
  - `"toyota"` → `{ marca: "toyota" }`
  - `"hilux 2015"` → `null`
  - `"corolla 1980"` → `anio: 1980`; `"corolla 2099"` (fuera de rango) → sin `anio`
  - `tieneFraseVehiculo("¿qué le queda a mi carro?")` → true; `("radio para mi carro")` → false
  - `generaciones(datos, "toyota", "corolla")` empieza por `{ desde: 2003, hasta: 2018 }`; `etiquetaGeneracion({desde:2018,hasta:2018})` → `"2018"`
  - `nombresAmbiguos` con un `ProductoBuscable` de prueba cuyo nombre dice «Fit» incluye `"fit"` y no incluye `"corolla"`.
  (Los slugs exactos —`cr-v`, `cx-5`, `civic-si`, `corolla-im`, `protege`, `rav4`, `4runner`— se toman del archivo al escribir el test; si alguno difiere, se usa el del archivo.)
- [ ] **Step 2: Run** `node --test lib/chat/vehiculo.test.ts` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** las funciones de arriba en `lib/chat/vehiculo.ts`.
- [ ] **Step 4: Run** `node --test lib/chat/vehiculo.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(chat): leer el vehículo escrito`

---

### Task 3: Bloques de la respuesta (`lib/chat/respuestaVehiculo.ts` y textos)

**Files:**
- Create: `lib/chat/respuestaVehiculo.ts`
- Modify: `lib/vehiculos/textos.ts`
- Test: `lib/chat/respuestaVehiculo.test.ts`, `lib/vehiculos/textos.test.ts`

**Interfaces:**
- Consumes: Task 1 (tipos), Task 2 (`generaciones`, `etiquetaGeneracion`), `resolverSeleccion`, `escribirSeleccion`, `leerSeleccion`, `hrefVehiculo`, `hrefPestana` (`lib/busqueda/pestana.ts`), `compatibilidad`, `hayResultados`, `tituloGrupo`, `textoGrupoVacio`, `notaReceptor`, `SIN_RESULTADOS`, `ERROR_CARGA`, `INSTALACION`, `buildVehicleInquiryMessage` (`lib/whatsapp/message.ts`).
- Produces (en `respuestaVehiculo.ts`):
  - `type Ver = { tipo: "receptores" } | { tipo: "ubicacion"; indice: number }`
  - `interface PedidoVehiculo { sel: Seleccion; rango: boolean; ver: Ver | null }` — `rango`: el año salió de un botón de generación o se eligió solo.
  - `idOpcionVehiculo(pedido: PedidoVehiculo): OpcionId` — `` `vehiculo:${query}` `` con `escribirSeleccion(sel)` más `rango=1` y `ver=receptores|ubicacion-<n>` cuando aplican.
  - `leerOpcionVehiculo(id: string): PedidoVehiculo | null` — inversa; `null` si no empieza con `vehiculo:`.
  - `interface RespuestaVehiculo { bloques: Bloque[]; titulo: string | null; resultados: number | null }` — `titulo` del vehículo resuelto (o `null`); `resultados` solo en el resumen (receptores + bocinas de todos los grupos).
  - `responderVehiculo(pedido: PedidoVehiculo, datos: DatosVehiculos): RespuestaVehiculo`
  - `bloquesSinVehiculos(): Bloque[]` — `ERROR_CARGA` con enlace `{ etiqueta: "Buscar por vehículo", href: hrefPestana("vehiculo"), despues: "." }`.
- Produces (en `lib/vehiculos/textos.ts`), copy exacto:
  - `TEXTO_PEDIR_VEHICULO = "Escribe la marca, el modelo y el año de tu carro, por ejemplo «Toyota Corolla 2010»."`
  - `textoPedirModelo(marca)` → `` `¿Qué modelo de ${marca}?` ``
  - `textoPedirAnio(marca, modelo)` → `` `¿De qué año es tu ${marca} ${modelo}?` ``
  - `textoFueraDeLista(marca, modelo, anio)` → `` `No tengo el ${marca} ${modelo} ${anio} en la lista.` ``
  - `textoPedirVersion(titulo)` → `` `¿Cuál es tu ${titulo}?` ``
  - `NO_ESTA_VEHICULO = "¿No está tu vehículo?"`, `ETIQUETA_WHATSAPP_VEHICULO = "Escríbenos por WhatsApp"`, `VER_TODO_BUSCAR = "Ver todo en Buscar"`
  - `lineaReceptores(conteo: { cabe: number; conAccesorios: number }): string` — «Receptores: 4 caben y 6 caben con accesorios.»; con uno solo de los dos, solo ese («Receptores: 10 caben con accesorios.»); `1` → «1 cabe» / «1 cabe con accesorios».
  - `lineaConsultar(nombre)` → `` `${nombre}: también puede ir, pero su marco depende del vehículo; escríbenos por WhatsApp.` ``
  - `lineaUbicacion(grupo, cantidad, estado)` → `{ texto, enlace? }`: «Puertas delanteras · 6.5": 34 bocinas, caben.» / «…, caben con accesorios.» / con pieza: texto «…: 34 bocinas, caben con» y `enlace { etiqueta: pieza.nombre, href: "/producto/" + pieza.slug, despues: "." }`; `1` → «1 bocina, cabe…».
  - `tituloConRango(vehiculo, g: Generacion)` → «Toyota Corolla 2003–2018» (+ « · versión»).

Comportamiento de `responderVehiculo` (spec § Lo que falta y § El resumen), con `r = resolverSeleccion(datos.vehiculos, sel)`:
1. Sin `r.marca`: texto `TEXTO_PEDIR_VEHICULO` + opciones de `r.opciones.marcas` (etiqueta = nombre; id con `{ marca }`).
2. Sin `r.modelo`: `textoPedirModelo` + opciones de modelos.
3. Sin `r.anio`: si `sel.anio` venía (fuera de lista) → `textoFueraDeLista` + opciones de generación + `NO_ESTA_VEHICULO` y bloque `whatsapp` (`motivo: "hablar"`, `mensaje: buildVehicleInquiryMessage()`). Si no venía y hay una sola generación → recursión con `anio = desde`, `rango: true`. Si hay varias → `textoPedirAnio` + opciones de generación (`anio = desde`, `rango: true`).
4. Sin `r.vehiculo` (pide versión): `textoPedirVersion(título del año)` + opciones de `r.opciones.versiones`. El título del año es `${marca} ${modelo} ${anio}` o, con `rango`, el rango de la generación.
5. Con vehículo y `ver === null`: el resumen; con `ver`: el grupo. El título es `tituloVehiculo(v, anio)` o `tituloConRango` si `rango`.
   - Resumen: texto título; sin resultados → `SIN_RESULTADOS` + línea de WhatsApp. Con resultados: `lineaReceptores` (solo si hay receptores no `consultar`), una `lineaConsultar` por receptor `consultar`, `lineaUbicacion` o `textoGrupoVacio` por ubicación, texto `INSTALACION`, opciones (`"Receptores"` si hay receptores; `tituloGrupo(g)` por ubicación con bocinas), un bloque `{ tipo: "texto", texto: "", enlace: { etiqueta: VER_TODO_BUSCAR, href: hrefVehiculo(sel) } }`. `BloqueChat` hoy pone un espacio antes del enlace; con `texto` vacío no lo pone (cambio en Task 5).
   - Grupo: texto «Receptores · <título>» o «<tituloGrupo> · <título>»; bloque `productos` con los primeros `MAX_PRODUCTOS_CHAT` (5) skus en el orden de `compatibilidad()`, `total` = todos, `verTodosHref: hrefVehiculo(sel)`, `notas` con `notaReceptor(sku)` de los que la tengan; opciones con los DEMÁS grupos. Un `ver` que no existe (índice fuera) → el resumen.
   - `hrefVehiculo` recibe `sel` sin `ver` ni `rango`, con el `anio` resuelto.

`MAX_PRODUCTOS_CHAT` vive en `motor.ts`; para no crear un import circular, moverlo a `tipos.ts` y reexportarlo desde `motor.ts`.

- [ ] **Step 1: Write the failing tests**
  - `textos.test.ts`: cada función con 1 y con varios; `lineaReceptores({cabe:4,conAccesorios:6})` = «Receptores: 4 caben y 6 caben con accesorios.»; `lineaUbicacion` con pieza devuelve el enlace a `/producto/<slug>`.
  - `respuestaVehiculo.test.ts`, con un `DatosVehiculos` de prueba armado a mano (dos vehículos «Prueba Uno» 2008–2012 y 2013–2015, uno con versiones «A»/«B» en 2016; receptores 1-din y 2-din; un receptor `DMH-AP6650BT`; bocinas de 6.5"; ubicaciones con `KSM-8` (pieza presente), `otro`, `null` y una de `6x8"` sin bocinas):
    - `responderVehiculo({ sel: {}, … })` → primer bloque `TEXTO_PEDIR_VEHICULO`, opciones con la marca.
    - modelo sin año → opciones `["2013–2015", "2008–2012"]` con ids que llevan `rango=1`.
    - año 1980 → `textoFueraDeLista` y un bloque `whatsapp`.
    - 2016 → `textoPedirVersion` con opciones «A», «B».
    - 2010 → resumen: textos exactos en orden, opciones de grupo, enlace `VER_TODO_BUSCAR` a `/buscar?vehiculo=prueba&modelo=uno&anio=2010`, `resultados` = suma.
    - `ver: { tipo: "receptores" }` → bloque `productos` con `total` correcto, a lo sumo 5 skus, y `notas` para un receptor de `NOTAS_RECEPTOR` incluido en el fixture.
    - botón viejo: `sel: { marca: "prueba", modelo: "no-existe" }` → pide modelo.
    - `leerOpcionVehiculo(idOpcionVehiculo(p))` devuelve `p` (ida y vuelta) para un pedido con `ver` y `rango`.
  - Uno más con los datos reales (`armarDatosVehiculos(vehiculos.json, catalog.json)`): «corolla» 2010 → el primer bloque es «Toyota Corolla 2010» y el resumen incluye `INSTALACION`.
- [ ] **Step 2: Run** `node --test lib/chat/respuestaVehiculo.test.ts lib/vehiculos/textos.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** textos y `respuestaVehiculo.ts`; mover `MAX_PRODUCTOS_CHAT`.
- [ ] **Step 4: Run** lo mismo y `node --test lib/chat/motor.test.ts` — Expected: PASS (motor sigue verde con el movimiento).
- [ ] **Step 5: Commit** `feat(chat): resumen de lo que cabe en un vehículo`

---

### Task 4: El motor y la intención

**Files:**
- Modify: `lib/chat/intencion.ts` (lista `RECOMENDACION`)
- Modify: `lib/chat/motor.ts` (`responder`, `responderOpcion`, `necesitaCatalogo`)
- Test: `lib/chat/intencion.test.ts`, `lib/chat/motor.test.ts`

**Interfaces:**
- Consumes: Task 2 (`leerVehiculo`, `tieneFraseVehiculo`), Task 3 (`responderVehiculo`, `leerOpcionVehiculo`, `bloquesSinVehiculos`).
- Produces: el comportamiento; ninguna firma pública nueva.

Cambios:
- `RECOMENDACION` pierde `"que le queda"` y `"cual le queda"`.
- En `responder`, para las intenciones `recomendacion` y `busqueda`, antes de su respuesta de siempre: con `contexto.vehiculos`, `sel = leerVehiculo(texto, datos.vehiculos, ambiguos)`; si hay `sel`, o si no lo hay pero `tieneFraseVehiculo(texto)` (`sel = {}`), responde `responderVehiculo({ sel, rango: false, ver: null }, datos)`. Sin `contexto.vehiculos` y con frase → `bloquesSinVehiculos()`. En otro caso, lo de siempre.
- Una respuesta de vehículo: `estado = { ultimaConsulta: titulo ?? texto, ultimoTema: null }`; `evento = resultados !== null ? { evento: "vehiculo", consulta: titulo, resultados } : null`.
- `responderOpcion`: `vehiculo:` → `leerOpcionVehiculo`; sin `contexto.vehiculos` → `bloquesSinVehiculos()`. El estado conserva `ultimaConsulta` previa si no hay título.
- `necesitaCatalogo`: `true` también para opciones `vehiculo:` y para la intención `recomendacion`.

- [ ] **Step 1: Write the failing tests**
  - `intencion.test.ts`: el caso de la línea 67 («¿qué le queda a mi carro?») deja de esperar `recomendacion` y pasa a esperar `busqueda`; «cuál es mejor» sigue `recomendacion`.
  - `motor.test.ts`, con un `Contexto` que trae `vehiculos` (el fixture de Task 3 y `ambiguos` vacío) y el catálogo de prueba del archivo:
    - texto «qué le queda a mi prueba uno 2010» → bloques del resumen; `evento.evento === "vehiculo"`; `estado.ultimaConsulta === "Prueba Uno 2010"`.
    - «qué le queda a mi carro» → pide vehículo; sin evento.
    - flujo por botones: opción de modelo → generaciones → versión (2016) → resumen → grupo receptores, cada paso con `responder(estado, { tipo: "opcion", id }, ctx)`.
    - sin `vehiculos` en el contexto: «qué le queda a mi carro» → `ERROR_CARGA`; «prueba uno 2010» → respuesta de búsqueda (evento `busqueda` o `sin_resultados`).
    - «¿cuál es mejor?» → recomendación neutra; «radio para mi carro» → búsqueda; «¿instalan en un prueba uno 2010?» → tema `instalacion`.
    - `necesitaCatalogo`: `{ tipo: "opcion", id: "vehiculo:vehiculo=prueba" }` → true; texto «qué me recomiendan» → true; «envíos» → false.
- [ ] **Step 2: Run** `node --test lib/chat/intencion.test.ts lib/chat/motor.test.ts` — Expected: FAIL en los nuevos.
- [ ] **Step 3: Implement** los cambios de arriba.
- [ ] **Step 4: Run** `npm test` — Expected: PASS toda la suite.
- [ ] **Step 5: Commit** `feat(chat): el motor contesta qué le queda a un carro`

---

### Task 5: El panel baja los vehículos y muestra las notas

**Files:**
- Modify: `lib/chat/catalogo.ts` (cargador)
- Modify: `lib/chat/panel.ts` (`crearContexto`)
- Modify: `components/chat/LanzadorChat.tsx`, `components/chat/PanelChat.tsx`, `components/chat/PanelDiferido.test.ts` (props), `components/chat/BloqueChat.tsx`, `components/chat/ProductoChat.tsx`
- Test: `lib/chat/catalogo.test.ts`, `lib/chat/panel.test.ts`

**Interfaces:**
- Consumes: `descargarDatosVehiculos` (`lib/vehiculos/carga.ts`), `nombresAmbiguos` (Task 2), `VehiculosChat` (Task 1).
- Produces:
  - `crearCargador<T>(descargar: () => Promise<T | null>, plazoMs: number): () => Promise<T | null>` — la memoización y el plazo de hoy, sacados de `crearCargadorCatalogo`, que pasa a usarlo sin cambiar su firma.
  - `crearCargadorVehiculos(fetchImpl?: typeof fetch, plazoMs?: number): () => Promise<DatosVehiculos | null>` — `crearCargador(() => descargarDatosVehiculos(fetchImpl, plazoMs), plazoMs)`, con `PLAZO_DATOS_MS` por defecto.
  - `crearContexto(catalogo: CatalogoChat | null, vehiculos: DatosVehiculos | null, contacto)` — `vehiculos ? { datos: vehiculos, ambiguos } : null`, con `ambiguos = nombresAmbiguos(vehiculos.vehiculos, catalogo?.productos ?? [])` memoizado en un `WeakMap` por objeto `catalogo` (sin catálogo, conjunto vacío sin memo).
  - `PanelChat` recibe `cargarVehiculos: () => Promise<DatosVehiculos | null>`; `LanzadorChat` crea uno por carga de página, como el del catálogo, pero NO lo llama al abrir.
  - `BloqueChat`, bloque `texto`: con `texto === ""` no dibuja el espacio previo al enlace.
  - `ProductoChat` recibe `nota?: string`, dibujada bajo el nombre como `<p className="text-texto-secundario text-[13px] leading-snug">`; `BloqueChat` pasa `bloque.notas?.[producto.sku]`.

- [ ] **Step 1: Write the failing tests**
  - `catalogo.test.ts`: `crearCargadorVehiculos` con un `fetch` falso — dos llamadas comparten un fetch; un 500 da `null` y la siguiente reintenta (los mismos dos casos que ya tiene el cargador del catálogo, adaptados).
  - `panel.test.ts`: `crearContexto(catalogo, datos, {})` trae `vehiculos.datos === datos`; `crearContexto(catalogo, null, {})` trae `vehiculos: null`; dos llamadas con el mismo `catalogo` devuelven el mismo `ambiguos` (identidad).
- [ ] **Step 2: Run** `node --test lib/chat/catalogo.test.ts lib/chat/panel.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** los cargadores y `crearContexto`; en `PanelChat.enviar`, si `necesitaCatalogo(entrada)`, `preparar = Promise.all([cargarCatalogo(), cargarVehiculos()])`, y si no, `[catalogoRef.current, vehiculosRef.current]`; guardar en estado lo que cargue bien, como con el catálogo. Las props nuevas en `LanzadorChat`, `PanelDiferido.test.ts`, `BloqueChat` y `ProductoChat`.
- [ ] **Step 4: Run** `npm test && npm run lint && npx tsc --noEmit` — Expected: todo verde.
- [ ] **Step 5: Commit** `feat(chat): el panel baja los vehículos junto con el catálogo`

---

### Task 6: De punta a punta

**Files:**
- Modify: `e2e/chat.spec.ts`

**Interfaces:**
- Consumes: el fixture `PRUEBA` de `e2e/vehiculos.spec.ts` (copiar el vehículo, no importarlo: los specs no se importan entre sí) y `armarDatosVehiculos` con `data/catalog.json`.

- [ ] **Step 1: Write the test** «el chat contesta qué le queda a un carro»: `page.route("**/buscar/vehiculos.json", …)` con los datos de prueba; abrir el chat; escribir «¿qué le queda a mi prueba uno 2010?»; esperar el texto «Prueba Uno 2010», la línea de `INSTALACION` y el botón «Receptores»; tocarlo; esperar una fila de producto del primer receptor del grupo (por nombre) y el enlace «Ver los N resultados»; seguirlo y esperar la URL `/buscar?vehiculo=prueba&modelo=uno&anio=2010`.
- [ ] **Step 2: Run** `npx playwright test e2e/chat.spec.ts` — Expected: PASS el nuevo y los de antes. (Si falla porque el panel todavía no tiene el flujo, es un bug de Tasks 4–5: arreglarlo ahí.)
- [ ] **Step 3: Verify in the browser** con `preview_start sonoro-dev`: escribir «corolla 2010», «toyota», «elantra 2008» y «qué le queda a mi carro»; captura a 375 y 1280 px del resumen y de un grupo. Revisar que el enlace «Ver todo en Buscar» no deje un espacio al inicio de su línea.
- [ ] **Step 4: Commit** `test(chat): e2e de compatibilidad por vehículo`

---

### Task 7: Documentación

**Files:**
- Modify: `CLAUDE.md` (§ Chatbot, § Selector de vehículos)
- Modify: `docs/superpowers/specs/2026-11-02-chatbot-design.md` (§ Intención, tabla, fila 2)

- [ ] **Step 1:** § Chatbot, un punto nuevo: «Contesta qué le queda a un carro» — lee marca, modelo y año escritos (`lib/chat/vehiculo.ts`), pide con botones lo que falta (generación, versión), y resume con `compatibilidad()` de `/buscar` (`lib/chat/respuestaVehiculo.ts`); baja `/buscar/vehiculos.json` junto con su catálogo; los modelos que la búsqueda del chat encuentra como producto («Fit») piden marca o año; no ranquea.
- [ ] **Step 2:** § Selector: «No cambian el chat (no contesta compatibilidad)…» pasa a «No cambian la ficha de producto ni el nav. El chat sí contesta qué le queda a un carro (§ Chatbot), sobre los mismos datos y reglas.»
- [ ] **Step 3:** Spec del chat: quitar «qué le queda a mi carro» de los ejemplos de `recomendacion` y agregar una nota que apunte a `2026-11-06-chat-compatibilidad-design.md`.
- [ ] **Step 4: Run** `npx prettier --check CLAUDE.md docs/superpowers/specs/2026-11-02-chatbot-design.md` — Expected: sin cambios pendientes (o correr `--write`).
- [ ] **Step 5: Commit** `docs: el chat contesta compatibilidad por vehículo`
