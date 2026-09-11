# SONORO — Sesiones G y J, reescritas

El catálogo cambió lo suficiente como para que las dos sesiones sean otra cosa. Antes eran ejercicios de arqueología sobre prosa inconsistente; ahora son trabajo directo sobre 26 columnas normalizadas con cobertura del 100%.

**Lo que esto elimina:** la fase de análisis de datos que ambas requerían. No hay que inventariar etiquetas, ni medir dispersión de valores, ni normalizar en el importador. Las facetas ya están decididas por el esquema.

**Lo que esto cambia en el orden:** G y J ahora pueden hacerse en cualquier momento, y J ya no depende de G. Comparten un módulo (`lib/facets/`), así que conviene hacerlas seguidas, pero son independientes.

---

## Prerrequisito compartido: `lib/facets/`

Ambas sesiones leen los mismos campos y muestran los mismos valores al cliente. Si cada una define su propia traducción de `coaxial-2v` a «Coaxial de 2 vías», se van a desincronizar.

Esta sesión previa es corta y desbloquea las dos.

### Sesión F2 · Módulo de facetas

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

**Listo cuando:** `buildFacets` devuelve las facetas correctas para las nueve categorías.

---

# Sesión G · Filtros por especificación 🔍

Ya no necesita análisis previo. El plan sigue siendo útil porque hay decisiones de UI que conviene revisar antes de codificar.

## Lo que dicen los datos

Estos son los valores reales del catálogo, y determinan qué tipo de control usar para cada faceta:

| Categoría | Faceta | Valores distintos |
|---|---|---|
| Subwoofers | medida | 5 — `12"` `10"` `8"` `15"` `6.5"` |
| | impedancia | 2 — `4 Ω` `2 Ω` |
| | bobinas | 3 |
| | potencia RMS | 14 |
| Bocinas | medida | 16 |
| | configuración | 6 |
| | impedancia | 3 |
| | potencia RMS | 23 |
| Amplificadores | canales | 5 — `1` `2` `4` `5` `6` |
| | clase | 3 — `D` `AB` `BR` |
| | potencia RMS | 16 |
| Receptores | formato | 4 |
| | pantalla | 6 |
| Accesorios | tipo | 6 |

**Consecuencia de diseño:** casi todas las facetas tienen menos de siete valores, así que van como casillas de verificación visibles, sin desplegables ni buscadores. Las dos excepciones son la potencia RMS (14 a 23 valores) y la medida en Bocinas (16), que necesitan agruparse en rangos.

## Prompt

```
El catálogo trae 26 columnas normalizadas con cobertura del 100% en los campos
obligatorios. lib/facets/ ya define qué es facetable por categoría y cómo se
muestra cada valor. Esta sesión construye los filtros.

ALCANCE
Filtros en /catalogo, /catalogo/[categoria], /marcas/[marca] y /buscar.

CONTROLES SEGÚN LOS DATOS
- Facetas con menos de 8 valores (medida en subwoofers, impedancia,
  configuración, bobinas, clase, canales, formato, tipo de accesorio,
  material): casillas de verificación, todas visibles, sin colapsar
- potencia_rms_w: agrupar en rangos. Propón los cortes a partir de la
  distribución real de cada categoría, no rangos fijos iguales para todas —
  un subwoofer de 150 W y una bocina de 150 W no ocupan el mismo lugar en su
  categoría
- medida en Bocinas (16 valores): agrupar las principales (6.5", 6x9", 4",
  5x7", 8") y dejar el resto bajo «Otras medidas»
- carplay y android_auto: una sola casilla cada uno, no un grupo
- precio: rangos predefinidos, no slider. Los cuartiles del catálogo son
  Q 600, Q 1,500 y Q 2,900, con máximo de Q 70,000 — propón cortes redondos
  a partir de eso

COMPORTAMIENTO
- Todo en query params, igual que marca hoy. La URL debe ser compartible por
  WhatsApp y rastreable
- Cada valor muestra su conteo: «12" (22)». Si un valor daría cero
  resultados con los filtros ya aplicados, se deshabilita en vez de
  desaparecer — que desaparezcan hace sentir que la interfaz se rompe
- Las facetas son POR CATEGORÍA. En /catalogo (todas) y /buscar solo se
  ofrecen marca y precio, que son las únicas transversales. Al elegir una
  categoría aparecen las suyas
- Sistemas no tiene facetas propias: solo marca y precio
- Los sistemas que aparecen por categoriasSecundarias NO se cuentan en las
  facetas y desaparecen al aplicar cualquier filtro de especificación. Son 3
  en Subwoofers y 5 en Bocinas. Que el conteo de la faceta y el total del
  listado no coincidan es correcto: verifica que la interfaz no lo presente
  como un error
- Cero resultados: mostrar qué filtros están activos y ofrecer quitarlos uno
  por uno, no solo «limpiar todo»

CANONICAL
Los filtros entran al canonical; `orden` sigue excluido. Mantén el
comportamiento actual de lib/catalog/href.ts, no escribas lógica nueva de
querystring.

MÓVIL
Drawer a pantalla completa con botón «Ver N resultados» fijo abajo. El conteo
se actualiza mientras el usuario marca casillas, antes de cerrar el drawer.

ANTES DE CODIFICAR muéstrame los cortes de rango que propones para potencia y
precio, con cuántos productos cae en cada uno.
```

## Verificación

- [ ] Filtrar Subwoofers por `12"` + `2 Ω` devuelve resultados correctos
- [ ] Las facetas cambian al cambiar de categoría
- [ ] Un valor sin resultados aparece deshabilitado, no desaparecido
- [ ] La URL con filtros se abre igual en otra pestaña
- [ ] En móvil, el contador se actualiza sin cerrar el drawer
- [ ] `/catalogo` y `/buscar` solo ofrecen marca y precio

