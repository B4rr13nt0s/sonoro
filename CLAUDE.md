# CLAUDE.md — Sonoro

Contexto permanente del proyecto. Léelo antes de tocar cualquier archivo.

Este documento **reemplaza** al `CLAUDE.md` que venía dentro del handoff de diseño. Es la única autoridad. Si algo en `design/` contradice este archivo, manda este archivo.

---

## Qué es Sonoro

Tienda en línea de equipo de audio para carro en Guatemala. **Vende producto, nada más.**

En esta etapa **no hay pago en línea.** El sitio es un catálogo con carrito; el pedido se cierra por WhatsApp. La estructura de datos está diseñada para que agregar pago en línea después sea sumar un módulo, no reescribir.

---

## Reglas que no se rompen

1. **Sonoro no instala. Nunca, bajo ningún concepto.** Prohibido todo copy que sugiera instalación, agenda, taller o servicio: «agenda tu instalación», «te lo instalamos», «nuestros técnicos».
2. **Sonoro no asesora ni recomienda.** Prohibido el copy de criterio experto sobre qué le queda al cliente: «te ayudamos a escoger», «el equipo perfecto para tu carro», «te armamos tu sistema», «nuestros expertos». El sitio presenta datos del producto; el cliente decide.
3. **No hay pago en línea.** No existe página de checkout, ni pasarela, ni campos de tarjeta, ni copy que diga «pagar», «comprar ahora» o «finalizar compra». El carrito termina en WhatsApp.
4. **Garantía:** únicamente por **desperfecto de fábrica**. Se pierde si hay evidencia de mal uso o de instalación incorrecta. No inventes plazos ni condiciones adicionales (ver Decisiones abiertas).
5. **Precios:** `Q 2,450.00`. Símbolo, espacio, coma de miles, **dos decimales siempre**. Sin excepciones. Siempre con IVA incluido.
6. **Financiamiento: máximo 6 pagos.** La línea bajo el precio es `o Q 408.34 al mes × 6`. La frase para condiciones es exactamente «Hasta 6 pagos precio contado.»
7. **Envíos:** «Envíos gratis a todo el país», siempre acompañado de «Aplican restricciones según destino y volumen del pedido».
8. **Las variantes no son selectores.** Un subwoofer 12" doble 2 Ω y uno 12" doble 4 Ω son **dos productos distintos**, con nombre y código propios. En la ficha, impedancia y tamaño se muestran como datos, no como opciones.
9. **Idioma:** español de Guatemala. Quetzales. Términos técnicos en su forma común (RMS, clase D, AWG, CarPlay).
10. **No agregues secciones, banners ni copy de relleno sin pedirlo.** Si una sección se ve vacía es un problema de layout, no falta de contenido.

---

## Modelo de conversión: carrito → WhatsApp

El usuario vive una experiencia de carrito completa. Lo único distinto de una tienda transaccional es el último paso.

**Flujo:** Agregar al carrito → `/carrito` con líneas, cantidades y totales → botón **«Pedir por WhatsApp»** → se abre `wa.me` con el mensaje ya redactado.

**Mensaje generado:**

```
Hola Sonoro, quiero pedir:

1x Serie SQ 12" D2 (SQ12-D2) — Q 2,450.00
2x Memphis PRX 6.5" (PRX60C) — Q 1,180.00 c/u

Subtotal: Q 4,810.00
Envío: gratis
Total: Q 4,810.00
Ref: SNR-A7K2M
```

**Reglas del carrito:**

- El botón dice **«Pedir por WhatsApp»**. Nunca «Proceder al pago», «Pagar» ni «Finalizar compra».
- El resumen conserva el diseño del handoff: subtotal, envío, total en 28px, cuota, botón negro a todo el ancho, condiciones en mono al final.
- **ID de pedido corto** (`SNR-XXXXX`) visible en pantalla y en el mensaje: vendedor y cliente hablan del mismo pedido.
- Si el carrito excede ~15 líneas, el mensaje envía el `Ref` y un enlace en vez de la lista completa.
- El número va en `NEXT_PUBLIC_WHATSAPP_NUMBER`. Nunca incrustado en el código.
- **El estado del carrito no conoce WhatsApp.** WhatsApp es un consumidor del carrito, igual que lo será el checkout en el futuro.

**Estructura del ítem** (diseñada como si ya hubiera pagos):

```ts
CartItem {
  sku            string
  qty            number
  unitPriceCents number        // snapshot al agregar
  currency       'GTQ'
  nombreSnapshot string
  imagenSnapshot string | null
  addedAt        ISO8601
}
Cart { schemaVersion: number; items: CartItem[]; createdAt; updatedAt }
```

Totales siempre calculados, nunca almacenados. `schemaVersion` en `localStorage`: si no coincide, migrar o descartar limpiamente. **Nunca crashear con un carrito viejo.**

---

## Datos

### Formato de precio

Una sola función `formatQ(cents: number): string` en `lib/format/`, usada por la UI, el mensaje de WhatsApp y las imágenes OG. Cero formateo inline.

