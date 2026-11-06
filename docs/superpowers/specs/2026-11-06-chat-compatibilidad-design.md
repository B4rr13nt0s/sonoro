# El chat contesta «¿qué le queda a mi carro?» — diseño

Fecha: 6 de noviembre de 2026 · Estado: aprobado en conversación, pendiente de
revisión escrita.

Desde noviembre de 2026 las tarjetas del selector de vehículos de `/buscar` no
dicen si un producto cabe ni con qué pieza: eso se le pregunta al chat
(decisión del negocio). Este documento agrega al chat esa respuesta, sobre los
mismos datos y las mismas reglas del selector
(`2026-11-04-selector-vehiculos-design.md`). Extiende el diseño del chat
(`2026-11-02-chatbot-design.md`); lo que no se nombra acá no cambia.

---

## Qué se construye

El cliente escribe su carro («¿qué le queda a mi Corolla 2010?», «toyota
corolla 2010», «civic si 2004») y el chat responde con un resumen de lo que
cabe: receptores y, por cada ubicación de bocinas, cuántas hay y cómo caben.
Si falta algo para saber cuál es el carro, ofrece botones. Cada grupo del
resumen tiene un botón que muestra sus productos.

Es compatibilidad, no asesoría (regla 2): el chat dice qué cabe y cómo, con
los datos de la guía de marcos. No dice cuál conviene.

### Fuera de alcance

- Preguntas por UN producto («¿le queda el SQ12 a mi Civic?»).
- Recordar el carro entre conversaciones o entre recargas.
- El canal de WhatsApp (sigue pendiente).
- Vehículos que el libro no trae: se siguen cubriendo con «¿No está tu
  vehículo? Escríbenos por WhatsApp.».

---

## Datos

El chat usa el mismo `/buscar/vehiculos.json` del selector (`DatosVehiculos`,
`armarDatosVehiculos`). Medido el 5 de noviembre de 2026: 74 KB, **6 KB con
gzip**, 66 vehículos, 24 modelos, 9 marcas.

- Por lo poco que pesa, el panel lo baja **junto con** `/chat/catalogo.json`,
  en paralelo, cada vez que una entrada necesita el catálogo. No hace falta
  adivinar antes si la pregunta es de vehículo. Ninguno de los dos espera al
  otro: si los vehículos fallan, el catálogo sigue sirviendo.
- La descarga es `descargarDatosVehiculos` (`lib/vehiculos/carga.ts`), con su
  plazo de 8 s. El cargador del chat la envuelve con el mismo reintento que el
  del catálogo (`crearCargadorCatalogo`): un fallo da `null` y la siguiente
  pregunta vuelve a intentar.
- El botón del chat no carga nada más: la descarga sigue ocurriendo después
  del primer clic, dentro del panel.
- `necesitaCatalogo` pasa a ser verdadero también para la intención
  `recomendacion` (donde hoy caen «qué le queda…») y para los botones
  `vehiculo:…`.

---

## Cómo entiende el carro (`lib/chat/vehiculo.ts`)

Lógica pura con test: `leerVehiculo(texto, vehiculos, ambiguos)` sobre
`normalizar()` (sin acentos ni mayúsculas).

| # | Regla |
|---|---|
| 1 | **Modelo.** Un modelo de la lista, como palabras enteras, con o sin la marca. También sin sus separadores: «crv», «cx5» y «rav 4» son CR-V, CX-5 y RAV4. Si calzan dos, gana el más largo: «civic si» es Civic Si, «corolla im» es Corolla iM. |
| 2 | **Nombres ambiguos.** Un modelo cuyo nombre también aparece en el catálogo (nombre, descripción o ficha de un producto) solo cuenta con su marca o con un año. Hoy son «Fit» (1 producto) y «Protegé» (6: el verbo «protege»). El conjunto se calcula con los productos ya cargados (`nombresAmbiguos`), no se escribe a mano. |
| 3 | **Marca.** Una marca de la lista sin modelo cuenta como vehículo: el chat pide el modelo. Ninguna de las 9 aparece en el catálogo. |
| 4 | **Año.** El primer número de cuatro cifras entre 1940 y el año actual + 1. |
| 5 | **Frase de vehículo sin vehículo.** «qué le queda», «cuál le queda», «qué le cabe» y «qué cabe en», sin marca ni modelo: el chat pide el carro. Estas frases salen de la lista de recomendación (`RECOMENDACION`). |
| 6 | El resto del texto se ignora: «pantalla para corolla 2010» da el mismo resumen que «corolla 2010». |

**Cuándo se prueba.** El orden de `detectarIntencion` no cambia. El vehículo
se prueba solo sobre lo que hoy sale como `recomendacion` o `busqueda`. Así:

- «¿Instalan en un Corolla?» sigue siendo el tema instalación.
- «¿Cuántos watts tiene el MJP1244?» sigue siendo un dato.
- «¿Cuál es mejor?» sigue con la respuesta neutra de recomendación.
- «Radio para mi carro» sigue siendo una búsqueda de radios: «mi carro» no es
  una frase de vehículo.
