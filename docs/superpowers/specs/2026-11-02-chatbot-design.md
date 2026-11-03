# Chatbot de Sonoro — diseño

Fecha: 2 de noviembre de 2026 · Estado: aprobado en conversación, pendiente de revisión escrita

Es la «Fase 8» que `docs/PLAN.md` dejó prevista (Anexo B). Este documento la
concreta y reemplaza lo que el Anexo B decía sobre motor y RAG: **no hay LLM**.

---

## Qué se construye

Un widget **«Preguntar»** en sonoro.gt que:

1. **Busca productos** con lo que escribe el cliente y responde con datos del
   catálogo: nombre, marca, código, precio, cuota, disponibilidad y «Agregar al
   carrito».
2. **Responde dudas de políticas** (envíos, garantía, instalación, cuotas,
   cómo pedir) solo con textos ya confirmados.
3. **Pasa a una persona** por WhatsApp y ofrece **consultar disponibilidad**
   de lo que no aparece.
4. **Registra de forma anónima** qué se pregunta y qué no se encuentra.

**No asesora (regla 2 de CLAUDE.md).** Muestra datos y el cliente decide. Un
pedido de criterio («¿cuál es mejor?») recibe una respuesta neutra.

**Sin LLM.** Es guiado y por reglas, sobre la misma búsqueda de `/buscar`
(`buscar()`, `interpretar()`, `sugerir()`). No tiene costo variable y no
puede inventar un dato. Entiende lo mismo que `/buscar`, no más: su valor
está en reunir búsqueda, dudas y paso a persona en un solo lugar, y en el
registro.

**Web primero, WhatsApp después.** El motor no conoce el canal. El bot de
WhatsApp (webhook, cuenta de Meta, plantillas) **queda fuera de este spec**,
pero los tipos ya lo contemplan (ver § Canal WhatsApp).

### Fuera de alcance

- El bot de WhatsApp en sí.
- Memoria de contexto entre mensajes («¿y más barato?» no refina la búsqueda
  anterior): sin LLM, adivinar a qué se refiere sería decidir por el cliente.
- Persistir la conversación entre recargas.
- Cualquier respuesta sobre lo que está en «Decisiones abiertas» de CLAUDE.md
  (plazo de garantía, qué es una instalación compleja, precios de
  instalación, horarios, plazos de entrega).

---

## Arquitectura

```
lib/politicas.ts          Textos confirmados de políticas. Única fuente: la leen
                          app/legal/*, lib/seo/llms.ts y el bot.
lib/busqueda/             busqueda.ts, busqueda.test.ts y sinonimos.ts MOVIDOS desde
                          components/catalog/, sin cambios de lógica. Importan desde
                          aquí SearchExperience.tsx y app/buscar/page.tsx.
lib/catalog/buscables.ts  tarjetasBuscables(): el mapeo producto → ProductoBuscable
                          que hoy vive en línea en app/buscar/page.tsx. Lo usan
                          /buscar y el catálogo del chat: los dos bajan lo mismo.
lib/whatsapp/message.ts   + buildAvailabilityInquiryMessage(consulta) y
                          buildChatHandoffMessage(…). El primero sale del texto
                          que hoy está en línea en SinResultadosBusqueda.tsx.

lib/chat/                 EL MOTOR. Puro: sin React, sin DOM, sin canal, sin I/O.
  tipos.ts                Entrada, Bloque, Estado, Contexto, EventoChat
  intencion.ts            texto → intención (tema | recomendacion | saludo | busqueda)
  respuestas.ts           tema → Bloque[] desde lib/politicas.ts
  motor.ts                responder(estado, entrada, contexto)
                            → { estado, bloques, evento }
  enmascarar.ts           oculta tiras de 7+ dígitos antes de registrar

app/chat/catalogo.json/route.ts
                          GET estático (prerenderizado en el build): { productos:
                          ProductoBuscable[], marcas: { nombre, slug }[] }.

lib/chatLog/              Esquema zod con topes, decide/forward (patrón de lib/quoteLog/)
app/api/chat-log/route.ts POST abierto, siempre 204, reenvía en after()

components/chat/
  LanzadorChat.tsx        Componente cliente mínimo que va en el layout: el botón
                          «Preguntar». Al primer clic hace import() del panel.
  PanelChat.tsx           Dialog: cabecera, historial, campo. Llama a responder().
  BloqueChat.tsx          Dibuja cada tipo de Bloque.
  ProductoChat.tsx        Fila de producto (miniatura, datos, «Agregar al carrito»).

app/layout.tsx            <LanzadorChat /> solo si NEXT_PUBLIC_CHAT_ENABLED === "true".
```

