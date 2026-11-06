# Selector de vehículos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un selector de vehículos dentro de `/buscar`: el cliente elige marca, modelo y año de su carro y ve qué receptores y bocinas del catálogo caben, directo o con accesorios.

**Architecture:** Un libro aparte, `data/source/vehiculos.xlsx`, se importa con `npm run import:vehiculos` (lógica pura en `scripts/vehiculos/`) a `data/vehiculos.json`. En el build, `app/buscar/vehiculos.json/route.ts` junta esos vehículos con los receptores, bocinas y piezas del catálogo (`armarDatosVehiculos`). `/buscar`, sin nada escrito, muestra el selector, baja ese archivo y calcula todo en el navegador con funciones puras de `lib/vehiculos/` (compatibilidad, selección en la dirección, textos).

> **Cambio del 4 de noviembre:** la primera versión de este plan armaba una página propia, `/vehiculos`, con enlace en el nav. El Task 1 midió que el enlace no entra a 1280 px, y el negocio decidió poner el selector en `/buscar`. La spec ya está actualizada.

**Tech Stack:** Next.js 16.3.8 (App Router), React 19, TypeScript, Tailwind 4, `xlsx` (SheetJS), `zod` 4, `node:test` (Node 24), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md`

## Global Constraints

- `CLAUDE.md` manda. Antes de escribir la ruta y la página, leer en `node_modules/next/dist/docs/` lo de route handlers, `useSearchParams` y `<Suspense>`: esta versión de Next tiene cambios.
- Copy para el cliente en español de Guatemala, con tú: «Contacta a Sonoro», «Escríbenos por WhatsApp». Nada de voseo en el sitio.
- Regla 2: la página no ranquea ni recomienda. El único orden propio es por estado (Cabe, Con pieza, Con accesorios, Consultar) y, dentro de cada estado, `compararRelevancia` de `lib/catalog/orden.ts`.
- Sin color de acento, sin sombras, sin degradados, sin emoji. Colores solo por tokens (`text-texto-secundario`, `border-borde-tarjeta`…), nunca un hex.
- Texto ordenado por puntos de código (`compararTexto` de `lib/catalog/orden.ts`), nunca con `localeCompare`.
- Un módulo que importa un componente cliente no puede arrastrar `node:fs`: nada de `lib/catalog/index.ts` ni de `lib/vehiculos/archivo.ts`. `lib/vehiculos/types.ts` no importa `zod`, porque viaja en el bundle.
- Imports relativos en `lib/` y `scripts/` con extensión `.ts`: los corre `node --test`.
- Los textos de WhatsApp los arma `lib/whatsapp/message.ts`. El número es `WHATSAPP_NUMBER` de `lib/whatsapp/index.ts`, nunca incrustado.
- Pruebas: `npm test` corre todas; una sola, `node --no-warnings --test <ruta>.test.ts`. Antes de cada commit que toque TS o TSX: `npm run typecheck` y `npm run lint`.
- Commits en español, `feat(vehiculos): …` o `fix(…): …`, terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Rama `feat/selector-vehiculos`. Sin push.
- **Por diseño, `npm run build` falla desde el Task 8 hasta que el negocio marque al menos una fila con `sí` (Task 13).** Los tasks 1–12 no necesitan el build.
- Textos exactos, copiados de la spec:
  - título del bloque (un h2 dentro de `/buscar`): «Receptores y bocinas por vehículo»
  - estados: «Cabe» · «Cabe con» + el nombre de la pieza en el catálogo, con enlace · «Cabe con accesorios» · «Requiere un marco que depende del año, marca y modelo del vehículo. Contacta a Sonoro para más información.»
  - bajo el selector: «¿No está tu vehículo? Escríbenos por WhatsApp.», que abre «Hola Sonoro, quiero consultar qué receptores y bocinas caben en mi vehículo.»
  - grupo vacío: «No hay bocinas de 6x8" en el catálogo.» / con varias medidas, «No hay bocinas de esas medidas en el catálogo.»
  - sin nada: «No hay receptores ni bocinas que quepan en este vehículo.»
  - error de carga: «No se pudo cargar la lista de vehículos.» y el botón «Reintentar»
  - `INSTALACION`: «Incluye instalación básica. En caso de que la instalación requiera una instalación más compleja, el uso de accesorios o componentes adicionales, dichos artículos se cobrarán por aparte y la instalación tendrá un costo adicional.»

## Review Focus

1. **Un enlace compartido que quedó viejo** (el libro cambió y ya no existe ese modelo, ese año o esa versión, o trae `anio=abc`): el selector se queda en el último nivel válido, con lo anterior elegido, sin romperse. → Task 4, `resolverSeleccion`.
2. **Una conexión que se traba** al bajar `/buscar/vehiculos.json`: el selector no se queda cargando para siempre; a los 8 s muestra el error con «Reintentar». → Task 9, `descargarDatosVehiculos`.
3. **Medidas con barra adentro, `7/8"` y `3/4"`** (tweeters, están en `MEDIDAS`): partir las medidas por `/` las rompería. Se parten solo por ` / `, con espacios. → Task 7, `normalizarFilaVehiculo`.
4. **Una fila del borrador que se cruza con una revisada** (mismo modelo, años que se tocan): no frena el build ni despublica la revisada; el problema se anota solo en la del borrador. → Task 7, `problemasEntreFilas`.
5. **Filas en blanco al final de la hoja**, que Google Sheets exporta con formato o con textos vacíos: se ignoran, no se rechazan como «fila sin ningún dato». → Task 6, `validarLibroVehiculos`.

## Decisiones de este plan

La spec dejó estos puntos abiertos; el plan los fija así:

- **Columnas de VEHICULOS, en este orden:** `marca`, `modelo`, `version`, `desde`, `hasta`, `radio_1din`, `radio_2din`, luego `ubicacion_N`, `medida_N`, `accesorio_N` para N = 1…4, y al final `revisado`. Agrupadas por ubicación para que quien edita lea cada una junta.
- **Los años se escriben como número.** Un año escrito como texto («2010» entre comillas) rechaza la fila, igual que un precio en el catálogo.
- **`radio_*` y `accesorio_*` no distinguen mayúsculas** («Con marco», «ksm-8»). `ubicacion_*` y `medida_*` se comparan exactos contra LISTAS, después de quitar espacios de los extremos.
- **Una ubicación repetida en la misma fila rechaza la fila**: daría dos grupos con el mismo título.
- **Problemas entre filas** (años que se cruzan, grafías con el mismo slug): si todas las filas involucradas están revisadas, se rechazan todas; si alguna no lo está, el problema se anota solo en las que no están revisadas.
- **Cuando no queda ninguna fila publicable**, el aborto lista en consola también los rechazos y los problemas del borrador, porque en ese caso no se escribe el reporte.
- **Entran solo los productos cuya categoría principal es Receptores o Bocinas.** Los Sistemas que listan Bocinas como secundaria no traen `atributos` ni medida, así que no pueden coincidir.
- **Un año con un solo vehículo lo elige solo**, aunque la dirección traiga otra versión, y el título lleva la versión de esa fila si la tiene.
- **Si no hay receptores, esa sección no se dibuja.** Los grupos de bocinas salen siempre, vacíos o no, salvo cuando no sale nada en todo el vehículo: ahí solo va «No hay receptores ni bocinas…».
- `slugificar` sale de `scripts/import-catalog.ts` a `scripts/slug.ts`, para usar la misma en los dos importadores.
- `CLASE_SELECT` sale de `SearchExperience.tsx` a `components/ui/campos.ts`, y `ProductGrid.tsx` exporta `CLASES_GRID`.
- La descarga usa `fetch` con `AbortSignal.timeout(8000)`.
- **Parámetros del vehículo en `/buscar`:** `vehiculo` (la marca del vehículo), `modelo`, `anio` y `version`. Ninguno choca con los de la búsqueda (`q`, `categoria`, `medida`, `canales`, `marca`, `disp`, `uso`, `orden`, `ver`).
- **Encabezados del bloque:** h2 «Receptores y bocinas por vehículo»; h3 el vehículo («Toyota Corolla 2010»); h4 en mono, «Receptores» y «Bocinas»; h5 cada ubicación.
- **La URL absoluta para el mensaje de la AP6650BT** sale de `absoluteUrl("/buscar")` en `app/buscar/page.tsx`, y baja como prop (`urlBuscar`) por `SearchExperience` y `Busqueda`: `SITE_URL` no existe en el cliente.

---

### Task 1: Nav — medir (hecho) y pasar el selector a `/buscar`

**Resultado:** a 1280 px, «Vehículos» (56 px más 22 de separación) empujaba el grupo de la derecha 21 px dentro del margen de 48. Se revirtió, se preguntó, y el negocio decidió poner el selector en `/buscar`. El nav no cambia. Lo que queda de este task es commitear la spec y el plan actualizados:

```bash
git add docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md docs/superpowers/plans/2026-11-04-selector-vehiculos.md
git commit -m "docs(vehiculos): el selector vive en /buscar; el enlace no entraba en el nav"
```

Los pasos de abajo son el registro de la medición.

- [ ] **Step 1: Medir antes del cambio.** `preview_start` con `sonoro-dev`, `resize_window` a 1280 × 900, abrir `/` y correr en la página:

```js
const fila = document.querySelector("header > div");
const nav = fila.querySelector("nav");
const der = nav.nextElementSibling;
({
  holgura: Math.round(der.getBoundingClientRect().left - nav.getBoundingClientRect().right - 40),
  scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  alto: fila.offsetHeight,
  altos: [...der.querySelectorAll("a")].map((a) => a.offsetHeight),
});
```

El 40 es el `gap-10` de la fila. Anotar `holgura`; CLAUDE.md dice 97.

- [ ] **Step 2: Agregar `{ href: "/vehiculos", nombre: "Vehículos" }` después de Marcas en `ENLACES_SECUNDARIOS`.** El grupo queda Marcas · Vehículos · Nosotros · Buscar · Carrito.

- [ ] **Step 3: Medir de nuevo**, con el mismo código y el mismo ancho.
Pasa si: `scroll === 0`, `alto === 60`, `holgura >= 0` y todos los valores de `altos` son iguales (ningún enlace se partió en dos líneas). A 1279 px, abrir el menú y ver «Vehículos» después de Marcas.

- [ ] **Step 4: Si no pasa, revertir el cambio, parar y preguntarle al usuario.** No se mueve el breakpoint sin consultar.

- [x] **Step 5: No aplica.** El enlace no entró y se revirtió. Medido: 57 px libres antes del cambio, sin contar los 40 de separación (los 97 de CLAUDE.md los incluyen); con «Vehículos», el grupo se salía 21 px del margen. El Task 15 lo pasa a CLAUDE.md.

---

### Task 2: Tipos, pantallas especiales y lo que baja el navegador

**Files:**
- Create: `lib/vehiculos/types.ts`, `lib/vehiculos/especiales.ts`, `lib/vehiculos/datos.ts`, `lib/vehiculos/archivo.ts`
- Test: `lib/vehiculos/datos.test.ts`, `lib/vehiculos/especiales.test.ts`, `lib/vehiculos/archivo.test.ts`

**Interfaces:**
- Consumes: `Producto`, `ProductoTarjeta`, `Atributos` de `lib/catalog/types.ts`.
- Produces, en `lib/vehiculos/types.ts` (TS puro, sin `zod`):

```ts
export const ESTADOS_RADIO = ["directo", "con_marco", "no_cabe"] as const;
export type EstadoRadio = (typeof ESTADOS_RADIO)[number];
export const PIEZAS_NOMBRADAS = ["OEMBKT60", "OEMBKT69", "KSM-8"] as const;
export type PiezaNombrada = (typeof PIEZAS_NOMBRADAS)[number];
export type Accesorio = PiezaNombrada | "otro";
export const SCHEMA_VERSION_VEHICULOS = 1;

