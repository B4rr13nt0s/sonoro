// Alertas de integridad entre el catálogo publicado y el que se está
// importando. Ninguna aborta: van a la consola y a reports/import-errors.md
// (CLAUDE.md § Fuente de verdad: «Alerta si un slug ya publicado cambió»).
//
// Lógica pura, fuera de scripts/import-catalog.ts para poder probarla: ese
// archivo corre main() al importarse.

import type { Retirado } from "../../lib/catalog/retirados.ts";

/** Lo que las alertas miran de cada producto. `Producto` lo cumple. */
export type ProductoAlertable = { sku: string; slug: string; nombre: string };

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

// "0450" → "450": quita ceros a la izquierda de cada grupo numérico que
// arranca al inicio del sku o justo después de un separador.
export function sinCerosIniciales(sku: string): string {
  return sku.replace(/(^|[ .-])0+(?=\d)/g, "$1");
}

/**
 * @param skusRechazados filas que siguen en el libro pero no pasaron la
 *   validación: no desaparecieron, y ya bloquean el build por su cuenta.
 */
export function detectarAlertas(
  anteriores: readonly ProductoAlertable[],
  nuevos: readonly ProductoAlertable[],
  skusRechazados: ReadonlySet<string> = new Set(),
): string[] {
  const alertas: string[] = [];

  const porSlugAnterior = new Map(anteriores.map((p) => [p.slug, p]));
  const porNombreAnterior = new Map(anteriores.map((p) => [normalizarNombre(p.nombre), p]));
  const porSkuAnterior = new Map(anteriores.map((p) => [p.sku, p]));

  for (const nuevo of nuevos) {
    // Ceros iniciales perdidos: match por slug O por nombre normalizado —
    // si solo se empareja por slug, un producto donde slug y sku cambiaron
    // a la vez nunca se detecta.
    const viejo =
      porSlugAnterior.get(nuevo.slug) ?? porNombreAnterior.get(normalizarNombre(nuevo.nombre));
    if (viejo && viejo.sku !== nuevo.sku && sinCerosIniciales(viejo.sku) === nuevo.sku) {
      alertas.push(
        `sku perdió ceros iniciales: "${viejo.sku}" → "${nuevo.sku}" (producto "${nuevo.nombre}")`,
      );
    }

    // Slug cambiado: match por sku estable.
    const viejoPorSku = porSkuAnterior.get(nuevo.sku);
    if (viejoPorSku && viejoPorSku.slug !== nuevo.slug) {
      alertas.push(`slug cambió para sku "${nuevo.sku}": "${viejoPorSku.slug}" → "${nuevo.slug}"`);
    }
  }

  // Filas publicadas que ya no están en el libro. CLAUDE.md § Mantenimiento
  // del catálogo: un producto se retira con activo = FALSO, NUNCA borrando la
  // fila. Borrada, su ficha responde 404 en vez de 410, los carritos
  // guardados la pierden sin explicación y un pedido ya enviado cita un
  // código que el catálogo no conoce. Hasta septiembre de 2026 esto pasaba
  // sin ningún aviso.
  const skusNuevos = new Set(nuevos.map((p) => p.sku));
  const porSlugNuevo = new Map(nuevos.map((p) => [p.slug, p]));
  for (const viejo of anteriores) {
    if (skusNuevos.has(viejo.sku) || skusRechazados.has(viejo.sku)) continue;
    // Ya alertado arriba como ceros perdidos.
    if (skusNuevos.has(sinCerosIniciales(viejo.sku))) continue;

    const mismoSlug = porSlugNuevo.get(viejo.slug);
    if (mismoSlug) {
      alertas.push(
        `sku cambió en "${viejo.slug}": "${viejo.sku}" → "${mismoSlug.sku}". El sku es permanente: ` +
          "si el producto es otro, va en una fila nueva y la vieja queda con activo = FALSO",
      );
      continue;
    }
    alertas.push(
      `sku "${viejo.sku}" ("${viejo.nombre}") ya no está en el libro. Una fila publicada no se ` +
        "borra: se devuelve al libro con activo = FALSO, o su ficha deja de responder 410",
    );
  }

  return alertas;
}

// Registro de skus publicados (data/skus-publicados.json): una lista que solo
// crece. `detectarAlertas` compara contra data/catalog.json, y ese archivo se
// regenera en cada importación: quien borra una fila e importa deja la alerta
// una sola vez, en su consola, y la corrida siguiente ya no recuerda el sku.
// El registro sí lo recuerda, está en Git, y borrar una fila publicada ABORTA
// la importación en vez de avisar.

/**
 * Skus del registro que ya no están en el libro (ni siquiera como fila
 * rechazada). Los retirados a propósito (data/retirados.json) no cuentan.
 */
export function skusPublicadosAusentes(
  registro: readonly string[],
  skusDelLibro: ReadonlySet<string>,
  retirados: readonly Retirado[] = [],
): string[] {
  const retiradosSku = new Set(retirados.map((r) => r.sku));
  return registro.filter((sku) => !skusDelLibro.has(sku) && !retiradosSku.has(sku));
}

// Un producto que Sonoro dejó de manejar y cuya fila ya no está en el libro.
// Su URL responde 410 (proxy.ts), igual que la de una fila con activo = FALSO,
// pero sin necesitar la fila. Es el camino para lo que ya se borró; lo normal
// sigue siendo activo = FALSO (CLAUDE.md § Mantenimiento del catálogo).
export type { Retirado };

/**
 * Un retirado que reaparece en el libro: su URL daría 410 con el producto a
 * la venta. Si volvió, se quita de data/retirados.json.
 */
export function retiradosEnElLibro(
  retirados: readonly Retirado[],
  skusDelLibro: ReadonlySet<string>,
  slugsDelLibro: ReadonlySet<string>,
): string[] {
  const conflictos: string[] = [];
  for (const r of retirados) {
    if (skusDelLibro.has(r.sku) || slugsDelLibro.has(r.slug)) {
      conflictos.push(
        `sku "${r.sku}" (slug "${r.slug}") está en data/retirados.json pero volvió al libro: ` +
          "su ficha respondería 410 con el producto a la venta. Quítalo de retirados.json",
      );
    }
  }
  return conflictos;
}

/** Registro ordenado por puntos de código y sin repetidos: el diff de Git solo muestra altas. */
export function ampliarRegistro(registro: readonly string[], nuevos: readonly string[]): string[] {
  return [...new Set([...registro, ...nuevos])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
