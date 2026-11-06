# Chat de Sonoro: conversación con memoria — diseño

Fecha: 3 de noviembre de 2026 · Estado: aprobado en conversación, pendiente de revisión escrita

Amplía `2026-11-02-chatbot-design.md`. Lo que este documento no toca sigue como
está allá. Sigue sin LLM: todo son reglas a mano sobre la búsqueda de
`lib/busqueda/`.

---

## Qué cambia y por qué

Hoy el chat contesta cada mensaje por separado. Solo recuerda la última búsqueda
para los botones de acotar (`Estado.busqueda`). Quien escribe «subwoofers» y
después «y de 12?» empieza de cero: «de 12» se busca solo y trae productos de
cualquier categoría.

Con este cambio el chat **conversa**:

1. **Seguimientos de búsqueda.** Un mensaje corto que modifica la búsqueda
   anterior se aplica sobre ella: medida, canales, marca, precio, disponibilidad,
   orden, «más resultados» y «quitar filtros».
2. **Referencias a lo que mostró.** «el primero», «ese», «el segundo» apuntan a
   los productos de la última respuesta, para preguntar un dato, el precio o la
   disponibilidad, o para pedir el botón de «Agregar al carrito».
3. **Charla.** Agradecimientos, «¿cómo estás?», «¿eres un bot?», despedidas,
   groserías y confirmaciones sueltas («ok», «sí») tienen respuesta.
4. **Tono.** Los resultados se presentan con una frase («Encontré 28
   subwoofers.») en vez de solo bloques.
5. **Preguntar cuando es vago.** Una categoría con muchos resultados o un pedido
   sin producto («algo para mi carro») recibe una pregunta con botones.

