// Dos grafías de la misma marca en el libro —«Kicker» y «KICKER», o
// «Cerwin Vega» y «Cerwin-Vega»— dan dos marcas en brands.json con el MISMO
// slug. /marcas/kicker mostraba solo los productos de una de las dos
// grafías, los conteos del proxy se quedaban con la última, y
// generateStaticParams emitía el slug dos veces, sin que nada avisara.
// Es un error del libro, no de una fila: el importador aborta sin escribir.
export function colisionesDeSlug(marcas: readonly { nombre: string; slug: string }[]): string[] {
  const porSlug = new Map<string, string[]>();
  for (const marca of marcas) {
    porSlug.set(marca.slug, [...(porSlug.get(marca.slug) ?? []), marca.nombre]);
  }
  return [...porSlug.entries()]
    .filter(([, nombres]) => nombres.length > 1)
    .map(
      ([slug, nombres]) =>
        `Las marcas ${nombres.map((n) => `«${n}»`).join(" y ")} dan el mismo slug "${slug}": ` +
        `unificá la grafía en el libro.`,
    );
}
