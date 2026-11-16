# Cotizador privado — plan de implementación

> **Para quien ejecute:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para llevar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Meta:** una ruta privada `/cotizador` donde solo Byron entra (contraseña) y arma una cotización con productos del catálogo, que se entrega como un mensaje de texto para copiar.

**Arquitectura:** lógica pura y probada en `lib/cotizador/` (sesión firmada, mensaje, borrador), una interfaz cliente que reutiliza el buscador de `/buscar`, y una página de servidor que comprueba la sesión **antes** de consultar el catálogo. Sin tocar el carrito, el nav, el chat ni el sitemap.

**Tecnologías:** Next 16.4.6 (App Router, server actions, `cookies()`), React 19, TypeScript, zod 4, `node:test` para unitarias, Playwright para e2e.

**Spec:** `docs/superpowers/specs/2026-11-16-cotizador-design.md`

## Restricciones globales

- Español de Guatemala. Precios siempre con `formatQ` (`Q 2,450.00`, espacio duro ` `); cero formateo inline.
- Sin color, sombra, degradado ni emoji nuevos: solo tokens y `components/ui/boton.ts` (`claseBoton`, `claseBotonInactivo`).
- Copy prohibido (reglas 2 y 3 de CLAUDE.md): «pagar», «comprar ahora», «finalizar compra», «te recomendamos». La instalación no se menciona ni se cotiza.
- Lo agotado no se agrega; lo bajo pedido sí y lleva `· bajo pedido` (`marcaDisponibilidad`). Máximo 99 por línea (`MAX_CANTIDAD_POR_LINEA`).
- Ningún componente lee `data/catalog.json`: todo por `lib/catalog/`.
- Importes entre módulos con extensión `.ts` (`import … from "../cart/envio.ts"`), como el resto de `lib/`.
- Trabajar en la rama `feature/cotizador` (hoy se está en `main`). Mensajes de commit al estilo del repo (`feat(cotizador): …`) terminados con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Verificación final: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Foco de revisión

Entradas que el spec no menciona y que más probablemente fallen, la más probable primero. Cada una tiene su prueba en la tarea dueña del código.

1. Cookie con firma válida pero de **otra contraseña** (rotada), expirada, o mal formada (vacía, sin punto, expira no numérico, hex de largo incorrecto): se rechaza sin lanzar excepción. → Tarea 1.
2. **Contraseña ausente, vacía, solo espacios o de menos de 12 caracteres**: se trata como no configurada, y la ruta cierra (404); un intento vacío o larguísimo no entra ni rompe. → Tarea 1.
3. **`localStorage` que falla** (modo privado, cuota, JSON corrupto o con cantidades fuera de rango): borrador vacío, sin pantalla de error. → Tarea 3.
4. **Nombre del cliente con saltos de línea o muy largo**: no puede inyectar líneas en el mensaje; se colapsa a una línea y se corta a 80. → Tarea 2.
5. **Cotización vacía**: el mensaje es `""` y «Copiar» queda deshabilitado; y **recargar no borra el borrador** guardado (no se guarda el estado vacío inicial antes de leer). → Tareas 2 y 6.

---

### Task 1: Sesión firmada

**Archivos:**
- Crear: `lib/cotizador/sesion.ts`
- Prueba: `lib/cotizador/sesion.test.ts`

**Interfaces:**
- Produce (lo usan las tareas 5 y 6):
  - `COOKIE_COTIZADOR = "cotizador"`, `DURACION_SESION_S = 604800` (7 días), `LARGO_MINIMO_CONTRASENA = 12`
  - `contrasenaConfigurada(valor: string | undefined): string | null` — `null` si falta, está vacía, es solo espacios o tiene menos de 12 caracteres; si no, la contraseña tal cual (sin `trim`).
  - `contrasenaCorrecta(intento: string, contrasena: string): boolean` — comparación en tiempo constante (compara los SHA-256 de ambas con `timingSafeEqual`, así el largo no se filtra).
  - `firmarSesion(contrasena: string, ahoraS: number): string` — `"<expira>.<hex>"`, con `expira = ahoraS + DURACION_SESION_S` y `hex` = HMAC-SHA256 (clave: la contraseña; mensaje: `cotizador-v1.<expira>`).
  - `sesionValida(valor: string | undefined, contrasena: string | null, ahoraS: number): boolean`
