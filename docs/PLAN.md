# SONORO — Plan de construcción del sitio web

Plan de ejecución completo, de cero a sitio publicado. Asume que no existe nada: ni dominio, ni repositorio, ni código.

**Qué se construye:** catálogo público de audio para vehículos, con cotizador que cierra por WhatsApp.
**Qué NO se construye ahora, pero debe quedar habilitado:** compras en línea (Fase 7 futura) y chatbot (Fase 8 futura).
**Qué NO existe en el lanzamiento:** fotografías de producto. Todo el catálogo sale con placeholders.

**Principio rector:** lo diferido —pagos, chatbot, fotos— debe poder añadirse *sumando*, nunca reescribiendo. Eso se logra aislando cuatro costuras: **datos, carrito, medios y consumo de catálogo**.

---

## Convenciones fijas

Estas reglas no se renegocian durante el desarrollo. Cualquier duda futura se resuelve contra esta tabla.

| Regla | Valor |
|---|---|
| Moneda | GTQ, único |
| Precio almacenado | Centavos, **entero**. Nunca `float` |
| Precio mostrado | **Siempre final, con IVA incluido** |
| Formato de precio | `Q 2,450.00` — símbolo, **espacio duro** (`\u00A0`), coma de miles, **siempre 2 decimales** |
| Cuotas | `Math.ceil` **al centavo**. Nunca prometer una cuota menor a la real |
| Identidad de producto | `sku` — llave del carrito y de todo cruce de datos |
| Identidad de URL | `slug` — **inmutable** una vez publicado |
| Idioma | es-GT, único |
| Imágenes | `imagenes: []` es estado válido → dispara placeholder |

---

## Fase 0 — Preparativos no técnicos

Se hacen en paralelo. Solo el dominio bloquea la publicación final; nada aquí bloquea empezar a programar.

### 0.1 Dominio

Registro `.gt` operado por el CEIA de la Universidad del Valle de Guatemala. Trámite en línea en **www.gt**.

| Tipo | Ejemplo | Nacional | Internacional |
|---|---|---|---|
| Segundo nivel | `sonoro.gt` | USD 40 / año | USD 60 / año |
| Tercer nivel | `sonoro.com.gt` | USD 20 / año | USD 30 / año |

Requisitos: nombre o razón social, correo, teléfono, dirección.

- [ ] Verificar disponibilidad en www.gt
- [ ] Registrar **`sonoro.gt`** como canónico, por **2 años** (evita perderlo por olvido de renovación)
- [ ] Registrar `sonoro.com.gt` y `sonoro.com` como defensa de marca, para redirigir 301
- [ ] Registrar **a nombre de la entidad legal**, no de una persona ajena
- [ ] Guardar credenciales en gestor de contraseñas
- [ ] Anotar fecha de renovación en el planificador de Notion

> Revisar promociones antes de pagar; el registro suele ofrecer 2 años por el precio de 1.

### 0.2 Cuentas y servicios

- [ ] GitHub (repositorio privado)
- [ ] Vercel, vinculado a GitHub
- [ ] Correo corporativo: `ventas@sonoro.gt`, `info@sonoro.gt` (Google Workspace o Zoho Mail)
- [ ] WhatsApp Business con el número dedicado: perfil, horario, mensaje de bienvenida
- [ ] Google Business Profile
- [ ] Cuenta de analítica (GA4 o Plausible)

### 0.3 Datos y contenido (arranca ya, es lo más lento)

- [ ] Confirmar con contabilidad la convención de precio del catálogo fuente y que corresponde al precio final con IVA
- [ ] Resolver las decisiones pendientes marcadas en el catálogo original
- [ ] Definir el subconjunto de lanzamiento: SKUs con descripción propia escrita, no los 400 con una línea cada uno
- [ ] **Gestionar acceso a bibliotecas de medios para distribuidores** de Pioneer, JL Audio, Kicker y demás marcas. Como distribuidor autorizado, Sonido Digital probablemente ya califica. Es el camino más corto de 0 a 400 fotos, y es cuestión de correos, no de estudio fotográfico. Si sale, entra sin tocar código

**Listo cuando:** dominio registrado y convención de precio confirmada por escrito.

---

## Fase 1 — Entorno y esqueleto desplegado

Objetivo: una URL viva el primer día. Desplegar al final es la forma más común de descubrir problemas de infraestructura cuando ya no hay tiempo.