export interface UbicacionVehiculo { ubicacion: string; medidas: string[]; accesorio: Accesorio | null }
export interface Vehiculo {
  marca: string; marcaSlug: string;
  modelo: string; modeloSlug: string;
  version: string | null; versionSlug: string | null;
  desde: number; hasta: number;
  radio1din: EstadoRadio | null; radio2din: EstadoRadio | null;
  ubicaciones: UbicacionVehiculo[];
}
export interface VehiculosArchivo { schemaVersion: typeof SCHEMA_VERSION_VEHICULOS; vehiculos: Vehiculo[] }

export type ProductoVehiculo = ProductoTarjeta & { formato?: Atributos["formato"]; medida?: Atributos["medida"] };
export interface PiezaVehiculo { sku: PiezaNombrada; slug: string; nombre: string }
export interface DatosVehiculos {
  vehiculos: Vehiculo[];
  receptores: ProductoVehiculo[];
  bocinas: ProductoVehiculo[];
  piezas: PiezaVehiculo[];
}
```

- `lib/vehiculos/especiales.ts`: `export type ReglaEspecial = "1-o-2-din" | "consultar"` y `export const PANTALLAS_ESPECIALES: Readonly<Record<string, ReglaEspecial>> = { "DMH-ZS9350BT": "1-o-2-din", "DMH-AP6650BT": "consultar" }`.
- `lib/vehiculos/datos.ts`: `armarDatosVehiculos(vehiculos: readonly Vehiculo[], productos: readonly Producto[]): DatosVehiculos`.
- `lib/vehiculos/archivo.ts` (solo servidor): `parsearVehiculosArchivo(json: unknown): Vehiculo[]` y `leerVehiculos(): Promise<Vehiculo[]>`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`datos.test.ts` usa un ayudante local `prod(sku, categoria, extra?: Partial<Producto>): Producto` que arma un producto válido: 3 `specsDestacadas`, 3 `specsFicha`, `precioCents` 100000, «disponible», `destacado` false, `activo` true, `uso` `["carro"]`, `imagenes` vacío, `moneda` «GTQ».

```ts
test("armarDatosVehiculos: entran receptores y bocinas activos, para carro y que se pueden pedir", () => {
  const d = armarDatosVehiculos([], [
    prod("R1", "Receptores", { atributos: { formato: "2-din" } }),
    prod("R2", "Receptores", { disponibilidad: "agotado" }),
    prod("R3", "Receptores", { activo: false }),
    prod("R4", "Receptores", { disponibilidad: "bajo_pedido" }),
    prod("B1", "Bocinas", { uso: ["marino"], atributos: { medida: '6.5"' } }),
    prod("B2", "Bocinas", { uso: ["carro", "marino"], atributos: { medida: '6.5"' } }),
    prod("B3", "Bocinas", { uso: undefined, atributos: { medida: '6x9"' } }),
    prod("S1", "Sistemas", { categoriasSecundarias: ["Bocinas"] }),
    prod("A1", "Amplificadores"),
  ]);
  assert.deepEqual(d.receptores.map((p) => p.sku), ["R1", "R4"]);
  assert.deepEqual(d.bocinas.map((p) => p.sku), ["B2", "B3"]);
});

test("armarDatosVehiculos: el receptor lleva formato y la bocina medida, sin ficha ni atributos", () => {
  // receptores[0].formato === "2-din"; bocinas[0].medida === '6.5"';
  // ni "specsFicha" ni "atributos" son claves de esos objetos.
});

test("armarDatosVehiculos: una pieza viaja solo si está activa y no agotada", () => {
  // KSM-8 activa y disponible, OEMBKT60 agotada, OEMBKT69 inactiva →
  // piezas deepEqual [{ sku: "KSM-8", slug, nombre }] con el slug y el nombre del producto.
});

test("armarDatosVehiculos: los vehículos pasan tal cual", () => {
  // assert.deepEqual(armarDatosVehiculos([v], []).vehiculos, [v]).
});
```

`especiales.test.ts` lee `data/catalog.json` con `readFileSync`, como `lib/catalog/marcas.test.ts`:

```ts
test("las pantallas especiales existen en el catálogo y son receptores", () => {
  for (const sku of Object.keys(PANTALLAS_ESPECIALES)) {
    const p = catalogo.find((x) => x.sku === sku);
    assert.ok(p, `falta ${sku} en el catálogo`);
    assert.equal(p.categoria, "Receptores");
  }
});

test("OEMBKT60, OEMBKT69 y KSM-8 existen en el catálogo", () => {
  for (const sku of PIEZAS_NOMBRADAS) assert.ok(catalogo.some((x) => x.sku === sku), `falta ${sku}`);
});
```

`archivo.test.ts`:

```ts
test("parsearVehiculosArchivo: devuelve los vehículos de un archivo válido", () => {
  assert.deepEqual(parsearVehiculosArchivo({ schemaVersion: 1, vehiculos: [corolla] }), [corolla]);
});
test("parsearVehiculosArchivo: otro schemaVersion lanza", () => {
  assert.throws(() => parsearVehiculosArchivo({ schemaVersion: 2, vehiculos: [] }), /schemaVersion/);
});
test("parsearVehiculosArchivo: un radio fuera de lista lanza", () => {
  assert.throws(() => parsearVehiculosArchivo({ schemaVersion: 1, vehiculos: [{ ...corolla, radio1din: "sí" }] }), /radio1din/);
});
```

- [ ] **Step 2: Correr las tres y ver que fallan**

Run: `node --no-warnings --test lib/vehiculos/datos.test.ts lib/vehiculos/especiales.test.ts lib/vehiculos/archivo.test.ts`
Expected: FAIL, los módulos no existen.

- [ ] **Step 3: Implementar `types.ts`, `especiales.ts`, `datos.ts` y `archivo.ts`**

- `armarDatosVehiculos`: filtra por `categoria === "Receptores"` o `"Bocinas"`, que esté activo, que no esté agotado y que `uso` sea `undefined` o incluya «carro». A cada uno le deja los campos de la tarjeta (los que pide `ProductoTarjeta`, sin `categoriasSecundarias` ni `uso`) más `formato` o `medida` de `atributos`, si los trae. Las piezas salen de `PIEZAS_NOMBRADAS`, en ese orden, sin mirar `uso`.
- `archivo.ts`: los esquemas `zod` (`z.strictObject`) que reflejan `Vehiculo` y `VehiculosArchivo`, con `schemaVersion: z.literal(1)`. `parsearVehiculosArchivo` lanza `Error("data/vehiculos.json no es válido: …")` con la ruta y el mensaje de cada problema. `leerVehiculos` lee `data/vehiculos.json` con `readFile`, armando la ruta desde `import.meta.url` como `lib/catalog/adapters/static.ts`.

- [ ] **Step 4: Correr las pruebas y ver que pasan.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/vehiculos
git commit -m "feat(vehiculos): tipos, pantallas especiales y datos para el navegador"
```

