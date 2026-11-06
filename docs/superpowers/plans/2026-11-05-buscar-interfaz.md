# /buscar: pestañas, barra de filtros y móvil — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/buscar` pasa a dos pestañas («Por producto» y «Por vehículo»), los filtros a una barra en escritorio y a una rejilla de dos columnas en el teléfono, con píldoras de filtros activos que se quitan con ✕.

**Architecture:** La pestaña y los filtros activos salen de funciones puras con test (`lib/busqueda/pestana.ts`, `lib/busqueda/filtros-activos.ts`, `hrefVehiculo` en `lib/vehiculos/url.ts`). `SearchExperience` sigue siendo dueña del estado en la dirección; las pestañas (`PestanasBuscar`) y la barra (`BarraFiltros`) son componentes que reciben valores y devuelven cambios. Toda la búsqueda sigue en la URL con `replaceState`.

**Tech Stack:** Next.js 16.3 (leer `node_modules/next/dist/docs/` antes de tocar rutas), React 19, Tailwind 4 con los tokens de `app/globals.css`, `node --test` para unitarias (imports con `.ts`), Playwright para e2e.

**Spec:** `docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md`

## Global Constraints

- CLAUDE.md es la autoridad. Sin degradados, sin sombras, sin emoji, sin color nuevo; ningún componente escribe un hex: solo tokens de `app/globals.css`.
- Copy en español de Guatemala con tú. No se agrega texto nuevo salvo «Por producto», «Por vehículo», «Quitar filtros» (ya existe) y el `aria-label` de cada ✕: `Quitar filtro: <etiqueta>`.
- Regla 2: nada de «lo más buscado», «te recomendamos» ni ganadores.
- Toda la búsqueda vive en la URL y cada cambio usa `window.history.replaceState`, como hoy.
- `/buscar` sigue prerenderizada: solo lo que lee la URL va en el `<Suspense>`; el fallback es la búsqueda vacía en «Por producto».
- Se conservan los nombres accesibles que usan las e2e: «Buscar en el catálogo», las píldoras como botones («Todo», «Subwoofers»…), «Filtrar por marca», «Filtrar por medida», «Filtrar por canales», «Filtrar por disponibilidad», «Filtrar por categoría», «Categoría (viene de lo que escribiste)», «Ordenar resultados», «Marca», «Modelo», «Año», «Versión».
- El código de cliente no importa `lib/catalog/index.ts` ni `lib/vehiculos/archivo.ts` (traen `node:fs`); los tipos de `lib/catalog/types.ts` se importan con `import type`.
- Breakpoint de la barra: `sm` (640 px). Debajo, la rejilla de móvil.
- Ruling ya tomado: la spec (decisión 12) pide el borde derecho de las píldoras «desvanecido», y CLAUDE.md prohíbe degradados. La línea se desliza hasta el borde de la pantalla y la última píldora queda cortada por el borde; sin máscara ni degradado. La spec se corrige en el Task 5.

## Review Focus

1. **Vaciar la marca en «Por vehículo»** (el cliente vuelve la lista Marca a «Marca»): la dirección tiene que quedar en `/buscar?por=vehiculo` y la pestaña seguir en «Por vehículo»; hoy `escribirSeleccion` da `""` y la página caería en «Por producto». → Task 1 (`hrefVehiculo`) y Task 3 (e2e).
2. **«Buscar» del menú o la lupa del header con «Por vehículo» abierta**: llevan a `/buscar` y la página queda en «Por producto», con el campo. → Task 3 (e2e).
3. **Esc en el campo vacío de «Por producto»** limpia y deja la dirección en `/buscar`, sin pasar a la otra pestaña. → Task 3 (e2e).
4. **La línea de píldoras deslizable a 375 px** no le agrega desplazamiento horizontal a la página: el desborde queda dentro de la línea. → Task 4 (e2e con la búsqueda que muestra las seis listas).
5. **La barra partida en dos líneas entre 640 y 1023 px**: Ordenar sigue a la derecha y nada se sale del ancho. → Task 4 (e2e a 768 px) y Task 5 (capturas).

---

### Task 1: La pestaña y la dirección del vehículo

**Files:**
- Create: `lib/busqueda/pestana.ts`
- Test: `lib/busqueda/pestana.test.ts`
- Modify: `lib/vehiculos/url.ts` (agregar `hrefVehiculo`)
- Test: `lib/vehiculos/url.test.ts`