---

# Sesión J · Comparador 🔍

**Ya no depende de la Sesión G.** Antes sí, porque había que normalizar antes de poder alinear filas. Ahora las filas salen alineadas por construcción: los campos obligatorios existen en el 100% de los productos de cada categoría.

Eso simplifica la sesión de forma importante: **desaparecen los huecos.** Dos subwoofers comparados van a tener las cuatro filas obligatorias llenas, siempre.

## Prompt

```
Construye el comparador de especificaciones. La tarjeta de la portada lo
anunciaba y no existía.

POR QUÉ AHORA ES SIMPLE
Los campos obligatorios de cada categoría tienen cobertura del 100%. Dos
productos de la misma categoría comparten por construcción las mismas filas
base. lib/facets/ ya define cuáles son y cómo se muestran.

SELECCIÓN
- Botón «Comparar» en la tarjeta de producto y en la ficha
- Máximo 4 productos. Al intentar un quinto, avisar sin bloquear
- Persistencia en localStorage con el MISMO patrón de lib/cart/:
  schemaVersion, migración o descarte limpio, nunca crashear
- Reconciliación al cargar, igual que el carrito: producto inexistente o
  inactivo sale de la selección
- Barra flotante cuando hay 2 o más, con «Comparar (N)» y opción de vaciar
- El estado del comparador no conoce al carrito ni a WhatsApp

SOLO DENTRO DE LA MISMA CATEGORÍA
Comparar un subwoofer con un cable no significa nada, y las filas no
existirían. Si el usuario agrega de otra categoría, ofrecer reemplazar la
selección o cancelar.

Sistemas queda fuera del comparador, incluso cuando aparece en el listado de
Subwoofers o Bocinas por categoriasSecundarias: no tiene medida, impedancia ni
potencia, así que todas sus filas saldrían en «—». El botón «Comparar» no se
muestra en esas tarjetas.

RUTA /comparar
- Estado en query params: /comparar?skus=SQ12-D2,COR-124D
- Es lo que hace la función compartible por WhatsApp, que es su mayor valor
- Sku inexistente o inactivo: ignorarlo y avisar cuál
- Con menos de 2 válidos, estado que invite a volver al catálogo
- robots: noindex

TABLA
Filas, en este orden:
  1. Nombre, marca, precio, disponibilidad
  2. Los campos OBLIGATORIOS de la categoría (siempre llenos, sin huecos)
  3. Los campos RECOMENDADOS presentes en al menos uno (profundidad,
     sensibilidad, capacidad, voltaje preamp)
  4. Las specs de texto de la ficha cuyo nombre coincida entre los productos

Los grupos 1 y 2 nunca llevan «—». Solo el 3 y el 4 pueden tenerlo.

Usa lib/facets/ para nombres de fila y formato de valor. No escribas una
segunda traducción de coaxial-2v ni de las demás.

Marca visualmente las filas donde los valores DIFIEREN, con peso tipográfico
o fondo del sistema, nunca con un color de acento.

«Agregar al carrito» y «Consultar por WhatsApp» por columna.

NO SE RANQUEA, NO SE RECOMIENDA
El comparador señala diferencias, nunca cuál es mejor. Prohibido marcar un
«ganador», ordenar por «mejor valor» o poner insignias tipo «más potente».
Sonoro presenta datos; el cliente decide.

Un caso concreto: los amplificadores guardan la potencia RMS sin su
impedancia de referencia, pero el texto de la ficha sí la trae
(«125 W × 4 @ 4 Ω · 200 W × 4 @ 2 Ω»). En la fila de potencia muestra el
TEXTO de la ficha, no el número suelto. Dos amplificadores de 600 W medidos a
impedancias distintas no son comparables, y mostrar solo el número lo
ocultaría.

MÓVIL
Una tabla de 4 columnas no cabe en 360px. Scroll horizontal con la columna de
etiquetas fija, o propón algo mejor. Muéstrame el enfoque antes de
implementarlo: es la parte más fácil de arruinar y ahí está la mayoría del
tráfico.

PORTADA
Restaura la tarjeta del comparador como enlace real.

ANALÍTICA
Evento compare_view con los skus comparados. Saber qué productos compara la
gente entre sí, y cuál termina cotizando, es información de venta que no
tienes por ningún otro medio.

Muéstrame el plan antes de codificar.
```

## Verificación

- [ ] Comparar 2 subwoofers: las cuatro filas obligatorias llenas, sin `—`
- [ ] Comparar 2 amplificadores: la potencia muestra el texto con impedancia
- [ ] Intentar agregar de otra categoría ofrece reemplazar
- [ ] La URL de `/comparar` reproduce la comparación en otro navegador
- [ ] Un sku inventado se ignora con aviso
- [ ] En teléfono real, la tabla se recorre sin perder las etiquetas
- [ ] Ningún texto sugiere cuál producto es mejor

---

## Orden y dependencias

```
F2 (facetas)  →  G (filtros)
              →  J (comparador)
```

F2 primero, obligatoriamente. Después G y J en cualquier orden, o en paralelo si trabajas en ramas distintas.

**Lo que ganaste con normalizar el catálogo:** las dos sesiones perdieron su fase de análisis de datos, J perdió su dependencia de G, y el comparador perdió el problema de los huecos. El trabajo que hiciste en la hoja es lo que convirtió estas dos sesiones de riesgosas en mecánicas.
