# Fotos de producto en Vercel Blob — diseño

Fecha: 17 de noviembre de 2026. Estado: **borrador para aprobar**. Contexto: el PR 17 (fotos a WebP) bajó `public/productos/` de 82.1 a 26.7 MB; esto saca esos 26.7 MB del deployment.

## Intención

`public/productos/` viaja completo en cada deployment de Vercel y llenó el Deployment Storage de la cuenta. Las fotos pasan a servirse desde Vercel Blob; el deployment deja de llevarlas. Esta primera parte rehace el flujo de fotos del importador para que `catalog.json` apunte a Blob.

## Metas

- `public/productos/` desaparece del deployment (−26.7 MB por deployment).
- **El build no necesita token ni red hacia Blob.** Solo quien sube fotos necesita el token.
- Subir fotos nuevas es un comando, y repetirlo no duplica nada (idempotente).
- Cada URL de foto es inmutable: si una foto cambia, cambia su URL (misma lección que los `.glb` en CLAUDE.md § Caché).
- Las fotos fuente siguen en Git, así que el historial y el respaldo no cambian.

## No metas

- No se mueven las fotos de la portada, los logos ni los modelos 3D: pesan poco y viven en otro flujo.
- No se borran blobs viejos automáticamente. Una foto reemplazada deja su blob anterior; se limpian a mano más adelante.
- No se cambia el formato, el encuadre ni el nombre `SKU_vista.ext` de las fotos.

## Anti-metas (sería un fracaso aunque «funcione»)

- Un build que falla o se vuelve lento por no tener el token de Blob.
- Una foto que sale en el sitio sin estar en Git, o una foto en Git que el sitio muestra desactualizada sin avisar.

## Enfoques considerados

- **A. Fotos fuente en el repo + manifiesto de URLs (elegido por Byron).** `assets/productos/` guarda las fotos; `npm run fotos:subir` las sube y escribe `data/fotos-blob.json`; el importador lee el manifiesto. Build sin red; el token solo para subir.
- **B. Solo en Blob; el importador lista Blob en cada corrida.** Repo más liviano, pero cada build (Vercel, Lighthouse, local) necesita token y red, y una foto borrada de Blob se pierde sin respaldo. Descartado.
- **C. Subir a Blob dentro del build.** Cada Preview subiría fotos y el build sería lento y dependiente del token. Descartado.

## Diseño

1. **Fotos fuente.** `git mv public/productos assets/productos` (conserva el historial). `scripts/fotos/normalizar-producto.mjs` y `jpg-a-webp.mjs` pasan a tener `assets/productos` como salida y carpeta por defecto.
2. **Subida.** `scripts/fotos/subir-blob.mjs` (`npm run fotos:subir`) usa `@vercel/blob` y `BLOB_READ_WRITE_TOKEN` (de `.env.local`). Por cada archivo calcula el sha-256 y toma los primeros 12 caracteres. Si el hash ya está en el manifiesto, lo salta sin tocar la red. Si no, sube con el nombre `productos/<archivo sin extensión>.<hash12>.<ext>` y las opciones `access: "public"`, `addRandomSuffix: false`, `allowOverwrite: false` y una caché larga.
3. **Manifiesto.** `data/fotos-blob.json`, versionado: `{ "<SKU_vista.ext>": { "url", "hash", "bytes" } }`, con las claves en orden de puntos de código (determinista, como `catalogo.csv`). Lo escribe solo el script de subida; no se edita a mano. Quita las entradas de archivos que ya no existen en disco.
4. **Importador.** `import-catalog.ts` deja de leer `public/productos/`. Lee los nombres de `assets/productos/`, los empareja con los skus con el mismo `emparejarFotosConSkus` y toma la URL de cada foto del manifiesto (`construirImagenes` recibe el manifiesto en vez de una ruta base). Alertas en `reports/import-errors.md`, sin abortar el import, igual que hoy:
   - foto en disco **sin entrada** en el manifiesto: «sin subir, corre `npm run fotos:subir`»; no entra en `imagenes`.
   - foto cuyo **hash en disco no coincide** con el del manifiesto: «cambió desde la última subida»; sigue saliendo con la URL vieja.
   - entrada del manifiesto **sin archivo** en disco: «huérfana».
5. **`next.config.ts`.** `images.remotePatterns` se arma leyendo los hostnames de las URLs del manifiesto, así no se escribe a mano el host de la tienda. Con el manifiesto vacío no hay patrones. `qualities` no cambia.
6. **Consumidores.** `ProductImage`, `ProductGallery` y el chat ya pasan por `next/image` y solo necesitan el patrón anterior. El JSON-LD usa `absoluteUrl()`, que deja intactas las URLs absolutas. Hay que comprobar que la imagen OG de la ficha no lea la foto del disco. Los fixtures de `photos.test.ts` y `buscables.test.ts` que usan `/productos/…` se actualizan.
7. **Carrito.** `imagenSnapshot` guarda la URL de la foto al agregar. Los carritos guardados antes del cambio tienen `/productos/X.jpg` (ya roto desde el PR 17) o `/productos/X.webp`, y mostrarían la imagen rota. **Mi propuesta:** `CarritoView` toma la foto de `imagenes[0]` del catálogo por sku y usa el snapshot solo si el producto ya no está. Es coherente con la regla del carrito de derivar lo que se muestra del catálogo.
8. **CLAUDE.md.** Se reescribe «Pipeline de fotos por SKU» (carpeta nueva, subida, manifiesto, alertas) y se actualizan las referencias a `public/productos/`.
9. **Prueba de consistencia.** Un test falla si `assets/productos` y `data/fotos-blob.json` no coinciden (archivo sin subir, hash distinto o entrada huérfana). Así una foto desactualizada no llega a producción sin que CI lo note.

## Lo que hace Byron (no se puede automatizar)

- Crear la tienda en el panel de Vercel: Storage → Create → Blob, **pública**.
- Poner `BLOB_READ_WRITE_TOKEN` en `.env.local`. No se pega en el chat ni se pone en las variables del proyecto en Vercel: el build no lo usa.

## Orden de trabajo (mis llamadas)

1. Rama nueva desde `feature/fotos-jbl-y-vistas`, porque esa rama trae fotos de JBL que también hay que mover (el PR llevará ese commit si no se ha fusionado antes).
2. `git mv`, script de subida, subir las fotos, importador, `next.config.ts`, carrito, test, CLAUDE.md.
3. Preview de Vercel para comprobar tres cosas: que cargan las fotos, que el build no pide token y que el Deployment Storage del Preview baja.

## Por verificar durante la construcción

- Que `assets/` (fuera de `public/`) no cuente en el Deployment Storage: se comprueba en Resources del Preview.
- Que `@vercel/blob` acepte nombres con espacio (`165 AC_frontal`); si no, el nombre de subida codifica el espacio.
- El host exacto de la tienda: sale de la primera subida.
