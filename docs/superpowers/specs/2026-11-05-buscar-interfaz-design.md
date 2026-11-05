# /buscar: pestañas, barra de filtros y móvil — diseño

Fecha: 5 de noviembre de 2026 · Estado: aprobado en conversación, pendiente de
revisión escrita. Los bocetos con que se eligió viven en `.superpowers/brainstorm/`
(no versionado).

La página de búsqueda se ordena en dos pestañas —«Por producto» y «Por
vehículo»—, los filtros pasan a una sola barra en escritorio y a una rejilla de
dos columnas en el teléfono, y la página sin nada escrito deja de ser un campo
perdido en blanco.

---

## Por qué

Tres problemas, vistos en `/buscar` a 1280 y 375 px el 5 de noviembre:

- **Móvil:** con una búsqueda, las píldoras de tipo de producto y cuatro listas
  apiladas (cada una de un ancho distinto) ocupan toda la primera pantalla. Los
  resultados empiezan abajo del pliegue.
- **Escritorio:** el encabezado, las píldoras y las listas van en tres filas
  sueltas. El handoff (`design/buscar.html`) los dibujó en una: conteo a la
  izquierda, píldoras y orden a la derecha. Desde entonces se sumaron marca,
  disponibilidad, categoría, medida y canales, que no tienen lugar en ese
  dibujo.
- **Sin nada escrito:** el campo, «Escribe para buscar en el catálogo.» y el
  selector de vehículos chico, con el resto de la página en blanco.

La línea «También buscan» del handoff no se implementa: es «lo más buscado»,
que la regla 2 prohíbe.

## Qué no cambia

- El motor de búsqueda (`lib/busqueda/`), lo que entiende y cómo ordena.
- Las sugerencias mientras se teclea (`SugerenciasBusqueda.tsx`).
- La página sin resultados (`SinResultadosBusqueda.tsx`).
- La tarjeta de producto, la rejilla (`ProductGrid`) y «Ver N resultados más».
- Los resultados del selector de vehículos (`ResultadosVehiculo.tsx`) y sus
  reglas.
- Los parámetros de la dirección que ya existen y lo que significan.
- `/buscar` sigue prerenderizada, con un `<Suspense>` alrededor de lo que lee la
  dirección; el canonical sigue siendo `/buscar` sin parámetros.

---

## Decisiones