### Contratos del motor (`lib/chat/tipos.ts`)

```ts
type Entrada =
  | { tipo: "texto"; texto: string }
  | { tipo: "opcion"; id: OpcionId };

type OpcionId =
  | "buscar" | "envios" | "garantia" | "instalacion" | "cuotas" | "como_pedir"
  | "contacto"                      // por texto; no está en el menú de inicio
  | "hablar"                        // pasar a una persona
  | `categoria:${string}`           // slug de categoría del sitio
  | `marca:${string}`;              // slug de marca

type Bloque =
  | { tipo: "texto"; texto: string; enlace?: { etiqueta: string; href: string } }
  | { tipo: "filtros"; aplicados: string[]; correccion: string | null;
      modo: ModoBusqueda }          // los mismos avisos de /buscar
  | { tipo: "productos"; skus: string[]; total: number; verTodosHref: string }
  | { tipo: "opciones"; opciones: { id: OpcionId; etiqueta: string }[] }
  | { tipo: "whatsapp"; etiqueta: string; mensaje: string;
      motivo: "hablar" | "disponibilidad" };

interface Estado {
  ultimaConsulta: string | null;    // para el mensaje de «Hablar con Sonoro»
  ultimoTema: OpcionId | null;
}

interface Contexto {
  productos: readonly ProductoBuscable[] | null;   // null = catálogo no cargó
  marcas: readonly { nombre: string; slug: string }[];
  // Las BUSINESS_* son variables de servidor: el layout las lee y las pasa.
  contacto: { telefono?: string; correo?: string; direccion?: string };
}

type EventoChat =
  | { evento: "busqueda"; consulta: string; modo: ModoBusqueda; resultados: number }
  | { evento: "sin_resultados"; consulta: string }
  | { evento: "tema"; tema: OpcionId }
  | { evento: "recomendacion"; consulta: string }
  | { evento: "agregar"; sku: string }              // lo emite el panel, no el motor
  | { evento: "whatsapp"; motivo: "hablar" | "disponibilidad" };
```

- **El bloque `productos` lleva skus, no productos.** El panel los resuelve
  contra el catálogo que ya tiene en memoria, y el canal WhatsApp contra
  `lib/catalog/`. El motor nunca escribe un precio: lo formatea quien dibuja,
  con `formatQ`.
- **El contexto se inyecta.** El motor no importa `catalog.json` ni lee
  variables de entorno, así que se prueba con `node --test` sobre fixtures.
  La regla «todo pasa por `lib/catalog/`» se cumple porque el catálogo del
  chat sale de `tarjetasBuscables()`.
- `responder()` es determinista: la misma entrada da los mismos bloques.

### Flujo en la web

1. Al cargar cualquier página (menos `/carrito`) se dibuja solo el botón.
2. Primer clic: `import()` de `PanelChat` y `fetch("/chat/catalogo.json")` en
   paralelo. El panel abre de inmediato con el saludo y el menú (no necesita el
   catálogo).
3. Cada envío pasa por `responder()`, se agregan los bloques y el `evento` va a
   `/api/chat-log` con `fetch(…, { keepalive: true })`, sin esperar respuesta.
4. La conversación vive en estado de React dentro del layout, que no se
   desmonta al navegar: se conserva entre páginas y se pierde al recargar. No
   se guarda en `localStorage`.

### Canal WhatsApp (diseño previsto, no se construye)

Un webhook llamaría a `responder()` en el servidor, con `productos` desde
`lib/catalog/` + `tarjetasBuscables()`. La traducción sería así:
- `opciones` → botones o lista interactiva.
- `productos` → texto con nombre, código, precio y enlace a la ficha.
- `filtros` → una línea de texto.
- `whatsapp` → no aplica, porque ya está en WhatsApp: pasa a «una persona te
  responde por aquí».

