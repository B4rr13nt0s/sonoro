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
/catalogo/[categoria]              Listado de categoría
/producto/[slug]                   Ficha de producto
/marcas                            Índice de marcas
/marcas/[marca]                    Página de una marca
/buscar                            Resultados de búsqueda
/carrito                           Carrito → WhatsApp
/nosotros
/legal/terminos
/legal/privacidad
/legal/garantias
```

- **No existe `/checkout`.** No crearla.
- **No existe `/instalacion`.** No crearla (regla 1).
- Filtros y orden en **query params** (`?marca=memphis&precio_max=200000`): URL compartible por WhatsApp y rastreable por Google.
- Paginación con URLs indexables (`?page=2`), no scroll infinito.
- Breadcrumbs: en ficha de producto terminan en la **marca**, no en el nombre del producto (`Inicio / Subwoofers / Sonoro`).

Las seis categorías del nav son: Bocinas, Subwoofers, Amplificadores, Receptores, Kits, Insonorización.

---

## Patrones que se repiten

- **Nav:** 60px de alto, borde inferior `#EDEDEB`, logo + monograma a la izquierda, categorías al centro, Marcas / Nosotros / Buscar / Carrito a la derecha. El enlace de la página actual va en `#0B0B0C` con `font-weight: 500`.
- **Pie:** borde superior, logo pequeño a la izquierda, línea de contacto en mono a la derecha.
- **Tarjeta de producto:** imagen 200px, etiqueta mono con categoría o marca, nombre 17px/600, especificación 14px gris, precio 17px/600, cuota 13px gris.
- **Resumen de pedido** (carrito): tarjeta con borde, subtotal, envío, total en 28px, cuota, botón negro a todo el ancho, condiciones en mono al final.

### Imágenes

**No hay fotografías de producto en el lanzamiento.** Todo el catálogo sale con placeholders.

El placeholder es un **estado de renderizado, no un dato**:

```
imagenes: []    →  placeholder
imagenes: [..]  →  fotos
```

Nunca escribir rutas de placeholder en el catálogo. Cuando lleguen las fotos, es solo un cambio de datos, cero código.

Patrón del handoff, adoptado tal cual: rayas diagonales `repeating-linear-gradient(135deg, #EFEFEC 0 10px, #F7F7F5 10px 20px)` con etiqueta mono describiendo la foto (`FOTO — sub 12" tres cuartos`, `LOGO — Memphis`). Sobre negro: `#16161A` / `#1D1D22`. Al reemplazar por `<img>`, conservar la altura del contenedor.

Como no hay fotos, **las imágenes OG se generan dinámicamente** con `ImageResponse`: fondo de marca + nombre + precio + logo. Sin esto, cada enlace compartido por WhatsApp —el canal principal— se vería vacío.

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

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