- Consume: nada.

- [ ] **Paso 1: escribir las pruebas que fallan** en `sesion.test.ts` (`node:test` + `assert/strict`, como `lib/cart/envio.test.ts`), con contraseña de prueba `"una-contrasena-larga"`:
  - `firmarSesion` + `sesionValida` con la misma contraseña y `ahoraS` → `true`.
  - Misma cookie con **otra** contraseña → `false`; con `ahoraS` ≥ `expira` → `false`; un carácter del hex alterado → `false`; `expira` alterado manteniendo el hex → `false`.
  - Mal formadas, todas `false` y sin lanzar: `undefined`, `""`, `"abc"`, `"123."`, `".abc"`, `"1.2.3"`, `"NaN.<64 ceros>"`, `"99999999999999999999.<hex válido>"`, hex de 63 y de 65 caracteres.
  - `sesionValida(cookieValida, null, …)` → `false`.
  - `contrasenaConfigurada`: `undefined`, `""`, `"            "` (12 espacios), `"corta"`, `"12345678901"` (11) → `null`; `"123456789012"` (12) → la misma cadena.
  - `contrasenaCorrecta("", c)` y `("x".repeat(100_000), c)` → `false` sin lanzar; la correcta → `true`.
- [ ] **Paso 2: ejecutar y ver que fallan**
  Ejecutar: `node --no-warnings --test lib/cotizador/sesion.test.ts` — Esperado: FALLA (módulo inexistente).
- [ ] **Paso 3: implementar `sesion.ts`** con `node:crypto` (`createHmac`, `createHash`, `timingSafeEqual`). `sesionValida` valida con `/^\d{1,12}$/` el `expira` y con `/^[0-9a-f]{64}$/` el hex antes de comparar; cualquier fallo devuelve `false`.
- [ ] **Paso 4: ejecutar y ver que pasan** — mismo comando — Esperado: PASS.
- [ ] **Paso 5: commit** — `git checkout -b feature/cotizador`, luego `git add lib/cotizador docs/superpowers/specs/2026-11-16-cotizador-design.md docs/superpowers/plans/2026-11-16-cotizador.md` y `feat(cotizador): sesión firmada con contraseña`.

---

### Task 2: Mensaje de la cotización

**Archivos:**
- Crear: `lib/cotizador/mensaje.ts`
- Prueba: `lib/cotizador/mensaje.test.ts`

**Interfaces:**
- Consume: `formatQ` (`../format/precio.ts`), `envioGratis`, `ENVIO_POR_COBRAR` (`../cart/envio.ts`), `marcaDisponibilidad` (`../catalog/disponibilidad.ts`), tipo `Disponibilidad` (`../catalog/types.ts`).
- Produce (lo usan las tareas 3 y 4):
  - `type LineaCotizacion = { sku: string; nombre: string; qty: number; unitPriceCents: number; disponibilidad: Disponibilidad }`
  - `MAX_CLIENTE = 80`
  - `lineaCotizacion(linea: LineaCotizacion): string`
  - `buildQuoteMessage(params: { cliente: string; lineas: readonly LineaCotizacion[] }): string` — `""` si no hay líneas.