**Interfaces:**
- Produces: `type Pestana = "producto" | "vehiculo"`; `leerPestana(busqueda: string): Pestana`; `hrefPestana(pestana: Pestana): string`; `hrefVehiculo(sel: Seleccion): string`.

- [ ] **Step 1: Escribir las pruebas**

```ts
// lib/busqueda/pestana.test.ts
test("leerPestana: vehiculo o por=vehiculo abren «Por vehículo»; q gana", () => {
  assert.equal(leerPestana(""), "producto");
  assert.equal(leerPestana("q=memphis"), "producto");
  assert.equal(leerPestana("por=vehiculo"), "vehiculo");
  assert.equal(leerPestana("vehiculo=toyota&modelo=corolla"), "vehiculo");
  assert.equal(leerPestana("q=memphis&vehiculo=toyota"), "producto");
  assert.equal(leerPestana("q=memphis&por=vehiculo"), "producto");
  assert.equal(leerPestana("por=otro"), "producto");
  assert.equal(leerPestana("modelo=corolla&anio=2010"), "producto");
});

test("hrefPestana: cada pestaña empieza vacía", () => {
  assert.equal(hrefPestana("producto"), "/buscar");
  assert.equal(hrefPestana("vehiculo"), "/buscar?por=vehiculo");
});

// lib/vehiculos/url.test.ts
test("hrefVehiculo: sin nada elegido se queda en la pestaña de vehículo", () => {
  assert.equal(hrefVehiculo({}), "/buscar?por=vehiculo");
  assert.equal(
    hrefVehiculo({ marca: "toyota", modelo: "corolla", anio: 2010 }),
    "/buscar?vehiculo=toyota&modelo=corolla&anio=2010",
  );
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `node --no-warnings --test lib/busqueda/pestana.test.ts lib/vehiculos/url.test.ts`
Expected: FAIL — el módulo `./pestana.ts` no existe y `hrefVehiculo` no está exportado.

- [ ] **Step 3: Implementar**

`lib/busqueda/pestana.ts`: `leerPestana` lee con `URLSearchParams`; «vehiculo» si no hay `q` (recortado) y hay `vehiculo` o `por === "vehiculo"`. `hrefPestana` según la tabla de arriba. `hrefVehiculo(sel)` en `url.ts`: `escribirSeleccion(sel)` con prefijo `/buscar?`, o `hrefPestana("vehiculo")` cuando da `""` (import de `../busqueda/pestana.ts`).

- [ ] **Step 4: Correrlas y verlas pasar**

Run: `node --no-warnings --test lib/busqueda/pestana.test.ts lib/vehiculos/url.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/busqueda/pestana.ts lib/busqueda/pestana.test.ts lib/vehiculos/url.ts lib/vehiculos/url.test.ts
git commit -m "feat(buscar): la pestaña sale de la dirección"
```

---

### Task 2: Filtros activos y «Quitar filtros», puros

**Files:**
- Create: `lib/busqueda/filtros-activos.ts`
- Test: `lib/busqueda/filtros-activos.test.ts`
- Modify: `components/catalog/SearchExperience.tsx` (importa `Filtros`, `USOS_ETIQUETA`, `DISPONIBILIDADES` y `SIN_FILTROS` en vez de definirlos; el botón «Quitar filtros» de hoy usa `cambiar(SIN_FILTROS)`)

**Interfaces:**
- Produces:
  - `interface Filtros { categoria: string | null; medida: number | null; canales: number | null; marca: string | null; disp: Disponibilidad | null; uso: Uso | null }` (se mueve tal cual desde `SearchExperience`).
  - `DISPONIBILIDADES: Record<Disponibilidad, string>` y `USOS_ETIQUETA: Record<Uso, string>` (los de hoy; `USOS` pasa a llamarse `USOS_ETIQUETA` para no chocar con `USOS` de `lib/catalog/types.ts`).
  - `type CampoActivo = "marca" | "medida" | "canales" | "disp" | "uso"`.
  - `filtrosActivos(filtros: Filtros, usoEscrito: boolean): { campo: CampoActivo; etiqueta: string }[]` — en el orden de la barra: marca, medida, canales, disponibilidad, categoría.
  - `SIN_FILTROS: { [K in keyof Filtros]: null }`.

- [ ] **Step 1: Escribir las pruebas**

```ts
const NINGUNO: Filtros = { categoria: null, medida: null, canales: null, marca: null, disp: null, uso: null };

