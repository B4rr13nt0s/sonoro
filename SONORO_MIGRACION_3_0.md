# SONORO — Migración al catálogo 3.0

Guía de ejecución. Todo lo que hay que correr, en orden, con los prompts listos para copiar.

**Qué hace esta migración:** pasa el catálogo de un archivo plano de 64 columnas a un libro con una hoja por categoría, y hace que el importador **genere** las specs legibles en vez de que las escribas a mano.

**Tiempo:** dos sesiones de Claude Code más la verificación.

---

## Índice

| Paso | Qué es                          | Quién         |
| ---- | ------------------------------- | ------------- |
| 0    | Preparar los archivos           | Tú            |
| 1    | Respaldo del catálogo actual    | Tú, terminal  |
| 2    | Sesión F2 — módulo de facetas   | Claude Code   |
| 3    | Sesión I2 — importador 3.0      | Claude Code   |
| 4    | Verificar que no se perdió nada | Tú, terminal  |
| 5    | Revisión visual                 | Tú, navegador |
| 6    | Limpieza y commit               | Tú, terminal  |

**No saltes el paso 1 ni el 4.** Son los que hacen reversible la migración.

---

# PASO 0 · Preparar los archivos

Trabajo tuyo, sin terminal.

1. Sube `SONORO_CATALOGO_3_0.xlsx` a Google Drive y ábrelo con Google Sheets
2. En cada hoja de producto, verifica que la **columna A (sku) esté en formato Texto sin formato**
   (selecciona la columna → Formato → Número → Texto sin formato)
3. Archivo → Descargar → **Microsoft Excel (.xlsx)**
4. Guárdalo en el repositorio como `data/source/catalogo.xlsx`
5. Copia `SONORO_IMPORTADOR_3_0.md` a `docs/IMPORTADOR.md`
6. Copia `SONORO_SESIONES_G_J.md` a `docs/SESIONES_G_J.md`

**Todavía no borres** `data/source/productos.csv` ni el importador viejo. Los necesitas en el paso 1.

---

# PASO 1 · Respaldo del catálogo actual

Terminal, en la raíz del repositorio.

```bash
# Genera el catálogo con el importador VIEJO
npm run import:catalog

# Guarda el resultado como referencia
cp data/catalog.json /tmp/catalog-antes.json
wc -l /tmp/catalog-antes.json

# Punto de retorno
git add -A && git commit -m "chore: punto previo a la migración del catálogo 3.0"
```

**Si `npm run import:catalog` falla aquí, detente.** Resuelve eso antes de migrar: no conviene cambiar de formato partiendo de un estado roto.

---

# PASO 2 · Sesión F2 · Módulo de facetas

Primero verifica si ya existe:

```bash
ls lib/facets/ 2>/dev/null && echo "YA EXISTE" || echo "NO EXISTE"
```

### Si dice YA EXISTE

Revisa que exporte lo que el importador necesita:

```bash
grep -c "coaxial-2v\|2-din\|material_conductor" lib/facets/*.ts
```

Si no aparecen esas traducciones, corre igual el prompt de abajo pidiéndole que complete lo que falte. Si sí aparecen, **salta al Paso 3**.

### Si dice NO EXISTE

Abre Claude Code en la raíz del repositorio, escribe `/clear`, y pega esto:

```
El catálogo ahora trae 26 columnas normalizadas con cobertura del 100% en los
campos obligatorios de cada categoría. Los filtros y el comparador van a leer
de ahí.

Crea lib/facets/ con:

1. DEFINICIÓN POR CATEGORÍA — qué campos son facetables en cada una:

   Subwoofers      medida · potencia_rms_w · impedancia_ohm · bobinas
   Bocinas         medida · configuracion · potencia_rms_w · impedancia_ohm
   Amplificadores  canales · clase · potencia_rms_w
   Receptores      formato · pantalla_pulg · carplay · android_auto
   Ecualizadores   tipo_ecualizador · canales
   Insonorización  espesor_mm · cobertura_m2 · material_insono
   Kits            calibre_awg · material_conductor
   Accesorios      tipo_accesorio
   Sistemas        (ninguna — cada uno es un paquete distinto)

   Más `precio`, que aplica a todas.

   IMPORTANTE — categorías secundarias:
   El catálogo tiene una columna `categoriasSecundarias`. Un sistema completo
   aparece en el listado de las categorías de los componentes que incluye: el
   Stage 6 marino está en Subwoofers y en Bocinas, la barra de sonido solo en
   Bocinas.

   Reglas:
   - `categoria` sigue siendo la PRINCIPAL: define la URL canónica, el
     breadcrumb y los campos obligatorios
   - `listProducts({categoria})` debe devolver los de categoría principal
     MÁS los que la traigan en categoriasSecundarias
   - Los productos secundarios NO cuentan para los conteos de faceta, porque
     no tienen valores en esos campos. Si contaran, «12" (22)» daría 22
     resultados pero el listado mostraría 23
   - Al aplicar cualquier filtro de especificación, los secundarios quedan
     fuera. Es correcto: un sistema completo no tiene una impedancia
   - `generateStaticParams` no cambia: cada producto tiene una sola URL

   Marca visualmente las tarjetas de productos secundarios con una etiqueta
   discreta («Sistema completo») para que el cliente entienda por qué un
   paquete de Q 45,000 aparece entre subwoofers sueltos.

2. ETIQUETAS PARA EL CLIENTE — una sola fuente de traducción:

   configuracion:  coaxial-2v → «Coaxial 2 vías» · componentes-2v → «Componentes 2 vías»
                   medio-rango → «Medio rango» · tweeter → «Tweeter»
   bobinas:        simple → «Bobina simple» · doble → «Doble bobina» · triple → «Triple bobina»
   clase:          D → «Clase D» · AB → «Clase AB» · BR → «Clase BR»
   formato:        1-din → «1 DIN» · 2-din → «Doble DIN» · flotante → «Pantalla flotante»
                   especifico → «Específico por vehículo»
   material_conductor: cobre → «Cobre» · cca → «CCA (aluminio recubierto)»
   tipo_ecualizador:   grafico → «Gráfico» · parametrico → «Paramétrico» · procesador → «DSP»
   tipo_accesorio:     cable-rca → «Cable RCA» · ... (los ocho valores)
   material_insono:    butilo → «Butilo» · espuma → «Espuma» · mixto → «Multicapa»

   El nombre del campo también se traduce: medida → «Medida»,
   potencia_rms_w → «Potencia RMS», impedancia_ohm → «Impedancia»,
   salidas_preamp_pares → «Salidas preamp», etc.

3. FORMATO DE VALOR — cómo se muestra cada tipo:
   potencia_rms_w → «600 W» · impedancia_ohm → «4 Ω» · canales → «4 canales»
   («Monoblock» cuando es 1) · pantalla_pulg → «9"» («Sin pantalla» cuando es 0)
   espesor_mm → «2 mm» · cobertura_m2 → «3.6 m²» · calibre_awg → «8 AWG»
   carplay/android_auto → «Sí» / «No» · medida se muestra tal cual

4. ORDEN DE VALORES — las medidas y potencias se ordenan por magnitud, no
   alfabéticamente. «10"» va después de «8"», no antes. Define un
   comparador que entienda pulgadas, milímetros y formatos como 6x9".

5. buildFacets(productos, categoria) — recorre los productos y devuelve las
   facetas con sus valores presentes y el conteo de cada uno. Las facetas se
   derivan del catálogo, no se codifican a mano: si una categoría no tiene
   ningún producto con cierto valor, ese valor no aparece.

Tests: que toda etiqueta de la definición tenga traducción, y que el orden de
medidas sea por magnitud.
```

### Verificación del paso 2

```bash
npm run typecheck
npm run lint
npm test
```

Los tres deben pasar. Luego:

```bash
git add -A && git commit -m "feat: módulo de facetas" && git push
```

---

# PASO 3 · Sesión I2 · Importador 3.0

`/clear` en Claude Code, y pega esto:

```
Reescribe scripts/import-catalog.ts para leer el nuevo libro por categorías.

ENTRADA
data/source/catalogo.xlsx con estas hojas:
  INSTRUCCIONES, LISTAS  → se IGNORAN
  SUBWOOFERS, BOCINAS, AMPLIFICADORES, RECEPTORES, ECUALIZADORES,
  INSONORIZACION, KITS, ACCESORIOS  → una categoría cada una
  ESPECIALES  → productos multi-categoría, sin obligatorios de especificación

Usa la librería xlsx (SheetJS) en devDependencies. La hoja es la categoría:
no existe columna `categoria` en las hojas normales.

Mapeo hoja → categoría del sitio:
  SUBWOOFERS→Subwoofers · BOCINAS→Bocinas · AMPLIFICADORES→Amplificadores
  RECEPTORES→Receptores · ECUALIZADORES→Ecualizadores
  INSONORIZACION→Insonorización · KITS→Kits · ACCESORIOS→Accesorios

BLOQUE COMÚN — idéntico en las nueve hojas, en este orden:
  sku · slug · nombre · marca · descripcion_corta · precio · precio_antes
  disponibilidad · garantia_meses · destacado · activo

ABORTAR (sin escribir ningún archivo de salida) si:
  1. Falta una hoja esperada o aparece una desconocida
  2. Las once columnas comunes no son idénticas en las nueve hojas, en el mismo
     orden. Reporta qué hoja difiere y en qué columna
  3. Falta una columna específica de la categoría, o sobra una desconocida
  4. Un sku cumple pareceValorMangeado (fecha o notación científica)
  5. Un precio o precio_antes no vacío llega como texto
  6. Hay un sku DUPLICADO entre hojas
  7. Hay un slug DUPLICADO entre hojas
  8. Una categoría de ESPECIALES.categorias no existe en el mapeo

Los puntos 6, 7 y 2 son nuevos y son los que el formato multi-hoja hace
necesarios: con nueve hojas, un duplicado ya no se ve a simple vista.

Acumula TODOS los ofensores antes de abortar. No pares en el primero.

RECHAZO POR FILA (el import continúa, la fila queda fuera y se documenta en
import-errors.md): cualquier otra falla del esquema Zod — obligatorio vacío,
valor fuera de lista, booleano ilegible, par etiqueta/valor asimétrico.

CAMPOS OBLIGATORIOS POR HOJA
  SUBWOOFERS      medida · potencia_rms_w · impedancia_ohm · bobinas
  BOCINAS         medida · configuracion · potencia_rms_w · impedancia_ohm
  AMPLIFICADORES  canales · clase · potencia_rms_w
  RECEPTORES      formato · pantalla_pulg · carplay · android_auto ·
                  salidas_preamp_pares
  ECUALIZADORES   tipo_ecualizador · canales
  INSONORIZACION  espesor_mm · cobertura_m2 · material_insono
  KITS            calibre_awg · material_conductor
  ACCESORIOS      tipo_accesorio
  ESPECIALES      categorias  (ningún campo de especificación)
Más el bloque común en todas: sku, slug, nombre, marca, descripcion_corta,
precio, disponibilidad, destacado, activo.

GENERACIÓN DE SPECS — la parte nueva e importante
El importador CONSTRUYE las specs legibles a partir de los campos
normalizados. Reutiliza lib/facets/ para el formato: es la misma traducción
que usan los filtros y el comparador, no escribas una segunda.

  medida         → «Diámetro» en Subwoofers, «Tamaño» en Bocinas.
                   Valor: 12" (30 cm)
  potencia_rms_w → «Potencia RMS»: 600 W  (en Bocinas: «600 W por bocina»)
  impedancia_ohm
    + bobinas    → «Impedancia»: Doble bobina de 4 Ω   (Subwoofers)
                   «Impedancia»: 4 Ω                   (resto)
  configuracion  → «Configuración»: Coaxial de 2 vías
  canales        → «Canales»: 4 canales · Monoblock (1 canal)
  clase          → «Clase»: D
  formato        → «Formato»: Doble DIN
  pantalla_pulg  → «Pantalla»: 9"  (se omite si es 0)
  carplay/android_auto → «Integración con el teléfono»: Apple CarPlay y
                   Android Auto  (se omite si ambos son falsos)
  salidas_preamp → «Salidas preamp»: 3 pares (4 V)
  espesor_mm     → «Espesor»: 2 mm
  cobertura_m2   → «Cobertura»: 3.6 m²
  material_insono → «Material»: Multicapa
  calibre_awg    → «Calibre»: 8 AWG
  material_conductor → «Material del conductor»: Cobre
  tipo_accesorio → «Tipo»: Cable RCA
  tipo_ecualizador → «Tipo»: Ecualizador gráfico
  bandas         → «Bandas»: 7 bandas
  profundidad_mm → «Profundidad de montaje»: 130 mm
  sensibilidad_db → «Sensibilidad»: 88 dB
  capacidad_w    → «Capacidad recomendada»: Hasta 1,200 W
  longitud_m     → «Longitud»: 5 m

PRECEDENCIA
Si una spec libre usa una etiqueta que el importador también genera, GANA LA
SPEC LIBRE. Es deliberado: permite matices como «FLEX seleccionable a 1 Ω,
2 Ω o 4 Ω», que dice más que el valor normalizado.

Pero el importador ADVIERTE en import-errors.md cuando la spec libre y el
campo normalizado se contradicen. Ejemplo: potencia_rms_w = 600 y una spec
libre «Potencia RMS: 800 W». Hoy esa contradicción puede existir sin que nadie
la note; esta advertencia es la razón principal de la reestructuración.

Detección: extrae el primer número de la spec libre y compáralo con el campo.
Si difieren, advierte. No abortes: puede ser legítimo (un amplificador con
«125 W × 4 @ 4 Ω · 200 W × 4 @ 2 Ω» tiene 125 en el campo y dos números en el
texto). La advertencia es para que lo revises, no para bloquear.

DESTACADAS
Las tres primeras specs de la ficha, en el orden de prioridad de la categoría:
  Subwoofers      Diámetro · Potencia RMS · Impedancia
  Bocinas         Tamaño · Configuración · Potencia RMS
  Amplificadores  Canales · Potencia RMS · Clase
  Receptores      Formato · Pantalla · Integración con el teléfono
  Ecualizadores   Tipo · Bandas · Canales
  Insonorización  Material · Espesor · Cobertura
  Kits            Calibre · Material del conductor · Capacidad recomendada
  Accesorios      Tipo · Longitud · (la primera spec libre)
  ESPECIALES      las tres primeras specs libres
Si falta alguna, se completa con las siguientes de la ficha, saltando
etiquetas de marketing: Ventaja, Línea, Serie, Diseño.

ORDEN DE LA FICHA
Destacadas primero, luego el resto de generadas, luego las libres. Máximo 10.

ESPECIALES
La columna `categorias` es una lista separada por comas. Se emite como
`categoriasSecundarias` en el producto. La categoría PRINCIPAL de un producto
de ESPECIALES es «Sistemas» — define su URL y su breadcrumb.

SALIDAS
  data/source/catalogo.csv   plano, una fila por producto, con la columna
                             `categoria` derivada de la hoja. Es el artefacto
                             de registro para el diff de Git: ordénalo por
                             categoría y luego por sku, de forma DETERMINISTA,
                             o cada import producirá un diff falso
  data/catalog.json          los productos válidos
  data/brands.json · data/taxonomy.json
  reports/import-errors.md   filas rechazadas, advertencias de contradicción,
                             alertas de slug cambiado
  reports/price-diff.md      cambios de precio contra el import anterior

Si hubo abort, no se escribe NADA: el catalog.json anterior queda intacto y el
sitio publicado no se toca.

ANTES DE CODIFICAR muéstrame el plan, en especial cómo vas a validar que el
bloque común sea idéntico entre hojas y cómo vas a garantizar que el CSV
generado sea determinista.
```