- [ ] **Paso 1: escribir las pruebas que fallan.** Los textos esperados usan `formatQ(...)` (espacio duro), no cadenas con espacio normal:
  - Línea: `{ sku:"TS-W312D4", nombre:'Subwoofer Champion Series 12" TS-W312D4', qty:1, unitPriceCents:88500, disponibilidad:"disponible" }` → `1x Subwoofer Champion Series 12" TS-W312D4 — Q 885.00 c/u — Q 885.00`. Con `qty:2, unitPriceCents:118000` → `… — Q 1,180.00 c/u — Q 2,360.00`.
  - Bajo pedido: la línea termina en ` · bajo pedido`; disponible no lleva marca.
  - Código: nombre sin el sku → la línea lleva `<nombre> <sku>`; nombre que ya lo contiene, **sin importar mayúsculas** (`"ts-w312d4"` dentro del nombre) → no se repite.
  - Mensaje completo con cliente `"Juan Pérez"` y dos líneas: encabezado `Cotización Sonoro para Juan Pérez:`, línea en blanco, las líneas, línea en blanco, `Subtotal: …`, `Envío: gratis`, `Total: …`, `Precios con IVA incluido.`, unidas por `\n`.
  - Sin cliente (`""` o solo espacios) → encabezado `Cotización Sonoro:`.
  - Envío: subtotal exactamente `50000` → `Envío: Por cobrar`; `50001` → `Envío: gratis`.
  - Cliente `"Ana\nLópez\r\n  Ruiz"` → `Ana López Ruiz` en una sola línea; cliente de 200 caracteres → se corta a 80.
  - Sin líneas → `""`.
- [ ] **Paso 2: ejecutar y ver que fallan** — `node --no-warnings --test lib/cotizador/mensaje.test.ts` — Esperado: FALLA.
- [ ] **Paso 3: implementar `lineaCotizacion` y `buildQuoteMessage`** con el formato del spec. El total de la línea es `qty * unitPriceCents` (enteros) y el subtotal la suma de esos totales (no usar `subtotalCents` del carrito: pide `CartItem`). El cliente se normaliza con `.replace(/\s+/g, " ").trim().slice(0, MAX_CLIENTE)`.
- [ ] **Paso 4: ejecutar y ver que pasan** — mismo comando — Esperado: PASS.
- [ ] **Paso 5: commit** — `feat(cotizador): mensaje de la cotización`.

---

### Task 3: Borrador (estado, resolución contra el catálogo, almacenamiento)

**Archivos:**
- Crear: `lib/cotizador/borrador.ts`
- Prueba: `lib/cotizador/borrador.test.ts`

**Interfaces:**
- Consume: `MAX_CANTIDAD_POR_LINEA` (`../cart/types.ts`), `LineaCotizacion`, `MAX_CLIENTE` (tarea 2), tipo `ProductoBuscable` (`../busqueda/busqueda.ts`), `zod`.
- Produce (lo usa la tarea 4):
  - `type Borrador = { cliente: string; lineas: { sku: string; qty: number }[] }`; `BORRADOR_VACIO: Borrador`
  - `type AccionBorrador = { type:"agregar"; sku:string } | { type:"cantidad"; sku:string; qty:number } | { type:"quitar"; sku:string } | { type:"cliente"; texto:string } | { type:"vaciar" } | { type:"cargar"; borrador:Borrador }`
  - `borradorReducer(borrador: Borrador, accion: AccionBorrador): Borrador` — puro. `agregar` suma 1 (crea la línea en 1); `cantidad` con `qty <= 0` quita la línea; todo se topa en 99; `cliente` se corta a `MAX_CLIENTE`; `vaciar` deja `BORRADOR_VACIO` (también borra el cliente).
  - `type ProductoCotizable = Pick<ProductoBuscable, "sku" | "nombre" | "precioCents" | "disponibilidad">`
  - `resolverBorrador(borrador: Borrador, catalogo: readonly ProductoCotizable[]): { lineas: LineaCotizacion[]; quitados: string[] }` — precio, nombre y disponibilidad salen del catálogo; un sku que no está en el catálogo (el cliente solo recibe los activos) o que está agotado va a `quitados` y no a `lineas`. Conserva el orden del borrador.
  - `CLAVE_BORRADOR = "sonoro:cotizador"`; `leerBorrador(almacen: Pick<Storage,"getItem"> | null): Borrador`; `guardarBorrador(almacen: Pick<Storage,"setItem"> | null, borrador: Borrador): void` — ninguna lanza nunca.