| # | Decisión |
|---|---|
| 1 | Arriba de todo, dos pestañas: **«Por producto»** (por defecto) y **«Por vehículo»**. Cada una muestra lo suyo en el mismo lugar. |
| 2 | La pestaña sale de la dirección: con `vehiculo` o con `por=vehiculo`, «Por vehículo»; en cualquier otro caso, «Por producto» (`modelo`, `anio` o `version` sin `vehiculo` no forman un vehículo, como hoy en `leerSeleccion`). Si la dirección trae `q` y un vehículo a la vez (un enlace armado a mano), gana `q`: es lo mismo que hoy, cuando escribir una búsqueda borra el vehículo. |
| 3 | `por` solo acepta `vehiculo`; cualquier otro valor se ignora. Con un vehículo elegido no se escribe `por`: `vehiculo` ya dice la pestaña. |
| 4 | Cambiar de pestaña reemplaza la dirección (`replaceState`, como toda la búsqueda): a «Por producto», `/buscar`; a «Por vehículo», `/buscar?por=vehiculo`. Lo de la otra pestaña se pierde. |
| 5 | Se quitan «Escribe para buscar en el catálogo.» (el campo ya lo dice) y el título «Receptores y bocinas por vehículo» (la pestaña lo nombra). No se agrega texto nuevo. |
| 6 | «Buscar» del menú y la lupa del header siguen yendo a `/buscar`: «Por producto», con el campo. La búsqueda sigue a un toque. |
| 7 | `/buscar/vehiculos.json` se baja solo con «Por vehículo» a la vista, como hoy con el selector. |
| 8 | Desde 640 px (`sm`), los filtros van en **una barra** entre dos líneas finas: píldoras de tipo de producto con su conteo; un separador; las listas Marca, Medida o Canales (solo cuando los resultados traen más de un valor, como hoy), Disponibilidad y Categoría (el uso: carro, marino, motorsports); y Ordenar al extremo derecho. Si no cabe en una línea, se parte en las que haga falta y Ordenar queda a la derecha: las listas nativas miden su opción más larga, y con cuatro listas son dos líneas a 1280 px y tres a 768 (medido al implementar). |
| 9 | Las listas siguen siendo `<select>` nativos, con forma de píldora y el valor elegido adentro («Marca: Memphis»). No hay menús propios: teclado, lector de pantalla y selector del teléfono funcionan como hoy. |
| 10 | Desde 640 px, con algún filtro puesto, debajo de la barra va una píldora por filtro con ✕ («Memphis ✕», «Disponible ✕», «Marino ✕», «12" ✕», «4 canales ✕») y «Quitar filtros». La de tipo de producto no se repite (ya se ve en negro) y el orden tampoco (no filtra). |
| 11 | Lo que salió de lo escrito («Filtros de tu búsqueda: más de 500 W», o la categoría fija porque la consulta dice «marino») no lleva ✕: se quita borrándolo del texto, como hoy. |
| 12 | Debajo de 640 px, las píldoras de tipo de producto van en una línea que se desliza con el dedo, sin barra visible; la línea llega hasta el borde de la pantalla y la última píldora queda cortada (sin degradado: CLAUDE.md los prohíbe, y manda sobre el boceto); debajo, las listas en una rejilla de dos columnas del mismo ancho (Marca, Disponibilidad, Categoría, Ordenar, y Medida o Canales cuando aplican). Sin píldoras con ✕: el valor elegido ya se lee en cada lista. Con algún filtro puesto, «Quitar filtros» debajo de la rejilla. |
| 13 | «Quitar filtros» —el de la barra, el de móvil y el botón que ya existe cuando ningún resultado pasa los filtros— vuelve tipo de producto, marca, medida, canales, disponibilidad y categoría a «todos»; conserva lo escrito y el orden. |
| 14 | En «Por vehículo», Marca, Modelo, Año y Versión siguen como hoy: en fila desde 640 px, apiladas debajo. |
| 15 | Sin resultados, no se dibuja la barra: no hay nada que filtrar. |

### Pestañas

Se dibujan como una fila de dos textos de 15 px con una línea de 2 px en negro
bajo la activa; la inactiva en texto secundario. Tokens del sistema visual: sin
color nuevo.

Son pestañas de verdad para el lector de pantalla: `role="tablist"`, cada una
`role="tab"` con `aria-selected` y `aria-controls`, y su panel
`role="tabpanel"`. Una sola está en el orden de tabulación; ← y → pasan a la
otra, Inicio y Fin van a la primera y a la última. Se activan al llegar (las dos
muestran su contenido sin esperar: «Por vehículo» muestra sus listas
deshabilitadas mientras baja los datos, como hoy).

### Las etiquetas del lector de pantalla no cambian

`e2e/flujo-critico.spec.ts` y `e2e/vehiculos.spec.ts` buscan «Buscar en el
catálogo», las píldoras como botones («Todo», «Subwoofers»…) y las listas por su
`aria-label` («Filtrar por marca», «Marca», «Año»…). Se conservan.

---

## Estados

**«Por producto»**

- Sin nada escrito: las pestañas y el campo. Al escribir, las sugerencias.
- Con resultados: encabezado («25 resultados», «para «…»», los avisos de hoy),
  la barra y la rejilla.
- Sin resultados: la tarjeta de hoy, sin barra.
- Ningún resultado con los filtros puestos: «Ningún resultado con estos
  filtros.» y «Quitar filtros».

**«Por vehículo»**

- Sin nada elegido: las listas y «¿No está tu vehículo? Escríbenos por
  WhatsApp.».
- Cargando: listas deshabilitadas. Si falla: «No se pudo cargar la lista de
  vehículos.» y «Reintentar».
- Con un vehículo: los resultados de hoy (receptores, bocinas por ubicación,
  anotaciones, frase de instalación).

---

## Código

La lógica nueva va en funciones puras con test, como el resto de `/buscar`:

- `lib/busqueda/pestana.ts`: `type Pestana = "producto" | "vehiculo"`,
  `leerPestana(busqueda: string): Pestana` (decisiones 2 y 3) y
  `hrefPestana(pestana: Pestana): string` (decisión 4).
- `lib/busqueda/filtros-activos.ts`: de los filtros vigentes y sus opciones, la
  lista de píldoras con ✕ (`{ campo, etiqueta }[]`, decisiones 10 y 11) y los
  cambios de «Quitar filtros» (decisión 13).

Componentes:

- `components/catalog/PestanasBuscar.tsx`: las pestañas y sus paneles.
- `components/catalog/BarraFiltros.tsx`: la barra de escritorio y la rejilla de
  móvil, sacadas de `SearchExperience.tsx` (769 líneas hoy). `SearchExperience`
  sigue siendo dueña del estado en la dirección; la barra recibe valores y
  devuelve cambios.
- `BusquedaPorVehiculo.tsx` pierde su título y pasa a ser el panel de «Por
  vehículo».

---

## Pruebas

- **Unitarias:** `leerPestana` y `hrefPestana` con cada combinación de
  parámetros (`por=vehiculo`, `vehiculo=…`, `q=…`, los dos a la vez, `por=otro`);
  las píldoras activas y lo que deja «Quitar filtros», incluida la categoría que
  vino de lo escrito.
- **De punta a punta:** se ajustan las de `e2e/vehiculos.spec.ts` a la pestaña;
  se agregan: cambiar de pestaña limpia la dirección; ← y → mueven entre
  pestañas; una ✕ quita su filtro y la dirección pierde ese parámetro; a 375 px
  la página no tiene desplazamiento horizontal con una búsqueda que muestra las
  seis listas.
- **En el navegador:** capturas de las dos pestañas a 1280, 1024, 768 y 375 px.
- **Lighthouse:** el CI mide `/buscar` (`lighthouserc.js`) y exige rendimiento ≥ 90
  y accesibilidad ≥ 95: el cambio no puede bajarlos.

## Documentación

- CLAUDE.md, § Patrones: la búsqueda vive en dos pestañas; el selector de
  vehículos está en «Por vehículo» y no en la página vacía; el parámetro `por`.
- CLAUDE.md, § Selector de vehículos, y la spec del selector
  (`2026-11-04-selector-vehiculos-design.md`): dónde vive ahora.

## Fuera de alcance

- Elegir varias marcas a la vez y la columna de filtros a la izquierda (opción
  descartada en los bocetos).
- «También buscan» y cualquier «lo más buscado» (regla 2).
- Foco automático en el campo al abrir la página (abriría el teclado del
  teléfono sin pedirlo).
- Textos de ayuda nuevos.