- Salida: `Q 2,450.00` · `Q 89.50` · `Q 12,300.00` · `Q 0.00`
- El espacio es **espacio duro** (`\u00A0`). Con espacio normal el navegador rompe la línea entre la `Q` y la cifra.
- Implementar con `Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` y anteponer `'Q' + '\u00A0'` a mano. **No usar `style: 'currency'`**: la salida del símbolo varía entre versiones de ICU.
- Cuotas: `Math.ceil` al centavo. `Q 2,450.00 / 6 → Q 408.34`.

### Esquema de producto

```ts
sku                string   // canónico, inmutable. VISIBLE al cliente como «Código»
slug               string   // URL, INMUTABLE una vez publicado
nombre             string   // «Serie SQ 12" D2»
marca              string
categoria          string
descripcionCorta   string   // una línea, va bajo el título
specsDestacadas    Spec[]   // ORDENADAS, 3–4, junto al precio
specsFicha         Spec[]   // ORDENADAS, ficha técnica completa
precioCents        number   // ENTERO, centavos, IVA INCLUIDO
precioAntesCents   number?
moneda             'GTQ'
disponibilidad     'disponible' | 'bajo_pedido' | 'agotado'
imagenes           Imagen[] // puede estar vacío → placeholder
garantiaMeses      number?
destacado          boolean
activo             boolean
```

`Spec = { etiqueta: string; valor: string }` — **arreglo ordenado, no objeto.** El orden en que aparecen es decisión editorial y debe respetarse.

- **El `sku` es el código del fabricante tal como lo publica cada marca, sin normalizar** — no una convención propia de Sonoro. Se permiten mayúsculas, dígitos, y espacio, punto o guion como separadores internos (`ACX 165`, `MJP800.4`, `SQ12-D2`), nunca dobles ni al inicio o al final. Debe coincidir exactamente con el código de la factura del distribuidor, porque viaja tal cual al cliente como «Código» y en los mensajes de WhatsApp.
- **`destacado` tiene tres efectos concretos, y ninguno es «producto importante» en abstracto:** aparecer en `/productos`, aparecer en la sección **Destacados** de la portada, y ordenar primero en todos los listados (el orden «relevancia», ver § Rutas). Marcar un producto es decidir que salga adelante en esos tres lugares — no una nota editorial sin consecuencia.
- **Precios almacenados en centavos enteros.** Nunca `float`.
- **No guardar precio base sin IVA.** Si se necesita, se deriva.
- La ficha técnica cierra siempre con «Datos publicados por el fabricante.»

### Fuente de verdad

```
Google Sheets → export CSV → data/source/productos.csv  (versionado en Git)
                             content/productos/{sku}.mdx
                                    ↓ scripts/import-catalog.ts
                             data/catalog.json
```

Ningún componente lee `catalog.json` directamente. **Nunca.** Todo pasa por `lib/catalog/`, con firmas asíncronas y paginadas:

```ts
getProduct(slug: string): Promise<Product | null>
listProducts(filters: ProductFilters): Promise<{ items: Product[]; total: number }>
listBrands(): Promise<Brand[]>
```

El importador **aborta** si un `sku` parece fecha o notación científica, si un precio llega como texto, o si el contrato de encabezados no calza. Alerta si un `slug` ya publicado cambió.

### Mantenimiento del catálogo

- Quitar un producto es activo = FALSO. NUNCA borrar la fila: rompe carritos
  guardados y la trazabilidad de pedidos enviados.
- disponibilidad = 'agotado' es para faltantes temporales; activo = FALSO es
  para descontinuados.
- sku y slug son permanentes. Un cambio de slug exige redirección 301
  permanente en next.config, que nunca se borra.
- Agregar una categoría nueva es un cambio de código, no solo de datos:
  requiere actualizar esta lista y el nav.

---

## Sistema visual

**Ancho de diseño:** 1280 px, contenido con `margin: 0 auto`, márgenes laterales 48px.

**Responsive:** el diseño de 1280 px es la referencia y el escritorio debe verse **idéntico** al handoff. Pero la implementación **es responsive obligatoriamente** — el tráfico será mayoritariamente móvil. Las pantallas móviles no están diseñadas; al construirlas, adaptar respetando los tokens, sin inventar componentes nuevos, y consultando antes de cualquier decisión de layout que no se deduzca del escritorio.

**Color** — no hay color de acento y no debe agregarse uno sin autorización:

| Uso | Valor |
|---|---|
| Negro / texto / botones | `#0B0B0C` |
| Blanco | `#FFFFFF` |
| Fondo de sección alterna | `#F5F5F3` |
| Bordes de tarjeta | `#ECECEA` |
| Bordes de píldora | `#E4E4E0` |
| Texto secundario | `#6B6B67` |
| Texto terciario / etiquetas | `#9C9C97` |
| Texto sobre negro | `#A1A1A6` |
| Bordes sobre negro | `#232326` |

**Sin degradados. Sin sombras. Sin emoji.**

**Tipografía:**
- Cuerpo e interfaz: `'Helvetica Neue', Helvetica, Arial, sans-serif`
- Logotipo únicamente: **Bakbak One**
- Etiquetas en versalitas, códigos, datos: **JetBrains Mono** (11 px, `letter-spacing: 0.14em`, mayúsculas)
- Titulares: peso 600, `letter-spacing` de −0.02em a −0.035em según tamaño
- Escala: 82 / 64 / 48 / 44 / 40 / 38 / 34 / 26 / 22 px