- «Hilux» no está en la lista: sigue como búsqueda.

Si los vehículos no cargaron (`null`), un texto con frase de vehículo responde
«No se pudo cargar la lista de vehículos.» (`ERROR_CARGA`) y un enlace a
`/buscar?por=vehiculo`. Un texto sin frase sigue como hoy.

---

## Lo que falta: botones

| Lo que se sabe | Respuesta |
|---|---|
| Nada (frase de vehículo sola) | «Escribe la marca, el modelo y el año de tu carro, por ejemplo «Toyota Corolla 2010».» y las marcas como botones, en orden alfabético. |
| Marca | «¿Qué modelo de <marca>?» y sus modelos como botones. |
| Modelo sin año | «¿De qué año es tu <marca> <modelo>?» y un botón por **generación** del libro (rango `desde`–`hasta` distinto), de la más nueva a la más vieja: «2003–2018», «1998–2002»… Un rango de un solo año se escribe «2018». Si el modelo tiene una sola generación, no se pregunta. |
| Año fuera de la lista | «No tengo el <marca> <modelo> <año> en la lista.», los botones de generación y la línea de WhatsApp de abajo. |
| Año con varias versiones, o con una sola fila que trae versión | «¿Cuál es tu <título>?» y las versiones como botones («Con radio de fábrica», «Sin radio de fábrica»). Igual que en `/buscar`, la del Civic 2016–2018 «LX o Sport» se elige aunque sea la única (`resolverSeleccion`). |

La línea de WhatsApp es el texto de `/buscar`: «¿No está tu vehículo?
Escríbenos por WhatsApp.», con el bloque `whatsapp` (motivo `hablar`) y la
consulta del cliente en el mensaje.

**Los botones** son `OpcionId` `vehiculo:<consulta>`, donde `<consulta>` es la
dirección de `/buscar` sin el `?`: `escribirSeleccion(sel)` más, para mostrar
un grupo, `&ver=receptores` o `&ver=ubicacion-<n>` (índice de la ubicación en
el vehículo). Un botón de generación lleva `anio=<desde>`. Se leen con
`leerSeleccion` y se resuelven con `resolverSeleccion`. Un botón que quedó
viejo (el libro cambió) se queda en el primer nivel que ya no existe y vuelve a
preguntar desde ahí.

**El título** del vehículo es `tituloVehiculo` con el año escrito; si el año
salió de un botón de generación o se eligió solo, va el rango: «Toyota Corolla
2003–2018», «Honda Civic 2016–2018 · LX o Sport».

---

## El resumen

Con el vehículo resuelto, `compatibilidad(vehiculo, datos)` —la misma de
`/buscar`— y una respuesta de bloques de texto, uno por línea. Ejemplo real,
Corolla 2010:

```
Toyota Corolla 2010
Receptores: 10 caben con accesorios.
Pantalla de 9" DMH-AP6650BT: también puede ir, pero su marco depende del vehículo; escríbenos por WhatsApp.
Puertas delanteras · 6.5": 34 bocinas, caben con accesorios.
Bandeja trasera · 6x9": 14 bocinas, caben con accesorios.
<INSTALACION>
[Receptores] [Puertas delanteras · 6.5"] [Bandeja trasera · 6x9"]
Ver todo en Buscar → /buscar?vehiculo=toyota&modelo=corolla&anio=2010
```

**Receptores**, en una línea, contados por estado (cabe primero):

- «Receptores: 10 caben.», «Receptores: 1 cabe con accesorios.».
- Con dos estados: «Receptores: 4 caben y 6 caben con accesorios.».
- Sin receptores, la línea no va (como en `/buscar`, que omite la sección).
- Cada receptor `consultar` (hoy solo la DMH-AP6650BT) va en su propia línea:
  «<nombre>: también puede ir, pero su marco depende del vehículo;
  escríbenos por WhatsApp.». Cuenta en el total, no en la línea de estados.

**Bocinas**, una línea por ubicación, con `tituloGrupo`. Todas las bocinas de
una ubicación caben igual (el accesorio es de la ubicación), así que el estado
va en la línea:

- «…: 34 bocinas, caben.» / «…: 1 bocina, cabe.»
- «…: 34 bocinas, caben con accesorios.»
- «…: 34 bocinas, caben con <nombre de la pieza>.» («caben con Alza para
  bocinas de 6.5"»), con el nombre como enlace a la ficha de la pieza
  (`enlace` del bloque de texto, `despues: "."`). Sin artículo: los nombres
  del catálogo mezclan singular y plural («Adaptadores de bocina…»).
- Sin bocinas de esa medida: `textoGrupoVacio` («No hay bocinas de 6x8" en el
  catálogo.»), sin botón.

Después: la frase de `INSTALACION` (`lib/politicas.ts`), un botón por grupo con
productos («Receptores» y `tituloGrupo` de cada ubicación) y «Ver todo en
Buscar» con `hrefVehiculo(sel)`.

Si nada cabe: «No hay receptores ni bocinas que quepan en este vehículo.»
(`SIN_RESULTADOS`) y la línea de WhatsApp.

**Al tocar un grupo:** su título («Receptores · Toyota Corolla 2010»,
«Puertas delanteras · 6.5" · Toyota Corolla 2010»), un bloque `productos` con
los primeros 5 (`MAX_PRODUCTOS_CHAT`) en el orden de `compatibilidad()` y «Ver
los N» hacia `hrefVehiculo(sel)`, y los botones de los demás grupos. La fila de
un receptor con anotación (`notaReceptor`, hoy la DMH-A5650BT) la muestra
debajo: el bloque `productos` suma `notas?: Record<sku, string>`. Las filas no
repiten el estado: ya lo dijo el resumen.

**Estado de la conversación:** una respuesta de vehículo olvida la búsqueda
acotable (`Estado.busqueda = null`, como cualquier otra respuesta) y deja en
`ultimaConsulta` el título del vehículo, para el mensaje de «Hablar con
Sonoro».

**Registro:** el resumen emite `{ evento: "vehiculo", consulta: <título>,
resultados: <receptores + bocinas> }`. Los botones de grupo no emiten nada.
`ChatLogRequestSchema` (`lib/chatLog/types.ts`) suma `vehiculo` a su enum. El
Apps Script **no** cambia: escribe cualquier evento en sus columnas (Evento,
Consulta, Resultados).

---

## Código

Nuevo, puro y con test:

- `lib/chat/vehiculo.ts`: `leerVehiculo`, `nombresAmbiguos`, las frases de
  vehículo y las generaciones de un modelo.
- `lib/chat/respuestaVehiculo.ts`: los bloques de la pregunta que falta, del
  resumen y de un grupo. Los textos que dependen de los datos van con los del
  selector en `lib/vehiculos/textos.ts`.

Cambia:

- `lib/chat/tipos.ts`: `OpcionId` suma `` `vehiculo:${string}` ``; `Contexto`
  suma `vehiculos?: { datos: DatosVehiculos; ambiguos: ReadonlySet<string> } |
  null`; el bloque `productos` suma `notas`; `EventoChat` suma `vehiculo`.
- `lib/chat/intencion.ts`: las frases de vehículo salen de `RECOMENDACION`.
- `lib/chat/motor.ts`: prueba el vehículo en `recomendacion` y `busqueda`,
  responde los botones `vehiculo:` y amplía `necesitaCatalogo`.
- `lib/chat/panel.ts` y `components/chat/PanelChat.tsx`: el cargador de
  vehículos, el contexto con `nombresAmbiguos` calculado una vez, y las `notas`
  en la fila del producto.
- `lib/chatLog/types.ts`: el evento nuevo.

---

## Pruebas

- **`vehiculo.test.ts`:** «corolla 2010», «Toyota Corolla 2010», «civic si
  2004» (Civic Si), «crv 2010», «fit» solo (no es vehículo), «honda fit» (sí),
  «protege 2001» (sí, por el año), «toyota» (pide modelo), «qué le queda a mi
  carro» (pide todo), «hilux» (no es vehículo), «Corolla 1980» (año fuera).
  Con los datos reales de `data/vehiculos.json` y el catálogo real para los
  ambiguos.
- **`respuestaVehiculo.test.ts`:** el resumen del Corolla 2010 contra los datos
  reales, línea por línea; un vehículo de prueba con una pieza nombrada
  (enlace), una ubicación vacía, receptores en dos estados y nada que quepa;
  el grupo con `notas`.
- **`motor.test.ts`:** el flujo por botones del Elantra (generación →
  versión → resumen → grupo); un botón viejo; vehículos sin cargar; «¿cuál es
  mejor?» sigue neutra; «radio para mi carro» sigue siendo búsqueda; «¿instalan
  en un Corolla?» sigue siendo el tema; `necesitaCatalogo` en los casos nuevos.
- **`lib/chatLog`:** el esquema acepta `vehiculo` con consulta y resultados.
- **`e2e/chat.spec.ts`:** escribir «¿qué le queda a mi corolla 2010?», ver el
  resumen, tocar «Receptores», ver las filas y seguir «Ver los N» hasta
  `/buscar?vehiculo=toyota&modelo=corolla&anio=2010`. Los datos se sirven con
  `page.route`, como en `e2e/vehiculos.spec.ts`.

## Documentación

- CLAUDE.md, § Chatbot: el punto de compatibilidad (qué entiende, que usa
  `/buscar/vehiculos.json` y las reglas del selector, sin ranquear).
- CLAUDE.md, § Selector de vehículos: «No cambian el chat (no contesta
  compatibilidad)» pasa a decir que el chat contesta qué le queda a un carro.
- La spec del chat (`2026-11-02-chatbot-design.md`), § Intención: «qué le queda
  a mi carro» deja de ser un ejemplo de recomendación y apunta a este
  documento.
