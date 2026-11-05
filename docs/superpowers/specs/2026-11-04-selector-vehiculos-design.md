# Selector de vehículos — diseño

Fecha: 4 de noviembre de 2026 · Estado: aprobado. Cambio del 4 de noviembre:
el selector vive en `/buscar`, no en una página propia (ver «Por qué en
`/buscar`»).

El cliente elige marca, modelo y año de su carro, y `/buscar` le muestra qué
receptores y bocinas del catálogo caben, directo o con accesorios. La idea viene
de «Outfit my car» de Crutchfield, en versión mucho más chica.

### Por qué en `/buscar`

La primera versión de esta spec le daba al selector su propia página,
`/vehiculos`, con un enlace en el nav. Al medir, el enlace no entró: a 1280 px,
«Vehículos» (56 px más los 22 px de separación) empujaba el grupo de la derecha
21 px dentro del margen de 48 px. El negocio decidió poner el selector en
`/buscar`, que ya se alcanza en un toque desde cualquier página y que, sin nada
escrito, solo mostraba «Escribe para buscar en el catálogo.». Buscar por
vehículo es otra forma de buscar.

---

## Qué es y qué no es

**Es información de compatibilidad, no asesoría (regla 2).** Que un receptor
quepa en el tablero de un Corolla 2010 es un dato de la guía del fabricante de
marcos, igual que la impedancia de un subwoofer. La página no dice cuál conviene,
no marca un «ganador» y no ordena por «mejor opción». El único orden propio es
por estado (cabe, cabe con una pieza, cabe con accesorios), que también es un
dato.

**Alcance de esta versión:** receptores y bocinas, solo para carro.

**Fuera de alcance:**

- Subwoofers y amplificadores.
- Los choques con ventilas, controles o la consola: no se toman en cuenta.
- El chat: no contesta preguntas de compatibilidad.
- La ficha de producto: no dice en qué vehículos cabe cada producto.
- Páginas indexables por vehículo: no hay página propia, y el canonical de
  `/buscar` no lleva parámetros.
- Combinar la búsqueda escrita con el vehículo («bocinas» para un Corolla): o se
  escribe, o se elige el vehículo.

---

## Decisiones tomadas

| # | Decisión |
|---|---|
| 1 | Solo se listan los vehículos que tienen datos. |
| 2 | Subwoofers fuera de esta versión: solo receptores y bocinas. |
| 3 | Un accesorio se nombra solo si es OEMBKT60, OEMBKT69 o KSM-8, y el nombre lleva enlace a su ficha. Cualquier otro accesorio es «accesorios», sin nombre. |
| 4 | Se ignoran los choques con ventilas y controles. |
| 5 | La DMH-AP6650BT y la DMH-ZS9350BT pasan al formato `especifico` en el libro del catálogo. |
| 6 | La DMH-AP6650BT sale en todos los vehículos con una nota: necesita un marco que depende del año, marca y modelo, y hay que contactar a Sonoro. |
| 7 | La DMH-ZS9350BT cabe donde la guía da una solución de 1 DIN o de 2 DIN. |
| 8 | Una bocina cabe solo en una ubicación de su misma medida. No hay equivalencias: 5x7" no es 6x8", 6.5" no es 6.75". Esto es entre bocinas y ubicaciones; al leer las fuentes del libro, el hueco que Crutchfield llama 6-3/4" y la guía y autofiles llaman 6.5" se anota como 6.5" (decisión del 5 de noviembre de 2026). |
| 9 | Los datos de vehículos viven en un libro de Google Sheets aparte, con su propio comando de importación. |
| 10 | El selector vive en `/buscar`, debajo del campo, cuando no hay nada escrito. No tiene página propia. |
| 11 | El nav no cambia: «Vehículos» no entró a 1280 px. |
| 12 | La frase de instalación nueva va al final de los resultados del selector y en los términos. |
| 13 | Se calcula en el navegador, como el resto de `/buscar`. El canonical sigue siendo `/buscar`, sin parámetros. |

---

## De dónde salen los datos

- **La guía de aplicación AAMP 2018** (PDF que trajo el negocio). Trae unas
  1,900–2,000 filas de 46 marcas, con años hasta 2018. Por cada vehículo da:
  - el kit de tablero para 1 DIN y para 2 DIN: `NR` es que cabe directo, un
    código de kit es que cabe con marco, y `NA` es que no hay solución;
  - el adaptador de bocina, que la guía da **por vehículo** y no por ubicación;
  - medida y ubicación de las bocinas delanteras y traseras.