- [ ] **Paso 1: escribir las pruebas que fallan** (con un `Storage` falso de un objeto): agregar dos veces → qty 2; `cantidad` 150 → 99; `cantidad` 0 quita; agregar 99 veces + 1 → 99; `cliente` de 200 → 80; `vaciar` borra líneas y cliente. `resolverBorrador`: precio y nombre del catálogo (no del borrador), sku desconocido y agotado → `quitados`, bajo pedido se queda con `disponibilidad:"bajo_pedido"`. Almacenamiento: ida y vuelta; `getItem` que lanza → `BORRADOR_VACIO`; `null` como almacén → vacío; JSON inválido; `{}`; línea con `qty: 0`, `-1`, `1.5`, `500`; más de 400 líneas; cliente que no es texto → en todos esos casos `BORRADOR_VACIO`; `setItem` que lanza no propaga.
- [ ] **Paso 2: ejecutar y ver que fallan** — `node --no-warnings --test lib/cotizador/borrador.test.ts` — Esperado: FALLA.
- [ ] **Paso 3: implementar.** `leerBorrador` valida con un esquema zod (`cliente` ≤ 80; `lineas` ≤ 400, cada una `sku` ≤ 64 y `qty` entero 1–99) y devuelve `BORRADOR_VACIO` ante cualquier fallo, sin intentar reparar.
- [ ] **Paso 4: ejecutar y ver que pasan** — mismo comando — Esperado: PASS.
- [ ] **Paso 5: commit** — `feat(cotizador): borrador, resolución contra el catálogo y almacenamiento`.

---

### Task 4: Interfaz de la herramienta

**Archivos:**
- Crear: `components/cotizador/Cotizador.tsx` (componente cliente)

**Interfaces:**
- Consume: `buscar`, `ProductoBuscable` (`@/lib/busqueda/busqueda.ts`), `compararRelevancia` (`@/lib/catalog/orden.ts`), `etiquetaDisponibilidad` (`@/lib/catalog/disponibilidad.ts`), `formatQ` (`@/lib/format/precio.ts`), `claseBoton`/`claseBotonInactivo` (`@/components/ui/boton.ts`), y de las tareas 2 y 3: `buildQuoteMessage`, `borradorReducer`, `BORRADOR_VACIO`, `resolverBorrador`, `leerBorrador`, `guardarBorrador`, `CLAVE_BORRADOR`.
- Produce: `export function Cotizador(props: { productos: ProductoBuscable[] }): JSX.Element`.

- [ ] **Paso 1: implementar `Cotizador`** (sin prueba unitaria: el comportamiento lo cubre el e2e de la tarea 6). Comportamiento exacto:
  - **Estado:** `useReducer(borradorReducer, BORRADOR_VACIO)`. Se hidrata **en un efecto tras montar** con `leerBorrador(window.localStorage)` (acción `cargar`) y marca `hidratado = true`; el guardado (`guardarBorrador`) corre solo cuando `hidratado` es `true`, para no pisar lo guardado con el vacío inicial. El acceso a `window.localStorage` va en `try/catch` (si lanza, almacén `null`).
  - **Buscador:** campo de texto; con consulta, `buscar(productos, consulta, compararRelevancia).productos.slice(0, 12)`; sin consulta, nada. Cada resultado muestra nombre, `formatQ(precioCents)`, la etiqueta de disponibilidad si no es `disponible`, y un botón «Agregar» (`claseBoton("secundario", "compacto")`); si está agotado el botón queda deshabilitado, dice «Agotado» y usa `claseBotonInactivo`.
  - **Líneas:** de `resolverBorrador(borrador, productos)`. Cada línea: nombre, `formatQ` del unitario, control de cantidad (− / número / +, tope 99 por el reducer) y botón «Quitar». Si `quitados` no está vacío, un efecto despacha `quitar` para cada sku y se muestra un aviso: «Se quitaron de la cotización productos que ya no están disponibles: <skus>.», que se cierra con un botón.
  - **Cliente:** campo opcional «Cliente», `maxLength` 80.
  - **Mensaje:** `buildQuoteMessage({ cliente, lineas })` en un `<textarea readOnly>` con etiqueta accesible. Botón «Copiar» (`claseBoton("principal")`), deshabilitado si el mensaje es `""`: `navigator.clipboard.writeText` y, si falla o no existe, alternativa con `select()` + `document.execCommand("copy")`; tras copiar, el botón dice «Copiado» durante 2 s. Botón «Vaciar» (`claseBoton("secundario")`) que despacha `vaciar`.
  - Diseño: tokens y espaciados del sitio, ancho de contenido como `/carrito`; en móvil todo en una columna. Ningún elemento ni texto que no esté en esta lista.