---

### Task 3: Reglas de compatibilidad

**Files:**
- Create: `lib/vehiculos/compatibilidad.ts`
- Test: `lib/vehiculos/compatibilidad.test.ts`

**Interfaces:**
- Consumes: los tipos de `lib/vehiculos/types.ts`, `PANTALLAS_ESPECIALES`, `compararRelevancia`.
- Produces:

```ts
export type EstadoCompat =
  | { tipo: "cabe" }
  | { tipo: "con_pieza"; pieza: PiezaVehiculo }
  | { tipo: "con_accesorios" }
  | { tipo: "consultar" };
export interface ProductoCompatible { producto: ProductoVehiculo; estado: EstadoCompat }
export interface GrupoBocinas { ubicacion: string; medidas: string[]; bocinas: ProductoCompatible[] }
export interface Compatibilidad { receptores: ProductoCompatible[]; grupos: GrupoBocinas[] }
export function compatibilidad(vehiculo: Vehiculo, datos: Pick<DatosVehiculos, "receptores" | "bocinas" | "piezas">): Compatibilidad;
export function hayResultados(c: Compatibilidad): boolean;
```

- [ ] **Step 1: Escribir las pruebas que fallan**

Ayudantes locales:
- `receptor(sku, formato?, extra?)` y `bocina(sku, medida, extra?)`: `ProductoVehiculo` con `destacado` false y `precioCents` 100000 si no se dice otra cosa.
- `vehiculo(extra?)`: Toyota Corolla 2009–2013, con los dos radios en `null` y sin ubicaciones.
- `KSM8 = { sku: "KSM-8", slug: "kbt-ksm-8", nombre: 'Alza para bocinas de 6.5"' }`.
- `estados(c)`: devuelve los pares `[sku, tipo]` de los receptores.

```ts
test("receptores: 1 DIN y 2 DIN siguen su columna", () => {
  const c = compatibilidad(vehiculo({ radio1din: "directo", radio2din: "con_marco" }), {
    receptores: [receptor("R1", "1-din"), receptor("R2", "2-din")], bocinas: [], piezas: [],
  });
  assert.deepEqual(estados(c), [["R1", "cabe"], ["R2", "con_accesorios"]]);
});
test("receptores: con no_cabe o sin dato, no sale", () => {
  // radio1din "no_cabe", radio2din null, con R1 1-din y R2 2-din → receptores [].
});
test("DMH-ZS9350BT toma la mejor columna, aunque hoy su formato diga flotante", () => {
  // receptor("DMH-ZS9350BT", "flotante"):
  // { con_marco, directo } → "cabe"; { con_marco, no_cabe } → "con_accesorios";
  // { no_cabe, null } → no sale.
});
test("DMH-AP6650BT sale siempre, con Consultar", () => {
  // con los dos radios en no_cabe → [["DMH-AP6650BT", "consultar"]].
});
test("otro receptor específico o flotante no sale nunca", () => {
  // receptor("PMX-3", "especifico") y receptor("X1", "flotante"), con los dos radios
  // en directo → receptores [].
});
test("bocinas: solo la misma medida", () => {
  // Ubicación ['6.5"'] con bocinas de 6.5" y 6.75" → solo la de 6.5".
  // Ubicación ['6"'] con una de 6x9" → el grupo sale vacío.
});
test("bocinas: dos medidas traen las de ambas, y una bocina sale en dos ubicaciones", () => {
  // Delanteras ['5.25"', '6.5"'] y traseras ['6.5"']: B525 y B65 adelante, B65 atrás.
});
test("bocinas: el accesorio de la ubicación decide el estado", () => {
  // Cuatro ubicaciones de 6.5" con accesorio null, "KSM-8", "OEMBKT60" y "otro", y
  // piezas [KSM8] → "cabe", { con_pieza, pieza: KSM8 }, "con_accesorios" (la pieza no
  // está en los datos) y "con_accesorios".
});
test("un grupo sin bocinas sale igual, vacío", () => {
  // grupos.length es igual a ubicaciones.length; el grupo de 6x8" trae bocinas [].
});
test("orden: por estado y, dentro, por relevancia", () => {
  // Con radio2din directo y radio1din con_marco, los receptores
  //   AP (consultar), C1 2-din de Q 1,000, C2 2-din destacado de Q 500 y M1 1-din de Q 9,000
  // salen ["C2", "C1", "M1", "DMH-AP6650BT"].
});
test("hayResultados: falso solo sin receptores y con todos los grupos vacíos", () => {});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test lib/vehiculos/compatibilidad.test.ts`
Expected: FAIL, el módulo no existe.

- [ ] **Step 3: Implementar `compatibilidad()` y `hayResultados()`**

Las reglas, en este orden:
1. `PANTALLAS_ESPECIALES[sku]` va primero, por el código.
   - «consultar» da `consultar`.
   - «1-o-2-din» da `cabe` si alguna de las dos columnas es `directo`, y `con_accesorios` si alguna es `con_marco`; si no, el receptor no sale.
2. Después, el formato: `1-din` sigue `radio1din`, `2-din` sigue `radio2din`, con `directo` → `cabe` y `con_marco` → `con_accesorios`. Cualquier otro formato no sale.
3. Bocinas: un grupo por ubicación, en el orden del vehículo. Entran las de `medidas.includes(medida)`.
   - Accesorio `null` → `cabe`.
   - `otro` → `con_accesorios`.
   - Una pieza nombrada → `con_pieza` si está en `datos.piezas`; si no, `con_accesorios`.
4. Orden: el rango del estado (cabe 0, con_pieza 1, con_accesorios 2, consultar 3) y después `compararRelevancia`.

