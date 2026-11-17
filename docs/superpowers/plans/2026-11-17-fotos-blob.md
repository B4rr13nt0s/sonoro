# Fotos de producto en Vercel Blob — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar `public/productos/` del deployment: las fotos fuente pasan a `assets/productos/`, se suben a Vercel Blob con un comando y el importador arma `imagenes` desde un manifiesto versionado.

**Architecture:** `npm run fotos:subir` sube cada foto con el hash de su contenido en el nombre y escribe `data/fotos-blob.json`. El importador compara el disco con el manifiesto (alertas, sin abortar) y toma las URLs de ahí, así que el build no necesita token ni red hacia Blob. `next.config.ts` deriva `images.remotePatterns` de los hosts del manifiesto, y el carrito deja de depender de la URL guardada en `localStorage`.

**Tech Stack:** Node 24, `tsx`, `@vercel/blob`, `sharp` (ya instalado), `node:test`, Next 16 (`next/image`), Zod.

**Spec:** `docs/superpowers/specs/2026-11-17-fotos-blob-design.md`

## Global Constraints

- Las fotos fuente siguen en Git: `assets/productos/` (fuera de `public/`).
- El build (`npm run build`, CI, Lighthouse, Preview) **no usa** `BLOB_READ_WRITE_TOKEN`. Solo `fotos:subir` lo lee, de `.env.local`.
- Nombre en Blob: `productos/<archivo sin extensión>.<hash12>.<ext>`, con `access: "public"`, `addRandomSuffix: false`, `allowOverwrite: false`. `hash12` = primeros 12 caracteres hex del sha-256 del contenido.
- `data/fotos-blob.json`: `{ "<SKU_vista.ext>": { "url", "hash", "bytes" } }`, claves en orden de puntos de código (no `localeCompare`), terminado en salto de línea; no se edita a mano.
- Las alertas del importador no abortan el import ni el build (igual que un archivo con typo hoy).
- El nombre `SKU_vista.ext`, el formato (WebP q80, 1600 × 1600) y el orden de las vistas no cambian.
- No se mueven las fotos de la portada, los logos ni los modelos 3D. No se borran blobs viejos.
- Copy y código comentan en español, como el resto del repo. Commits con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Rama nueva `feature/fotos-blob`, creada desde `feature/fotos-jbl-y-vistas`.

## Review Focus

1. **Foto reemplazada sin volver a subir** (mismo nombre, hash distinto): alerta «cambió desde la última subida» y sigue saliendo con la URL vieja. Test en Task 1; test de consistencia en Task 7.
2. **Nombres con espacio** (`165 AC_frontal.webp`): la URL del manifiesto va codificada por Blob y `next/image` debe aceptarla. Test de `hostsDeManifiesto` con una URL con `%20` en Task 1; comprobación en el navegador en Task 7.
3. **Subida interrumpida a la mitad**: lo ya subido queda en el manifiesto y volver a correr el comando continúa sin repetir. Test del cálculo de pendientes en Task 3.
4. **Sin token**: `fotos:subir` falla antes de subir nada con un mensaje claro; importador y build funcionan sin él. Task 3 y Task 7.
5. **Manifiesto ausente o vacío**: el importador no revienta (todas las fotos quedan «sin subir»), `next.config.ts` no declara patrones y `imagenes` sale `[]` (placeholder). Tests en Task 1 y Task 2.
6. **Carrito guardado antes del cambio** (`/productos/X.jpg` o `.webp` en `imagenSnapshot`): no debe dibujar una imagen rota. Test en Task 6.

---

### Task 1: Módulo puro del manifiesto

**Files:**
- Create: `lib/catalog/fotos-blob.ts`
- Test: `lib/catalog/fotos-blob.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type EntradaFoto = { url: string; hash: string; bytes: number };
  export type ManifiestoFotos = Record<string, EntradaFoto>;
  export type DiferenciasFotos = { sinSubir: string[]; cambiadas: string[]; huerfanas: string[] };
  export function nombreBlob(archivo: string, hash: string): string;
  export function compararConManifiesto(enDisco: ReadonlyMap<string, string>, manifiesto: ManifiestoFotos): DiferenciasFotos;
  export function alertasDeFotos(d: DiferenciasFotos): string[];
  export function serializarManifiesto(m: ManifiestoFotos): string;
  export function hostsDeManifiesto(m: ManifiestoFotos): string[];
  ```
  `enDisco` mapea nombre de archivo → hash12.

