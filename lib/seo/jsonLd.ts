// Props para <script type="application/ld+json" {...jsonLdScriptProps(data)} />.
// Escapa "<" a su escape unicode: sin esto, un nombre de producto o
// descripción que contuviera literalmente "</script>" cerraría el tag antes
// de tiempo y rompería el resto de la página (dangerouslySetInnerHTML no
// escapa su contenido por diseño).
export function jsonLdScriptProps(data: unknown) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
  } as const;
}