```bash
# Node LTS y pnpm instalados
npx create-next-app@latest sonoro --typescript --tailwind --app --eslint
cd sonoro
```

- [ ] Crear estructura de carpetas (§ Estructura, abajo)
- [ ] Configurar Prettier + ESLint + hook de pre-commit
- [ ] `tsconfig` en modo estricto
- [ ] Repositorio en GitHub, rama `main` protegida
- [ ] Conectar Vercel, verificar deploy automático en cada push
- [ ] Verificar que los *preview deployments* funcionan en una rama de prueba

### Estructura de carpetas

```
app/                        # rutas
components/
  ui/                       # primitivos
  catalog/                  # ProductCard, ProductGrid, FilterPanel
  cart/                     # CartDrawer, CartLineItem, CartSummary
  media/                    # ProductImage, PlaceholderImage
lib/
  catalog/                  # ÚNICA puerta a los datos
    index.ts
    types.ts
    adapters/static.ts
  cart/                     # estado, reducers, persistencia
  format/                   # formatQ, cuotas, teléfonos
  whatsapp/                 # composición del mensaje
content/
  productos/{sku}.mdx       # descripciones largas
data/
  source/productos.csv      # FUENTE DE VERDAD, versionada
  catalog.json              # generado — no editar a mano
scripts/
  import-catalog.ts
reports/                    # salida del importador
```

**Listo cuando:** una URL `*.vercel.app` responde con la página por defecto y cada push la actualiza.

---

## Fase 2 — Datos

La fase más importante. Si queda bien, el resto es mecánico y las fases futuras son baratas.

### 2.1 Superficie de edición: Google Sheets

Separar dos roles que "fuente de verdad" suele confundir:

- **Superficie de edición:** donde se cambian 40 precios cómodamente. → Google Sheets
- **Artefacto de registro:** lo que reconstruye el catálogo y debe ser tipado y diffeable. → `data/source/productos.csv` versionado en Git

Un `.xlsx` es un ZIP de XML: Git lo guarda, pero el diff es ilegible. El CSV es texto plano, así que `git diff` muestra la línea exacta, el valor anterior y el nuevo. Con un solo editor, ese historial revisable es la principal defensa contra un error propio.

```
Google Sheets  →  export CSV  →  data/source/productos.csv  →  importador  →  data/catalog.json
                                 content/productos/{sku}.mdx  ↗
```

- [ ] Montar la hoja con las columnas exactas del contrato
- [ ] **Marcar la columna SKU como Texto** antes de pegar cualquier dato
- [ ] Aplicar reglas de validación de datos en la hoja (rangos de precio, listas de marca y categoría)
- [ ] Fila 1 = encabezados. Sin títulos ni celdas combinadas arriba
- [ ] Exportar CSV en UTF-8

> Si alguna vez hay que editar el CSV en escritorio, usar **LibreOffice, no Excel**. Excel hace round-trip destructivo: al guardar reaplica coerción de tipos sin preguntar.

### 2.2 Esquema

```ts
sku                string   // canónico, inmutable
slug               string   // URL, INMUTABLE una vez publicado
nombre             string
marca              string
categoria          string
subcategoria       string?
descripcionCorta   string
specs              Record<string, string|number>
precioCents        number   // ENTERO, centavos, IVA INCLUIDO
precioAntesCents   number?
moneda             'GTQ'
disponibilidad     'disponible' | 'bajo_pedido' | 'agotado'
imagenes           Imagen[] // puede estar vacío
compatibilidad     string[]?
garantiaMeses      number?
destacado          boolean
activo             boolean
```

- [ ] Tipos TypeScript + validación Zod en `lib/catalog/types.ts`
- [ ] En la hoja, los precios se escriben en **quetzales normales** (`2450.00`), no en centavos. La conversión es trabajo del importador; pedirle a un humano teclear `245000` invita a un error de un orden de magnitud
- [ ] **No guardar precio base.** Si se necesita, se deriva (`base = precioCents / 1.12`). Dos campos de precio terminan desincronizados

### 2.3 Importador

`scripts/import-catalog.ts`:

1. Lee `data/source/productos.csv`
2. Valida el contrato de encabezados: lista exacta, **aborta** si falta una o sobra una desconocida. No adivina
3. **Validaciones defensivas** (§2.4), antes de normalizar nada
4. Normaliza: trim, marcas canónicas, slugs sin acentos, precios a centavos enteros
5. Une `content/productos/{sku}.mdx` por `sku`
6. Valida contra Zod
7. Emite `data/catalog.json`, `data/brands.json`, `data/taxonomy.json`
8. Emite `reports/import-errors.md` — toda fila rechazada y su motivo
9. Emite `reports/price-diff.md` — **qué precios cambiaron respecto al import anterior**

El paso 9 es la red de seguridad: antes de publicar se ve exactamente qué precios se mueven, y un tecleo equivocado se detecta antes de llegar al público.

**El script falla ruidosamente.** Un SKU sin precio no entra en silencio.

Opcional: emitir `data/catalog.sqlite` bajo bandera. No se usa ahora; es el insumo del lado SQL del chatbot futuro.

### 2.4 Validaciones defensivas — lo verdaderamente crítico

La elección de formato es reversible: migrar de CSV a SQLite o Postgres es reescribir ~200 líneas, y `lib/catalog` aísla a la aplicación. **La coerción silenciosa de tipos no es reversible.**

Si una hoja convierte un SKU `6X9-2` en fecha, ese SKU genera un slug mangeado; el slug es inmutable; y para cuando se note ya está indexado por Google y compartido por WhatsApp. Deshacerlo cuesta redirecciones, posicionamiento y enlaces rotos en conversaciones con clientes.

El importador, antes que nada:

- [ ] Valida cada `sku` contra regex explícita y **aborta** si parece fecha (`2024-06-09`, `9-Jun`) o notación científica (`1.2E+05`)
- [ ] Rechaza precios que lleguen como texto
- [ ] Compara con el import anterior y alerta si un SKU perdió ceros iniciales (`0450` → `450`)
- [ ] Alerta si un `slug` ya publicado cambió — siempre es error, o exige un 301 deliberado

**Listo cuando:** `npm run import:catalog` produce un `catalog.json` validado, con `import-errors.md` vacío o revisado.

---

## Fase 3 — Capa de acceso y formateo

### 3.1 `lib/catalog` — la costura crítica

Ningún componente lee `catalog.json` directamente. **Nunca.**

```ts
getProduct(slug: string): Promise<Product | null>
listProducts(filters: ProductFilters): Promise<{ items: Product[]; total: number }>
listBrands(): Promise<Brand[]>
```

- [ ] Implementar `adapters/static.ts` leyendo el JSON local
- [ ] **Firmas asíncronas y paginadas desde ahora**, aunque hoy lean un archivo en milisegundos

Escribirlas síncronas obliga a tocar cada componente al migrar a una API remota. Este detalle es la diferencia entre una migración de días y una de semanas — y sirve por igual al e-commerce futuro y al chatbot, que serán dos consumidores más de esta misma capa.

### 3.2 `lib/format`

Una sola función `formatQ(cents: number): string`, usada por la UI, el mensaje de WhatsApp y las imágenes OG. Así los tres nunca se desincronizan.

- Formato: `Q 2,450.00` · `Q 89.50` · `Q 12,300.00` · `Q 0.00`
- **Espacio duro** (`\u00A0`), no espacio normal. Con espacio normal el navegador puede romper la línea entre la `Q` y la cifra; en tarjetas angostas en móvil pasa seguido
- Implementar con `Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` y anteponer `'Q' + '\u00A0'` a mano
- **No usar `style: 'currency'`:** la salida del símbolo varía entre entornos y versiones de ICU (puede emitir `GTQ` o pegarlo sin espacio), y este formato debe ser idéntico en los tres consumidores
- Cuotas: `Math.ceil` al centavo. `Q 2,450.00 / 12 → Q 204.17`

### 3.3 Tests

- [ ] `formatQ`: cero, menos de mil, exactamente mil, millones, `.00` vs `.50`, y que el separador sea espacio duro
- [ ] Conversión a centavos
- [ ] `Math.ceil` de cuotas
- [ ] Contrato de encabezados del importador

**Listo cuando:** los tests pasan y ningún archivo fuera de `lib/catalog` importa `catalog.json`.

---

## Fase 4 — Rutas y navegación