- [ ] **Step 1: Write the failing tests** en `lib/catalog/fotos-blob.test.ts`
  - `nombreBlob("165 AC_frontal.webp", "0123456789ab")` → `"productos/165 AC_frontal.0123456789ab.webp"`; `nombreBlob("SRX62_tres_cuartos.jpg", "aaaaaaaaaaaa")` → `"productos/SRX62_tres_cuartos.aaaaaaaaaaaa.jpg"`.
  - `compararConManifiesto`: con disco `{A.webp: h1, B.webp: h2, C.webp: h3}` y manifiesto `{A.webp: {hash: h1}, B.webp: {hash: "otro"}, D.webp: {hash: h4}}` devuelve `{ sinSubir: ["C.webp"], cambiadas: ["B.webp"], huerfanas: ["D.webp"] }`. Con disco y manifiesto vacíos devuelve tres arreglos vacíos. Con manifiesto `{}` todo el disco es `sinSubir`.
  - `alertasDeFotos` produce exactamente: `"C.webp: sin subir a Blob (corre npm run fotos:subir)"`, `"B.webp: cambió desde la última subida (corre npm run fotos:subir)"`, `"D.webp: está en data/fotos-blob.json pero no en assets/productos/"`, en el orden sinSubir, cambiadas, huérfanas.
  - `serializarManifiesto({ "b.webp": e, "B.webp": e, "a.webp": e })` ordena por puntos de código (`B.webp` antes de `a.webp` antes de `b.webp`), indenta con 2 espacios y termina en `"\n"`.
  - `hostsDeManifiesto`: dos entradas con la misma URL de host y una con otro host devuelven los dos hostnames únicos, ordenados; una URL con `%20` en el path no rompe; manifiesto `{}` devuelve `[]`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `node --no-warnings --test lib/catalog/fotos-blob.test.ts`
  Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implement** `lib/catalog/fotos-blob.ts`. Sin `node:fs` ni `node:crypto`: es puro. Comparar claves con `a < b ? -1 : a > b ? 1 : 0` (como `lib/catalog/orden.ts`).

- [ ] **Step 4: Run test to verify it passes**
  Run: `node --no-warnings --test lib/catalog/fotos-blob.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(fotos): módulo puro del manifiesto de fotos en Blob`

---

### Task 2: `construirImagenes` toma las URLs del manifiesto

**Files:**
- Modify: `lib/catalog/photos.ts` (función `construirImagenes`, líneas 100-109, y el comentario de cabecera que cita `public/productos/`)
- Modify: `lib/catalog/photos.test.ts` (los tests de `construirImagenes` y el texto de ejemplo)

**Interfaces:**
- Consumes: `ArchivoFoto` (ya existe en `photos.ts`).
- Produces: `construirImagenes(archivos: ArchivoFoto[], nombreProducto: string, urlDe: (archivo: string) => string | undefined): Imagen[]`. Salta los archivos cuyo `urlDe` devuelve `undefined`; el `alt` sigue siendo `"{nombre} — {vista}"`.

- [ ] **Step 1: Update the failing tests** en `photos.test.ts`: `construirImagenes` con `urlDe = (a) => \`https://x.public.blob.vercel-storage.com/productos/${a}\`` devuelve `url` absoluta y `alt` `"Subwoofer SRX 12\" — frontal"` (usar el nombre de producto que ya usan los tests actuales); un archivo sin URL no aparece; si ninguno tiene URL devuelve `[]`.
- [ ] **Step 2: Run** `node --no-warnings --test lib/catalog/photos.test.ts` — Expected: FAIL (firma vieja).
- [ ] **Step 3: Implement** el cambio de firma; quitar el parámetro `rutaBase`.
- [ ] **Step 4: Run** `node --no-warnings --test lib/catalog/photos.test.ts` — Expected: PASS. Typecheck fallará en `scripts/import-catalog.ts` hasta Task 4: es esperado.
- [ ] **Step 5: Commit** — `refactor(fotos): construirImagenes recibe las URLs en vez de una ruta base`

---

### Task 3: Subida a Blob (`npm run fotos:subir`)

**Files:**
- Create: `scripts/catalogo/fotos.ts` (acceso al disco), `scripts/fotos/subir-blob.ts` (el comando)
- Modify: `package.json` (dependencia `@vercel/blob`, script `fotos:subir`), `.env.example` (documentar `BLOB_READ_WRITE_TOKEN`, solo para subir fotos)
- Test: `scripts/catalogo/fotos.test.ts`