### Durante la sesión

Te va a mostrar un plan antes de codificar. Revisa dos cosas:

- **Cómo valida que el bloque común sea idéntico entre las nueve hojas.** Debe comparar los once nombres en el mismo orden, no solo que existan
- **Cómo garantiza que el CSV generado sea determinista.** Si el orden de las filas cambia entre ejecuciones, cada import produce un diff falso de 328 líneas y el `price-diff.md` se vuelve inútil

Si propone escribir traducciones dentro del importador en vez de usar `lib/facets/`, recházalo.

### Verificación del paso 3

```bash
npm run import:catalog
```

Debe terminar sin abortar. Luego revisa los reportes:

```bash
cat reports/import-errors.md
cat reports/price-diff.md
```

`price-diff.md` debe decir que no hubo cambios de precio: la migración no toca precios. Si reporta cambios, **algo salió mal** — para y revisa.

---

# PASO 4 · Verificar que no se perdió nada

Terminal. Este es el paso que hace segura la migración.

```bash
node -e "
const a=require('/tmp/catalog-antes.json'), b=require('./data/catalog.json');
const A=new Map(a.map(p=>[p.sku,p])), B=new Map(b.map(p=>[p.sku,p]));
console.log('productos antes:',A.size,' despues:',B.size);
let err=0;
for(const k of A.keys()) if(!B.has(k)){ console.log('FALTA',k); err++; }
for(const k of B.keys()) if(!A.has(k)){ console.log('SOBRA',k); err++; }
for(const [k,x] of A){ const y=B.get(k); if(!y) continue;
  for(const f of ['slug','nombre','marca','categoria','precioCents','disponibilidad','activo'])
    if(JSON.stringify(x[f])!==JSON.stringify(y[f])){ console.log(k,f,x[f],'->',y[f]); err++; }
}
console.log(err===0 ? 'OK: sin diferencias' : 'DIFERENCIAS: '+err);
"
```