- [ ] **Paso 2: verificar tipos y lint** — `npm run typecheck && npm run lint` — Esperado: sin errores.
- [ ] **Paso 3: commit** — `feat(cotizador): interfaz de la herramienta`.

---

### Task 5: Ruta privada, acceso y robots

**Archivos:**
- Crear: `lib/cotizador/acceso.ts`, `app/cotizador/acciones.ts`, `app/cotizador/page.tsx`, `components/cotizador/FormularioEntrada.tsx`
- Modificar: `app/robots.ts` (agregar `"/cotizador"` a `disallow`), `.env.example` (documentar `COTIZADOR_PASSWORD`: servidor, mínimo 12 caracteres, sin definir la ruta responde 404, cambiarla cierra las sesiones, hay que cargarla en Vercel), `playwright.config.ts` (en `webServer.env`: `COTIZADOR_PASSWORD: "contrasena-de-prueba-e2e"`)

**Interfaces:**
- Consume: tarea 1 (`COOKIE_COTIZADOR`, `DURACION_SESION_S`, `contrasenaConfigurada`, `contrasenaCorrecta`, `firmarSesion`, `sesionValida`), `Cotizador` (tarea 4), `listAllProducts` (`@/lib/catalog/index.ts`), `tarjetasBuscables` (`@/lib/catalog/buscables.ts`), `metadataPagina` (`@/lib/seo/metadata.ts`).
- Produce:
  - `haySesion(): Promise<boolean>` en `lib/cotizador/acceso.ts` — lee `cookies()` y `process.env.COTIZADOR_PASSWORD`, usa `Date.now()/1000`. **Es el único sitio que decide si hay sesión.**
  - `type EstadoEntrada = { error: string | null }`; `entrar(estado: EstadoEntrada, datos: FormData): Promise<EstadoEntrada>` y `salir(): Promise<void>` en `app/cotizador/acciones.ts` (`"use server"`).