- **El parque vehicular de la SAT** (archivo de octubre de 2026). Sirve para
  decidir qué vehículos se cargan primero.
  - **Los más comunes:** CR-V, RAV4, Corolla, Tacoma, Civic, Hilux, Yaris y 4Runner.
  - **Cerca del 84 %** de lo que no es moto es modelo 2018 o anterior, así que la
    guía cubre la mayor parte del parque aunque termine en 2018.
  - **Faltan en la guía:** Hilux, L200, Hiace, Mirage, D-Max, BT-50, K2700,
    Picanto, Bongo, Terracan, Mazda2, Fortuner y Amarok. Esos quedan sin datos
    hasta que el negocio los consiga.
- **La lectura de la guía es por OCR y tiene errores**, como «TWHGSO» por TWH950
  o «6xSE» por 6x9E. Por eso la primera carga entra entera sin revisar (ver
  `revisado`, abajo).

---

## 1. Datos

### El libro

Un Google Sheets aparte del catálogo. Se baja como `data/source/vehiculos.xlsx`,
que se versiona igual que `catalogo.xlsx`, y se importa con
`npm run import:vehiculos`.

**Hoja VEHICULOS**, una fila por vehículo y generación:

| Columna | Qué lleva | Obligatoria |
|---|---|---|
| `marca` | «Toyota» | sí |
| `modelo` | «Corolla» | sí |
| `version` | Vacía, o algo como «Tablero gris». Solo cuando esos años tienen más de un tablero de fábrica, o cuando la fila vale solo para algunos carros («LX o Sport»). | no (ver validaciones) |
| `desde`, `hasta` | Años, números enteros | sí |
| `radio_1din`, `radio_2din` | `directo`, `con marco`, `no cabe`, o vacía si no hay dato | no |
| `ubicacion_1` … `ubicacion_4` | Un valor de LISTAS: «Puertas delanteras» | no |
| `medida_1` … `medida_4` | `6.5"`, o varias separadas por ` / `: `5.25" / 6.5"` | con su ubicación |
| `accesorio_1` … `accesorio_4` | Vacío, `OEMBKT60`, `OEMBKT69`, `KSM-8` u `otro` | no |
| `revisado` | `sí` (también `si`) o `no`, sin distinguir mayúsculas | sí |

**Hoja LISTAS**, con dos columnas:

- `ubicacion` — los nombres en español de las ubicaciones de la leyenda de la
  guía (letras A–P; por ejemplo, E es la puerta inferior, J la bandeja trasera y
  A el tablero superior). Se escriben al armar la primera carga.
- `medida` — escrita exactamente como el campo `medida` de las bocinas del
  catálogo (`6.5"`, `6x9"`, `5x7"`, `5.25"`), porque la comparación es de texto
  exacto. Puede traer medidas que hoy no tiene ninguna bocina, como `6x8"`.

### El importador

`scripts/import-vehiculos.ts`, con la lógica en módulos de `scripts/vehiculos/`
(contrato, filas, validaciones), igual que `scripts/catalogo/`. Corre **después**
de `import:catalog`, porque valida contra el `data/catalog.json` que ese acaba de
escribir.

**Aborta sin escribir nada**, juntando todos los problemas, si:

- falta o sobra una hoja;
- falta o sobra una columna, o vienen en otro orden;
- **no queda ninguna fila publicable.** La primera carga entra entera con
  `revisado = no`. Sin esta regla, `/buscar` mostraría un selector sin
  vehículos. Mientras el negocio no marque las primeras filas con `sí`, el build
  no pasa.

**Rechaza la fila** (se anota en `reports/vehiculos-errores.md` y el build no
pasa) si:

- `desde` o `hasta` no es un entero entre 1940 y el año actual más uno, o
  `desde` es mayor que `hasta`;
- un valor de radio no es uno de los permitidos;
- una ubicación o una medida no está en LISTAS;
- hay una ubicación sin medida, o una medida o un accesorio sin ubicación;
- el accesorio no es uno de los permitidos, o es OEMBKT60, OEMBKT69 o KSM-8 y
  ese código no existe en `catalog.json`;
- la fila no tiene ningún dato: los dos radios vacíos y ninguna ubicación;
- dos filas de la misma marca y modelo se cruzan en años y alguna no trae
  versión, o las dos traen la misma (se rechazan las dos, juntas);