«Agregar al carrito» se vuelve enlace a la ficha, porque el carrito vive en
el navegador. Los tipos de arriba no cambian para eso.

---

## Conversación

### Al abrir

Todo el texto del bot le habla al cliente de **tú**, como el resto del sitio
(«Agregas», «Puedes», «lo que llevas»).

Saludo: «Busca un producto por nombre, marca, código o medida, o elige un
tema.» Le siguen las opciones *Buscar un producto · Envíos · Garantía ·
Instalación · Pagos en cuotas · Cómo pedir · Hablar con Sonoro*. El campo de
texto está siempre disponible.

*Buscar un producto* no busca nada: enfoca el campo y deja como placeholder
«Ej.: sub 12" 2 ohm menos de Q 3,000».

### Intención (`intencion.ts`)

Son reglas a mano, en orden; gana la primera que coincide. El vocabulario
vive en el mismo archivo, como `sinonimos.ts`, y se compara sobre
`normalizar()` (sin acentos ni mayúsculas).

| # | Si el texto… | Intención | Ejemplos |
|---|---|---|---|
| 1 | es un saludo o agradecimiento, solo | `saludo` | «hola», «buenas», «gracias» |
| 2 | pide criterio | `recomendacion` | «qué me recomiendan», «cuál es mejor», «cuál me conviene», «qué le queda a mi carro» |
| 3 | nombra un tema de política | `tema:<id>` | envío/envían/entregan/flete → `envios`; garantía/se arruinó/defecto → `garantia`; instalan/instalación/colocan → `instalacion`; cuotas/financiamiento/visacuotas → `cuotas`; cómo compro/cómo pido/cómo pago/pagar en línea → `como_pedir`; dónde están/ubicados → contacto (ver abajo). Más las palabras ambiguas de abajo, que solo ganan si van solas |
| 4 | cualquier otra cosa | `busqueda` | «sub 12 2 ohm», «tienen memphis?», «cuánto cuesta el SQ12» |

Si un texto nombra un tema y un producto a la vez («¿el SQ12 trae
garantía?»), gana el tema: la garantía no cambia por producto. **Salvo las
palabras ambiguas** (`TEMAS_AMBIGUOS`): *teléfono, correo, dirección,
tarjeta, pagos*, que también son palabras corrientes de una pregunta por un
producto («radio con carplay para el teléfono», «tarjeta de sonido»). Las
demás palabras de tema son *fuertes* y ganan siempre. Una palabra ambigua gana
cuando el texto no trae más contenido que ella («teléfono», «¿cuál es su
correo?», «aceptan tarjeta»; los saludos, arranques, artículos y palabras de
relleno como «cuál es su» no cuentan). Si trae más, el motor prueba la
búsqueda —primero con el texto entero y luego sin la palabra del tema, porque
«teléfono» no está en la ficha de un radio— y, **solo si da resultados en modo
exacto**, responde con los productos y deja el tema como botón extra («Ver
contacto», «Ver pagos en cuotas») junto a *Hablar con Sonoro*, para que no se
pierda en silencio. Con resultados aproximados o parciales, sin resultados o
con el catálogo sin cargar, se responde el tema como siempre. Por eso esa
entrada sí espera al catálogo (`necesitaCatalogo`). En `busqueda`
se quitan antes los arranques conversacionales («tienen», «hay», «venden»,
«cuánto cuesta», «precio de», «busco», «quiero») y lo que queda va a
`buscar()`. Si no queda nada, se trata como saludo.

### Respuestas de tema (todas desde `lib/politicas.ts`)

- **Envíos:**
  - «Envío gratis en pedidos mayores a Q 500.00; debajo, el envío es por
    cobrar.»
  - «Aplican restricciones según destino y volumen del pedido.»
  - «El tiempo de entrega varía según el departamento.»
  - Enlace a `/legal/terminos`.
  - El monto sale de `UMBRAL_ENVIO_GRATIS_CENTS` con `formatQ`, nunca escrito
    a mano. *Decisión de esta conversación:* el bot sí nombra el mínimo
    porque responde una pregunta directa; el pie, la portada y `llms.txt`
    siguen sin nombrarlo.
- **Garantía:**
  - Únicamente por desperfecto de fábrica.
  - Se pierde si hay evidencia de mal uso o de una instalación incorrecta
    hecha fuera de Sonoro.
  - **Sin plazo.** Enlace a `/legal/garantias`.