**Radios:** 999px botones y píldoras · 16px tarjetas grandes · 14px tarjetas de producto · 12px campos de formulario · 8px monograma del nav (28px) · 7px monograma del pie (24px)

**Espaciado:** secciones a `88px 48px` o `96px 48px`. Rejillas con `gap: 16px`.

**Tokens, no estilos en línea.** El handoff usa estilos en línea deliberadamente, para mover bloques entre archivos sin arrastrar CSS. Al implementar en Next.js, convertirlos a tokens de Tailwind y componentes. No introducir un CSS global a medias.

---

## El logo

`assets/logos/` trae wordmark, monograma y lockup en SVG (tipografía incrustada) y PNG a 4×, en negro y en blanco.

Dos reglas al reconstruirlo en código:

1. La «s» del monograma lleva `transform: translateY(-0.095em)` dentro del cuadrado. Es corrección óptica de altura-x, no un error — sin ella la letra se ve caída.
2. En el lockup, el wordmark lleva la misma corrección dentro de una caja de la altura del icono, para que ambas «s» compartan línea óptica.

En los SVG el texto sigue siendo texto. Antes de imprenta o bordado, convertir a curvas.

---

## Rutas

```
/                                  Inicio
/catalogo                          Catálogo completo
/productos                         Productos destacados
/catalogo/[categoria]              Listado de categoría
/producto/[slug]                   Ficha de producto
/marcas                            Índice de marcas
/marcas/[marca]                    Página de una marca
/comparar                          Comparador de especificaciones
/buscar                            Resultados de búsqueda
/carrito                           Carrito → WhatsApp
/nosotros
/legal/terminos
/legal/privacidad
/legal/garantias
```

- **Tres listados distintos, que se confunden fácil:**
  - `/catalogo` — **todo**: los productos activos de todas las categorías. Es el destino de «Ver productos» del hero y de «Ver toda la tienda →», porque quien los pulsa quiere la tienda, no una selección.
  - `/catalogo/[categoria]` — **una** categoría. Es la ruta HERMANA de `/catalogo`, no su hija en cuanto a plantilla: comparten orden, paginación y filtros, y se diferencian solo en el alcance.
  - `/productos` — solo los marcados `destacado` (hoy 72 de 320). No es el catálogo y no debe usarse como si lo fuera.
- **`/comparar` NO ranquea ni recomienda** (regla 2). Señala en qué filas los valores difieren, y eso es un hecho; decir cuál conviene es asesoría. Prohibido marcar un «ganador», ordenar por «mejor valor» o poner insignias tipo «más potente».
  - Solo compara dentro de **una misma categoría**: un subwoofer contra un cable RCA no significa nada.
  - Su estado vive en la URL (`?skus=SQ12-D2,COR-S124D`), no en `localStorage`, porque lo que le da valor es que se pueda **compartir por WhatsApp**. Quien abre un enlace ajeno ve lo del enlace y no pierde su propia selección.
  - `noindex` en la metadata, pero **NO** en el `Disallow` de `robots.ts`: un Disallow impediría que Google llegara a leer el noindex, y la URL está hecha para compartirse.
  - **El resaltado de diferencias solo cuenta filas donde TODAS las columnas traen dato.** Un hueco no es una diferencia entre productos, es un dato que el fabricante no publica. Contarlo marcaba 17 de 17.1 filas con cuatro subwoofers —el resaltado dejaba de distinguir nada— porque `specsFicha` no tiene vocabulario fijo: Bocinas usa 49 etiquetas distintas entre 106 productos y cada uno lleva 4-10.
- **No existe `/checkout`.** No crearla.
- **No existe `/instalacion`.** No crearla (regla 1).
- Filtros y orden en **query params** (`?marca=memphis&precio_max=200000`): URL compartible por WhatsApp y rastreable por Google.
- **Los listados abren por «relevancia»:** `destacado` primero, luego precio **descendente**, desempate por `sku`. El precio descendente como criterio secundario pone el equipo antes que los accesorios sin agregar un campo al esquema — con precio ascendente, KBT abría con adaptadores RCA de Q 30 y sus subwoofers caían en la página 3. El comparador vive en `lib/catalog/orden.ts` y desempata por puntos de código, no con `localeCompare`: el orden no puede cambiar entre builds y la salida de ICU varía entre versiones.
- **El orden por defecto no se escribe en la URL.** `ORDEN_DEFECTO` (`lib/catalog/types.ts`) es el valor que `lib/catalog/href.ts` OMITE, así que `/marcas/kbt` queda limpia y `?orden=precio_asc` solo aparece cuando alguien lo pidió. El canonical excluye `orden` aparte, armándose con el mismo builder sin pasarlo. Si algún día cambia el default, se cambia esa constante — no los tres builders.
- El orden que ordena el catálogo completo no es el mismo que la «relevancia» de `/buscar`, que es un puntaje de coincidencia de TEXTO dependiente de la consulta (`SearchExperience.tsx`). Ese puntaje manda ahí; el comparador de `orden.ts` solo le rompe los empates.
- Paginación con URLs indexables (`?page=2`), no scroll infinito.
- Breadcrumbs: en ficha de producto terminan en la **marca**, no en el nombre del producto (`Inicio / Subwoofers / Sonoro`). Cada segmento con página real es un link (`components/layout/Breadcrumbs.tsx`) — el último normalmente no lleva link porque es la página actual, salvo en la ficha de producto, donde ningún segmento es la página actual (termina en la marca, no en el producto) y los tres son navegables.

