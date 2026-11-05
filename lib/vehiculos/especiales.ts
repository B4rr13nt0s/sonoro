// Las dos pantallas de 9" que la guía de marcos no cubre por formato.
//
// El selector las reconoce por su CÓDIGO y no por el formato del catálogo,
// así funciona igual antes y después de que el negocio cambie su formato a
// `especifico` en el libro:
//   - DMH-ZS9350BT cabe donde la guía da una solución de 1 DIN o de 2 DIN;
//   - DMH-AP6650BT sale en todos los vehículos, con «Consultar»: necesita un
//     marco que depende del año, marca y modelo.
// especiales.test.ts comprueba contra el catálogo real que las dos existen.
export type ReglaEspecial = "1-o-2-din" | "consultar";

export const PANTALLAS_ESPECIALES: Readonly<Record<string, ReglaEspecial>> = {
  "DMH-ZS9350BT": "1-o-2-din",
  "DMH-AP6650BT": "consultar",
};