- **Instalación:**
  - Cada producto incluye la instalación básica.
  - Una instalación más compleja tiene costo adicional.
  - Al cerrar el pedido se informa cuál requiere lo que llevas.
  - Sin precios, tiempos ni agenda.
- **Cuotas:** «Hasta 6 pagos precio contado.» Las condiciones se acuerdan al
  confirmar el pedido por WhatsApp (mismo texto que `/legal/terminos`).
- **Cómo pedir:**
  - El párrafo «Cómo funciona un pedido» de `/legal/terminos` («Agregas
    productos al carrito, revisas el resumen en /carrito y presionas «Pedir
    por WhatsApp»…»).
  - No hay pago en línea.
  - Prohibido decir «pagar», «comprar ahora» o «finalizar compra»
    (regla 3).
- **Contacto:** dirección, teléfono y correo desde las variables `BUSINESS_*`
  (las mismas de `/nosotros`), que llegan por `Contexto.contacto`. El campo
  que falta no se muestra.
  El chat solo trae calle y localidad, así que, cuando muestra la dirección,
  le sigue la línea «La dirección completa está en <Nosotros>» con enlace a
  `/nosotros`. Sin dirección no se agrega.
- **Lo no definido** (horarios, plazos, qué cuenta como instalación compleja):
  «Eso te lo confirma Sonoro directamente.» + `whatsapp` (hablar).

Cada respuesta de tema cierra con las opciones *Buscar un producto* y *Hablar
con Sonoro*.

### Recomendación

«No recomendamos equipo: te mostramos los datos para que compares.» Le
siguen opciones de categoría (las ocho del nav) y *Hablar con Sonoro*. Nada
de «te ayudamos a escoger» ni de «nuestros expertos».

### Búsqueda

- `buscar(consulta, productos)` y, del resultado:
  - Un bloque `filtros` si hubo `aplicados`, `correccion` o el modo no es
    exacto. Usa los mismos textos que `/buscar`: «Quizá quisiste decir…»,
    «Filtros de tu búsqueda: …», «estos coinciden con alguna palabra».
  - Un bloque `productos` con los **5 primeros**, en el orden de `buscar()`
    (puntaje, desempate de `orden.ts`).
  - «Ver los N resultados» → `/buscar?q=<consulta>` (el mismo builder de URL
    de `SearchExperience`).
- **Fila de producto** (`ProductoChat.tsx`):
  - Miniatura de 56 px con `ProductImage` (placeholder si `imagenes: []`).
  - Etiqueta mono «MARCA · CÓDIGO», nombre en 14px/600.
  - Precio con `formatQ` y la línea «o Q X al mes × 6» (`Math.ceil`, la misma
    función que la ficha).
  - `PildoraDisponibilidad`: como en la ficha, solo «bajo pedido» y
    «agotado» llevan píldora; lo disponible no lleva nada.
  - «Agregar al carrito» es `AddToCartButton` en tamaño compacto: lo agotado
    sale gris, deshabilitado y con el texto «Agotado». Al agregar, el bot
    suma una línea con el texto de la ficha, «Has añadido 1 ítem al
    carrito.», y un enlace «Ver carrito».
  - El nombre enlaza a `/producto/[slug]`.
  - *Decisión de esta conversación:* el chat **sí** muestra precio y cuota,
    aunque las tarjetas de los listados no los muestren.
- **Sin resultados:**
  - «No encontramos productos para "…".»
  - Opciones de categorías o marcas cercanas (`sugerir()`).
  - `whatsapp` con `buildAvailabilityInquiryMessage(consulta)`, el mismo texto
    de `SinResultadosBusqueda`.
- **Catálogo no cargado** (`productos === null`): «No pudimos cargar el
  catálogo.» Le siguen un enlace a `/buscar` y *Hablar con Sonoro*. Los temas
  siguen funcionando.

### Hablar con Sonoro

Abre `wa.me` (`buildWhatsAppUrl`, `NEXT_PUBLIC_WHATSAPP_NUMBER`) con
`buildChatHandoffMessage`:
- Hay consulta → «Hola Sonoro, tengo una consulta: <última consulta>».
- Solo hay tema → «Hola Sonoro, tengo una consulta sobre <tema>».
- No hay nada → «Hola Sonoro, tengo una consulta».