**Interfaces:**
- Consumes: `nombreBlob`, `serializarManifiesto`, `ManifiestoFotos` (Task 1).
- Produces (en `scripts/catalogo/fotos.ts`):
  ```ts
  export function hashDeFoto(contenido: Buffer): string;                 // sha-256, primeros 12 hex
  export function leerHashesDeFotos(carpeta: string): Map<string, string>; // archivo → hash12; ignora archivos que empiezan por "."
  export function leerManifiesto(ruta: string): ManifiestoFotos;         // {} si el archivo no existe
  export function pendientesDeSubir(enDisco: ReadonlyMap<string, string>, manifiesto: ManifiestoFotos): string[]; // sin entrada o con hash distinto, ordenados por puntos de código
  ```

- [ ] **Step 1: Write the failing tests** en `scripts/catalogo/fotos.test.ts`, con una carpeta temporal (`mkdtempSync`):
  - `hashDeFoto(Buffer.from("abc"))` → `"ba7816bf8f01"`.
  - `leerHashesDeFotos` ignora `.gitkeep`, devuelve un mapa con el hash de cada archivo y no recorre subcarpetas.
  - `leerManifiesto` de una ruta inexistente → `{}`.
  - `pendientesDeSubir` con disco `{A: h1, B: h2}` y manifiesto `{A: {hash: h1}}` → `["B"]`; con `{A: {hash: "x"}}` → `["A", "B"]`; sin pendientes → `[]` (caso de reanudar tras una subida interrumpida).