El spec del 2 de noviembre dejaba la memoria fuera de alcance porque «adivinar a
qué se refiere sería decidir por el cliente». Este diseño la agrega con una
condición que resuelve eso: **el chat siempre dice qué entendió** («Cambié 12"
por 10".», «Ahora solo Memphis.») y un seguimiento nunca se aplica si el mensaje
nombra otro producto o categoría. Lo que no se entiende con certeza se trata
como búsqueda nueva, que es lo que pasa hoy.

**No asesora (regla 2).** Nada de lo nuevo elige por el cliente: los
seguimientos filtran u ordenan lo que el cliente pidió, las preguntas ofrecen los
valores que traen los resultados, y las frases no llevan «te recomendamos», «el
mejor» ni adjetivos de venta.

### Fuera de alcance

- Varias preguntas en un mensaje («¿cuánto cuesta el envío y tienen garantía?»).
- Marca, modelo o año del carro («radio para Corolla 2015»).
- Agregar al carrito sin que el cliente toque el botón.
- Recordar la conversación entre recargas (sigue en memoria, como hoy).
- El canal de WhatsApp.

---

## Arquitectura

```
lib/chat/tipos.ts         Estado gana campos (§ Memoria). Bloque y OpcionId no
                          cambian salvo lo indicado.
lib/chat/charla.ts        NUEVO. Vocabulario y respuestas de charla, y las frases
                          que presentan resultados. Sin dependencias del motor.
lib/chat/referencia.ts    NUEVO. Reconoce a qué producto mostrado se refiere un
                          texto («el primero», «ese», «el 3») y lo quita del texto.
lib/chat/seguimiento.ts   NUEVO. Reconoce si un texto modifica la búsqueda guardada
                          y lo traduce a cambios (acotes, orden, página, quitar).
lib/chat/intencion.ts     detectarIntencion recibe el Estado y suma las intenciones
                          nuevas, en el orden de § Intención.
lib/chat/datos.ts         + el campo «precio».
lib/chat/motor.ts         Responde las intenciones nuevas y escribe la memoria.
lib/busqueda/acotar.ts    + el acote «disponibilidad».
lib/chat/respuestas.ts    Textos nuevos (§ Textos).
```

Los tres módulos nuevos son lógica pura con test propio, como `acotar.ts`.
Ninguno lee el catálogo: reciben lo que necesitan del Estado o del Contexto.

---

## Memoria (`Estado`)

```ts
interface Estado {
  ultimaConsulta: string | null;   // ya existe: para «Hablar con Sonoro»
  ultimoTema: OpcionId | null;     // ya existe
  busqueda?: BusquedaAcotable | null;
  mostrados?: string[];            // skus de la última respuesta con productos, en orden
  enfoque?: string | null;         // sku del último producto del que se habló
  ultimosCampos?: Campo[];         // el último dato preguntado («potencia»)
  pendiente?: "medida" | "canales" | "categoria" | null; // la pregunta del bot sin contestar
}

interface BusquedaAcotable {
  base: …;                         // ya existe
  acotes: Acote[];                 // ya existe
  orden?: "precio_asc" | "precio_desc"; // NUEVO; sin él, el orden de relevancia
  pagina?: number;                 // NUEVO; 0 = los primeros 5
}
```

Reglas:

- **Una búsqueda nueva** (escrita, de categoría o de marca) reemplaza `busqueda`,
  `mostrados` y `pendiente`, y borra `enfoque` y `ultimosCampos`.
- **Un seguimiento** modifica `busqueda` y reemplaza `mostrados`.
- **Una referencia** no toca `busqueda` ni `mostrados`: escribe `enfoque` (y
  `ultimosCampos` si preguntó un dato).
- **Un tema, una recomendación o el inicio** borran todo lo nuevo. Así, después
  de hablar de envíos, «y de 10?» es una búsqueda nueva, no un seguimiento.
- **La charla** («gracias», «¿cómo estás?») no borra nada: se puede agradecer y
  seguir con la misma búsqueda.
- `ultimaConsulta` pasa a ser la búsqueda **combinada**, para que «Hablar con
  Sonoro» lleve lo que de verdad se estaba buscando: «subwoofer · 10" · Memphis».

---

## Intención

`detectarIntencion(texto, estado)` prueba en este orden y gana la primera que
coincide. Los pasos 1–4 y 8–9 son los de hoy; 0, 5, 6 y 7 son nuevos.

| # | Intención | Cuándo |
|---|---|---|
| 0 | `charla` | El texto entero es una frase de charla (§ Charla). Antes del saludo, porque «gracias» y «ok» hoy son saludo. |
| 1 | `saludo` | Igual que hoy, sin lo que pasó a charla. |
| 2 | `recomendacion` | Igual que hoy. |
| 3 | `tema` | Igual que hoy. |
| 4 | `respuesta_pendiente` | Hay `pendiente` y el texto contesta esa pregunta: un número solo («12», «12 pulgadas») para medida o canales, o el nombre de una categoría. |
| 5 | `referencia` | Hay `mostrados` y el texto nombra uno (§ Referencias). |
| 6 | `seguimiento` | Hay `busqueda` y el texto la modifica (§ Seguimientos). |
| 7 | `vago` | El texto no nombra producto, categoría, marca ni medida y pide equipo («algo para mi carro», «quiero mejorar el sonido»). |
| 8 | `dato` | Igual que hoy. |
| 9 | `busqueda` | Igual que hoy. |

Sin Estado (la primera vez, o tras un tema), 4–6 no aplican: el chat se
comporta como hoy.

---

## Seguimientos (`seguimiento.ts`)

`interpretarSeguimiento(texto, busqueda, contexto): Cambio[] | null`. `null`
quiere decir «no es un seguimiento».

### Cuándo es un seguimiento

Las dos condiciones a la vez:

1. **No nombra otra cosa.** Ninguna palabra del texto, después de quitar lo que
   es filtro, coincide con una categoría del sitio, un sinónimo de categoría
   (`SINONIMOS`), una palabra de producto del catálogo ni un código. «y
   bocinas?» nombra Bocinas: es una búsqueda nueva.
2. **Modifica algo.** El texto trae al menos uno de los cambios de la tabla, o
   empieza con un conector de seguimiento: «y», «solo», «sólo», «nada más»,
   «pero», «mejor», «ahora», «también», «entonces».

Un texto con conector pero sin cambio reconocible («y entonces?») no es
seguimiento: sigue al paso siguiente.

### Cambios

| Cambio | Se reconoce por | Efecto | Frase |
|---|---|---|---|
| medida | `N"`, «N pulgadas» o un número solo de 1 a 20 (en una búsqueda con medidas) | acote `medida` (reemplaza el anterior) | «Cambié 12" por 10".» / «Ahora de 10".» |
| canales | `N canales` | acote `canales` | «Ahora de 4 canales.» |
| marca | el nombre de una marca del catálogo, con o sin «marca» | acote `marca` | «Ahora solo Memphis.» |
| precio | «menos de», «hasta», «más de», «entre … y …» con un número (las reglas de `interpretar`) | acote `precio`, en centavos | «Ahora de menos de Q 2,000.00.» |
| disponibilidad | «disponibles», «en existencia», «los que haya», «que tengan» | acote `disponibilidad` = disponible | «Solo los disponibles.» |
| orden | «más baratos», «más económicos», «de menor a mayor» / «más caros», «de mayor a menor» | `orden` | «Ordené de menor a mayor precio.» / «…de mayor a menor…» |
| más resultados | «más», «otros», «siguientes», «muéstrame más», «hay más?» | `pagina + 1` | «Del 6 al 10 de 28.» |
| quitar | «quita los filtros», «sin filtros», «todos», «todas», «quita la marca» | borra todos los acotes, o los de ese campo | «Quité los filtros.» / «Quité la marca.» |

- «más» solo es «más resultados» si no forma parte de otro cambio: «más
  baratos» es orden y «más de 3000» es precio. Se reconocen primero.
- «nada más» es conector cuando sigue algo («nada más Memphis»); solo, es una
  despedida (§ Charla).
- Un mensaje puede traer varios cambios: «solo Memphis de 10» cambia marca y
  medida, y la frase los junta: «Ahora solo Memphis de 10".».
- **La medida de la búsqueda base.** Si la búsqueda guardada es de texto y trae
  una medida («sub 12»), un cambio de medida la saca del texto y la pasa a acote.
  Si no, «y de 10?» sobre «sub 12» buscaría «sub 12» y además 10", que no da
  nada.
- **Si el cambio deja cero productos**, no se aplica: «No hay Memphis de 15" en
  esta búsqueda.» y debajo los botones de acotar de la búsqueda sin ese cambio.
  La memoria queda como estaba.
- **«Más» sin más resultados:** «Ya te mostré los 11.»
- Todo cambio vuelve la página a 0, salvo «más».

### Respuesta

La misma forma que la de un botón de acotar (`responderAcote`): frase del
cambio, línea de filtros, productos (los 5 de la página), botones de acotar que
queden, «Hablar con Sonoro». «Ver los N» lleva a `/buscar` con lo mismo,
incluido el orden (`orden=precio_asc`) y la disponibilidad (`disp=disponible`).

`acotar.ts` suma el acote `{ campo: "disponibilidad" }`, que `aplicarAcotes`
filtra por `disponibilidad === "disponible"` y `hrefAcotado` escribe como
`disp=disponible`. No se ofrece como botón: solo entra por un seguimiento.

---

## Referencias (`referencia.ts`)

`encontrarReferencia(texto, estado): { sku: string; resto: string } | null`.
`resto` es el texto sin la referencia.

| Escrito | Producto |
|---|---|
| «el primero», «la primera», «el 1», «el número 1» | `mostrados[0]` |
| «el segundo» … «el quinto», «el 2» … «el 5» | el de esa posición |
| «el último», «la última» | el último de `mostrados` |
| «ese», «este», «esa», «esta», «eso», «lo», «-lo» (agrégalo, cómpralo) | `enfoque`; si no hay, el único de `mostrados` si se mostró uno solo |
| el código de un producto de `mostrados` | ese (ya funciona hoy por búsqueda; acá entra por referencia) |

Si la posición no existe («el sexto» con 5 mostrados) o «ese» no tiene a qué
referirse, **no es referencia**: el texto sigue al paso siguiente.

### Qué se hace con el producto

Con el `resto`:

| Resto | Respuesta | Ejemplo |
|---|---|---|
| un dato de `VOCABULARIO_DATOS` | el dato de ese producto, como hoy (`responderDato` con un solo producto) | «¿cuántos watts tiene el primero?» |
| precio: «cuánto cuesta», «precio», «cuánto vale», «cuánto sale» | «<nombre> cuesta Q 2,450.00, o Q 408.34 al mes × 6.» | «¿cuánto cuesta ese?» |
| carrito: «agrégalo», «agregar», «lo quiero», «me lo llevo», «me llevo», «cómpralo», «añadir» | «Aquí está <nombre> para agregarlo al carrito.» + la fila del producto con su botón | «me llevo el segundo» |
| nada más, o «y el segundo?» con `ultimosCampos` | el mismo dato de antes, del producto nuevo | «¿y el segundo?» |
| nada más y sin `ultimosCampos` | la fila del producto | «el tercero» |

El precio es un campo nuevo de `datos.ts` (`{ tipo: "precio" }`, palabras:
«precio», «cuesta», «vale», «sale», «cuánto cuesta»), que también responde
«¿cuánto cuesta el MJP1244?» sin referencia. El precio sale con `formatQ` y
`lineaCuota`, como en la ficha.

El botón de la fila es el `AddToCartButton` de siempre: el chat no agrega nada
solo. Lo agotado sale en gris, como hoy.

---

## Charla (`charla.ts`)

El texto entero, sin puntuación, normalizado, es una de estas frases (también
precedidas de un saludo: «hola, ¿cómo estás?»):

| Clase | Frases | Respuesta |
|---|---|---|
| gracias | «gracias», «muchas gracias», «mil gracias», «te agradezco», «gracias por la info» | «Con gusto. ¿Te ayudo con algo más?» |
| cómo estás | «cómo estás», «cómo está», «qué tal estás», «cómo te va» | «Bien, gracias. ¿Qué producto buscas?» |
| quién eres | «eres un bot», «eres una persona», «eres humano», «con quién hablo», «quién eres», «eres real» | «Soy el asistente automático de Sonoro: busco productos y respondo dudas de envíos, garantía y pagos.» + botón «Hablar con Sonoro» |
| adiós | «adiós», «bye», «chao», «hasta luego», «eso es todo», «nada más», «es todo» | «Gracias por escribir. Aquí estoy si necesitas algo más.» |
| confirmación | «ok», «okay», «sí», «si», «dale», «va», «listo», «perfecto», «entendido», «está bien» | si hay `pendiente`: repite la pregunta con sus botones; si no: «¿Qué más buscas?» |
| negación | «no», «no gracias», «ninguno» | «Está bien. Aquí estoy si necesitas algo más.» |
| grosería | una lista corta en `charla.ts` (no se repite acá) | «Estoy para ayudarte a buscar productos y resolver dudas de la tienda.» + el menú de inicio. No repite la palabra. |

- La charla no toca la memoria (§ Memoria), salvo «adiós», que la borra.
- «gracias» deja de ser saludo: hoy devuelve el menú de inicio, que no responde
  a un agradecimiento.
- Las respuestas van sin el menú de inicio, salvo la grosería: el chat no
  empuja temas a quien solo agradeció.

### Frases que presentan resultados

Una línea de texto antes de los productos, en toda respuesta con productos:

| Caso | Frase |
|---|---|
| búsqueda exacta, 1 resultado | «Encontré 1 resultado.» |
| búsqueda exacta, varios | «Encontré 28 resultados.» / «Estos son los 28 resultados.» (rota) |
| con acotes o seguimiento | la frase del cambio, y si no hay: «Quedan 11.» |
| aproximada, cercana o parcial | ninguna: ya la dice la línea de avisos |

- **Rotación sin azar:** la frase se elige con el número de mensajes de la
  conversación módulo la cantidad de variantes. Así un test sabe qué sale y dos
  mensajes seguidos no repiten frase.
- Se dice «resultados» y no el nombre de la categoría: «Encontré 28
  subwoofers» obligaría a pluralizar cada categoría y marca, y equivocarse con
  «28 insonorizacións» se ve peor que no decirlo.

---

## Preguntar cuando es vago

### Una categoría con muchos resultados

Si la búsqueda (escrita, de categoría o de marca) trae **más de 20 resultados**
y el texto no nombró medida ni canales, la frase de presentación es una
pregunta:

| Resultados | Frase | `pendiente` |
|---|---|---|
| con medidas (≥2 valores) | «Hay 118 resultados. ¿Qué medida buscas?» | `medida` |
| con canales (≥2 valores) | «Hay 59 resultados. ¿De cuántos canales?» | `canales` |
| mezclan categorías, sin lo anterior | «Hay 110 resultados. ¿Qué tipo de equipo buscas?» | `categoria` |

Debajo van los productos y los botones de acotar de siempre, con el grupo de la
pregunta primero. La respuesta escrita entra por `respuesta_pendiente`: «12» o
«de 12 pulgadas» acota a 12"; «subwoofers» acota a esa categoría. Un número que
no está entre los valores («13») acota con la búsqueda *cercana*: «Ninguno es de
13". Los más cercanos son de 12" y 15".».

### Un pedido sin producto (`vago`)

Frases que piden equipo sin decir cuál: «algo para mi carro», «quiero mejorar
el sonido», «quiero más bajo», «que suene más fuerte», «busco equipo», «quiero
armar mi sistema». Vocabulario a mano en `charla.ts`.

Respuesta: «¿Qué tipo de equipo buscas?» + las categorías del sitio como
botones + «Hablar con Sonoro». `pendiente: "categoria"`. No dice «no
recomendamos»: nadie pidió criterio.

«quiero más bajo» lleva la palabra «bajo», que es sinónimo de subwoofer: entra
por `vago` solo si la frase entera está en la lista. «bajo de 12» sigue siendo
una búsqueda.

---

## Textos nuevos (`respuestas.ts` y `charla.ts`)

Todos en español de Guatemala, sin emoji, sin «te recomendamos», sin adjetivos
de venta. Los de la tabla de Charla y los de la tabla de Cambios, más:

- «No hay <descripción> en esta búsqueda.» (un seguimiento que deja cero)
- «Ya te mostré los <N>.» («más» sin más)
- «Del <a> al <b> de <N>.» (página siguiente)
- «<nombre> cuesta <precio>, o <cuota>.» (precio)
- «Aquí está <nombre> para agregarlo al carrito.»
- «¿Qué tipo de equipo buscas?» / «¿Qué medida buscas?» / «¿De cuántos canales?»

---

## Registro

Sin eventos nuevos. Un seguimiento registra `busqueda` con la consulta
combinada («subwoofer · 10" · Memphis»). Una referencia con dato registra
`busqueda` con el código del producto. La charla no registra nada.

---

## Interfaz

- **Sin componentes nuevos.** Todo sale con los bloques que existen: texto,
  filtros, productos, acotar, opciones, whatsapp.
- `resumenDeMensaje` (lo que anuncia el lector de pantalla) incluye la frase de
  presentación.

---

## Errores

- Catálogo sin cargar: un seguimiento o una referencia responden como hoy sin
  catálogo (`sinCatalogo`).
- Un sku de `mostrados` que ya no está en el catálogo (otro deploy entre
  mensajes): la referencia no lo encuentra y el texto sigue como búsqueda.
- Estado viejo sin los campos nuevos: todos son opcionales, y ausentes valen
  «sin memoria».

---

## Pruebas

- **`charla.test.ts`, `referencia.test.ts`, `seguimiento.test.ts`:** cada frase de
  las tablas, y lo que NO debe entrar (una búsqueda nueva que empieza con «y», un
  «el sexto» que no existe, «bajo de 12»).
- **`intencion.test.ts`:** el orden de § Intención, con y sin Estado.
- **`motor.test.ts`:** conversaciones de varios mensajes sobre el fixture:
  - «subwoofers» → «12» → «solo Memphis» → «más baratos» → «¿cuánto cuesta el
    primero?» → «agrégalo».
  - «sub 12» → «y de 10?» (la medida del texto pasa a acote).
  - un seguimiento que deja cero no cambia la memoria.
  - un tema en medio borra la memoria.
  - «gracias» en medio no la borra.
- **`conversaciones.test.ts` (nuevo, catálogo real):** tres o cuatro
  conversaciones típicas, comprobando cualidades de lo que sale (categoría,
  medida, marca, orden), no skus fijos, como `consultas.test.ts`.
- **e2e (`e2e/chat.spec.ts`):** una conversación de punta a punta: búsqueda,
  seguimiento, referencia con precio y el botón de agregar.

---

## Documentación

- `CLAUDE.md` § Chatbot: un párrafo sobre la memoria y su regla («siempre dice
  qué entendió; si nombra otra cosa, es búsqueda nueva»).
- `2026-11-02-chatbot-design.md`: la línea de «Fuera de alcance» sobre memoria
  apunta a este documento.