```
/
/catalogo
/catalogo/[categoria]
/catalogo/[categoria]/[subcategoria]
/producto/[slug]
/marcas
/marcas/[marca]
/buscar
/carrito
/nosotros
/contacto
/legal/terminos
/legal/privacidad
/legal/garantias
```

- [ ] `generateStaticParams` para todas las rutas dinámicas
- [ ] Layout raíz, header, footer, 404 personalizada
- [ ] Breadcrumbs en catálogo y producto
- [ ] **Filtros y orden en query params** (`?marca=pioneer&precio_max=200000`): URL compartible por WhatsApp y rastreable por Google
- [ ] Paginación con URLs indexables (`?page=2`), no scroll infinito puro

**Listo cuando:** se navega el catálogo completo, sin diseño terminado. Fea pero funcional.

---

## Fase 5 — Diseño y componentes

> El handoff de diseño (`design/`) es la especificación visual. Los tokens, patrones y placeholders salen de ahí, no se inventan. Ver `CLAUDE.md`.

- [ ] Tokens desde la identidad de Sonoro (wordmark de Canva): paleta, tipografía, escala, radios, sombras → `tailwind.config` + variables CSS
- [ ] **Mobile-first sin excepción.** Diseñar a 360px y expandir

Componentes, en este orden:

1. `PriceDisplay`
2. `ProductImage` / `PlaceholderImage` ← temprano, es transversal
3. `ProductCard`
4. `ProductGrid` + estados de carga y vacío
5. `FilterPanel` (drawer en móvil, sidebar en escritorio)
6. `ProductGallery`
7. `AddToQuoteButton`
8. `CartDrawer`
9. `WhatsAppCTA`

### Placeholders (no hay fotos en el lanzamiento)

**El placeholder es un estado de renderizado, no un dato.** Nunca se escriben rutas de placeholder en el catálogo:

```
imagenes: []    →  placeholder
imagenes: [..]  →  fotos
```

Cuando lleguen las fotos, es **solo un cambio de datos**. Cero código. Meter placeholders como entradas falsas en el JSON obliga a limpiarlas después SKU por SKU.

- [ ] Placeholder **de marca**: tokens de Sonoro, wordmark discreto, silueta por categoría (bocina, pantalla, amplificador). Uno genérico gris se lee como sitio a medio hacer; uno diseñado se lee como decisión
- [ ] Etiqueta honesta: **"Foto próximamente"**. Ocultar la ausencia genera desconfianza; nombrarla, no
- [ ] Misma relación de aspecto que tendrán las fotos reales (1:1), para que el layout no se mueva después
- [ ] El carrete muestra **un** placeholder, no tres iguales

### Compensar la falta de foto

Sin imagen, la conversión recae en el texto:

- [ ] Specs completas y bien formateadas: son el sustituto directo de la foto
- [ ] Jerarquía tipográfica fuerte en la ficha, para que la ausencia no deje un vacío visual
- [ ] CTA de WhatsApp más prominente: si el cliente quiere ver el producto, preguntar es el camino natural

### Accesibilidad y rendimiento

- [ ] Contraste AA, foco visible, `alt` real, navegación por teclado en el drawer, roles ARIA en filtros
- [ ] `priority` en la imagen LCP; `lazy` en el resto

**Listo cuando:** Lighthouse móvil ≥ 90 en Performance y ≥ 95 en Accessibility.

---

## Fase 6 — Cotizador con cierre por WhatsApp

Experiencia de carrito completa. Lo único distinto de un e-commerce real es el último paso.

### 6.1 Estructura del carrito (póliza para el futuro transaccional)

Diseñada hoy como si ya hubiera pagos:

```ts
CartItem {
  sku            string
  qty            number
  unitPriceCents number        // snapshot al agregar
  currency       'GTQ'
  nombreSnapshot string
  imagenSnapshot string | null // null = placeholder
  addedAt        ISO8601
}

Cart {
  schemaVersion  number
  items          CartItem[]
  createdAt      ISO8601
  updatedAt      ISO8601
}
```

- [ ] Totales siempre **calculados**, nunca almacenados
- [ ] React Context + `useReducer`, persistido en `localStorage`
- [ ] `schemaVersion` en la serialización: si no coincide, migrar o descartar limpiamente. **Nunca crashear con un carrito viejo**
- [ ] El carrito **no conoce WhatsApp**. WhatsApp es un consumidor del carrito, igual que lo será el checkout

### 6.2 Flujo