- [ ] **Step 2: Run** `node --no-warnings --test scripts/catalogo/fotos.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `scripts/catalogo/fotos.ts`.
- [ ] **Step 4: Run** el test — Expected: PASS.
- [ ] **Step 5: Install** `npm install @vercel/blob` y agregar a `package.json`: `"fotos:subir": "tsx --env-file-if-exists=.env.local scripts/fotos/subir-blob.ts"`. Comprobar que `tsx` acepta ese flag: `npx tsx --env-file-if-exists=.env.local -e "console.log('ok')"` imprime `ok`; si no, usar `node --env-file-if-exists=.env.local --import tsx scripts/fotos/subir-blob.ts`.
- [ ] **Step 6: Implement `scripts/fotos/subir-blob.ts`** (carpeta fuente `assets/productos`, manifiesto `data/fotos-blob.json`):
  1. Si falta `BLOB_READ_WRITE_TOKEN`: mensaje claro («Crea la tienda Blob en Vercel y pon el token en .env.local») y `process.exit(1)` **antes** de leer o subir nada.
  2. Calcula pendientes; sube de a 4 en paralelo con `put(nombreBlob(...), contenido, { access: "public", addRandomSuffix: false, allowOverwrite: false, contentType: "image/webp" o el de la extensión, cacheControlMaxAge: 31536000 })`. Guarda `{ url, hash, bytes }` por archivo.
  3. Quita del manifiesto las entradas cuyo archivo ya no está en disco.
  4. Escribe el manifiesto con `serializarManifiesto` en un `finally`, para conservar lo ya subido si algo falla a mitad.
  5. Imprime «N subidas, M ya estaban, K entradas quitadas, X MB».
- [ ] **Step 7: Verify without token**: `npm run fotos:subir` con `BLOB_READ_WRITE_TOKEN` vacío termina con código 1 y el mensaje, sin tocar `data/fotos-blob.json`.
- [ ] **Step 8: Commit** — `feat(fotos): comando fotos:subir que sube a Vercel Blob y escribe el manifiesto`

---

### Task 4: El importador lee el manifiesto

**Files:**
- Modify: `scripts/import-catalog.ts` (constante `RUTA_FOTOS` línea 66; bloque de fotos líneas 180-198; alertas línea 207-215; resumen línea 292-294)

**Interfaces:**
- Consumes: `leerHashesDeFotos`, `leerManifiesto` (Task 3); `compararConManifiesto`, `alertasDeFotos` (Task 1); `construirImagenes` (Task 2).
- Produces: `catalog.json` con `imagenes[].url` absolutas de Blob; alertas de fotos en `reports/import-errors.md`.

- [ ] **Step 1: Implement**
  - `RUTA_FOTOS = path.join(RAIZ, "assets", "productos")` y `RUTA_FOTOS_BLOB = path.join(RAIZ, "data", "fotos-blob.json")`.
  - `hashes = leerHashesDeFotos(RUTA_FOTOS)` si la carpeta existe (si no, mapa vacío); `manifiesto = leerManifiesto(RUTA_FOTOS_BLOB)`.
  - El emparejamiento usa `[...hashes.keys()]` en lugar de `readdirSync`.
  - `construirImagenes(..., (archivo) => manifiesto[archivo]?.url)`.
  - Agregar `...alertasDeFotos(compararConManifiesto(hashes, manifiesto))` al arreglo `alertas`.
  - El resumen dice `archivo(s) de assets/productos/ ignorado(s)` y suma `N foto(s) sin subir`.
- [ ] **Step 2: Verify** `npm run typecheck` pasa (la firma de Task 2 ya está usada). **No** correr `import:catalog` todavía: sin manifiesto dejaría el catálogo sin fotos hasta Task 7.
- [ ] **Step 3: Commit** — `feat(fotos): el importador toma las URLs de data/fotos-blob.json`

---

### Task 5: `next.config.ts` acepta el host de Blob

**Files:**
- Modify: `next.config.ts` (bloque `images`, línea ~110)

**Interfaces:**
- Consumes: `hostsDeManifiesto`, `ManifiestoFotos` (Task 1).

- [ ] **Step 1: Implement** `images.remotePatterns`: un patrón `{ protocol: "https", hostname, pathname: "/productos/**" }` por cada host de `hostsDeManifiesto(...)`, leyendo `data/fotos-blob.json` con `readFileSync` y devolviendo `[]` si falta. Si `next.config.ts` no puede importar `./lib/catalog/fotos-blob.ts`, repetir esa función de tres líneas dentro del archivo y dejar un comentario que apunte a la de `lib/`. `qualities: [50, 75]` no cambia.
- [ ] **Step 2: Verify** `npm run typecheck` pasa. (La carga real con una URL se prueba en Task 7.)
- [ ] **Step 3: Commit** — `feat(fotos): remotePatterns de next/image salen del manifiesto`

---

### Task 6: El carrito no depende de la URL guardada

**Files:**
- Create: `lib/cart/foto.ts`
- Modify: `lib/cart/types.ts` (`CatalogoSku`, línea 54), `app/layout.tsx` (línea 92), `lib/cart/context.ts` (junto a `slugPorSku`, líneas 76 y 259), `components/cart/CarritoView.tsx` (líneas 50, 145 y 208)
- Test: `lib/cart/foto.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/cart/foto.ts
  export function fotoDeLinea(snapshot: string | null, fotoCatalogo: string | undefined): string | null;
  ```
  `CatalogoSku` gana `foto?: string`; `useCart()` gana `fotoPorSku: Readonly<Record<string, string>>`.

- [ ] **Step 1: Write the failing tests** en `lib/cart/foto.test.ts`:
  - con `fotoCatalogo = "https://x.public.blob.vercel-storage.com/productos/A.h.webp"` devuelve esa URL aunque el snapshot sea `"/productos/A.jpg"`.
  - sin foto de catálogo y snapshot `"https://x.public.blob.vercel-storage.com/productos/A.h.webp"` devuelve el snapshot.
  - sin foto de catálogo y snapshot `"/productos/A.jpg"` o `"/productos/A.webp"` devuelve `null` (carrito viejo: placeholder, no imagen rota).
  - snapshot `null` y sin catálogo devuelve `null`.
- [ ] **Step 2: Run** `node --no-warnings --test lib/cart/foto.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `fotoDeLinea` (el prefijo viejo es `/productos/`).
- [ ] **Step 4: Run** el test — Expected: PASS.
- [ ] **Step 5: Wire it**: `layout.tsx` agrega `foto: p.imagenes[0]?.url` al objeto del catálogo del carrito; `context.ts` calcula `fotoPorSku` igual que `slugPorSku` y lo expone; `CarritoView` pasa `fotoDeLinea(item.imagenSnapshot, fotoPorSku[item.sku])` a la miniatura (si es `null`, el `PlaceholderImage` que ya existe).
- [ ] **Step 6: Gate de peso.** Con el servidor de desarrollo: `curl -s --compressed -o /dev/null -w "%{size_download}" http://localhost:3000/carrito` antes y después de este paso (con el catálogo ya con URLs de Blob, o sea después de Task 7). Si la diferencia comprimida pasa de **6000 bytes**, quitar `foto` de `CatalogoSku` y de `layout.tsx`, y dejar `fotoDeLinea(item.imagenSnapshot, undefined)`: los carritos viejos muestran placeholder y los nuevos guardan la URL absoluta.
- [ ] **Step 7: Run** `npm test` y `npm run typecheck` — Expected: PASS.
- [ ] **Step 8: Commit** — `fix(carrito): la miniatura sale del catálogo y no de una URL guardada`

---

### Task 7: Migración de las fotos (requiere el token de Byron)

**Files:**
- Move: `public/productos/` → `assets/productos/` (`git mv`; incluye `.gitkeep` si existe)
- Create: `data/fotos-blob.json` (lo escribe el script), `lib/catalog/fotos-manifiesto.test.ts`
- Modify: `data/catalog.json` (lo regenera el importador), `scripts/fotos/normalizar-producto.mjs` y `scripts/fotos/jpg-a-webp.mjs` (carpeta de salida y por defecto: `assets/productos`)