Las ocho categorías del nav son: Bocinas, Subwoofers, Amplificadores, Receptores, Kits, Insonorización, Ecualizadores, Accesorios.

---

## Patrones que se repiten

- **Chrome del carrusel 3D:** cada bloque anclado a su esquina, no en una barra: categoría arriba a la izquierda, contador (`2 / 9`) abajo a la izquierda, puntos y flechas abajo a la derecha. Deja libre el centro del cuadro, que es donde vive el producto. Bajo 640 px los puntos se ocultan y quedan solo las flechas.
- **Nav:** 60px de alto, borde inferior `#EDEDEB`, logo + monograma a la izquierda, categorías al centro, Marcas / Nosotros / Buscar / Carrito a la derecha. El enlace de la página actual va en `#0B0B0C` con `font-weight: 500`.
- **El nav completo colapsa bajo 1280px, no bajo 1024.** El handoff dibujó la barra con SEIS categorías (`design/index.html`); el sitio tiene ocho, y las dos extra no caben: entre 1024 y 1174px la barra se desbordaba hasta 151px y le metía scroll horizontal a la página entera. A 1280 entra con 97px de holgura y se ve idéntica al handoff, así que el breakpoint es `xl:` y no `lg:`. **Agregar una novena categoría vuelve a apretar esos 97px** — hay que medir antes, no después.
- **La búsqueda se alcanza en UN toque desde cualquier página.** Con 200+ productos es la ruta principal de navegación, no un extra. Debajo de 1280px el header compacto lleva una lupa (44×44) que va directo a `/buscar`, además de «Buscar» dentro del menú: dentro del menú solo serían dos toques, y el menú es justamente lo que colapsa en ese rango.
- **Pie:** borde superior, logo pequeño a la izquierda, línea de contacto en mono a la derecha.
- **Tarjeta de producto:** imagen 200px, etiqueta mono con categoría o marca, nombre 17px/600, especificación 14px gris, precio 17px/600, cuota 13px gris.
- **Resumen de pedido** (carrito): tarjeta con borde, subtotal, envío, total en 28px, cuota, botón negro a todo el ancho, condiciones en mono al final.

### Imágenes

El placeholder es un **estado de renderizado, no un dato**:

```
imagenes: []    →  placeholder
imagenes: [..]  →  fotos
```

Nunca escribir rutas de placeholder en el catálogo. Un producto sin fotos sigue con `imagenes: []` hasta que existan archivos que le correspondan — cero cambio de código cuando lleguen.

Patrón del handoff, adoptado tal cual: rayas diagonales `repeating-linear-gradient(135deg, #EFEFEC 0 10px, #F7F7F5 10px 20px)` con etiqueta mono describiendo la foto (`FOTO — sub 12" tres cuartos`, `LOGO — Memphis`). Sobre negro: `#16161A` / `#1D1D22`. Al reemplazar por `<img>`, conservar la altura del contenedor.

Como no hay fotos de todas las marcas todavía, **las imágenes OG se generan dinámicamente** con `ImageResponse`: fondo de marca + nombre + precio + logo. Sin esto, cada enlace compartido por WhatsApp —el canal principal— se vería vacío.

#### Pipeline de fotos por SKU

Los archivos van en `public/productos/`, con el nombre `SKU_vista.ext`:

```
SRX62_frontal.jpg
SRX62_lateral.jpg
ACX 165_frontal.jpg      ← el sku se escribe tal cual (con su espacio interno)
```

- **Formatos:** `jpg`, `jpeg`, `png`, `webp`. Cualquier otra extensión se ignora y se reporta.
- El **primer** `_` del nombre separa sku de vista — nunca ambiguo, porque `SKU_REGEX` (`lib/catalog/types.ts`) no admite `_` dentro de un sku. La vista puede traer sus propios guiones bajos (`SRX62_tres_cuartos.jpg` → vista `tres_cuartos`).
- `scripts/import-catalog.ts` escanea la carpeta en cada corrida de `npm run import:catalog` y arma `imagenes` por sku emparejando con `lib/catalog/photos.ts` (lógica pura, testeada en `photos.test.ts`). Ningún componente cambia — `ProductImage`/`ProductGallery` ya leen `imagenes` tal cual venga.
- Las fotos de un mismo sku quedan **ordenadas alfabéticamente por vista** (`frontal` < `lateral` < `trasera` ya cae en ese orden en español) — esa es la que sale ampliada por defecto en la ficha. Para forzar cuál va primero, nombrar la vista para que ordene primero.
- Un archivo que no matchea ningún sku (typo de sku o de vista, extensión no soportada, sin `_`) **no aborta el import** — se reporta como alerta en `reports/import-errors.md`, igual que un slug que cambió. Nunca se adivina cuál sku es.
- `alt` se genera automático como `"{nombre del producto} — {vista}"`.

---

## El handoff de diseño

Las nueve páginas HTML viven en `design/` como **referencia de solo lectura**. Nunca se importan, se extienden ni se copian a `app/`.