- [ ] **Paso 1: implementar `haySesion`** (`lib/cotizador/acceso.ts`): `sesionValida(cookie, contrasenaConfigurada(process.env.COTIZADOR_PASSWORD), ahoraS)`.
- [ ] **Paso 2: implementar las acciones.** `entrar`: lee el campo `contrasena`; si no hay contraseña configurada o `contrasenaCorrecta` da `false`, espera 1 s (`setTimeout`) y devuelve `{ error: "Contraseña incorrecta." }`; si es correcta, pone la cookie (`httpOnly`, `secure` solo con `NODE_ENV === "production"`, `sameSite: "strict"`, `path: "/cotizador"`, `maxAge: DURACION_SESION_S`, valor de `firmarSesion`) y hace `redirect("/cotizador")`. `salir`: pone la cookie vacía con `maxAge: 0` y el mismo `path`, y `redirect("/cotizador")`.
- [ ] **Paso 3: implementar `FormularioEntrada`** (cliente, `useActionState(entrar, { error: null })`): un campo `type="password"` con etiqueta «Contraseña», botón «Entrar» y el error en una región `role="alert"`. Sin más texto.
- [ ] **Paso 4: implementar `page.tsx`.** `metadata = metadataPagina({ titulo: "Cotizador", descripcion: "Herramienta interna.", ruta: "/cotizador", noIndexar: true })`. Orden estricto en el componente: (1) si `contrasenaConfigurada(process.env.COTIZADOR_PASSWORD)` es `null` → `notFound()`; (2) si `!(await haySesion())` → `<FormularioEntrada />` y **nada más**, sin consultar el catálogo; (3) con sesión, `listAllProducts({ activo: true })` → `tarjetasBuscables` → `<Cotizador productos={…} />`, más un `<form action={salir}>` con botón «Salir».
- [ ] **Paso 5: robots, `.env.example` y `playwright.config.ts`** como se indica arriba.
- [ ] **Paso 6: verificar** — `npm run typecheck && npm run lint && npm test` — Esperado: sin errores y todas las pruebas pasan. Luego `npm run build` y confirmar en su salida que `/cotizador` figura como ruta dinámica (`ƒ`), no estática.
- [ ] **Paso 7: commit** — `feat(cotizador): ruta privada con contraseña`.

---

### Task 6: Prueba e2e y documentación

**Archivos:**
- Crear: `e2e/cotizador.spec.ts`
- Modificar: `CLAUDE.md` (§ Rutas)

**Interfaces:**
- Consume: la ruta de la tarea 5 y `COTIZADOR_PASSWORD = "contrasena-de-prueba-e2e"` del servidor e2e.

- [ ] **Paso 1: escribir `e2e/cotizador.spec.ts`** (mismo estilo que `e2e/buscar.spec.ts`; cada prueba parte de un contexto limpio). Casos:
  - **Sin sesión:** `GET /cotizador` devuelve el formulario de contraseña; el HTML **no** contiene `Champion Series` (nombre de producto: solo viaja con sesión; los skus sí aparecen en todas las páginas por el layout del carrito, así que no sirven para esta prueba); trae `noindex`.
  - **Contraseña incorrecta:** se queda en el formulario con «Contraseña incorrecta.».
  - **Contraseña correcta:** entra; buscar `TS-W312D4`, pulsar «Agregar»; el cuadro del mensaje coincide con la expresión `/1x Subwoofer Champion Series 12" TS-W312D4 — Q\s[\d,]+\.\d{2} c\/u — Q\s[\d,]+\.\d{2}/` (precio con regex: no depende del valor del catálogo).
  - **Recargar conserva el borrador:** tras agregar y recargar, la línea sigue ahí.
  - **Vaciar:** deja el mensaje vacío y «Copiar» deshabilitado.
  - **Salir:** vuelve al formulario y `/cotizador` ya no muestra la herramienta.
  - **robots:** `/robots.txt` contiene `Disallow: /cotizador`.
- [ ] **Paso 2: ejecutar** — `npx playwright test e2e/cotizador.spec.ts` — Esperado: PASS.
- [ ] **Paso 3: documentar en `CLAUDE.md`.** En § Rutas, agregar `/cotizador` a la lista de rutas y una viñeta junto a la de `/checkout`: ruta privada de uso interno, contraseña en `COTIZADOR_PASSWORD` (sin definir → 404; mínimo 12 caracteres), `noindex`, sin enlace ni sitemap, no se registra en la hoja, no cotiza instalación ni descuentos. Agregar una sección corta «Cotizador privado» (después de «Selector de vehículos») con: formato del mensaje y por qué cada línea muestra unitario y total, el código que se agrega solo si el nombre no lo trae, y que el catálogo solo se consulta con sesión válida.
- [ ] **Paso 4: verificación final** — `npm run typecheck && npm run lint && npm test && npm run test:e2e` — Esperado: todo en verde.
- [ ] **Paso 5: commit** — `feat(cotizador): e2e y documentación`.