- dos grafías distintas de una marca, un modelo o una versión dan el mismo slug.

**Las filas con `revisado = no`** se validan igual, pero no se publican, y sus
problemas van a una sección aparte del reporte, «Filas sin revisar», **sin
frenar el build**. Así el borrador del OCR puede tener errores sin bloquear el
sitio, y quien lo revisa ve qué corregir antes de marcarla.

**Con filas rechazadas**, el reporte se escribe pero `data/vehiculos.json` queda
en la última importación buena, igual que `catalog.json`.

**Salida:** `data/vehiculos.json`, siempre en el mismo orden (marca, modelo,
versión y año inicial, comparados por puntos de código, no con `localeCompare`).
El `.xlsx` no se puede leer en un `git diff`; este archivo sí, y solo cambia
cuando cambian los datos.

```ts
VehiculosArchivo { schemaVersion: 1; vehiculos: Vehiculo[] }

Vehiculo {
  marca: string;        marcaSlug: string;     // «Toyota», «toyota»
  modelo: string;       modeloSlug: string;    // «Corolla», «corolla»
  version: string | null;  versionSlug: string | null;
  desde: number;  hasta: number;
  radio1din: "directo" | "con_marco" | "no_cabe" | null;
  radio2din: "directo" | "con_marco" | "no_cabe" | null;
  ubicaciones: {
    ubicacion: string;                 // «Puertas delanteras»
    medidas: string[];                 // ['5.25"', '6.5"']
    accesorio: "OEMBKT60" | "OEMBKT69" | "KSM-8" | "otro" | null;
  }[];
}
```

Los slugs se sacan como los de las marcas del catálogo: minúsculas, sin acentos
y con guiones.

### La primera carga

La arma Claude con lo que se leyó de la guía, para los vehículos más comunes
según la SAT. Todas las filas entran con `revisado = no`, para que ningún error
de lectura le llegue al cliente antes de que lo revise el negocio.

Como la guía da el adaptador por vehículo y no por ubicación, el borrador anota
`otro` en **todas** las ubicaciones del vehículo, salvo que la guía diga «solo
atrás». Ante la duda, la bocina sale «Cabe con accesorios» y no «Cabe».

### Las dos pantallas especiales

`lib/vehiculos/especiales.ts`, una tabla corta en el código:

- `DMH-ZS9350BT` → `"1-o-2-din"`
- `DMH-AP6650BT` → `"consultar"`

El selector las reconoce **por su código**, no por el formato, así que funciona
igual antes y después de que el negocio cambie el libro del catálogo.

### Lo que baja el navegador

`app/buscar/vehiculos.json/route.ts`, igual que `/chat/catalogo.json`: se genera
en el build (`force-static`), lleva `X-Robots-Tag: noindex` y no entra al sitemap
ni al `Disallow`. `/buscar` lo baja solo cuando no hay nada escrito, que es
cuando se ve el selector. Lo arma una función pura, `armarDatosVehiculos()` en
`lib/vehiculos/datos.ts`, con su prueba, a partir de lo que devuelve
`lib/catalog/` (nunca de `catalog.json` directo). Contiene:

- los vehículos publicados de `data/vehiculos.json`;
- los receptores y bocinas que pueden salir (ver «Qué productos entran», en la
  parte 2), con los campos de la tarjeta (`ProductoTarjeta`) más `formato` o
  `medida` de sus atributos;
- OEMBKT60, OEMBKT69 y KSM-8, si están activos y no agotados.

Un cambio en el catálogo aparece en la siguiente publicación sin volver a
importar vehículos. Una pieza que no viene en este archivo no se puede pedir, y
la regla de bocinas la trata así.

---

## 2. Reglas de compatibilidad

Una sola función pura, `lib/vehiculos/compatibilidad.ts`, sin React ni DOM y con
sus pruebas, como `lib/busqueda/`. Recibe un vehículo y los productos de
`datos.json`. Devuelve los receptores que caben y, por cada ubicación, las
bocinas que caben, cada producto con su estado.

### Qué productos entran

Este filtro lo aplica `armarDatosVehiculos()` al armar `datos.json`, así que lo
que no entra ni siquiera viaja al navegador:

- Receptores y bocinas activos cuyo `uso` incluye carro. Un producto sin `uso`
  cuenta como carro, igual que en `/buscar`. Hoy eso deja fuera 15 productos
  marinos o de motorsports.
