// Alertas de integridad entre el catálogo publicado y el que se está
// importando. Ninguna aborta: van a la consola y a reports/import-errors.md
// (CLAUDE.md § Fuente de verdad: «Alerta si un slug ya publicado cambió»).
//
// Lógica pura, fuera de scripts/import-catalog.ts para poder probarla: ese
// archivo corre main() al importarse.

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