Agregar → toast (no modal) → drawer con líneas y subtotal → `/carrito` con nombre y notas opcionales → botón **«Pedir por WhatsApp»** que abre `wa.me`.

### 6.3 Mensaje generado

```
Hola Sonoro, quiero cotizar:

1x Pioneer AVH-1550NEX — Q 2,450.00
2x JL Audio C2-650X — Q 1,180.00 c/u

Subtotal: Q 4,810.00
Ref: SNR-A7K2M
```

- [ ] **ID de cotización corto** (`SNR-XXXXX`) visible en pantalla: vendedor y cliente hablan del mismo pedido
- [ ] Truncar si el carrito excede ~15 líneas: enviar el ID y un enlace
- [ ] Número en `NEXT_PUBLIC_WHATSAPP_NUMBER`, no incrustado

### 6.4 Registro de cotizaciones

- [ ] `/api/quote-log` → Google Sheets o Airtable

Es el activo más valioso de esta fase: demanda real, productos cotizados que no cierran, ticket promedio. Justifica y dimensiona el e-commerce futuro, y acumula las preguntas reales que harán útil al chatbot.

**Listo cuando:** un test e2e recorre buscar → filtrar → agregar 2 productos → abrir carrito → verificar el texto del mensaje.

---

## Fase 7 — Contenido y SEO

La fase más lenta. **Empezar en paralelo desde la Fase 4.**

### Contenido

- [ ] **Descripciones propias**, no copiadas del PDF del proveedor. El contenido duplicado penaliza, y otros distribuidores publicarán el mismo texto. Sin fotos, esto pasa de importante a crítico: el texto es lo único que diferencia
- [ ] Un archivo por producto en `content/productos/{sku}.mdx`. Markdown, no celdas: mejor editor, revisión por lotes, diff por redacción
- [ ] Plantilla por categoría con **encabezados consistentes**: qué es, para quién, qué resuelve, specs clave, qué se necesita para instalarlo. Esa consistencia es lo que después permite chunking para RAG
- [ ] Un SKU sin MDX se publica con `descripcionCorta` y specs; el importador lo reporta como pendiente, no como error

### SEO

- [ ] `metadata` por ruta: title, description, canonical, OpenGraph
- [ ] **Imágenes OG generadas dinámicamente** con `ImageResponse`: fondo de marca + nombre + precio + logo. Sin esto, cada enlace compartido por WhatsApp —el canal principal— se vería vacío. Es automática para todo el catálogo y no requiere una sola fotografía. Cuando lleguen las fotos reales, la plantilla las usa como fondo sin cambiar nada más
- [ ] **JSON-LD `Product`** con `offers`, `price`, `priceCurrency: GTQ`, `availability`. Se implementa ahora aunque no haya venta en línea: es requisito para Google Shopping y rich results después
- [ ] `LocalBusiness` con dirección y horario
- [ ] `sitemap.xml` y `robots.txt` generados desde el catálogo
- [ ] Páginas legales redactadas: términos, privacidad, garantías (alcance y exclusiones; **el plazo sigue sin definir**, ver `CLAUDE.md`)

---

## Fase 8 — Calidad

- [ ] Tests unitarios de lo que rompe en silencio (§3.3) + migración del carrito
- [ ] Un test e2e del flujo crítico (§6)
- [ ] Lighthouse en CI con presupuestos: Performance ≥ 90 móvil, Accessibility ≥ 95
- [ ] Revisión manual: recorrer los SKUs publicados y verificar precio, marca y categoría contra la fuente. Una vez, a mano, antes de publicar
- [ ] Probar en Android de gama media con red lenta, no solo en escritorio
- [ ] Enlaces rotos, 404, favicon, OG, formulario de contacto
- [ ] **WhatsApp probado desde un teléfono ajeno**
- [ ] Revisión por alguien que no construyó el sitio

---

## Fase 9 — Publicación

- [ ] DNS de `sonoro.gt` apuntando a Vercel
- [ ] SSL verificado, HTTPS forzado
- [ ] Elegir canónico (`www` o apex) y redirigir el otro
- [ ] Dominios defensivos con 301 al canónico
- [ ] Variables de entorno en Vercel: WhatsApp, endpoint de cotizaciones, IDs de analítica. **Nada de secretos en el repo**
- [ ] Analítica con eventos `view_product`, `add_to_quote`, `open_quote`, `whatsapp_click` — nombres estándar de e-commerce desde ahora, para no rehacer reportes después
- [ ] Meta Pixel si se va a pautar en Facebook/Instagram
- [ ] Google Search Console: verificar propiedad, enviar sitemap
- [ ] Google Business Profile y WhatsApp Business enlazados al sitio