Son un prototipo visual, no una aplicación: los botones son `<span>` o `<a>` sin lógica, no hay estados de hover, foco, error ni carga, y no hay diseño móvil.

Estas páginas funcionan como PLANTILLAS, no páginas individuales:

  catalogo-subwoofers.html  → plantilla de /catalogo/[categoria], para las
                              seis categorías
  marca-memphis.html        → plantilla de /marcas/[marca], para las diez marcas
  producto-sq12-d2.html     → plantilla de /producto/[slug], para todos los SKUs

Nunca se duplica el archivo por categoría, marca o producto: se construye una
ruta dinámica con generateStaticParams.

El producto y la marca del handoff son UN CASO, no el caso general. La
plantilla no puede asumir el conteo de specs (varía de 4 a 10), qué etiquetas
existen (varían por categoría), ni cuántos productos tiene una marca. Debe
renderizar lo que traigan los datos.

`design/checkout.html` está **descartado**. Se conserva solo como referencia visual para el futuro transaccional; no se implementa nada de él.

Faltan por diseñar: carrito vacío, búsqueda sin resultados, confirmación de pedido, estados de hover y foco, y todo el móvil.

---

## Decisiones abiertas

No inventes valores para estos puntos. Si el trabajo los necesita, pregunta.

- **Plazo de garantía.** Está definido el alcance (solo desperfecto de fábrica, se pierde por mal uso o instalación incorrecta) pero **no la duración**. Probablemente varíe por marca, según lo que otorgue cada fabricante. Hasta definirlo, `garantiaMeses` queda vacío y la página de garantías describe alcance y exclusiones sin plazo.
- **«Envíos gratis a todo el país»** — compromiso de negocio heredado del handoff, sin confirmar. Es caro si se sostiene sin condiciones.
- **Redondeo de la cuota.** Este documento fija `Math.ceil` al centavo (`Q 408.34`). El handoff mostraba `Q 408.33`, que suma Q 2,449.98 en seis pagos. Si el negocio prefiere 408.33, cambiar aquí y definir que la última cuota absorbe la diferencia.
- **Datos supuestos en el handoff, todos por confirmar:** precios, conteos de producto, países de origen de las marcas, teléfono, correo y dirección.

<!-- BEGIN:nextjs-agent-rules -->

---

## Modelos 3D

Los nueve modelos del carrusel del home (`components/home/ProductCarousel3D.tsx`) son **iconos de categoría**, no SKUs: sin logos, sin texto legible, sin marca. Viven en `public/models/` y se generan con Blender desde `scripts/models3d_v2/`.

### Regenerar un modelo

```bash
blender --background --python scripts/models3d_v2/subwoofer.py
```

Un script por modelo, más `_common.py` con la biblioteca compartida (primitivas, materiales, limpieza de malla, normalización de origen y export). El script escribe directo a `public/models/<id>.glb` y reporta triángulos, dimensiones y peso. `scripts/models3d/` es la **primera versión, superada**: no la uses. No está versionada (`.gitignore`); si no la tenés en disco, no hace falta.

### Convenciones (no negociables)

- **Metros, escala real.** Nada de unidades arbitrarias.
- **Ymin = 0** y **centro XZ en (0,0)**: el modelo apoya en el piso y gira sobre su propio eje. El componente lo baja `-(height · displayScale) / 2` para centrarlo en el cuadro; si un modelo no apoya en 0, queda descolgado.
- **El NODO del glTF no lleva traslación.** No alcanza con que la malla esté centrada: si el objeto se exporta sin pasar por `normalize_object()` (lo hace `finalize()`), el nodo se lleva la posición que el objeto tenía en la escena de Blender y el modelo aparece a metros del origen. El síntoma es brutal y mudo: **el cuadro se ve vacío**, sin error en consola, porque el modelo carga bien pero queda fuera del frustum. Ya pasó una vez, con un `sound-deadening.glb` reexportado a mano cuyo nodo traía `translation: [-1.26, 2.07, -0.18]`. Verificación de un vistazo:

  ```bash
  node -e "const b=require('fs').readFileSync('public/models/X.glb');console.log(JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()).nodes)"
  ```

  Debe imprimir el nodo **sin** campo `translation`.
- **+Y up.** Blender es Z-up; la conversión la hace el export glTF (`export_yup=True`). **No se rota la malla.**
- **Draco obligatorio** (`KHR_draco_mesh_compression` en `extensionsRequired`), nivel 6, cuantización de posición 14.
- **Sin cámaras, sin luces, sin texturas de imagen.** Materiales PBR por valores.
- 5,000–25,000 triángulos y menos de 300 KB por modelo. Los nueve suman 315 KB.
- Nombres de objetos y materiales en inglés, kebab-case.

### Paleta de materiales compartida

`PALETTE` en `scripts/models3d_v2/_common.py` — hex, roughness, metallic:

| Material | Hex | Rough | Metal |
|---|---|---|---|
| `matte-black` | `#1A1A1A` | 0.85 | 0 |
| `textured-black` | `#232323` | 0.95 | 0 |
| `brushed-alu` | `#B8BCC0` | 0.35 | 1 |
| `chrome` | `#E8EAED` | 0.08 | 1 |
| `rubber` | `#101010` | 0.98 | 0 |
| `copper` | `#B87333` | 0.30 | 1 |
| `screen-glass` | `#0A0C10` | 0.05 | 0 |
| `accent-orange` | `#FF6A00` | 0.50 | 0 |
| `cable-red` | `#C41E1E` | 0.90 | 0 |
| `cable-blue` | `#1B4FA8` | 0.90 | 0 |
| `cable-white` | `#E6E6E6` | 0.85 | 0 |

