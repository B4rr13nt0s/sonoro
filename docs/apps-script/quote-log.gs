/**
 * Registro de cotizaciones — script de Google Apps Script.
 *
 * Recibe lo que manda app/api/quote-log/route.ts y escribe una fila por línea
 * del pedido. Este archivo NO se ejecuta desde el repositorio: vive acá para
 * que quede versionado y revisable, pero corre pegado en el editor de Apps
 * Script del documento de Google.
 *
 * Lo que llega (ya validado y acotado del lado del sitio, lib/quoteLog/):
 *
 *   { token, ref, items: [{ sku, nombre, qty, unitPriceCents }],
 *     subtotalCents, userAgent }
 *
 * TRES COSAS QUE ESTE SCRIPT TIENE QUE HACER, y por qué:
 *
 * 1. ESCRIBIR TEXTO, NUNCA FÓRMULA. `nombre`, `sku` y `userAgent` los controla
 *    quien manda la petición. En una hoja de cálculo, un valor que empieza con
 *    `=`, `+`, `-` o `@` no es texto: se ejecuta. Un `=IMPORTXML(...)` en una
 *    celda convierte la hoja en un canal para sacar datos hacia afuera. Por eso
 *    las columnas de texto se formatean como texto ANTES de escribir y además
 *    se les antepone un apóstrofo cuando empiezan con uno de esos caracteres.
 *
 * 2. VERIFICAR EL TOKEN antes de escribir nada. La URL del script es pública
 *    —tiene que serlo para que el sitio pueda llamarla— así que el token es lo
 *    único que distingue una cotización real de cualquiera que descubra la URL.
 *
 * 3. DESCARTAR REPETIDOS por `ref`. El reenvío puede llegar dos veces si la
 *    red reintenta, y un pedido contado dos veces ensucia justo los números
 *    por los que existe este registro.
 *
 * INSTALACIÓN (una sola vez)
 *
 *   1. Extensiones → Apps Script en la hoja de cálculo.
 *   2. Pegar este archivo completo, reemplazando lo que haya.
 *   3. Configuración del proyecto → Propiedades del script → agregar
 *      QUOTE_LOG_TOKEN con el MISMO valor que está en Vercel.
 *   4. Implementar → Nueva implementación → Aplicación web:
 *        Ejecutar como: Yo
 *        Quién tiene acceso: Cualquier usuario
 *      Copiar la URL que termina en /exec → esa es QUOTE_LOG_URL en Vercel.
 *   5. Cada vez que se edite este script hay que volver a implementar
 *      (Implementar → Administrar implementaciones → editar → Versión nueva),
 *      o el sitio seguirá hablando con la versión vieja.
 */

/** Nombre de la pestaña donde se escribe. Se crea sola si no existe. */
const HOJA = "Cotizaciones";

const ENCABEZADOS = [
  "Fecha",
  "Ref",
  "SKU",
  "Producto",
  "Cantidad",
  "Precio unitario",
  "Total línea",
  "Total pedido",
  "Navegador",
];

/** Columnas (1-based) que llevan texto controlado por el cliente. */
const COLUMNAS_DE_TEXTO = [2, 3, 4, 9];

function doPost(peticion) {
  // Una cotización a la vez: dos que lleguen juntas podrían leer la misma
  // última fila y pisarse, o colar dos veces el mismo `ref`.
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(20000);
  } catch (error) {
    return responder({ ok: false, motivo: "ocupado" });
  }

  try {
    const cuerpo = leerCuerpo(peticion);
    if (!cuerpo) return responder({ ok: false, motivo: "cuerpo" });

    const esperado = PropertiesService.getScriptProperties().getProperty("QUOTE_LOG_TOKEN");
    // Sin detalle en la respuesta: a quien no tiene el token no se le explica
    // qué le falta.
    if (!esperado || cuerpo.token !== esperado) return responder({ ok: false });

    const ref = String(cuerpo.ref || "").trim();
    const items = Array.isArray(cuerpo.items) ? cuerpo.items : [];
    if (!ref || items.length === 0) return responder({ ok: false, motivo: "vacío" });

    const hoja = hojaDeCotizaciones();
    if (yaRegistrado(hoja, ref)) return responder({ ok: true, repetido: true });

    escribir(hoja, ref, items, cuerpo);
    return responder({ ok: true, filas: items.length });
  } catch (error) {
    // El sitio ignora el cuerpo de la respuesta y nunca se lo muestra a nadie;
    // esto queda en el registro de ejecuciones de Apps Script.
    console.error("quote-log: " + error);
    return responder({ ok: false, motivo: "error" });
  } finally {
    candado.releaseLock();
  }
}

/** GET no hace nada: la URL solo existe para recibir cotizaciones. */
function doGet() {
  return responder({ ok: false, motivo: "método" });
}

function leerCuerpo(peticion) {
  if (!peticion || !peticion.postData || !peticion.postData.contents) return null;
  try {
    const cuerpo = JSON.parse(peticion.postData.contents);
    return cuerpo && typeof cuerpo === "object" ? cuerpo : null;
  } catch (error) {
    return null;
  }
}

function hojaDeCotizaciones() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.appendRow(ENCABEZADOS);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

/** ¿Ya entró este pedido? Se compara contra la columna Ref. */
function yaRegistrado(hoja, ref) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return false;
  const refs = hoja.getRange(2, 2, ultima - 1, 1).getValues();
  for (let i = 0; i < refs.length; i++) {
    if (String(refs[i][0]).trim() === ref) return true;
  }
  return false;
}

function escribir(hoja, ref, items, cuerpo) {
  const ahora = new Date();
  const totalPedido = centavosAQuetzales(cuerpo.subtotalCents);
  const navegador = texto(cuerpo.userAgent);

  const filas = items.map(function (item) {
    const cantidad = Number(item.qty) || 0;
    const unitario = centavosAQuetzales(item.unitPriceCents);
    return [
      ahora,
      texto(ref),
      texto(item.sku),
      texto(item.nombre),
      cantidad,
      unitario,
      cantidad * unitario,
      totalPedido,
      navegador,
    ];
  });

  const primera = hoja.getLastRow() + 1;
  const rango = hoja.getRange(primera, 1, filas.length, ENCABEZADOS.length);

  // EL ORDEN IMPORTA: el formato de texto va ANTES de escribir. Puesto
  // después, la hoja ya habría interpretado un `=` como fórmula.
  COLUMNAS_DE_TEXTO.forEach(function (columna) {
    hoja.getRange(primera, columna, filas.length, 1).setNumberFormat("@");
  });
  hoja.getRange(primera, 1, filas.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  [6, 7, 8].forEach(function (columna) {
    hoja.getRange(primera, columna, filas.length, 1).setNumberFormat('"Q" #,##0.00');
  });

  rango.setValues(filas);
}

/**
 * Deja el valor como texto plano. El apóstrofo delante no se ve en la celda:
 * le dice a la hoja «esto es texto», y es el segundo cerrojo por si alguien
 * cambia el formato de la columna más adelante.
 */
function texto(valor) {
  const limpio = String(valor == null ? "" : valor);
  return /^[=+\-@\t\r]/.test(limpio) ? "'" + limpio : limpio;
}

/** El sitio manda centavos enteros (CLAUDE.md § Formato de precio). */
function centavosAQuetzales(centavos) {
  const numero = Number(centavos);
  return Number.isFinite(numero) ? numero / 100 : 0;
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
