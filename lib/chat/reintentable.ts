// Un valor que se puede descartar y volver a crear. Sirve para `React.lazy`:
// lazy guarda la promesa que falló, así que reintentar un import() rechazado
// (sin red al primer clic, un chunk viejo tras un deploy) exige un lazy NUEVO.
// La fábrica recibe `alFallar`; al llamarlo, la próxima lectura crea otra
// instancia. Un fallo de una instancia ya reemplazada se ignora.

export function crearReintentable<T>(fabrica: (alFallar: () => void) => T): { actual(): T } {
  let instancia: { valor: T } | null = null;

  function crear(): { valor: T } {
    const nueva: { valor: T } = {
      valor: fabrica(() => {
        if (instancia === nueva) instancia = null;
      }),
    };
    return nueva;
  }

  return {
    actual() {
      instancia ??= crear();
      return instancia.valor;
    },
  };
}