`cable-red`, `cable-blue` y `cable-white` **no son colores de acento de marca**: son código de color eléctrico (positivo, remoto, negativo) y solo aparecen en `install-kit` y `rca-cable`. Lo mismo `accent-orange`, que marca conectores. La regla de «sin color de acento» de § Sistema visual sigue aplicando a la interfaz; estos son colores del producto representado.

### El exponente 0.65 de `displayScale`

`lib/models3d.ts` guarda un `displayScale` por modelo, y **está calculado: no lo recalcules ni lo redondees, y no lo sustituyas por auto-fit ni por escala real.**

Entre el más chico (speaker, 165 mm) y el más grande (sound-deadening, 395 mm) hay una relación de 1 a 3. A escala real el speaker ocuparía un tercio del cuadro. Con auto-fit por modelo pasa lo contrario: speaker y subwoofer se verían idénticos pese a medir 165 y 302 mm, y el carrusel dejaría de comunicar tamaño.

`displayScale` es la **escala real elevada a 0.65**, normalizada al modelo más grande: conserva el orden de tamaños y acerca los extremos. Si alguien regenera el manifiesto sin saber del exponente, los tamaños relativos se rompen sin que nada falle ni avise.

`FRAME_RADIUS` (0.2545) y `FRAME_HEIGHT` (0.1965) son el radio y la altura ya escalados del modelo más grande, y de ahí sale el encuadre de cámara. `FRAME_RADIUS` es el radio del **cilindro** que barre el modelo al girar sobre Y — verificado midiendo los vértices de los nueve `.glb` en el navegador. Para comprobarlo no sirve `Box3.setFromObject`: transforma la caja de cada geometría en vez de sus vértices, así que sobre un modelo girado devuelve una caja inflada por la diagonal (hasta √2 de más).

### Cámara del carrusel

El usuario puede **orbitar, acercar y desplazar** el modelo, para ver el detalle del producto:

| | Escritorio | Táctil |
|---|---|---|
| Orbitar | arrastre izquierdo | un dedo (tras decidir la intención) |
| Zoom | rueda del mouse | pellizco |
| Desplazar | arrastre derecho, medio o Shift | dos dedos |

#### Vista predeterminada

Tres cuartos frontal, evocando la **perspectiva caballera**: azimut 150°, 25° sobre el horizonte (polar 65°, que es como se expresa acá, desde +Y).

No es caballera estricta y no pretende serlo: la caballera es una proyección OBLICUA (cara frontal sin deformar, profundidad a 45° y a escala completa), y eso necesita una cámara ortográfica con cizalladura, no una pose. Se eligió la pose para no tener que cambiar de proyección cada vez que el usuario toma el modelo y lo suelta.

**El azimut es 150° y no 30° porque los `.glb` tienen su frente hacia −Z.** Una cámara en el cuadrante +Z los muestra de espaldas. Por lo mismo, la luz principal va en `(1.6, 2, −1.2)`: dejarla en +Z deja a contraluz justo la cara que se ve.

Pero **ese giro global no alcanza: cada modelo decidió por su cuenta hacia dónde apunta su frente.** Para eso está `giroBase` en el manifiesto, un giro sobre Y por modelo, aplicado sobre la malla sin tocarla. Hoy lo llevan `amplifier`, `head-unit`, `screen`, `equalizer` y `sound-deadening`. Si un producto aparece de espaldas, eso es lo que hay que ajustar — nunca el azimut global, que movería a los nueve.

Cuidado al juzgar «de frente o de espaldas» a ojo: en el ecualizador, los RCA traseros llevan aro `accent-orange` y se parecen bastante a perillas. La fila de controles reales es la de cilindros oscuros del canto frontal.

#### Encuadre: el producto no toca el chrome ni los bordes

`ZOOM_DEFECTO = 1`, o sea la vista predeterminada es exactamente el encuadre calculado — que ya es lo más grande que entra sin rozar nada. Acercarlo más recorta: el margen del encuadre es del 10%, así que por debajo de 0.9 el producto se sale. (Y ojo con leer «85% del zoom máximo» como una fracción del acercamiento: el máximo es `1/ZOOM_MIN` ≈ 2.9×, y **cualquier default por encima del 35% de eso se sale del cuadro**.)

El chrome vive en las ESQUINAS, no en barras completas, así que hay dos maneras de no tocarlo y basta con cumplir una — `useEncuadre` calcula las dos y se queda con la menos exigente:

- **A, por bandas:** usar todo el ancho y quedarse fuera de las franjas de arriba y abajo. Es la que manda en pantallas angostas, donde la etiqueta se come casi todo el ancho.
- **B, por columna:** usar todo el alto y quedarse en la columna central libre entre los bloques de las esquinas. Es la que manda en escritorio, donde el cuadro es muy ancho y el producto nunca llega a las esquinas.