**Interfaces:**
- Consumes: `leerHashesDeFotos`, `leerManifiesto` (Task 3); `compararConManifiesto` (Task 1).

- [ ] **Step 1: Byron** crea la tienda en Vercel (Storage → Create → Blob, **pública**) y pone `BLOB_READ_WRITE_TOKEN` en `.env.local`. Confirmar que `.env.local` sigue en `.gitignore` (`.env*.local` ya está).
- [ ] **Step 2:** `git checkout -b feature/fotos-blob` desde `feature/fotos-jbl-y-vistas`; `git mv public/productos assets/productos`.
- [ ] **Step 3:** `npm run fotos:subir`. Expected: sube todas las fotos (≈ 26.7 MB) y escribe `data/fotos-blob.json`. Abrir una URL del manifiesto en el navegador y comprobar que carga; anotar el host.
- [ ] **Step 4:** Repetir `npm run fotos:subir`. Expected: «0 subidas, N ya estaban» (idempotencia).
- [ ] **Step 5:** `npm run import:catalog`. Expected: 0 alertas de fotos; `catalog.json` ya no contiene `"/productos/"` (`grep -c '"/productos/' data/catalog.json` imprime `0`) y sus `imagenes[].url` empiezan por `https://`.
- [ ] **Step 6: Write the consistency test** `lib/catalog/fotos-manifiesto.test.ts`: lee `assets/productos` y `data/fotos-blob.json` y afirma que `compararConManifiesto` devuelve los tres arreglos vacíos (mensaje de fallo: la salida de `alertasDeFotos`). Sin la carpeta `assets/productos` el test se salta.
- [ ] **Step 7:** Actualizar las carpetas por defecto en `normalizar-producto.mjs` y `jpg-a-webp.mjs` (y los comentarios que dicen `public/productos`).
- [ ] **Step 8: Verify**: `npm test`, `npm run typecheck`, `npm run lint` pasan. Con `preview_start` `sonoro-dev`: `/catalogo/bocinas` y una ficha cargan las fotos (`img` con `naturalWidth > 0`), una ficha de sku con espacio (p. ej. `165 AC`) también, y `/carrito` con un carrito viejo (`localStorage` con `imagenSnapshot: "/productos/X.jpg"`) muestra placeholder y no una imagen rota. La imagen OG de una ficha (`/producto/<slug>/opengraph-image`) responde 200: `grep -n "imagenes\|readFile\|public" "app/producto/[slug]/opengraph-image.tsx" lib/og/*.ts` no debe mostrar lectura de fotos desde disco; si la hay, leer la foto por URL. Sin `BLOB_READ_WRITE_TOKEN` en el entorno, `npm run build` termina bien.
- [ ] **Step 9: Commit** en dos commits: `chore(fotos): mover las fotos fuente a assets/productos` (solo el `git mv` y los scripts) y `feat(fotos): subir las fotos a Blob y regenerar el catálogo` (manifiesto, catálogo, test).

---

### Task 8: Documentación y PR

**Files:**
- Modify: `CLAUDE.md` (§ Imágenes → «Pipeline de fotos por SKU»; §Datos → esquema de imágenes; cualquier mención de `public/productos/`)

- [ ] **Step 1:** Reescribir el pipeline: carpeta `assets/productos/`, `npm run fotos:subir`, `data/fotos-blob.json` (qué es, que no se edita), las tres alertas, que el build no usa token, el nombre con hash y su razón (URL inmutable), que el carrito toma la foto del catálogo, y que los blobs viejos no se borran solos. Reemplazar las menciones de `public/productos/`: `grep -n "public/productos" CLAUDE.md` debe quedar en cero salvo la nota histórica del PR de WebP, si se conserva.
- [ ] **Step 2: Verify** `grep -rn "public/productos" scripts lib app components next.config.ts package.json CLAUDE.md` no devuelve referencias vivas.
- [ ] **Step 3:** Commit `docs(fotos): documentar el flujo de fotos en Blob`, push y abrir el PR. En la descripción: qué hace Byron (tienda y token), que el build no necesita token y cómo comprobar el ahorro en Resources → Static Assets del Preview contra el último deployment.
- [ ] **Step 4:** En el Preview comprobar tres cosas: cargan las fotos, el build no pidió token y `assets/` no aparece en Static Assets. Si `assets/` aparece, se agrega a `.vercelignore` y se vuelve a comprobar.
