// El slug de una marca, un modelo o una versión: minúsculas, sin acentos y
// con guiones. Lo usan los dos importadores (catálogo y vehículos), así una
// marca da el mismo slug en los dos.
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
