// Un valor que se puede descartar y volver a crear. Sirve para `React.lazy`:
// lazy guarda la promesa que falló, así que reintentar un import() rechazado
// (sin red al primer clic, un chunk viejo tras un deploy) exige un lazy NUEVO.
//
// Se descarta A MANO (`descartar`), nunca en el momento del rechazo: mientras
// el error viaja hacia el límite de error, el lazy fallido tiene que seguir
// siendo el vigente. Si se reemplazara al rechazarse, React volvería a dibujar,
// leería el lazy nuevo y arrancaría otro import() en lugar de lanzar el error:
// sin red, eso se repite sin fin. Quien atrapa el error llama `descartar()`, y
// la PRÓXIMA lectura crea otra instancia.

export function crearReintentable<T>(fabrica: () => T): { actual(): T; descartar(): void } {
  let instancia: { valor: T } | null = null;

  return {
    actual() {
      instancia ??= { valor: fabrica() };
      return instancia.valor;
    },
    descartar() {
      instancia = null;
    },
  };
}