---

## Interfaz

Sin diseño en el handoff; es adaptación con tokens existentes (maqueta
aprobada en la conversación). Sin sombras, degradados, emoji ni color de
acento.

- **Lanzador:**
  - Botón `bg-negro text-white rounded-full`. En reposo es un círculo de
    44 × 44 px (mínimo táctil) con solo el ícono de burbuja de trazo (el SVG,
    nunca un emoji). Con el puntero encima (`hover:`, que en Tailwind 4 solo
    aplica en dispositivos que pueden hacer hover) o con el foco del teclado
    (`focus-visible`), se expande hacia la izquierda a la píldora de 14 px con
    el ícono y el texto «Preguntar», con una transición de ancho que
    `motion-reduce` desactiva. El texto está siempre en el DOM, colapsado a
    ancho 0 en reposo: es el nombre accesible. En táctil no se expande.
  - Fija abajo a la derecha: 24 px en `lg:`, 16 px debajo, más
    `env(safe-area-inset-bottom)`.
  - **No se dibuja en `/carrito`.** (`BarraComparador` hoy no está montada,
    así que no hay choque en `/comparar`. Si se repone, el lanzador tiene que
    subir por encima de la barra.)
  - Con el panel abierto en escritorio sigue visible y lo cierra.
- **Escritorio (`lg:`):**
  - Panel de 380 × 560 px sobre el lanzador: `bg-white`, `border-borde-tarjeta`,
    `rounded-card-lg`. La página detrás sigue usable.
  - Cabecera: «Sonoro» (600) + etiqueta mono «PREGUNTAS» + cerrar.
  - Cuerpo con scroll. Lo del cliente va a la derecha sobre `bg-fondo-alt`
    con radio de 14 px; lo del bot, a la izquierda y sin burbuja.
  - Abajo: campo `rounded-field` + botón negro «Enviar».
- **Móvil (< `lg`):** la hoja inferior de `FiltroMarca`/`OrdenSelector`
  (`rounded-t-card-lg`, fondo `bg-negro/40`), con `max-h-[90dvh]`.
- **Opciones:** las píldoras del sitio (`border-borde-pildora rounded-full`).
- **Accesibilidad:**
  - El panel es un `role="dialog"` con `aria-label="Preguntas"`.
  - Al abrir, el foco va al campo. Esc cierra y el foco vuelve al lanzador.
  - En móvil el foco queda atrapado en la hoja.
  - El historial es `aria-live="polite"` y anuncia solo las respuestas
    nuevas.
  - Todo se maneja con teclado.
  - Etiquetas mono en `texto-terciario`, que cumple 4.5:1.

---

## Registro (`/api/chat-log`)

- **Mismo patrón que `/api/quote-log`:**
  - Siempre 204.
  - Limitador por IP: instancia propia, 30 por minuto.
  - Tope de cuerpo: 4 KB.
  - Esquema zod con topes por campo; reenvío en `after()` a `QUOTE_LOG_URL`
    con `QUOTE_LOG_TOKEN` inyectado en el servidor.
  - Sin variables de entorno nuevas.
- **Cuerpo:** `{ tipo: "chat", conversacion, evento, consulta?, modo?,
  resultados?, tema?, sku?, motivo? }`.
  - `conversacion`: 8 caracteres al azar generados al abrir el panel, solo en
    memoria.
  - `consulta`: máx. 200, ya enmascarada.
  - `sku`: máx. 64.
- **Enmascarado (`enmascarar.ts`, en el navegador, antes de enviar):** toda
  tira de 7 o más dígitos (ignorando espacios y guiones entre ellos) se
  vuelve `•••••••`. «12», «3000» y «1,000 W» pasan intactos.
- **No se envía** IP, user agent ni identificador persistente.
- **Apps Script:** `docs/apps-script/quote-log.gs` gana una rama para
  `tipo === "chat"`, que escribe en la hoja «Chat» (fecha, conversación,
  evento, consulta, modo, resultados, tema, sku, motivo). Escribe como
  **texto** (`setNumberFormat("@")`), con la misma regla anti-fórmula del
  registro de cotizaciones, y verifica el token. Sin deduplicación: los
  eventos no tienen `ref`. **Hay que volver a pegar el script en el editor de
  Apps Script**; eso no se hace desde el repo.
