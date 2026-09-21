/**
 * Límite de frecuencia para /api/quote-log, por IP.
 *
 * Es un cubo de fichas: cada IP arranca con `capacidad` fichas, gasta una
 * por petición y recupera `porMinuto` fichas por minuto. Deja pasar una
 * ráfaga corta —recargar la página y volver a pedir no debería castigarse—
 * pero corta un bucle sostenido.
 *
 * QUÉ ES Y QUÉ NO ES. El endpoint es abierto por necesidad: lo llama el
 * navegador de cualquiera que cierre un pedido, sin sesión ni token. Esto
 * frena el abuso barato —un script en bucle llenando la hoja del negocio y
 * quemando la cuota del Apps Script— y nada más. NO es protección contra un
 * ataque repartido entre muchas IP, y en Vercel hay un matiz que conviene
 * tener presente: el estado vive en la memoria de CADA instancia serverless,
 * así que con varias instancias activas el tope efectivo se multiplica por
 * cuántas haya, y una instancia fría arranca con el cubo lleno. Para un tope
 * de verdad hace falta una regla de Vercel Firewall (Project → Firewall), que
 * corre antes de la función y se configura fuera del repositorio.
 *
 * Lógica pura y con reloj inyectable para poder probarla con node --test,
 * igual que el resto de lib/quoteLog.
 */

/** Fichas con las que arranca cada IP: la ráfaga máxima que se tolera. */
export const CAPACIDAD = 10;

/** Fichas que recupera una IP por minuto. Un pedido real gasta una. */
export const POR_MINUTO = 10;

/**
 * Tope de IP distintas en memoria. Sin esto, un atacante que rote IP hace
 * crecer el Map sin límite hasta tumbar la instancia. Al llegar al tope se
 * vacía entero: perder el estado significa, como mucho, que unas IP vuelven
 * a arrancar con el cubo lleno — mismo efecto que una instancia fría.
 */
export const MAX_CLAVES = 10_000;

export type Limitador = (clave: string) => boolean;

export function crearLimitador(opciones?: {
  capacidad?: number;
  porMinuto?: number;
  maxClaves?: number;
  ahora?: () => number;
}): Limitador {
  const capacidad = opciones?.capacidad ?? CAPACIDAD;
  const porMinuto = opciones?.porMinuto ?? POR_MINUTO;
  const maxClaves = opciones?.maxClaves ?? MAX_CLAVES;
  const ahora = opciones?.ahora ?? Date.now;
  const cubos = new Map<string, { fichas: number; visto: number }>();

  return function permitir(clave: string): boolean {
    const t = ahora();
    const cubo = cubos.get(clave);

    if (!cubo) {
      if (cubos.size >= maxClaves) cubos.clear();
      cubos.set(clave, { fichas: capacidad - 1, visto: t });
      return true;
    }

    const recuperadas = ((t - cubo.visto) / 60_000) * porMinuto;
    cubo.fichas = Math.min(capacidad, cubo.fichas + recuperadas);
    cubo.visto = t;

    if (cubo.fichas < 1) return false;
    cubo.fichas -= 1;
    return true;
  };
}

/**
 * De qué IP viene la petición. En Vercel la real es la primera de
 * `x-forwarded-for` (la cadena es cliente, proxies…); `x-real-ip` es el
 * respaldo. Las dos las pone la plataforma, pero un cliente puede mandarlas
 * igual, así que esto vale para contar peticiones, NUNCA para decidir
 * permisos: quien falsifique la cabecera se salta su propio cubo, que es
 * exactamente el mismo esfuerzo que cambiar de IP.
 *
 * Sin ninguna de las dos —correr local, por ejemplo— todas las peticiones
 * caen en el mismo cubo "desconocida".
 */
export function ipDePeticion(headers: Headers): string {
  const reenviada = headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return headers.get("x-real-ip")?.trim() || "desconocida";
}