- **Lo agotado no sale**, porque no se puede pedir. Hoy es solo el tweeter P1T-S.
  La disponibilidad es la del último deploy, como en el resto del sitio.
- **Lo bajo pedido sí sale.**

### Estados

| Estado | Texto |
|---|---|
| Cabe | «Cabe» |
| Con pieza | «Cabe con» y el nombre del accesorio en el catálogo, con enlace a su ficha: «Cabe con Alza para bocinas de 6.5"» |
| Con accesorios | «Cabe con accesorios» |
| Consultar | «Requiere un marco que depende del año, marca y modelo del vehículo. Contacta a Sonoro para más información.» |

### Receptores

- **1 DIN:** según `radio1din`. Con `directo`, «Cabe»; con `con_marco`, «Cabe
  con accesorios». Con `no_cabe` o sin dato, no sale.
- **2 DIN:** la misma regla, con `radio2din`.
- **DMH-ZS9350BT:** toma la mejor de las dos columnas (`directo` gana a
  `con_marco`). Si ninguna sirve, no sale.
- **DMH-AP6650BT:** sale en todos los vehículos, con «Consultar».
- **Cualquier otro de formato `especifico`** (PMX-3, PMX-HD9813, SMC3,
  MXA1MC) **o `flotante`**: no sale nunca. La guía no tiene columna para esos
  formatos.

### Bocinas

En cada ubicación salen las bocinas cuya `medida` es una de las medidas de esa
ubicación, por igualdad exacta de texto. El estado depende del accesorio de la
ubicación:

- **Vacío:** «Cabe».
- **OEMBKT60, OEMBKT69 o KSM-8:** «Cabe con» y el nombre de la pieza. Si la pieza
  no viene en los datos (está agotada o inactiva), baja a «Cabe con accesorios»,
  para no mandar al cliente a algo que no puede pedir.
- **`otro`:** «Cabe con accesorios».

Una misma bocina puede salir en más de una ubicación, por ejemplo adelante y
atrás si las dos son de 6.5".

### Orden

Por estado: Cabe, Con pieza, Con accesorios y Consultar. Dentro de cada estado,
`compararRelevancia` de `lib/catalog/orden.ts`, el mismo orden de los listados.

---

## 3. El selector en `/buscar`

### Dónde va

En `/buscar`, cuando no hay nada escrito: debajo del campo y de «Escribe para
buscar en el catálogo.». Si el cliente escribe algo, manda la búsqueda y el
selector se oculta; al borrar lo escrito, vuelve.

### Estado en la dirección

Como el resto de `/buscar`, el vehículo elegido vive en la dirección:
`/buscar?vehiculo=toyota&modelo=corolla&anio=2010`, más `&version=tablero-gris`
cuando hace falta. La marca del vehículo va en `vehiculo` y no en `marca`,
porque `/buscar` ya usa `marca` para filtrar por marca de producto.

- Cada cambio usa `replaceState`, así que «Atrás» sale de la página.
- Escribir una búsqueda borra el vehículo de la dirección, y elegir un vehículo
  la deja sin `q`: las dos cosas no van juntas.
- La página sigue prerenderizada, con el mismo `<Suspense>` de hoy. En el
  fallback, el selector sale vacío y deshabilitado.
- El canonical sigue siendo `/buscar`, sin parámetros.
- La lectura y escritura de la dirección es lógica pura en `lib/vehiculos/url.ts`.
  Un valor que no existe no rompe nada: el selector se queda en el primer nivel
  inválido, con lo anterior ya elegido.

### Carga

Cuando `/buscar` muestra el selector, se baja `/buscar/vehiculos.json`. Si falla,
el selector dice «No se pudo cargar la lista de vehículos.» con un botón
«Reintentar».

### Encabezado y selector

- El bloque abre con un `h2`, «Receptores y bocinas por vehículo», sin párrafo de
  introducción. El `h1` de la página sigue siendo el de `/buscar`.
- **Tres listas nativas: Marca, Modelo y Año.** Cada una se habilita al elegir la
  anterior. Los años van del más nuevo al más viejo.
- **«Versión»** aparece si ese año tiene más de una versión, o una sola fila que trae versión: esa no se elige sola, porque la versión dice para qué carros es (Civic 2016–2018 «LX o Sport»; decisión del 5 de noviembre de 2026).
- **Layout:** el de `/buscar`, con el mismo ancho, márgenes y rejilla. Las listas
  van apiladas a todo el ancho en móvil y en fila desde `sm`.