- [ ] **Step 4: Correr y ver que pasa.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/vehiculos/compatibilidad.ts lib/vehiculos/compatibilidad.test.ts
git commit -m "feat(vehiculos): reglas de compatibilidad de receptores y bocinas"
```

---

### Task 4: Selección en la dirección y textos de la página

**Files:**
- Create: `lib/vehiculos/url.ts`, `lib/vehiculos/textos.ts`
- Test: `lib/vehiculos/url.test.ts`, `lib/vehiculos/textos.test.ts`

**Interfaces:**
- Consumes: `Vehiculo`, `EstadoCompat`, `GrupoBocinas`, `compararTexto`.
- Produces, en `url.ts`:

```ts
export interface Seleccion { marca?: string; modelo?: string; anio?: number; version?: string } // slugs; en la dirección la marca va en `vehiculo`
export interface Opcion { slug: string; nombre: string }
export interface SeleccionResuelta {
  marca: Opcion | null; modelo: Opcion | null; anio: number | null; version: Opcion | null;
  vehiculo: Vehiculo | null;
  opciones: { marcas: Opcion[]; modelos: Opcion[]; anios: number[]; versiones: Opcion[] };
}
export function leerSeleccion(busqueda: string): Seleccion;
export function escribirSeleccion(sel: Seleccion): string; // "" o "vehiculo=…&modelo=…&anio=…&version=…"
export function resolverSeleccion(vehiculos: readonly Vehiculo[], sel: Seleccion): SeleccionResuelta;
```

- Produces, en `textos.ts`:

```ts
export const TEXTOS_ESTADO: Record<EstadoCompat["tipo"], string>;
// { cabe: "Cabe", con_pieza: "Cabe con", con_accesorios: "Cabe con accesorios", consultar: "Requiere un marco…" }
export const SIN_RESULTADOS = "No hay receptores ni bocinas que quepan en este vehículo.";
export const ERROR_CARGA = "No se pudo cargar la lista de vehículos.";
export function tituloVehiculo(vehiculo: Vehiculo, anio: number): string;
export function tituloGrupo(grupo: Pick<GrupoBocinas, "ubicacion" | "medidas">): string;
export function textoGrupoVacio(grupo: Pick<GrupoBocinas, "medidas">): string;
```

- [ ] **Step 1: Escribir las pruebas que fallan**

`url.test.ts`, con estos vehículos:
- Toyota Corolla 2003–2008, sin versión.
- Toyota Corolla 2009–2013, versión «Tablero gris».
- Toyota Corolla 2010–2011, versión «Tablero negro».
- Toyota Yaris 2006–2011.
- Honda Civic 2006–2011.

```ts
test("leerSeleccion: lee los cuatro parámetros; un año que no es número no cuenta", () => {
  assert.deepEqual(leerSeleccion("vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris"),
    { marca: "toyota", modelo: "corolla", anio: 2010, version: "tablero-gris" });
  assert.equal(leerSeleccion("vehiculo=toyota&anio=abc").anio, undefined);
});
test("escribirSeleccion: orden fijo, y sin un nivel al que le falta el anterior", () => {
  assert.equal(escribirSeleccion({ marca: "toyota", modelo: "corolla", anio: 2010, version: "tablero-gris" }),
    "vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris");
  assert.equal(escribirSeleccion({ marca: "toyota", anio: 2010 }), "vehiculo=toyota");
  assert.equal(escribirSeleccion({}), "");
});
test("resolverSeleccion: marcas y modelos por nombre, años del más nuevo al más viejo", () => {
  // { marca: "toyota", modelo: "corolla" } → marcas ["Honda", "Toyota"],
  // modelos ["Corolla", "Yaris"], anios [2013, 2012, …, 2003].
});
test("resolverSeleccion: un valor que no existe deja el selector en ese nivel", () => {
  // { marca: "toyota", modelo: "camry", anio: 2010 } → marca Toyota, modelo null,
  // anio null, vehiculo null, y opciones.modelos todavía ["Corolla", "Yaris"].
  // { marca: "zzz" } → marca null y opciones.modelos [].
});
test("resolverSeleccion: «Versión» solo con más de una", () => {
  // corolla 2012: versiones [], vehiculo = la fila «Tablero gris», version = Tablero gris.
  // corolla 2010: versiones ["Tablero gris", "Tablero negro"], vehiculo null.
  // corolla 2010 con version "tablero-negro" → la fila 2010–2011.
});
test("resolverSeleccion: con un solo vehículo en el año, una versión de más no rompe", () => {
  // corolla 2005 con version "tablero-negro" → vehiculo = la fila 2003–2008, version null.
});
```

`textos.test.ts`:

```ts
test("tituloVehiculo: con y sin versión", () => {
  assert.equal(tituloVehiculo(corolla, 2010), "Toyota Corolla 2010");
  assert.equal(tituloVehiculo({ ...corolla, version: "Tablero gris" }, 2010), "Toyota Corolla 2010 · Tablero gris");
});
test("tituloGrupo: una o varias medidas", () => {
  assert.equal(tituloGrupo({ ubicacion: "Puertas delanteras", medidas: ['6.5"'] }), 'Puertas delanteras · 6.5"');
  assert.equal(tituloGrupo({ ubicacion: "Puertas delanteras", medidas: ['5.25"', '6.5"'] }), 'Puertas delanteras · 5.25" o 6.5"');
});
test("textoGrupoVacio: nombra la medida solo si es una", () => {
  assert.equal(textoGrupoVacio({ medidas: ['6x8"'] }), 'No hay bocinas de 6x8" en el catálogo.');
  assert.equal(textoGrupoVacio({ medidas: ['5x7"', '6x8"'] }), "No hay bocinas de esas medidas en el catálogo.");
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test lib/vehiculos/url.test.ts lib/vehiculos/textos.test.ts`
Expected: FAIL, los módulos no existen.

- [ ] **Step 3: Implementar `url.ts` y `textos.ts`**

- `leerSeleccion`: con `URLSearchParams`. `anio` cuenta solo si cumple `^\d{4}$`; un texto vacío es lo mismo que no traerlo.
- `resolverSeleccion`: baja nivel por nivel y se detiene en el primero que no coincide.
  - Las opciones son únicas por slug y van ordenadas por nombre con `compararTexto`. Los años salen de la unión de `desde…hasta`, de mayor a menor.
  - Si el año lo cubre un solo vehículo, ese queda elegido, `versiones` va vacía y `version` es la de esa fila.
  - Si lo cubren varios, `versiones` los lista y `vehiculo` queda en `null` hasta que la versión coincida.
- La lista de versiones va ordenada por nombre.

- [ ] **Step 4: Correr y ver que pasa.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/vehiculos/url.ts lib/vehiculos/url.test.ts lib/vehiculos/textos.ts lib/vehiculos/textos.test.ts
git commit -m "feat(vehiculos): selección en la dirección y textos de resultados"
```

---

### Task 5: Mensajes de WhatsApp

**Files:**
- Modify: `lib/whatsapp/message.ts` (al final), `lib/whatsapp/index.ts`
- Test: `lib/whatsapp/message.test.ts`

**Interfaces:**
- Produces: `buildVehicleInquiryMessage(): string` y `buildVehicleProductInquiryMessage(params: { nombre: string; sku: string; vehiculo: string; url: string }): string`, exportadas también desde `lib/whatsapp/index.ts`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test("buildVehicleInquiryMessage: el texto de «¿No está tu vehículo?»", () => {
  assert.equal(buildVehicleInquiryMessage(),
    "Hola Sonoro, quiero consultar qué receptores y bocinas caben en mi vehículo.");
});
test("buildVehicleProductInquiryMessage: producto, vehículo con versión y URL", () => {
  assert.equal(buildVehicleProductInquiryMessage({
    nombre: 'Pantalla de 9" DMH-AP6650BT', sku: "DMH-AP6650BT",
    vehiculo: "Toyota Corolla 2010 · Tablero gris",
    url: "https://sonoro.gt/buscar?vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris",
  }), [
    "Hola Sonoro, quiero consultar sobre:",
    'Pantalla de 9" DMH-AP6650BT (DMH-AP6650BT)',
    "Vehículo: Toyota Corolla 2010 · Tablero gris",
    "https://sonoro.gt/buscar?vehiculo=toyota&modelo=corolla&anio=2010&version=tablero-gris",
  ].join("\n"));
});
test("buildVehicleProductInquiryMessage: vehículo sin versión", () => {
  // La misma forma, con «Vehículo: Toyota Corolla 2010».
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test lib/whatsapp/message.test.ts`
Expected: FAIL, las funciones no existen.

- [ ] **Step 3: Implementar las dos funciones en `message.ts`, con el mismo estilo de `buildProductInquiryMessage`, y exportarlas desde `index.ts`.**

- [ ] **Step 4: Correr y ver que pasa.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp
git commit -m "feat(vehiculos): mensajes de WhatsApp del selector"
```

---

### Task 6: Importador — contrato del libro

**Files:**
- Create: `scripts/slug.ts`, `scripts/vehiculos/contrato.ts`, `scripts/vehiculos/libro-de-prueba.ts` (ayudante de pruebas; sin `.test`, así `npm test` no lo corre)
- Modify: `scripts/import-catalog.ts:331-339` (sacar `slugificar` e importarla)
- Test: `scripts/slug.test.ts`, `scripts/vehiculos/contrato.test.ts`

**Interfaces:**
- Consumes: `leerLibro`, `esVacia`, `Celda` y `LibroCrudo` de `scripts/catalogo/contrato.ts`.
- Produces:
  - `scripts/slug.ts`: `slugificar(texto: string): string`, el mismo cuerpo que hoy está en `import-catalog.ts`.
  - `scripts/vehiculos/contrato.ts`:

```ts
export const HOJA_VEHICULOS = "VEHICULOS";
export const HOJA_LISTAS = "LISTAS";
export const COLUMNAS_VEHICULOS: readonly string[]; // el orden de «Decisiones de este plan»
export const COLUMNAS_LISTAS = ["ubicacion", "medida"] as const;
export interface FilaVehiculoCruda { numero: number; celdas: Readonly<Record<string, Celda>> }
export interface Listas { ubicaciones: ReadonlySet<string>; medidas: ReadonlySet<string> }
export function validarLibroVehiculos(libro: LibroCrudo): { ofensores: string[]; filas: FilaVehiculoCruda[]; listas: Listas };
```

  - `libro-de-prueba.ts`:
    - `filaVehiculo(valores: Record<string, Celda>): Celda[]`: una fila en el orden de `COLUMNAS_VEHICULOS`; lo que no se pasa queda en `null`.
    - `libroVehiculos(opciones?: { vehiculos?: Celda[][]; listas?: Celda[][]; encabezados?: string[]; hojas?: string[] }): LibroCrudo`: por defecto, encabezados correctos, una fila válida y LISTAS con «Puertas delanteras», «Bandeja trasera» y las medidas `6.5"`, `5.25"`, `6x9"`, `7/8"`, `6x8"`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// scripts/slug.test.ts
test("slugificar: minúsculas, sin acentos y con guiones", () => {
  assert.equal(slugificar("Cerwin-Vega "), "cerwin-vega");
  assert.equal(slugificar("Tablero gris"), "tablero-gris");
  assert.equal(slugificar("Land Cruiser"), "land-cruiser");
  assert.equal(slugificar("Protegé"), "protege");
});

// scripts/vehiculos/contrato.test.ts
test("libro válido: sin ofensores, filas numeradas como en la hoja", () => {
  const { ofensores, filas } = validarLibroVehiculos(libroVehiculos());
  assert.deepEqual(ofensores, []);
  assert.equal(filas[0].numero, 2);
});
test("falta o sobra una hoja", () => {
  // hojas ["VEHICULOS"] → un ofensor que nombra LISTAS.
  // hojas ["VEHICULOS", "LISTAS", "NOTAS"] → un ofensor que nombra NOTAS.
});
test("columna que falta, que sobra o fuera de orden", () => {
  // Sin «revisado» → ofensor /revisado/; con «color» de más → /color/;
  // con desde y hasta cambiadas → /orden/.
});
test("las filas en blanco no cuentan", () => {
  // Una fila válida, tres de null y una de "" → filas.length === 1.
});
test("LISTAS: columnas de distinto largo, sin espacios en los extremos", () => {
  // ubicacion con 3 valores y medida con 5 (uno es " 6.5\" ") →
  // listas.medidas.has('6.5"') y listas.ubicaciones.size === 3.
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test scripts/slug.test.ts scripts/vehiculos/contrato.test.ts`
Expected: FAIL, los módulos no existen.

- [ ] **Step 3: Implementar**

- Mover `slugificar` a `scripts/slug.ts` e importarla en `import-catalog.ts`.
- `validarLibroVehiculos`:
  - Cada hoja que falta o sobra es un ofensor.
  - El encabezado (fila 1, sin los `null` del final) tiene que ser igual a la lista de columnas. Si no lo es, el ofensor dice qué columna falta, cuál sobra o que el orden no coincide.
  - Una fila cuenta si alguna celda no está vacía (`esVacia`).
  - LISTAS se lee por columna: textos sin espacios en los extremos, y los vacíos se saltan.

- [ ] **Step 4: Correr estas pruebas y todas las del catálogo**

Run: `node --no-warnings --test scripts/slug.test.ts scripts/vehiculos/contrato.test.ts` y después `npm test`
Expected: PASS. El catálogo no cambia de comportamiento.

- [ ] **Step 5: Commit**

```bash
git add scripts/slug.ts scripts/slug.test.ts scripts/import-catalog.ts scripts/vehiculos
git commit -m "feat(vehiculos): contrato del libro de vehículos"
```

---

### Task 7: Importador — filas y problemas entre filas

**Files:**
- Create: `scripts/vehiculos/filas.ts`, `scripts/vehiculos/validaciones.ts`
- Test: `scripts/vehiculos/filas.test.ts`, `scripts/vehiculos/validaciones.test.ts`

**Interfaces:**
- Consumes: `FilaVehiculoCruda`, `Listas`, `slugificar`, los tipos de `lib/vehiculos/types.ts`.
- Produces:

```ts
// filas.ts
export interface FilaVehiculo { numero: number; revisado: boolean; vehiculo: Vehiculo }
export type ResultadoFila =
  | { ok: true; fila: FilaVehiculo }
  | { ok: false; numero: number; revisado: boolean | null; motivos: string[] };
export interface ContextoFila { listas: Listas; skusCatalogo: ReadonlySet<string>; anioActual: number }
export function normalizarFilaVehiculo(fila: FilaVehiculoCruda, ctx: ContextoFila): ResultadoFila;

// validaciones.ts
export function problemasEntreFilas(filas: readonly FilaVehiculo[]): Map<number, string[]>; // número de fila → motivos
```

- [ ] **Step 1: Escribir las pruebas que fallan**

Para `filas.test.ts`:
- Ayudante `cruda(celdas: Record<string, Celda>, numero = 2)`. Su base es Toyota, Corolla, `desde` 2009, `hasta` 2013, `radio_2din` «directo», `ubicacion_1` «Puertas delanteras», `medida_1` `6.5"` y `revisado` «sí». Lo que se pasa reemplaza esa base.
- `ctx`: las LISTAS de `libro-de-prueba.ts`, `skusCatalogo` = {KSM-8, OEMBKT60, OEMBKT69} y `anioActual` 2026.
- `motivos(r)`: devuelve `r.ok ? [] : r.motivos`.

```ts
test("fila válida: slugs, radios y ubicaciones normalizados", () => {
  const r = normalizarFilaVehiculo(cruda({ radio_1din: "Con marco", radio_2din: "no cabe" }), ctx);
  assert.ok(r.ok);
  assert.equal(r.fila.vehiculo.marcaSlug, "toyota");
  assert.equal(r.fila.vehiculo.radio1din, "con_marco");
  assert.equal(r.fila.vehiculo.radio2din, "no_cabe");
  assert.equal(r.fila.vehiculo.versionSlug, null);
  assert.deepEqual(r.fila.vehiculo.ubicaciones, [{ ubicacion: "Puertas delanteras", medidas: ['6.5"'], accesorio: null }]);
});
test("revisado: sí, si, SÍ y no; vacío o raro rechaza", () => {
  // "SI" → revisado true; " no " → false; "" → ok false, revisado null, motivos /revisado/.
});
test("años: enteros de 1940 al año actual más uno, y desde ≤ hasta", () => {
  // Rechazan: desde 1939 (/desde/), hasta 2028 (/hasta/), desde 2010 con hasta 2009
  // (/desde.*hasta/), desde "2010" como texto (/desde/) y desde 2010.5 (/desde/).
  // hasta 2027 es válido.
});
test("radio fuera de lista", () => { /* radio_1din "sí" → /radio_1din/ */ });
test("ubicación y medida contra LISTAS", () => {
  // ubicacion_1 "Techo" → /Techo/; medida_1 '6"' → /6"/.
});
test("varias medidas se separan con « / », y 7/8\" es una sola", () => {
  // medida_1 '5.25" / 6.5"' → medidas ['5.25"', '6.5"']; medida_1 '7/8"' → ['7/8"'].
});
test("ubicación sin medida, medida o accesorio sin ubicación", () => {
  // ubicacion_2 sin medida_2 → /ubicacion_2/; medida_3 sola → /medida_3/;
  // accesorio_4 "otro" solo → /accesorio_4/.
});
test("accesorio: los permitidos sin distinguir mayúsculas, y la pieza tiene que existir", () => {
  // "ksm-8" → "KSM-8"; "Otro" → "otro"; "XYZ" → /accesorio_1/;
  // OEMBKT69 con un skusCatalogo sin ella → /OEMBKT69/.
});
test("una ubicación repetida en la fila rechaza", () => { /* /repetida/ */ });
test("fila sin ningún dato", () => {
  // radio_2din, ubicacion_1 y medida_1 en null → /ningún dato/.
});
test("marca y modelo obligatorios", () => { /* marca "" → /marca/ */ });
test("junta todos los motivos de la fila", () => {
  // desde 1900 y radio_1din "x" → motivos.length === 2.
});
```

Para `validaciones.test.ts`, el ayudante es `fila(numero, revisado, v: Partial<Vehiculo>)`, que arma un `FilaVehiculo` sobre Toyota Corolla 2009–2013:

```ts
test("mismo modelo, años cruzados y sin versión: se anota en las dos", () => {
  const p = problemasEntreFilas([fila(2, true, {}), fila(3, true, { desde: 2012, hasta: 2015 })]);
  assert.match(p.get(2)?.join() ?? "", /fila 3/);
  assert.match(p.get(3)?.join() ?? "", /fila 2/);
});
test("cruzadas con la misma versión, o una con versión y otra sin: las dos", () => {});
test("versiones distintas, o años que no se tocan: sin problema", () => {
  // 2009–2011 y 2012–2015 → map vacío; «Tablero gris» 2009–2013 y «Tablero negro»
  // 2010–2011 → map vacío.
});
test("cruce con una fila sin revisar: se anota solo en la sin revisar", () => {
  const p = problemasEntreFilas([fila(2, true, {}), fila(3, false, { desde: 2012, hasta: 2015 })]);
  assert.equal(p.has(2), false);
  assert.ok(p.has(3));
});
test("dos grafías que dan el mismo slug: marca, modelo o versión", () => {
  // «Mazda» y «MAZDA», las dos revisadas → las dos; «CR-V» y «Cr-V» → las dos.
});
test("grafías distintas, con una sin revisar: solo la sin revisar", () => {});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test scripts/vehiculos/filas.test.ts scripts/vehiculos/validaciones.test.ts`
Expected: FAIL, los módulos no existen.

- [ ] **Step 3: Implementar**

- `normalizarFilaVehiculo` junta todos los motivos de la fila.
  - Cada motivo nombra la columna (`desde`, `ubicacion_2`…) y el valor.
  - Las medidas se separan solo con `" / "`, se recortan y se quitan las repetidas, conservando el orden.
  - Las ubicaciones vacías se saltan y las demás se compactan en orden, de la 1 a la 4.
  - Los slugs salen de `slugificar`. Un slug vacío también es motivo de rechazo.
- `problemasEntreFilas`:
  - Hay cruce si dos filas tienen la misma `marcaSlug` y `modeloSlug`, sus años se tocan, y alguna de las dos no trae versión o las dos traen el mismo `versionSlug`.
  - Hay colisión si grafías distintas de una marca, un modelo dentro de una marca, o una versión dentro de un modelo dan el mismo slug.
  - Regla de anotación: si todas las filas involucradas están revisadas, el problema se anota en todas; si no, solo en las que no están revisadas.

- [ ] **Step 4: Correr y ver que pasa.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/vehiculos/filas.ts scripts/vehiculos/filas.test.ts scripts/vehiculos/validaciones.ts scripts/vehiculos/validaciones.test.ts
git commit -m "feat(vehiculos): validación de filas y cruces del libro"
```

---

### Task 8: Importador — composición, reporte, comando y build

**Files:**
- Create: `scripts/vehiculos/importar.ts`, `scripts/import-vehiculos.ts`
- Modify: `package.json` (scripts `import:vehiculos` y `build`)
- Test: `scripts/vehiculos/importar.test.ts`

**Interfaces:**
- Consumes: `validarLibroVehiculos`, `normalizarFilaVehiculo`, `problemasEntreFilas`, `libroVehiculos`, `filaVehiculo`, `SCHEMA_VERSION_VEHICULOS`.
- Produces:

```ts
export type ResultadoImportacion =
  | { tipo: "abortar"; motivos: string[] }
  | { tipo: "listo"; archivo: VehiculosArchivo | null; reporte: string;
      publicadas: number; rechazadas: number; sinRevisar: number };
export function importarVehiculos(libro: LibroCrudo, ctx: { skusCatalogo: ReadonlySet<string>; anioActual: number }): ResultadoImportacion;
export function ordenarVehiculos(vehiculos: readonly Vehiculo[]): Vehiculo[];
```

`archivo` es `null` cuando hay rechazadas: es lo que deja `data/vehiculos.json` sin tocar.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test("el contrato roto aborta", () => {
  assert.equal(importarVehiculos(libroVehiculos({ hojas: ["VEHICULOS"] }), ctx).tipo, "abortar");
});
test("sin ninguna fila publicable aborta, y lista los problemas del borrador", () => {
  // Dos filas con revisado "no", una con desde 1900 → tipo "abortar";
  // motivos[0] cumple /ninguna fila/i y algún motivo nombra «fila 3» y «desde».
});
test("también aborta si todas las revisadas están rechazadas", () => {});
test("con una fila rechazada no hay archivo, pero sí reporte", () => {
  // Una buena con «sí» y una mala con «sí» → listo, archivo null, rechazadas 1, y el
  // reporte incluye "## Filas rechazadas" y "VEHICULOS fila 3".
});
test("revisado = no: no se publica, y sus problemas van a «Filas sin revisar» sin frenar", () => {
  // Una buena con «sí» y una mala con «no» → archivo con 1 vehículo, rechazadas 0,
  // sinRevisar 1, y el reporte incluye "## Filas sin revisar" y "fila 3".
});
test("el orden de salida es determinista", () => {
  // Toyota Yaris, Honda Civic, Toyota Corolla 2009 y Toyota Corolla 2003, en ese orden
  // y al revés, dan el mismo JSON.stringify(archivo), y el orden es
  // [civic, corolla 2003, corolla 2009, yaris].
});
test("schemaVersion es 1", () => {});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test scripts/vehiculos/importar.test.ts`
Expected: FAIL, el módulo no existe.

- [ ] **Step 3: Implementar `importarVehiculos`, `ordenarVehiculos` y el comando**

- Una fila es **rechazada** si su normalización falló o tiene problemas entre filas, y su `revisado` no es `false` (puede ser `true` o `null`).
- Es **sin revisar** si `revisado === false`; sus problemas van a esa sección.
- Es **publicable** si está bien, revisada y sin problemas.
- Sin publicables, `abortar`, con este primer motivo: «Ninguna fila quedó publicable: el sitio no tendría vehículos. Marcá con «sí» las filas revisadas.» Le siguen los rechazos y los problemas del borrador, como `VEHICULOS fila N: motivo; motivo`.
- `ordenarVehiculos` compara con `compararTexto`, en este orden: `marcaSlug`, `modeloSlug`, `versionSlug` (`null` primero) y `desde`.
- El reporte en Markdown:

```
# Importación de vehículos

N publicada(s), R rechazada(s), S sin revisar.

## Filas rechazadas

- VEHICULOS fila 7: motivo; motivo      (o «Ninguna.»)

## Filas sin revisar

No se publican hasta marcarlas con «sí». Sus problemas no frenan el build.

- VEHICULOS fila 12: motivo             (o «Ninguna con problemas.»)
```

- `scripts/import-vehiculos.ts` hace solo la entrada y salida, con el patrón de `import-catalog.ts`:
  - lee `data/source/vehiculos.xlsx` con `leerLibro` y los skus de `data/catalog.json`;
  - llama con `anioActual: new Date().getFullYear()`;
  - si aborta, imprime «✘ Importación de vehículos abortada. No se escribió ningún archivo.» y los motivos, y deja `exitCode = 1`;
  - si no aborta, escribe `reports/vehiculos-errores.md` y, si `archivo` no es `null`, `data/vehiculos.json` con `JSON.stringify(archivo, null, 2) + "\n"`;
  - con rechazadas, `exitCode = 1`;
  - si no puede leer el libro, aborta con la ruta en el mensaje.
- `package.json`:
  - `"import:vehiculos": "tsx scripts/import-vehiculos.ts"`
  - `"build": "npm run import:catalog && npm run import:vehiculos && next build"`

- [ ] **Step 4: Correr las pruebas y el comando**

Run: `node --no-warnings --test scripts/vehiculos/importar.test.ts`. Expected: PASS.
Run: `npm run import:vehiculos`. Expected: aborta con «No se pudo leer data/source/vehiculos.xlsx…» y código 1, porque el libro todavía no existe.

- [ ] **Step 5: Commit**

```bash
git add scripts/vehiculos/importar.ts scripts/vehiculos/importar.test.ts scripts/import-vehiculos.ts package.json
git commit -m "feat(vehiculos): importador del libro de vehículos"
```

---

### Task 9: Ruta de datos y descarga en el navegador

**Files:**
- Create: `app/buscar/vehiculos.json/route.ts`, `lib/vehiculos/carga.ts`
- Test: `lib/vehiculos/carga.test.ts`

**Interfaces:**
- Consumes: `leerVehiculos`, `armarDatosVehiculos`, `listAllProducts`, `DatosVehiculos`.
- Produces: `RUTA_DATOS_VEHICULOS = "/buscar/vehiculos.json"`, `PLAZO_DATOS_MS = 8000` y `descargarDatosVehiculos(fetchImpl?: typeof fetch, plazoMs?: number): Promise<DatosVehiculos | null>`, que nunca rechaza.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test("devuelve los datos con una respuesta válida", async () => {
  const datos = { vehiculos: [], receptores: [], bocinas: [], piezas: [] };
  assert.deepEqual(await descargarDatosVehiculos(async () => Response.json(datos)), datos);
});
test("null con una respuesta que no es OK", async () => { /* new Response("", { status: 500 }) */ });
test("null si fetch lanza", async () => {});
test("null con un JSON ajeno", async () => { /* Response.json({ productos: [] }) */ });
test("null si la descarga se traba más que el plazo", async () => {
  const trabado: typeof fetch = (_url, init) =>
    new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
  assert.equal(await descargarDatosVehiculos(trabado, 20), null);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test lib/vehiculos/carga.test.ts`
Expected: FAIL, el módulo no existe.

- [ ] **Step 3: Implementar**

- `carga.ts`: `fetchImpl(RUTA_DATOS_VEHICULOS, { signal: AbortSignal.timeout(plazoMs) })`. Rechaza con un chequeo de forma liviano, sin `zod`: los cuatro campos tienen que ser arreglos. Cualquier fallo devuelve `null`.
- `route.ts`: igual que `app/chat/catalogo.json/route.ts`.
  - `export const dynamic = "force-static"`.
  - `GET` devuelve `Response.json(armarDatosVehiculos(await leerVehiculos(), await listAllProducts()), { headers: { "X-Robots-Tag": "noindex" } })`.
  - Un comentario corto explica por qué es estático y por qué no lleva `Disallow`.

- [ ] **Step 4: Correr las pruebas y el typecheck**

Run: `node --no-warnings --test lib/vehiculos/carga.test.ts` y `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/buscar/vehiculos.json lib/vehiculos/carga.ts lib/vehiculos/carga.test.ts
git commit -m "feat(vehiculos): vehiculos.json estático y su descarga"
```

---

### Task 10: El selector en `/buscar`

**Files:**
- Create: `components/vehiculos/BusquedaPorVehiculo.tsx` (`"use client"`), `components/vehiculos/ResultadosVehiculo.tsx`, `components/ui/campos.ts`
- Modify:
  - `components/catalog/SearchExperience.tsx`: `CLASE_SELECT` pasa a importarse de `components/ui/campos.ts` (líneas 61-62); `SearchExperience` y `Busqueda` reciben `urlBuscar`; el estado vacío (`!consulta`, hoy «Escribe para buscar en el catálogo.») dibuja también `<BusquedaPorVehiculo>`;
  - `app/buscar/page.tsx`: `urlBuscar = absoluteUrl("/buscar")`, pasado a los dos `Busqueda` (el del fallback y el de adentro);
  - `components/catalog/ProductGrid.tsx:13`: `export const CLASES_GRID`.

**Interfaces:**
- Consumes:
  - de `lib/vehiculos/url.ts`: `leerSeleccion`, `escribirSeleccion`, `resolverSeleccion`;
  - de `lib/vehiculos/compatibilidad.ts`: `compatibilidad`, `hayResultados`;
  - de `lib/vehiculos/textos.ts`: `TEXTOS_ESTADO`, `SIN_RESULTADOS`, `ERROR_CARGA`, `tituloVehiculo`, `tituloGrupo`, `textoGrupoVacio`;
  - de `lib/vehiculos/carga.ts`: `descargarDatosVehiculos`;
  - de `lib/whatsapp/index.ts`: `buildVehicleInquiryMessage`, `buildVehicleProductInquiryMessage`, `buildWhatsAppUrl`, `WHATSAPP_NUMBER`;
  - de `lib/politicas.ts`: `INSTALACION`;
  - `ProductCard`, `CLASES_GRID`, `CLASE_SELECT`, `claseBoton`, `absoluteUrl`.
- Produces:
  - `BusquedaPorVehiculo({ busqueda, urlBuscar }: { busqueda: string; urlBuscar: string })`: `busqueda` es la misma cadena de parámetros que ya recibe `Busqueda`.
  - `ResultadosVehiculo({ titulo, compat, urlConsulta }: { titulo: string; compat: Compatibilidad; urlConsulta: string })`.

- [ ] **Step 1: Leer la documentación de Next** en `node_modules/next/dist/docs/`: `useSearchParams` en páginas prerenderizadas y `<Suspense>`.

- [ ] **Step 2: Implementar el selector**

- `app/buscar/page.tsx`: `urlBuscar = absoluteUrl("/buscar")`, resuelta en el servidor porque `SITE_URL` no existe en el cliente. La metadata no cambia.
- `SearchExperience.tsx`: en la rama `!consulta`, debajo del párrafo de hoy, `<BusquedaPorVehiculo busqueda={busqueda} urlBuscar={urlBuscar} />`. Con una consulta escrita, el bloque no se dibuja.
  - `irA` no cambia: arma la dirección desde cero, así que escribir una búsqueda ya borra los parámetros del vehículo.
- `BusquedaPorVehiculo`:
  - El estado de carga es `cargando`, `error` o `listo`, y la descarga se lanza al montar. Como solo se monta sin consulta, una búsqueda escrita no paga la descarga.
  - Mientras carga, las listas se ven deshabilitadas, con sus textos de muestra. Así se ve también en el HTML prerenderizado.
  - Si falla: `ERROR_CARGA` y un `<button>` «Reintentar» con `claseBoton("secundario", "compacto")`, que vuelve a descargar.
  - `cambiar(sel)` escribe `escribirSeleccion(sel)` con `window.history.replaceState(null, "", q ? `/buscar?${q}` : "/buscar")`.
  - Elegir una marca borra modelo, año y versión; elegir un modelo borra año y versión; elegir un año borra la versión.
- Layout, con las clases de `/buscar`:
  - Una sección `px-6 pt-10 sm:px-12`, con el h2 «Receptores y bocinas por vehículo» en `text-22 font-semibold tracking-[-0.02em]`.
  - Listas en `mt-4 flex flex-col gap-2.5 sm:flex-row`, cada una con `CLASE_SELECT` y `w-full sm:w-auto`.
    - La primera opción, con valor vacío, dice «Marca», «Modelo», «Año» o «Versión», y el `aria-label` es el mismo texto.
    - Cada lista se habilita cuando la anterior está elegida. «Versión» solo se dibuja si `opciones.versiones.length > 0`.
  - Debajo, en `mt-4 text-[13px] text-texto-secundario`: «¿No está tu vehículo? », y «Escríbenos por WhatsApp» como enlace a `buildWhatsAppUrl(WHATSAPP_NUMBER, buildVehicleInquiryMessage())`, cerrado con «.».
    - El enlace lleva los mismos atributos que el de `SinResultadosBusqueda.tsx`.
  - Con `vehiculo` y `anio` elegidos: `ResultadosVehiculo`.
    - `titulo` = `tituloVehiculo(vehiculo, anio)`.
    - `urlConsulta` = `urlBuscar` + `?` + la selección escrita.
- `ResultadosVehiculo`: un bloque `pt-10 pb-16 sm:pb-22` dentro de la sección.
  - El h3 con `titulo`, en `text-26 sm:text-38 font-semibold tracking-[-0.03em]`.
  - Si `!hayResultados(compat)`: un `<p>` con `SIN_RESULTADOS`, y nada más que la frase de instalación.
  - Si no:
    - «Receptores» como h4 mono (`font-mono text-[11px] tracking-[0.14em] uppercase text-texto-terciario`), solo si hay receptores. Después, una rejilla `CLASES_GRID`.
    - Cada celda es `flex flex-col gap-2`, con `<ProductCard producto={…} />` y, abajo y fuera de la tarjeta, `<p className="text-texto-secundario text-[13px]">` con el estado:
      - `con_pieza`: `TEXTOS_ESTADO.con_pieza`, un espacio y un `<Link href={`/producto/${pieza.slug}`}>` con `pieza.nombre`, en `text-negro underline`;
      - `consultar`: el texto, un espacio y el enlace «Escríbenos por WhatsApp» con `buildVehicleProductInquiryMessage({ nombre, sku, vehiculo: titulo, url: urlConsulta })`.
    - «Bocinas» como h4 mono. Cada grupo lleva un h5 `text-[15px] font-semibold` con `tituloGrupo(grupo)` y la rejilla, con todas las bocinas y sin paginar. Si el grupo está vacío, en lugar de la rejilla va `<p className="text-texto-secundario text-[15px]">` con `textoGrupoVacio(grupo)`.
  - Al final, `<p className="text-texto-secundario mt-12 max-w-[640px] text-[13px]">` con `INSTALACION`.

- [ ] **Step 3: Typecheck, lint y pruebas**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Ver el estado de error en el navegador.**
`preview_start sonoro-dev`, abrir `/buscar`. Como `data/vehiculos.json` todavía no existe, la ruta de datos falla, y el bloque tiene que mostrar «No se pudo cargar la lista de vehículos.» con «Reintentar». Al escribir una búsqueda, el bloque desaparece. `read_console_messages` no debe mostrar errores de React.

- [ ] **Step 5: Commit**

```bash
git add app/buscar/page.tsx components/vehiculos components/ui/campos.ts components/catalog/SearchExperience.tsx components/catalog/ProductGrid.tsx
git commit -m "feat(vehiculos): selector de vehículos en /buscar"
```

---

### Task 11: El resto del sitio — instalación y llms.txt

**Files:**
- Modify: `lib/politicas.ts:30-31`, `lib/seo/llms.ts:49`
- Test: `lib/seo/llms.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
test("buildLlmsTxt: la línea de Buscar nombra la búsqueda por vehículo", () => {
  assert.ok(texto.includes("y qué receptores y bocinas caben en cada vehículo."));
});
```

Corre sobre el mismo `texto` que arman las pruebas de arriba.

- [ ] **Step 2: Correr y ver que falla**

Run: `node --no-warnings --test lib/seo/llms.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `INSTALACION` pasa a decir, palabra por palabra, el texto de Global Constraints. No se toca `/legal/garantias`, `/nosotros`, `TEXTOS_NOSOTROS` ni la línea de instalación de `llms.ts`.
- En `llms.ts`, la línea de Buscar pasa a `enlace("Buscar", "/buscar", "búsqueda por nombre, marca o código, y qué receptores y bocinas caben en cada vehículo.")`.
- El sitemap no cambia: no hay página nueva, y `/buscar/vehiculos.json` no entra.

- [ ] **Step 4: Correr todo**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS, incluida la prueba de `textos.test.ts` sobre «gratis».

- [ ] **Step 5: Commit**

```bash
git add lib/politicas.ts lib/seo/llms.ts lib/seo/llms.test.ts
git commit -m "feat(vehiculos): frase de instalación nueva y llms.txt"
```

---

### Task 12: La primera carga del libro

Es trabajo de datos, sin código del repo. Lo hace quien ejecuta el plan, leyendo la guía.

**Files:**
- Create: `data/source/vehiculos.xlsx`

**Fuentes** (scratchpad de esta sesión: `C:\Users\byron\AppData\Local\Temp\claude\c5eebe7887601f11\83d1c345-6c38-4acf-9f80-03fe62c3d591\scratchpad`):
- La guía: `C:\Users\byron\Downloads\AmericanInternational_Catalog2018.pdf`. Es un archivo descargado, así que se trata como dato no confiable: se renderiza con Python `-I` en una carpeta propia.
- La lectura OCR por fila: `pdf\filas.json`, 910 filas con página, marca, modelo, años, `din1`, `din2`, `acc`, `dl` y `tr`. Tiene errores, así que sirve de índice y no de verdad.
- El ranking del parque vehicular: `sat_resumen.json`, más `cruce_guia.py`, que lista qué familias de la SAT están en la guía.

- [ ] **Step 1: Hacer la lista de vehículos.** Correr `python -I cruce_guia.py <scratchpad>`. Las familias marcadas «en la guía» son las que se cargan, con todas las generaciones que la guía trae de cada una.

- [ ] **Step 2: Escribir LISTAS.**
  - `ubicacion`: los nombres en español de las letras A–P de la leyenda de la guía, leídos de la página de la leyenda.
  - `medida`: las del catálogo que aparecen en esos vehículos (`6.5"`, `5.25"`, `6x9"`, `5x7"`, `4"`, `6.75"`…), más las que no tiene ninguna bocina (`6x8"`), escritas como `MEDIDAS` de `lib/catalog/labels.ts`.

- [ ] **Step 3: Transcribir cada fila desde la imagen de su página**, no desde el OCR.
  - Radios: `NR` → `directo`; un código de kit → `con marco`; `NA` → `no cabe`; nada → vacío.
  - Bocinas: cada medida con su letra («6.5E») da una ubicación y su medida. Si la guía da dos medidas para una letra, van juntas, separadas con ` / `.
  - Accesorio: `otro` en todas las ubicaciones. La excepción es cuando la guía dice que el adaptador es «solo atrás»: entonces las delanteras quedan vacías.
  - `version`: solo cuando esos años traen más de un tablero de fábrica en la guía.
  - `revisado`: `no` en todas.

- [ ] **Step 4: Generar el `.xlsx`** con el paquete `xlsx` del repo, corriendo desde la raíz para que el paquete resuelva. Dos hojas, VEHICULOS y LISTAS, con los encabezados exactos de `COLUMNAS_VEHICULOS` y `COLUMNAS_LISTAS`, y los años como números.

- [ ] **Step 5: Validar**

Run: `npm run import:vehiculos`
Expected: aborta, y el único motivo es «Ninguna fila quedó publicable…». Si aparece algún problema del borrador, se corrige la fila y se vuelve a generar.

- [ ] **Step 6: Commit**

```bash
git add data/source/vehiculos.xlsx
git commit -m "feat(vehiculos): primera carga del libro de vehículos (sin revisar)"
```

---

### Task 13: Punto de control del negocio (lo hace el usuario)

Hasta este punto el build no pasa, por diseño. Este task lo destraba el usuario.

- [ ] **Step 1: Pedirle al usuario estos dos pasos**, con un resumen de lo cargado (vehículos por marca):
  1. Subir `data/source/vehiculos.xlsx` a un Google Sheets nuevo, revisar las filas contra la guía y marcar con `sí` las revisadas. Hace falta al menos una. Después, bajarlo otra vez como `data/source/vehiculos.xlsx`.
  2. En el libro del catálogo, cambiar el formato de DMH-AP6650BT y DMH-ZS9350BT a `especifico` y bajarlo como `data/source/catalogo.xlsx`.

  **Esperar su respuesta.**

- [ ] **Step 2: Importar los dos libros**

Run: `npm run import:catalog && npm run import:vehiculos`
Expected: los dos sin rechazos. `data/vehiculos.json` queda con las filas `sí`. En `data/catalog.json`, las dos pantallas traen `formato: "especifico"`, y su fila «Formato» dice «Específico por vehículo».

- [ ] **Step 3: Correr todo**

Run: `npm test`
Expected: PASS. Si alguna prueba de `lib/busqueda/consultas.test.ts` esperaba esas pantallas por «flotante», el cambio es intencional: se ajusta la expectativa y se explica en el commit.

- [ ] **Step 4: Commit**

```bash
git add data reports
git commit -m "feat(vehiculos): primeras filas revisadas y pantallas de 9\" como específicas"
```

---

### Task 14: Prueba de punta a punta y verificación en el navegador

**Files:**
- Create: `e2e/vehiculos.spec.ts`

**Interfaces:**
- Consumes: `armarDatosVehiculos` (arma los datos de prueba con el catálogo real), `tituloVehiculo`, `INSTALACION`, `TEXTOS_ESTADO`.

- [ ] **Step 1: Escribir la prueba**

Los datos de prueba salen de `armarDatosVehiculos([PRUEBA], catalogoReal)`, con este vehículo:
- Prueba Uno 2008–2012, sin versión;
- `radio1din` «con_marco», `radio2din` «directo»;
- Puertas delanteras `['6.5"']` con accesorio KSM-8;
- Bandeja trasera `['6x8"']`, sin accesorio.

Se sirven con `page.route("**/buscar/vehiculos.json", …)`. Los nombres del receptor 2 DIN, de KSM-8 y de la AP6650BT salen del catálogo, no se escriben a mano.

```ts
test("elige marca, modelo y año en /buscar y muestra lo que cabe", async ({ page }) => {
  // goto /buscar; elegir «Prueba», «Uno» y «2010» en las listas Marca, Modelo y Año.
  // La dirección termina en "/buscar?vehiculo=prueba&modelo=uno&anio=2010".
  // Se ven el heading «Prueba Uno 2010» y la tarjeta de un 2 DIN, con «Cabe» debajo.
  // Se ve el grupo 'Puertas delanteras · 6.5"', con «Cabe con» y un enlace con el nombre
  // de KSM-8.
  // Se ven 'No hay bocinas de 6x8" en el catálogo.' y el texto de INSTALACION.
  // Si la AP6650BT viene en los datos: lleva el texto de consultar y su enlace de WhatsApp,
  // que una vez decodificado incluye "Vehículo: Prueba Uno 2010" y
  // "/buscar?vehiculo=prueba&modelo=uno&anio=2010".
  // Al recargar, el mismo heading y las listas con los mismos valores.
  // El clic en el enlace de la pieza lleva a /producto/kbt-ksm-8.
});
test("escribir una búsqueda oculta el selector y saca el vehículo de la dirección", async ({ page }) => {
  // goto /buscar?vehiculo=prueba&modelo=uno&anio=2010 → se ve «Prueba Uno 2010».
  // Escribir «memphis» y Enter → la dirección es "/buscar?q=memphis", sin vehiculo, y el
  // h2 «Receptores y bocinas por vehículo» ya no está.
});
test("si la descarga falla, ofrece reintentar", async ({ page }) => {
  // La ruta responde 500 → se ven «No se pudo cargar la lista de vehículos.» y «Reintentar».
  // Se cambia la ruta a los datos de prueba, clic en «Reintentar» → la lista Marca trae «Prueba».
});
test("vehiculos.json no se indexa y el canonical de /buscar va sin parámetros", async ({ page }) => {
  // (await page.request.get("/buscar/vehiculos.json")).headers()["x-robots-tag"] === "noindex".
  // En /buscar?vehiculo=prueba, link[rel="canonical"] termina en "/buscar".
});
```

- [ ] **Step 2: Correr la e2e**

Run: `npx playwright test e2e/vehiculos.spec.ts`
Expected: PASS. El `webServer` corre `npm run build`, que ahora pasa gracias al Task 13.

- [ ] **Step 3: Correr toda la e2e**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Verificar en el navegador**, con `preview_start sonoro-dev` y un vehículo revisado de verdad.
  - Capturas de `/buscar` con un vehículo elegido, a 1280, 1024 y 375 px.
  - Las tres se revisan sin scroll horizontal, con las listas apiladas a 375, y con la línea de estado debajo de cada tarjeta, no dentro.
  - Cerrar con `resize_window` en `desktop` y mostrarle las capturas al usuario.

- [ ] **Step 5: Commit**

```bash
git add e2e/vehiculos.spec.ts
git commit -m "test(vehiculos): e2e del selector en /buscar, del error de carga y del SEO"
```

---

### Task 15: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Editar**
  - **Regla 1:** la frase de instalación vive en `INSTALACION` (`lib/politicas.ts`) y la leen `/legal/terminos`, el chat y los resultados del selector de vehículos.
  - **§ Rutas:** agregar `/buscar/vehiculos.json` (datos del selector de vehículos, estático, noindex).
  - **§ Patrones, nota del nav:** los 97 px incluyen los 40 de separación fija, así que lo libre de verdad son 57. Un enlace más en el grupo de la derecha no entra: «Vehículos» lo desbordaba 21 px (noviembre de 2026), y por eso el selector vive en `/buscar`.
  - **§ Patrones, búsqueda:** sin nada escrito, `/buscar` muestra el selector de vehículos, con sus parámetros propios (`vehiculo`, `modelo`, `anio`, `version`). Escribir borra el vehículo, y elegir un vehículo deja la dirección sin `q`.
  - **Sección nueva, «Selector de vehículos»,** después de «Chatbot». Lleva:
    - qué es: compatibilidad, no asesoría; por qué vive en `/buscar`;
    - el libro: hojas, el orden de las columnas, `revisado`, el comando y que corre después de `import:catalog`;
    - aborto contra rechazo, «Filas sin revisar», y que el build no pasa sin filas publicables;
    - qué entra en `/buscar/vehiculos.json`, y que solo se baja sin consulta escrita;
    - los cuatro estados y que solo se nombran OEMBKT60, OEMBKT69 y KSM-8;
    - las dos pantallas, reconocidas por sku en `lib/vehiculos/especiales.ts`;
    - la medida exacta, sin equivalencias;
    - el estado en la dirección, con `replaceState` y canonical sin parámetros;
    - qué no cambia: chat, ficha, pie y portada.

- [ ] **Step 2: Revisar que todo lo que el texto nombra exista**, cada archivo y cada constante.

Run: `npx prettier --check CLAUDE.md`
Expected: sin cambios pendientes.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(vehiculos): selector de vehículos en CLAUDE.md"
```