- **`/legal/privacidad`:** un párrafo nuevo que dice que lo escrito en
  «Preguntar» se registra de forma anónima para saber qué se busca, que no se
  pide nombre ni teléfono y que los números de teléfono se ocultan antes de
  guardarse.

---

## Refactors que acompañan

1. **`lib/politicas.ts`:** las frases de envíos, garantía, instalación, cuotas
   y cómo pedir que hoy están en línea en `app/legal/terminos`,
   `app/legal/garantias`, `lib/seo/llms.ts`, `app/nosotros`, `app/page.tsx`,
   la ficha y `CarritoView`. Este spec mueve las que usa el bot y hace que
   `/legal/*` y `llms.ts` las lean; las demás pantallas pueden quedar para
   después, pero ninguna puede tener una versión distinta del mismo texto.
2. **`lib/busqueda/`:** mover sin tocar la lógica; el test se mueve con su
   archivo.
3. **`tarjetasBuscables()`:** sacar el mapeo de `app/buscar/page.tsx`.
4. **`buildAvailabilityInquiryMessage`:** sacar el texto de
   `SinResultadosBusqueda.tsx`.
5. **CLAUDE.md:** una sección corta «Chatbot» con la regla de no asesorar en
   el bot, el registro anónimo, la bandera y `/carrito` sin lanzador. También
   se actualiza la regla del Anexo B de `docs/PLAN.md`: sin LLM ni RAG.

---

## Errores

| Falla | Qué pasa |
|---|---|
| `catalogo.json` no carga | Los temas funcionan; la búsqueda responde «No pudimos cargar el catálogo» + `/buscar` + Hablar con Sonoro |
| `/api/chat-log` falla o limita | Nada visible: el envío no se espera ni se reintenta |
| Falta `NEXT_PUBLIC_WHATSAPP_NUMBER` | Lo que ya hace `buildWhatsAppUrl` |
| Falta `NEXT_PUBLIC_CHAT_ENABLED` o no es `"true"` | No se dibuja nada, ni el lanzador |
| Catálogo del chat más viejo que el deploy | El carrito lo corrige como siempre (`reconcile` + avisos) |
| Texto vacío o solo espacios | No se envía |

## Rendimiento

En el layout va solo `LanzadorChat`. El panel, el motor y `lib/busqueda` se
cargan con `import()` al primer clic, y el catálogo con `fetch`. Hay que
medir la portada con `lighthouserc.js` antes y después: el JS inicial no
puede crecer más que el lanzador.

## Pruebas

- **Unitarias (`node --test`):**
  - `lib/chat/intencion.test.ts`: cada tema, recomendación, saludo,
    tema + producto (gana el tema) y arranques conversacionales.
  - `lib/chat/motor.test.ts` (fixtures):
    - Los bloques de cada intención.
    - Sin resultados → `whatsapp` de disponibilidad.
    - Catálogo `null` → mensaje de falla.
    - El monto de envío sale de `UMBRAL_ENVIO_GRATIS_CENTS`.
    - Ningún bloque contiene «pagar», «comprar ahora», «finalizar compra»,
      «recomendamos» (fuera de «No recomendamos»), «expertos» ni «perfecto».
  - `lib/chat/enmascarar.test.ts`.
  - `lib/chatLog/*.test.ts`: esquema, topes y cuerpo máximo.
  - `lib/whatsapp/message.test.ts`: los dos mensajes nuevos.
  - `lib/chat/bandera.test.ts`: `chatHabilitado()` solo con `"true"` exacto.
    El e2e corre con la bandera encendida, así que el caso apagado se prueba
    acá.
- **E2E (`e2e/chat.spec.ts`, con la bandera encendida):**
  - Abrir → buscar → agregar al carrito → el contador del nav sube.
  - Pregunta de envíos → respuesta con «Q 500.00».
  - Lo agotado aparece deshabilitado.
  - `/carrito` sin lanzador.
  - Esc cierra y el foco vuelve al lanzador.
  - La hoja en viewport móvil.
- `npm run typecheck`, `npm run lint` y `npm test` en verde.