Con una sola regla no alcanza: la A sola deja el producto ridículamente chico en escritorio, y la B sola es imposible de cumplir en móvil.

Las medidas del chrome (`CHROME_MOVIL`, `CHROME_SM` en `ProductCarousel3D.tsx`) son **constantes, no medidas del DOM**: medir obligaría a releer el layout en cada render, y el resultado cambiaría con el largo del nombre de cada categoría, así que el producto cambiaría de tamaño de un slide a otro. Están tomadas del caso más ancho («Kits de instalación») con aire de sobra. Si se agranda el chrome o se alarga una etiqueta, hay que subirlas.

Por lo mismo el cuadro creció en móvil (220 → 300 px): con el chrome descontado de 220 px quedaban 112 px útiles y el producto salía diminuto.

Al cambiar de producto —con las flechas, con los puntos o por el ciclo— la vista se repone a esta pose **de golpe, sin interpolar**: el deslizamiento entre slides ya está ocurriendo y un segundo movimiento encima se lee como un tirón.

#### El ciclo

Corre siempre mientras el carrusel esté a la vista, y cada producto recorre lo mismo:

```
espera-previa (5 s)  →  girando (15 s, una vuelta)  →
espera-final (5 s)   →  siguiente producto  →  espera-previa …
```

Y si el usuario toma el modelo: `interactuando` → (5 s **desde que suelta**) → `volviendo` (≈0.8 s) → `girando`. O sea, primero se recuperan la vista y el zoom, y recién entonces arranca el giro.

El plan vive en `components/home/ciclo.ts` —sin React ni DOM— y tiene test (`ciclo.test.ts`) que fija el orden de las fases, los 25 s por producto y que el giro sea exactamente una vuelta. El ángulo es **absoluto en función del tiempo**, no un acumulador: así el modelo arranca siempre en 0, termina la vuelta exacta y cambiar de producto no arrastra el ángulo del anterior. Va en negativo porque una rotación positiva sobre +Y lleva la cara frontal hacia la derecha, y el giro pedido va de derecha a izquierda.

`volviendo` es la única fase sin plazo: la corta el rig cuando la interpolación llegó a destino. Un temporizador la cortaría antes o después según cuánto hubiera que desandar.

La cuenta de los 5 s **no corre mientras hay un gesto en curso**. Con un solo aviso en el `pointerdown`, un arrastre lento más largo que ese plazo se cancelaba solo a mitad de camino, y se veía como si el modelo se negara a quedarse donde uno lo dejaba.

#### El bug del riel: por qué el modelo no giraba en horizontal

Los tres slides estaban dentro de un grupo «riel» que **rotaba con el azimut de la cámara**, para que los vecinos quedaran siempre a los costados de la vista. Era un error grave: al orbitar la cámara θ, el riel giraba θ y **el modelo giraba con ella**. Los dos giros se cancelaban y el producto parecía inmóvil en horizontal. El eje vertical no se veía afectado porque el riel solo rota sobre Y — de ahí el síntoma «solo se mueve de arriba a abajo».

Lo insidioso es que **medir el azimut de la cámara no detecta este bug**: el azimut cambia perfectamente. Solo se ve comparando dos capturas del mismo modelo, y con el botón apretado, porque si la cámara alcanza a volver a reposo entre una captura y la otra salen idénticas. Ahora cada slide se coloca por POSICIÓN sobre el eje horizontal de la cámara (`right = (cos az, 0, −sen az)`), sin rotar nada.

#### Estudio sin CDN

La iluminación **no** usa `<Environment preset="studio" />`. Ese preset descarga un HDR de ~1 MB desde `raw.githack.com`: un tercero en el critical path del home, exactamente lo que se evita sirviendo el decoder de Draco en local. En su lugar el entorno se genera en la GPU con cuatro `Lightformer` y `frames={1}` (la escena de luces no se mueve, se cocina una sola vez). Cero peticiones de red — verificado: la única externa que queda en el home es Analytics.

Lo que más pesa en el resultado **no son los focos sino el entorno**, porque un material metálico no tiene color difuso propio: devuelve lo que lo rodea. El gris del ciclorama ES el gris del aluminio.

Dos perillas, en orden de importancia:

- **`<color attach="background">`** — demasiado oscuro y el producto se empasta en negro; demasiado claro y el aluminio sale lavado y plano, casi sin contraste contra el fondo claro del cuadro. Es el primer valor a revisar si algo se ve sucio o apagado.
- **El plano oscuro de abajo.** Sin él el metal refleja el mismo gris por arriba y por abajo, y sale plano: parece plástico gris, no metal. Con el piso aparece el degradado —claro arriba, oscuro abajo— que es lo que lo hace leer como metal.

El contraste lo ponen los focos, no el gris de fondo: conviene mantener el ciclorama contenido y los `Lightformer` brillantes, que es como se ilumina metal en un estudio de verdad.

#### Cámara propia, sin `OrbitControls`

La cámara la maneja `Camara` en `CarouselCanvas.tsx`. Toda la vista son cinco números —azimut, polar, distancia y el punto de mira— y se recoloca desde ellos en cada frame. `useRotateGesture` no toca nada: traduce punteros y rueda a INCREMENTOS que `Camara` consume y vacía.

Se sacó `OrbitControls` porque tenía tres trampas encadenadas, todas silenciosas:

- **`enableDamping` viene en `true` en drei** (three lo trae en `false`). El delta esférico decae asintóticamente y nunca llega a cero: `update()` dispara `change` para siempre, lo que reiniciaba sin parar la cuenta de inactividad y la cámara no volvía nunca.
- **Fuerza `touch-action: none`** sobre su `domElement` cada vez que se conecta, robándole al dedo el scroll de la página.
- **Elegir rama según `(pointer: coarse)`** rompe el portátil con pantalla táctil: reporta puntero grueso, cae en la rama del dedo, y ahí un arrastre vertical del MOUSE se interpreta como scroll. La media query describe el dispositivo, no el gesto; lo que importa es el `pointerType` de cada evento.

Durante un arrastre, `pointermove` y `pointerup` se escuchan en `window`: el gesto no se corta si el cursor sale del cuadro, si React re-renderiza la capa de controles, o si `setPointerCapture` falla.

#### Zoom

**La rueda va enganchada a mano, no por `onWheel` de React.** React registra los listeners de `wheel` en la raíz como PASIVOS, y en un listener pasivo `preventDefault()` no hace nada: el zoom ocurría y la página scrolleaba al mismo tiempo. Con `{ passive: false }` sobre el contenedor, la rueda encima del carrusel hace zoom y nada más. Consecuencia asumida: con el cursor sobre el cuadro la rueda no scrollea la página; hay que salir del cuadro.

El paso es **fijo, 1.5% por evento, mirando solo el signo** de `deltaY`. Escalarlo con la magnitud —lo que hace OrbitControls— salta de tope a tope en un solo tic en los mouse que mandan deltas grandes. Muchos mouse y trackpads mandan varios eventos por muesca, así que el paso tiene que ser chico.

Y el paso es solo la mitad de la historia: la cámara **no salta a la distancia nueva, la persigue** con decaimiento exponencial (`SUAVIZADO_ZOOM`, ~80 ms de constante de tiempo, calculado con el delta real para que a 120 Hz tarde lo mismo que a 60). Por eso la vista lleva dos distancias: la PEDIDA, que mueven la rueda y el regreso a reposo, y la DIBUJADA, que la sigue. Entre el paso chico y el suavizado, cada muesca se ve como movimiento continuo y no como un escalón.

#### Órbita y encuadre

La órbita es **libre en los dos ejes**: azimut sin tope y polar de polo a polo, menos **0.05 rad (≈2.9°) de margen en cada polo**. Ese margen no es cosmético: en el polo exacto la dirección de vista queda paralela al vector «arriba», el producto cruz que arma la base de la cámara da cero y `lookAt` devuelve una matriz con `NaN`. No se ve un tirón, se ve el cuadro vacío.

`distanciaPara(polar)` calcula el encuadre: de canto manda la altura del modelo, desde arriba manda su diámetro, dos veces y media más. Es el punto de partida y el destino al volver, **no una cárcel**: forzar `minDistance = maxDistance` en cada frame encuadra perfecto y anula la rueda por completo. `gap` se calcula contra la distancia máxima alcanzable —la del polo o la del zoom más lejano— o al alejarse aparecen los productos vecinos por los costados.

**Ojo con el primer frame:** el canvas todavía mide 0×0, y sin un piso en el aspecto la distancia sale infinita, con la cámara clavada en el tope lejano. `useEncuadre()` pone ese piso y `Camara` adopta la distancia buena en cuanto hay medidas reales.

### Caché: `immutable` y el nombre del archivo

`next.config.ts` sirve `/models/*` y `/draco/*` con `Cache-Control: public, max-age=31536000, immutable`.

**Consecuencia: regenerar un modelo exige cambiar el nombre del archivo.** Un navegador que ya cacheó `subwoofer.glb` con `immutable` no lo vuelve a pedir nunca — ni con recarga forzada, en varios navegadores. Si no se renombra, hay usuarios viendo la versión vieja por un año.

Por eso cada entrada de `MODELS` en `lib/models3d.ts` tiene un campo **`archivo`** aparte del id: el id (`sound-deadening`) es semántico y permanente, y el archivo lleva la versión (`sound-deadening-2.glb`). Al regenerar se sube el número en los dos lados —el `finalize(obj, "<id>-N")` del script de Blender y el `archivo` del manifiesto— y nada más cambia.

**Si el modelo nuevo cambia de tamaño, hay que recalcular los NUEVE `displayScale`,** porque la normalización cuelga del más grande. Al reemplazar `sound-deadening` (radio 0.2545 → 0.2482) el mayor pasó a ser `rca-cable`, y con él se recalculó todo:

```
displayScale_i = (diámetro_mayor / diámetro_i) ^ 0.35      // diámetro = 2 · radius
FRAME_RADIUS   = max(radius_i · displayScale_i)
FRAME_HEIGHT   = max(height_i · displayScale_i)
```

El decoder de Draco (`public/draco/`) se copia de `node_modules/three/examples/jsm/libs/draco/gltf/` y se sirve local a propósito: el CDN de Google sería un tercero en el critical path del home. `lib/models3d.ts` exporta `DRACO_DECODER_PATH` y `ProductModel3D` se lo pasa a `useGLTF`; sin ese segundo argumento drei cae al CDN.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