- Debajo del selector: «¿No está tu vehículo? Escríbenos por WhatsApp.» El
  enlace abre WhatsApp con «Hola Sonoro, quiero consultar qué receptores y
  bocinas caben en mi vehículo.»

### Resultados

Con el vehículo completo:

- **Título:** «Toyota Corolla 2010», y la versión si la tiene: «Toyota Corolla
  2010 · Tablero gris».
- **Receptores:** la `ProductCard` de siempre, en la misma rejilla de 1, 2, 4 y 6
  columnas.
  - Debajo de cada tarjeta, fuera de la tarjeta y de su enlace, va el estado en
    13 px gris, como la línea de especificación.
  - Si el estado nombra una pieza, el nombre es un enlace a su ficha.
  - La DMH-AP6650BT lleva su nota y «Escríbenos por WhatsApp».
- **Bocinas:** un grupo por ubicación, con sus medidas en el título: «Puertas
  delanteras · 6.5"», o «Puertas delanteras · 5.25" o 6.5"».
  - Si no hay bocinas de esa medida: «No hay bocinas de 6x8" en el catálogo.»
    Con varias medidas: «No hay bocinas de esas medidas en el catálogo.»
  - Se muestran todas, sin paginar. En 6.5" son unas 35.
- **Si no sale nada:** «No hay receptores ni bocinas que quepan en este
  vehículo.»
- **Al final:** la frase de instalación, la constante `INSTALACION` de
  `lib/politicas.ts`, en texto secundario.

### Mensajes de WhatsApp

Los arma `lib/whatsapp/message.ts`, como los demás, y se abren con
`buildWhatsAppUrl` y `NEXT_PUBLIC_WHATSAPP_NUMBER`.

- `buildVehicleInquiryMessage()`, para «¿No está tu vehículo?»: «Hola Sonoro,
  quiero consultar qué receptores y bocinas caben en mi vehículo.»
- `buildVehicleProductInquiryMessage({ nombre, sku, vehiculo, url })`, para la
  DMH-AP6650BT:

  ```
  Hola Sonoro, quiero consultar sobre:
  Pantalla de 9" DMH-AP6650BT (DMH-AP6650BT)
  Vehículo: Toyota Corolla 2010 · Tablero gris
  https://…/buscar?vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris
  ```

  La URL es la absoluta de `/buscar` con el vehículo, para que el vendedor vea lo
  mismo que el cliente.

---

## 4. Cambios en el resto del sitio

1. **Nav:** no cambia. Medido el 4 de noviembre: a 1280 px quedan 57 px libres
   en la barra, sin contar los 40 px de separación fija (los 97 de CLAUDE.md los
   incluyen), y un enlace más del largo de «Vehículos» ocupa 78.
2. **Instalación** (`lib/politicas.ts`): `INSTALACION` pasa a ser, palabra por
   palabra:

   > Incluye instalación básica. En caso de que la instalación requiera una
   > instalación más compleja, el uso de accesorios o componentes adicionales,
   > dichos artículos se cobrarán por aparte y la instalación tendrá un costo
   > adicional.

   La leen el párrafo «Instalación» de `/legal/terminos`, la respuesta de
   instalación del chat y el final de los resultados del selector. `/legal/garantias`,
   `/nosotros`, `TEXTOS_NOSOTROS` y `llms.txt` conservan su redacción.
3. **Las dos pantallas de 9":** el negocio cambia su formato a `especifico` en el
   libro del catálogo y se vuelve a importar. `labels.ts` no cambia.
   - En la ficha de las dos, «Formato» pasa de «Pantalla flotante» a «Específico
     por vehículo».
   - Una búsqueda de «pantalla flotante» deja de traerlas por ese dato.
4. **Textos** (`lib/seo/textos.ts`): `TEXTOS_BUSCAR` no cambia, y no hace falta
   un texto nuevo: no hay página nueva.
5. **`llms.txt`** (`lib/seo/llms.ts`): la línea de Buscar pasa a «búsqueda por
   nombre, marca o código, y qué receptores y bocinas caben en cada vehículo.»
6. **Sitemap:** no cambia. `/buscar/vehiculos.json` no entra.
7. **Build:** `"build": "npm run import:catalog && npm run import:vehiculos && next build"`.
8. **CLAUDE.md:**
   - § Rutas suma `/buscar/vehiculos.json`.
   - Una sección nueva, «Selector de vehículos», con el libro y su importador,
     las reglas de compatibilidad, las dos pantallas especiales, por qué vive en
     `/buscar` y por qué el estado está en la dirección.
   - La nota del nav suma la medición: un enlace más en el grupo de la derecha no
     entra a 1280 px.
   - La regla 1 apunta a `INSTALACION` como el único lugar de la frase.