**Tiene que imprimir `OK: sin diferencias`.**

Los campos comparados son los que la migración no debe tocar. Las specs sí van a cambiar de redacción — ese es el punto del cambio — pero ningún producto puede desaparecer, cambiar de slug o cambiar de precio.

### Si aparecen diferencias

```bash
git reset --hard HEAD
```

Vuelves al punto del paso 1. Cuéntame qué diferencia salió.

---

# PASO 5 · Revisión visual

```bash
npm run dev
```

Abre `http://localhost:3000` y revisa **una ficha de producto por categoría**. Las specs ahora se generan, así que el texto cambió de forma.

Sugerencias concretas, una por categoría:

```
/producto/sonoro-serie-sq-12-d2      (Subwoofers)
/producto/memphis-mjp800-4           (Amplificadores)
/producto/pioneer-dmh-ap6650bt       (Receptores)
/producto/focal-acx-165              (Bocinas)
/producto/memphis-4gkit              (Kits)
```

En cada una verifica:

- [ ] No hay specs duplicadas con distinta redacción
- [ ] Las tres destacadas son las correctas de esa categoría
- [ ] Los amplificadores conservan la impedancia en el texto de potencia
      (`125 W × 4 @ 4 Ω · 200 W × 4 @ 2 Ω`, no solo `125 W`)
- [ ] Ningún producto quedó con menos de tres specs
- [ ] El breadcrumb y la URL no cambiaron

Y revisa los listados de categoría:

```
/catalogo/subwoofers     debe mostrar 57 productos (54 + 3 sistemas)
/catalogo/bocinas        debe mostrar 114 (109 + 5 sistemas)
```

---

# PASO 6 · Limpieza y commit

Solo después de que los pasos 4 y 5 pasaron.

```bash
# El CSV viejo editable ya no existe: ahora el importador genera el suyo
git rm data/source/productos.csv

# Verifica que el CSV generado sí esté versionado
git add data/source/catalogo.xlsx data/source/catalogo.csv

git add -A
git commit -m "feat: catálogo 3.0 — libro por categorías y specs generadas"
git push
```

Vercel despliega. Revisa la URL de producción y repite una ficha del paso 5.

### Actualiza `CLAUDE.md`

Agrega a la sección Datos:

```
FUENTE DE VERDAD (catálogo 3.0)

data/source/catalogo.xlsx — una hoja por categoría. La HOJA es la categoría.
El importador lo lee y emite data/source/catalogo.csv (plano, versionado para
el diff de Git) y data/catalog.json.

El importador GENERA las specs legibles desde los campos normalizados, usando
lib/facets/. Las columnas spec_N de la hoja son solo para lo que no se deriva.
Si una spec libre usa una etiqueta derivable, gana la libre, pero el importador
advierte si contradice al campo normalizado.

Cambiar una etiqueta en lib/facets/ cambia el catálogo generado. No lo
dupliques en el importador.

La hoja ESPECIALES es para productos multi-categoría. Su columna `categorias`
define en qué listados aparecen. Categoría principal: Sistemas.
```

---

# Después de la migración

El flujo de actualización queda así:

```
1. Editar la hoja de la categoría en Google Sheets
2. Archivo → Descargar → Microsoft Excel (.xlsx)
3. Reemplazar data/source/catalogo.xlsx
4. npm run import:catalog
5. git diff data/source/catalogo.csv     ← qué cambió, línea por línea
   cat reports/price-diff.md
   cat reports/import-errors.md
6. git commit && git push
```

Mismos seis pasos que antes. Lo que cambió es que editas una hoja de 35 columnas con solo los campos que aplican, en vez de una de 64 donde la mayoría están vacías.

**Lo que sigue:** las Sesiones G (filtros) y J (comparador) de `docs/SESIONES_G_J.md`. Ya no necesitan nada más: `lib/facets/` existe y el catálogo está normalizado.
