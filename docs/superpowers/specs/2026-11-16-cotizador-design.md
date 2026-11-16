# Cotizador privado — diseño

Fecha: 16 de noviembre de 2026. Estado: pendiente de aprobación.

## Intención

Byron necesita armar cotizaciones para clientes con productos del catálogo, y
entregarlas como **un mensaje de texto que pega en otro medio** (WhatsApp, correo,
lo que sea). Nadie más debe poder abrir la herramienta. Es de uso interno: el
cliente nunca la ve.

## Metas

- Una ruta privada, `/cotizador`, que solo abre quien tiene la contraseña.
- Buscar productos con el mismo motor de `/buscar`, agregarlos, cambiar
  cantidades, quitarlos.
- Un mensaje listo para copiar, con el formato de precios del resto del sitio.
- El borrador sobrevive a una recarga.

## No metas

- PDF, enlace compartible, historial de cotizaciones, registro en la hoja.
- Descuentos, líneas de precio libre, precios editables.
- Instalación con precio: sigue en «Decisiones abiertas» y no se inventa.
- Varios usuarios, roles o cuentas.
- Tocar el carrito, el nav, el chat, el sitemap o `llms.txt`.

## Anti-metas (fallaría aunque «funcione»)

- Que la página o el catálogo de la herramienta se sirvan a alguien sin sesión.
- Que, sin la variable de entorno, la ruta quede abierta (debe cerrarse sola).
- Que aparezca en buscadores o en cualquier enlace público.

## Enfoques considerados

- **A. Ruta privada en este sitio, contraseña en variable de entorno y cookie
  firmada (elegido por Byron).** Poco código, sin dependencias ni base de
  datos. Su límite: la seguridad es una sola contraseña, que debe ser larga.
- **B. Inicio de sesión de Google limitado a un correo.** Más seguro, pero
  trae una librería de autenticación y configurar OAuth; excesivo para un
  usuario.
- **C. Pestaña en el Google Sheets del catálogo.** Sin código, pero sin
  buscador, con precios copiados que se desfasan.

## Diseño

### Acceso (decisiones mías, a corregir)

- Variable de servidor `COTIZADOR_PASSWORD`. **Sin definir, `/cotizador`
  responde 404**: nunca queda abierta por olvido. Se documenta en
  `.env.example` y hay que cargarla en Vercel.
- Entrar: un formulario (server action) compara la contraseña en tiempo
  constante. Si coincide, pone la cookie `cotizador`.
- La cookie vale `<expira>.<HMAC-SHA256>`, firmada con la propia contraseña:
  cambiar la contraseña cierra todas las sesiones. `httpOnly`, `secure` en
  producción, `sameSite: strict`, `path: /cotizador`, 7 días.
- **La verificación vive en un solo lugar**, `sesionValida()` en
  `lib/cotizador/sesion.ts`, y la llaman la página y la acción de salir. No se
  agrega al `proxy.ts`: ahí solo se resuelven códigos de estado, y la página
  tiene que comprobar la sesión por sí misma de todos modos.
- Los intentos fallidos llevan una espera corta. Un limitador en memoria en
  Vercel no es confiable entre instancias: la defensa real es el largo de la
  contraseña, y el diseño no finge otra cosa.
- «Salir» borra la cookie.

### Página

- `app/cotizador/page.tsx`: dinámica (lee la cookie). `metadata` con `noindex`,
  y `/cotizador` se agrega al `disallow` de `robots.ts`. Sin enlace en ningún
  lado; Byron la abre desde un marcador.
- Sin sesión: solo el formulario de contraseña. **El catálogo no se consulta
  ni se manda** hasta que la sesión es válida.
- Con sesión: `listAllProducts({ activo: true })` → `tarjetasBuscables()` →
  componente cliente `Cotizador`. Los mismos datos que ya llegan a `/buscar`.

### Herramienta (cliente)

- Buscador con `buscar()` y `compararRelevancia` como desempate, los de
  `/buscar`. Muestra los primeros resultados con botón «Agregar».
- Reglas del carrito que se conservan: **lo agotado no se agrega**; lo bajo
  pedido sí y sale con `· bajo pedido`; máximo 99 por línea
  (`MAX_CANTIDAD_POR_LINEA`).
- Estado propio, sin tocar el del carrito. Se guarda en `localStorage`
  (`sonoro:cotizador`) solo `{ sku, qty }` por línea y el nombre del cliente:
  precio y disponibilidad se leen del catálogo en cada render, así que el
  borrador nunca arrastra un precio viejo. Una línea cuyo sku ya no está a la
  venta se quita con un aviso, como en `/carrito`.
- Campo opcional «Cliente».
- Botón «Copiar» (`navigator.clipboard`, con alternativa si falla) y el
  mensaje visible en un cuadro de solo lectura. Botón «Vaciar».

### Mensaje

Función pura `buildQuoteMessage` en `lib/cotizador/mensaje.ts`. Reutiliza
`subtotalCents`, `envioGratis`, `ENVIO_POR_COBRAR`, `marcaDisponibilidad` y
`formatQ`.

**Cada línea lleva lo que pidió Byron: cantidad, nombre, precio unitario y
precio total de la línea.** Una línea propia, distinta de `formatearLinea`
(la del pedido de WhatsApp, que muestra el sku entre paréntesis y el unitario
solo si hay más de una unidad):

```
Cotización Sonoro para Juan Pérez:

1x Subwoofer Champion Series 12" TS-W312D4 — Q 885.00 c/u — Q 885.00
2x Memphis PRX 6.5" PRX60C — Q 1,180.00 c/u — Q 2,360.00

Subtotal: Q 3,245.00
Envío: gratis
Total: Q 3,245.00
Precios con IVA incluido.
```

- El nombre es el `nombre` del catálogo tal cual. En 308 de 327 productos ya
  trae el código del fabricante, así que **no se repite entre paréntesis**.
  **Decisión mía:** en los 19 cuyo nombre no lo trae, el código se agrega al
  final del nombre, para que el cliente no se quede sin él.
- «c/u» va siempre, también con una sola unidad, para que unitario y total
  nunca se confundan. El total de la línea es cantidad × unitario en centavos
  enteros: sin redondeo.
- Lo bajo pedido lleva al final ` · bajo pedido`, como en el carrito.

Sin cliente, el encabezado es «Cotización Sonoro:». No lleva `Ref` ni se
registra en la hoja: no es un pedido. **Decisión mía:** no lleva cuota de
financiamiento, ni vigencia, ni nada de instalación; ninguna está definida
por el negocio.

## Pruebas

- Unitarias de `sesion.ts`: firma válida, firma alterada, expirada, sin
  variable de entorno.
- Unitarias de `mensaje.ts`: con y sin cliente, envío en el umbral exacto
  (Q 500.00 paga), línea bajo pedido, cantidades y precios con coma de miles,
  total de línea = cantidad × unitario, y el código que se agrega solo cuando
  el nombre no lo trae.
- Unitarias del reductor del borrador: tope de 99, quitar, sku desaparecido.
- e2e: sin cookie no hay catálogo en el HTML; contraseña incorrecta no entra;
  la correcta sí y se puede copiar.

## Documentación

Al implementar, `CLAUDE.md` suma `/cotizador` a § Rutas (privada, `noindex`,
no se enlaza ni va en el sitemap) y `.env.example` suma `COTIZADOR_PASSWORD`.

## Para el constructor

El nombre de los archivos, el estilo del formulario y del cuadro del mensaje
se resuelven con los tokens y componentes existentes (`components/ui/`), sin
color nuevo ni elementos inventados.