test("filtrosActivos: una píldora por filtro, en el orden de la barra", () => {
  assert.deepEqual(
    filtrosActivos({ ...NINGUNO, uso: "marino", disp: "disponible", marca: "Memphis", medida: 12, canales: 4 }, false),
    [
      { campo: "marca", etiqueta: "Memphis" },
      { campo: "medida", etiqueta: '12"' },
      { campo: "canales", etiqueta: "4 canales" },
      { campo: "disp", etiqueta: "Disponible" },
      { campo: "uso", etiqueta: "Marino" },
    ],
  );
});

test("filtrosActivos: el tipo de producto no se repite, y lo escrito no lleva ✕", () => {
  assert.deepEqual(filtrosActivos({ ...NINGUNO, categoria: "Subwoofers" }, false), []);
  assert.deepEqual(filtrosActivos({ ...NINGUNO, uso: "marino" }, true), []);
  assert.deepEqual(filtrosActivos(NINGUNO, false), []);
});

test("SIN_FILTROS: todos los filtros a null, sin tocar q ni orden", () => {
  assert.deepEqual(SIN_FILTROS, NINGUNO);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `node --no-warnings --test lib/busqueda/filtros-activos.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar** `lib/busqueda/filtros-activos.ts` (`etiquetaCanales` de `./acotar.ts`; tipos con `import type` de `../catalog/types.ts`) y cambiar `SearchExperience` para usarlo. Sin cambio visual.

- [ ] **Step 4: Correr unitarias, tipos y lint**

Run: `node --no-warnings --test lib/busqueda/filtros-activos.test.ts && npx tsc --noEmit -p . && npx eslint components/catalog lib/busqueda`
Expected: PASS, sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/busqueda/filtros-activos.ts lib/busqueda/filtros-activos.test.ts components/catalog/SearchExperience.tsx
git commit -m "refactor(buscar): filtros activos y «Quitar filtros» en lib/busqueda"
```

---

### Task 3: Las pestañas

**Files:**
- Create: `components/catalog/PestanasBuscar.tsx`
- Modify: `components/catalog/SearchExperience.tsx`, `components/vehiculos/BusquedaPorVehiculo.tsx`, `components/vehiculos/ResultadosVehiculo.tsx`
- Test: `e2e/vehiculos.spec.ts`

**Interfaces:**
- Consumes: `leerPestana`, `hrefPestana` (Task 1), `hrefVehiculo` (Task 1).
- Produces: `PestanasBuscar({ pestana, alCambiar, producto, vehiculo }: { pestana: Pestana; alCambiar: (p: Pestana) => void; producto: React.ReactNode; vehiculo: React.ReactNode })`.

Lo que cambia, según la spec (decisiones 1–7 y § Pestañas):
- `PestanasBuscar`: `role="tablist"` con dos `role="tab"` («Por producto», «Por vehículo»), `aria-selected`, `aria-controls` y `tabIndex` 0 solo en la activa; ←/→ pasan a la otra y Inicio/Fin a la primera y la última, moviendo el foco y llamando a `alCambiar`. Dos `role="tabpanel"` con `aria-labelledby`; solo el activo tiene contenido, el otro va con `hidden` y vacío (así «Por vehículo» no baja datos si no está a la vista). Estilo: texto de 15 px; activa en `text-negro` con línea inferior de 2 px `border-negro`; inactiva en `text-texto-secundario` con borde transparente.
- `SearchExperience`: `pestana = leerPestana(busqueda)`; `alCambiar` hace `replaceState(null, "", hrefPestana(p))`. El panel de producto es el campo y lo de abajo; el de vehículo, `<BusquedaPorVehiculo>`. Se quitan «Escribe para buscar en el catálogo.» y la rama `!consulta` que dibujaba el selector.
- `BusquedaPorVehiculo`: sin el `<h2>`; `cambiar` usa `hrefVehiculo(sel)`.
- `ResultadosVehiculo`: el título baja a `<h2>`, «Receptores» y «Bocinas» a `<h3>`, cada grupo a `<h4>` (el `<h2>` que había arriba ya no existe). Mismas clases.

- [ ] **Step 1: Ajustar y agregar las e2e** en `e2e/vehiculos.spec.ts`:
  - «elige marca, modelo y año…»: arranca en `/buscar`, hace clic en la pestaña «Por vehículo» y espera la dirección `/buscar?por=vehiculo` antes de elegir. El resto queda igual.
  - Reemplazar «escribir una búsqueda oculta el selector…» por «cambiar de pestaña limpia la dirección»: desde `RUTA_ELEGIDA`, clic en «Por producto» → la dirección es `/buscar`, la pestaña «Por producto» tiene `aria-selected="true"` y la lista «Marca» no está; escribir «memphis» y Enter → `/buscar?q=memphis`.
  - «si la descarga falla…»: `goto("/buscar?por=vehiculo")`.
  - Nueva «las flechas mueven entre pestañas»: en `/buscar`, foco en «Por producto», `ArrowRight` → «Por vehículo» con `aria-selected="true"`, el foco en ella y la dirección `/buscar?por=vehiculo`; `Home` → vuelve a «Por producto».
  - Nueva «vaciar la marca deja la pestaña de vehículo» (Review Focus 1): en `RUTA_ELEGIDA`, elegir la opción «Marca» (valor vacío) → dirección `/buscar?por=vehiculo` y la lista «Marca» sigue visible.
  - Nueva «Buscar del header vuelve a «Por producto»» (Review Focus 2): en `RUTA_ELEGIDA`, clic en el enlace «Buscar» del header (el que esté visible a 1280) → la dirección termina en `/buscar` y se ve el campo «Buscar en el catálogo».
  - Nueva «Esc en el campo vacío no cambia de pestaña» (Review Focus 3): en `/buscar`, foco en el campo, `Escape` → la dirección sigue en `/buscar` y «Por producto» con `aria-selected="true"`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test e2e/vehiculos.spec.ts`
Expected: FAIL — no existe la pestaña «Por vehículo».

- [ ] **Step 3: Implementar** lo de arriba.

- [ ] **Step 4: Correr todo**

Run: `npm test && npx tsc --noEmit -p . && npm run lint && npx playwright test e2e/vehiculos.spec.ts e2e/flujo-critico.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/catalog/PestanasBuscar.tsx components/catalog/SearchExperience.tsx components/vehiculos/BusquedaPorVehiculo.tsx components/vehiculos/ResultadosVehiculo.tsx e2e/vehiculos.spec.ts
git commit -m "feat(buscar): pestañas «Por producto» y «Por vehículo»"
```

---

### Task 4: La barra de filtros

**Files:**
- Create: `components/catalog/BarraFiltros.tsx`
- Modify: `components/catalog/SearchExperience.tsx`
- Create: `e2e/buscar.spec.ts`

**Interfaces:**
- Consumes: `Filtros`, `filtrosActivos`, `SIN_FILTROS`, `DISPONIBILIDADES`, `USOS_ETIQUETA` (Task 2).
- Produces: `BarraFiltros(props)` con lo que hoy calcula `SearchExperience` para la fila de filtros: `filtros`, `conteoPorCategoria`, `opcionesUso`, `usosEscritos`, `opcionesMedida`, `opcionesCanales`, `opcionesMarca`, `conteoPorDisp`, `ordenActivo` y `cambiar(parcial)`. Las listas mueven tal cual sus opciones, textos y `aria-label`.

Lo que cambia, según la spec (decisiones 8–13 y 15):
- Un solo contenedor. Desde `sm`: fila `flex flex-wrap items-center gap-2.5` entre dos líneas finas (`border-y border-borde-tarjeta`, `py-3`): las píldoras, un separador de 1 px (`bg-borde-pildora`, solo desde `sm`), las listas y «Ordenar resultados» con `sm:ml-auto`.
- Debajo de `sm`: las píldoras en una línea `flex gap-2.5 overflow-x-auto` sin barra visible (`[scrollbar-width:none]` y `[&::-webkit-scrollbar]:hidden`), que corre hasta el borde de la pantalla (`-mr-6 pr-6`) para que la última quede cortada; sin degradado. Las listas en `grid grid-cols-2 gap-2.5` con `w-full`; el grupo de listas usa `sm:contents` para sumarse a la fila de arriba.
- Desde `sm`, con `filtrosActivos(...)` no vacío: fila de píldoras `Etiqueta ✕` (botones con `aria-label="Quitar filtro: Etiqueta"`, fondo `bg-fondo-alt`, que ponen ese campo en `null`) y «Quitar filtros» subrayado (`cambiar(SIN_FILTROS)`). Debajo de `sm`, con `hayFiltros`: solo «Quitar filtros», bajo la rejilla.
- Sin resultados (`base.length === 0`) no se dibuja la barra (ya es así).

- [ ] **Step 1: Escribir las e2e** en `e2e/buscar.spec.ts` (abortar `/_next/image` en `beforeEach`, como `e2e/vehiculos.spec.ts`):
  - La consulta de todas es «bocina»: hoy trae 7 marcas, 17 medidas y los tres usos. Antes de cada caso, la prueba comprueba con `data/catalog.json` que las bocinas activas sigan trayendo más de una marca, medida y uso, y si no, falla diciendo eso (no por un selector que no aparece).
  - «una ✕ quita su filtro»: a 1280, con la primera marca de esas bocinas; `goto("/buscar?q=bocina&marca=<marca>")` → el botón «Quitar filtro: <marca>» está visible; clic → la dirección ya no trae `marca` y la lista «Filtrar por marca» vuelve a «Todas las marcas».
  - «Quitar filtros vuelve todo a todos»: con `marca` y `disp` puestos, clic en «Quitar filtros» → la dirección conserva `q` y no trae `marca` ni `disp`.
  - «a 375 px los filtros no desbordan la página» (Review Focus 4): `/buscar?q=bocina` a 375 × 812 (ahí salen las listas de categoría, medida, marca, disponibilidad y orden); `document.documentElement.scrollWidth - clientWidth === 0` y la lista «Filtrar por marca» se ve sin desplazarse en horizontal.
  - «a 768 px Ordenar queda en la barra, a la derecha» (Review Focus 5): misma consulta a 768 px; sin desbordamiento horizontal, y el borde derecho de «Ordenar resultados» a 48 px o menos del borde de la página.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test e2e/buscar.spec.ts`
Expected: FAIL — no existe «Quitar filtro: …».

- [ ] **Step 3: Implementar** `BarraFiltros` y reemplazar con ella el bloque de filtros de `SearchExperience`.

- [ ] **Step 4: Correr todo**

Run: `npm test && npx tsc --noEmit -p . && npm run lint && npm run test:e2e`
Expected: PASS (todas las e2e).

- [ ] **Step 5: Commit**

```bash
git add components/catalog/BarraFiltros.tsx components/catalog/SearchExperience.tsx e2e/buscar.spec.ts
git commit -m "feat(buscar): barra de filtros en escritorio y rejilla en móvil"
```

---

### Task 5: Documentación y verificación en el navegador

**Files:**
- Modify: `CLAUDE.md` (§ Patrones, bullet de `/buscar`; § Selector de vehículos, primer párrafo)
- Modify: `docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md` (dónde vive el selector)
- Modify: `docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md` (decisión 12: sin degradado, la última píldora queda cortada en el borde)
- Modify: `.gitignore` (agregar `.superpowers/`)

- [ ] **Step 1: Actualizar la documentación.** CLAUDE.md: «Sin nada escrito, `/buscar` muestra el selector de vehículos» pasa a «`/buscar` tiene dos pestañas…, con `por=vehiculo` cuando no hay vehículo elegido; cambiar de pestaña limpia la dirección»; la barra en una línea desde 640 px y la rejilla debajo; el § Selector dice que vive en la pestaña «Por vehículo».

- [ ] **Step 2: Capturas** con Playwright contra `sonoro-dev` (puerto 3000) de las dos pestañas, con «subwoofer 12» y con «Toyota Corolla 2010», a 1280, 1024, 768 y 375 px. Se revisan sin desplazamiento horizontal, con la barra en una o dos líneas y el estado debajo de cada tarjeta del vehículo.

- [ ] **Step 3: Verificar**

Run: `npm test && npx tsc --noEmit -p . && npm run lint && npm run test:e2e`
Expected: PASS.

- [ ] **Step 3b: Lighthouse**

Run: `npx lhci autorun` (usa `lighthouserc.js`: build, servidor en el puerto 3100 y `/buscar` entre las páginas)
Expected: las aserciones pasan — rendimiento ≥ 0.9 y accesibilidad ≥ 0.95 en `/buscar`. Si en local no corre, se anota y lo confirma el CI del PR.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md .gitignore
git commit -m "docs(buscar): pestañas y barra de filtros en CLAUDE.md y las specs"
```
