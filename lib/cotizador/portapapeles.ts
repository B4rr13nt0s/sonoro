// Cotizador privado: copiar el mensaje al portapapeles diciendo la verdad.
// Devuelve `true` solo si algo se copió de verdad. Si las dos vías fallan
// (sin permiso del navegador y sin que `execCommand` acepte), devuelve `false`
// para que la pantalla NO diga «Copiado»: Byron pegaría lo que hubiera en el
// portapapeles de antes —quizá la cotización de otro cliente— creyendo que es
// la nueva.

export type MediosCopia = {
  /** `navigator.clipboard.writeText`, o `undefined` si el navegador no lo tiene. */
  escribir: ((texto: string) => Promise<void>) | undefined;
  /** La vía vieja: selecciona el cuadro y devuelve lo que contestó `execCommand("copy")`. */
  copiarSeleccion: () => boolean;
};

export async function copiarTexto(texto: string, medios: MediosCopia): Promise<boolean> {
  if (medios.escribir) {
    try {
      await medios.escribir(texto);
      return true;
    } catch {
      // Sin permiso del portapapeles: se prueba la vía vieja.
    }
  }
  try {
    return medios.copiarSeleccion();
  } catch {
    return false;
  }
}