**No cambian:** el nav, el chat, el pie, la portada (regla 10) y la ficha de
producto.

---

## 5. Pruebas

Lógica pura con `node --test`; la página con Playwright.

1. **Qué productos entran** (`lib/vehiculos/datos.test.ts`): lo agotado y lo
   inactivo no entran, lo bajo pedido sí. Lo que es solo marino o solo
   motorsports no entra; sin `uso`, cuenta como carro. Una pieza agotada o
   inactiva no viaja.
2. **Compatibilidad** (`lib/vehiculos/compatibilidad.test.ts`), con productos y
   vehículos armados a mano:
   - **Radios:**
     - 1 DIN y 2 DIN: `directo` da «Cabe», `con_marco` da «Cabe con
       accesorios», y `no_cabe` o vacío no sale.
     - La ZS9350BT toma la mejor columna y no sale si ninguna sirve.
     - La AP6650BT sale siempre con «Consultar».
     - Otro `especifico`, o un `flotante`, no sale nunca.
   - **Bocinas:**
     - Solo misma medida: 6.75" no entra en 6.5", ni 6x9" en 6".
     - Una ubicación con dos medidas trae las de ambas, y una bocina puede salir
       en dos ubicaciones.
     - Accesorio vacío da «Cabe». Una pieza nombrada da «Cabe con», y baja a «Cabe
       con accesorios» si la pieza falta en los datos. `otro` da «Cabe con
       accesorios».
   - **Orden:** por estado y, dentro, por relevancia.
3. **Importador** (`scripts/vehiculos/*.test.ts`):
   - **Aborta sin escribir nada:** por hoja o columna de más o de menos, y
     cuando no queda ninguna fila publicable.
   - **Rechaza la fila:** por cada motivo de la lista de la parte 1.
   - **Con filas rechazadas,** `vehiculos.json` no se toca.
   - **`revisado = no`:** no se publica, y sus problemas van a «Filas sin
     revisar» sin frenar el build.
   - **El orden de salida es determinista.**
4. **Contra el catálogo real** (como el test de logos de marcas): las dos
   pantallas de `especiales.ts` existen y son receptores, y OEMBKT60, OEMBKT69 y
   KSM-8 existen. Si alguien renombra uno, falla CI y no la página.
5. **WhatsApp** (`lib/whatsapp/message.test.ts`): los dos mensajes nuevos, con y
   sin versión.
6. **Dirección y selector** (`lib/vehiculos/url.test.ts`):
   - leer y escribir los cuatro parámetros;
   - un valor inexistente deja el selector en ese nivel con lo anterior
     elegido;
   - años del más nuevo al más viejo;
   - «Versión» con más de una, o con una sola fila que trae versión.
7. **Página** (`e2e/vehiculos.spec.ts`): la prueba reemplaza
   `/buscar/vehiculos.json` con `page.route` por datos de prueba, así no depende
   de qué filas haya revisado el negocio. Además de los casos de abajo, comprueba
   que escribir una búsqueda oculta el selector y saca el vehículo de la
   dirección.
   - **Caso completo:**
     - elegir marca, modelo y año;
     - comprobar la dirección, los resultados por sección y la frase de
       instalación;
     - recargar y ver que todo queda igual;
     - comprobar que el enlace de la pieza lleva a su ficha.
   - **Otro caso:** la descarga falla, y se comprueban «No se pudo cargar la
     lista de vehículos.» y «Reintentar».
8. **En el navegador** (no es automática, va en el plan): capturas de `/buscar`
   con un vehículo elegido, a 1280, 1024 y 375 px.

---

## Riesgos y pendientes

- **La calidad de los datos depende de la revisión.** El OCR tiene errores y la
  guía es de 2018. El sitio publica solo lo que el negocio marcó `sí`, y la
  página dice solo lo que está en el libro.
- **Vehículos sin datos:** los modelos que faltan en la guía (Hilux, L200, D-Max
  y los demás de la lista de arriba) no aparecen hasta que el negocio los
  agregue. La línea «¿No está tu vehículo?» cubre ese hueco.
- **El cambio de formato de las dos pantallas** lo hace el negocio en el libro
  del catálogo. El selector no depende de ese cambio.
