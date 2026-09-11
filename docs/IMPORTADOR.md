# SONORO — Importador 3.0

Especificación para reescribir `scripts/import-catalog.ts` sobre el libro por categorías. Incluye el prompt para Claude Code y la verificación que hace segura la migración.

---

## Qué cambia

| | Antes | Ahora |
|---|---|---|
| Entrada | `productos.csv`, 64 columnas | `catalogo.xlsx`, 9 hojas de 32–37 columnas |
| Categoría | columna `categoria` | la hoja **es** la categoría |
| Specs | 13 parejas, mitad duplicando campos normalizados | 10 parejas, solo lo no derivable |
| Multi-categoría | columna `categorias_secundarias` | hoja `ESPECIALES` con columna `categorias` |
| Artefacto de registro | el mismo CSV que editabas | CSV plano **generado**, solo para el diff de Git |

---

## Flujo

```
Google Sheets
   ↓ Archivo → Descargar → Microsoft Excel (.xlsx)      ← UNA descarga
data/source/catalogo.xlsx          superficie de edición
   ↓ npm run import:catalog
data/source/catalogo.csv           generado · plano · versionado para el diff
data/catalog.json                  generado · consume la app
data/brands.json · taxonomy.json
reports/import-errors.md · price-diff.md
```

El CSV deja de editarse a mano. Sigue en Git porque `git diff` sobre texto plano es lo que te deja ver qué precio cambió; el `.xlsx` no da eso.

---

## Antes de empezar: ¿existe `lib/facets/`?

Este importador **genera** las specs legibles a partir de los campos normalizados, y para eso necesita saber que `coaxial-2v` se muestra como «Coaxial de 2 vías» y que `12"` se muestra como `12" (30 cm)`.

Esa traducción es la misma que usan los filtros y el comparador. Vive en `lib/facets/`, que crea la **Sesión F2**.

### Verifica

```bash
ls lib/facets/
cat lib/facets/index.ts 2>/dev/null | head -30
```

### Si existe

Confirma que exporta lo que el importador va a usar:

- [ ] La traducción de valor a etiqueta de cliente para `configuracion`, `bobinas`, `clase`, `formato`, `material_conductor`, `material_insono`, `tipo_ecualizador`, `tipo_accesorio`
- [ ] El formato de valor para los numéricos: `600 W`, `4 Ω`, `4 canales`, `8 AWG`, `3.6 m²`, `2 mm`
- [ ] El nombre de fila de cada campo: `medida` → «Diámetro» o «Tamaño» según categoría

Si falta alguno, agrégalo en F2 antes de tocar el importador. No lo definas en el importador: eso reintroduce la duplicación que esta reestructuración elimina.

Con eso verificado, sigue al prompt de abajo.

### Si NO existe

**No escribas el importador todavía.** Tienes dos caminos:

**A) Correr la Sesión F2 primero** (recomendado). Está en `SONORO_SESIONES_G_J.md`. Es corta, y desbloquea el importador, los filtros y el comparador de una vez. El orden queda:

```
F2 (facetas)  →  importador 3.0  →  G (filtros)  →  J (comparador)
```

**B) Empezar por el importador**, y entonces crea `lib/facets/` como parte de esa sesión. Agrega esto al inicio del prompt:

```
Este proyecto todavía no tiene lib/facets/. Créalo como PRIMER paso de esta
sesión, antes del importador, siguiendo la especificación de la Sesión F2 en
docs/SESIONES_G_J.md: definición de facetas por categoría, traducción de
valores a etiquetas de cliente, formato de valor y orden por magnitud.

El importador lo consume; no dupliques ninguna traducción dentro de
scripts/import-catalog.ts.
```

La opción B hace la sesión más larga y mezcla dos cosas distintas en un commit. Prefiere A salvo que quieras el importador funcionando ya.

**Lo que no debes hacer en ningún caso** es escribir las traducciones dentro del importador «por ahora, para salir del paso». Si `coaxial-2v` se traduce en dos lugares, en la primera etiqueta que cambies el catálogo generado y la interfaz van a decir cosas distintas — y nadie lo va a notar hasta que un cliente lo vea.

---

## Prompt para Claude Code 🔍

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

---

## Verificación de la migración

Esta es la parte que hace seguro el cambio. **Hazla antes de borrar nada.**

Paso cero, si no lo hiciste aún: confirma que `lib/facets/` existe y exporta
las traducciones (ver la sección «Antes de empezar» arriba). Sin eso, el
importador no puede generar las specs.

```bash
# 1. Con el importador VIEJO y el CSV viejo
npm run import:catalog
cp data/catalog.json /tmp/catalog-antes.json

# 2. Migra: nuevo xlsx + importador nuevo
npm run import:catalog

# 3. Compara
node -e "
const a=require('/tmp/catalog-antes.json'), b=require('./data/catalog.json');
const key=p=>p.sku;
const A=new Map(a.map(p=>[key(p),p])), B=new Map(b.map(p=>[key(p),p]));
console.log('antes',A.size,'después',B.size);
for(const k of A.keys()) if(!B.has(k)) console.log('FALTA', k);
for(const k of B.keys()) if(!A.has(k)) console.log('SOBRA', k);
for(const [k,x] of A){ const y=B.get(k); if(!y) continue;
  for(const f of ['slug','nombre','marca','categoria','precioCents','disponibilidad','activo'])
    if(JSON.stringify(x[f])!==JSON.stringify(y[f])) console.log(k,f,x[f],'->',y[f]);
}
"
```

Los campos del bloque común deben salir **idénticos**. Las specs sí van a cambiar —ese es el punto— pero ningún producto puede desaparecer, ni cambiar de slug, ni de precio.

Ya verifiqué el lado de la hoja: los 328 productos migraron con **cero diferencias** en los 34 campos comparados y cero diferencias en las specs libres.

### Revisión visual, obligatoria

Después de la comparación, levanta el sitio y revisa la ficha de al menos uno por categoría. Las specs ahora se generan, así que el texto va a cambiar de forma. Busca:

- Que no haya specs duplicadas con distinta redacción
- Que las destacadas sean las tres correctas
- Que los amplificadores conserven su potencia con impedancia en el texto
- Que ningún producto quede con menos de tres specs

---

## Lo que se gana

**La hoja deja de ser ilegible.** De 64 columnas a entre 32 y 37, y sin celdas vacías por diseño: un subwoofer ya no tiene columnas de pantalla ni de calibre AWG.

**La categoría no puede estar mal.** No hay columna que escribir mal: la hoja es la categoría.

**La contradicción se detecta.** Hoy `potencia_rms_w = 600` puede convivir con una ficha que diga 800 W y nadie se entera. Fue el origen de casi todos los huecos que encontramos.

**Se escribe la mitad.** Las specs derivables se generan solas; solo capturas lo que de verdad no se deduce.

## Lo que cuesta

**Una sesión de Claude Code** para el importador, más la verificación.

**Las specs van a cambiar de redacción** en los productos donde antes había prosa para un campo derivable y ahora no la haya. Por eso la revisión visual no es opcional.

**Depende de que la Sesión F2 esté hecha.** Es el único prerrequisito duro de
esta reestructuración.

**Sube el acoplamiento con `lib/facets/`.** El importador pasa a depender de ese módulo para formatear. Es lo correcto —una sola traducción para el sitio, el importador y el comparador— pero significa que cambiar una etiqueta ahí afecta al catálogo generado. Vale documentarlo en `CLAUDE.md`.