---

## Fase 10 — Medición

- Cotizaciones por semana y tasa de cierre real, cruzada con ventas
- Productos más cotizados vs. más vendidos
- Ticket promedio de cotización
- Abandono entre `add_to_quote` y `whatsapp_click`
- Términos de búsqueda en Search Console: qué busca la gente que no está en el catálogo
- **Diferencia de conversión entre fichas con foto y sin foto**, en cuanto existan ambas. Mide directamente cuánto vale terminar el trabajo de imágenes

---

## Anexo A — Habilitación de compras en línea (futuro)

Si las Fases 2, 3 y 6 se respetaron:

| Componente | Estado |
|---|---|
| Esquema de producto, precios enteros con IVA | ✅ Sin cambios |
| `CartItem` / `Cart` con snapshots | ✅ Sin cambios |
| `lib/catalog` como adaptador | ✅ Solo se agrega un adaptador |
| Rutas y slugs | ✅ Inmutables, SEO conservado |
| Sistema de medios | ✅ Las fotos entran sin tocar código |
| JSON-LD con `offers` | ✅ Ya emitido |
| Eventos de analítica | ✅ Ya nombrados según estándar |
| Checkout | 🆕 Módulo nuevo |
| Pasarela de pago | 🆕 Evaluar Recurrente, Neonet, Visanet GT |
| Inventario en tiempo real | 🆕 Integración con el ERP de Sonido Digital |
| **Facturación electrónica FEL (SAT)** | 🆕 **Investigar temprano** |

> **FEL:** la factura electrónica pasa por un certificador autorizado por SAT. Es el componente con más plazo de gestión y menos control técnico propio, y suele ser el que retrasa lanzamientos transaccionales. Averiguar requisitos y certificadores mucho antes de necesitarlos.

---

## Anexo B — Habilitación del chatbot (futuro)

Cuatro anclajes, todos gratis si se sigue el plan:

| Anclaje | Qué queda listo |
|---|---|
| Datos estructurados | `catalog.json` tipado y normalizado es el lado SQL de la arquitectura híbrida. El importador emite `catalog.sqlite` bajo bandera |
| Contenido chunkeable | Un `.mdx` por SKU con encabezados consistentes: la unidad exacta para chunks de RAG, ya asociada a un `sku` |
| Identidad estable | `sku` y `slug` inmutables permiten al bot enlazar a productos reales sin ambigüedad |
| Punto de montaje | Slot `<ChatWidget />` en el layout raíz tras bandera `NEXT_PUBLIC_CHAT_ENABLED=false`, que hoy no renderiza nada. `app/api/` ya existe para el endpoint |

Además, el registro de cotizaciones acumulará durante meses **preguntas y combinaciones reales de producto**. Ese log será mejor insumo para definir qué debe responder el chatbot que cualquier suposición actual.

**Lo que NO se hace ahora:** ni embeddings, ni vector store, ni endpoint de chat, ni prompt. Escribirlos hoy sería código sin uso envejeciendo.

---

## Ruta crítica

```
Fase 0  ─┬─ dominio ──────────────────────────────────┐
         └─ contenido y fotos ─────────────────────────┼──> bloquean SOLO la publicación
Fase 1  → esqueleto desplegado                         │
Fase 2  → datos          ← la que más determina el resto
Fase 3  → capa de acceso                               │
Fase 4  → rutas                                        │
Fase 5  → diseño                                       │
Fase 6  → cotizador                                    │
Fase 7  → contenido y SEO  (empezar desde Fase 4) ─────┘
Fase 8  → calidad
Fase 9  → publicación
Fase 10 → medición
```

**El cuello de botella no es técnico.** Construir el sitio es predecible; escribir descripciones propias para cada SKU, no. Con placeholders, las fotos dejaron de bloquear el lanzamiento, pero el texto lo bloquea más que antes: sin foto, carga solo con toda la conversión. Conviene lanzar con un subconjunto bien escrito antes que con el catálogo completo a una línea por producto.
