import test from "node:test";
import assert from "node:assert/strict";

import { COLUMNAS_VEHICULOS, validarLibroVehiculos } from "./contrato.ts";
import { FILA_VALIDA, filaVehiculo, libroVehiculos } from "./libro-de-prueba.ts";

test("libro válido: sin ofensores, filas numeradas como en la hoja", () => {
  const { ofensores, filas } = validarLibroVehiculos(libroVehiculos());
  assert.deepEqual(ofensores, []);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].numero, 2);
  assert.equal(filas[0].celdas.marca, "Toyota");
});

test("falta o sobra una hoja", () => {
  const falta = validarLibroVehiculos(libroVehiculos({ hojas: ["VEHICULOS"] }));
  assert.equal(falta.ofensores.length, 1);
  assert.match(falta.ofensores[0], /LISTAS/);

  const sobra = validarLibroVehiculos(libroVehiculos({ hojas: ["VEHICULOS", "LISTAS", "NOTAS"] }));
  assert.equal(sobra.ofensores.length, 1);
  assert.match(sobra.ofensores[0], /NOTAS/);
});

test("columna que falta, que sobra o fuera de orden", () => {
  const sinRevisado = COLUMNAS_VEHICULOS.filter((c) => c !== "revisado");
  assert.match(
    validarLibroVehiculos(libroVehiculos({ encabezados: sinRevisado })).ofensores.join(),
    /revisado/,
  );

  assert.match(
    validarLibroVehiculos(
      libroVehiculos({ encabezados: [...COLUMNAS_VEHICULOS, "color"] }),
    ).ofensores.join(),
    /color/,
  );

  const cambiadas = [...COLUMNAS_VEHICULOS];
  [cambiadas[3], cambiadas[4]] = [cambiadas[4], cambiadas[3]];
  assert.match(
    validarLibroVehiculos(libroVehiculos({ encabezados: cambiadas })).ofensores.join(),
    /orden/,
  );

  assert.match(
    validarLibroVehiculos(libroVehiculos({ encabezadosListas: ["ubicacion"] })).ofensores.join(),
    /medida/,
  );
});

test("las filas en blanco no cuentan", () => {
  const vacia = filaVehiculo({});
  const conEspacios = filaVehiculo({ marca: "", modelo: "  ", revisado: " " });
  const { ofensores, filas } = validarLibroVehiculos(
    libroVehiculos({
      vehiculos: [filaVehiculo(FILA_VALIDA), vacia, vacia, vacia, conEspacios],
    }),
  );
  assert.deepEqual(ofensores, []);
  assert.equal(filas.length, 1);
});

test("una fila después de filas en blanco conserva su número de la hoja", () => {
  const { filas } = validarLibroVehiculos(
    libroVehiculos({
      vehiculos: [filaVehiculo(FILA_VALIDA), filaVehiculo({}), filaVehiculo(FILA_VALIDA)],
    }),
  );
  assert.deepEqual(
    filas.map((f) => f.numero),
    [2, 4],
  );
});

test("LISTAS: columnas de distinto largo, sin espacios en los extremos", () => {
  const { listas } = validarLibroVehiculos(
    libroVehiculos({
      listas: [
        ["Puertas delanteras", '6.5"'],
        [" Puertas traseras ", ' 5.25" '],
        ["Bandeja trasera", '6x9"'],
        [null, '7/8"'],
        [null, '6x8"'],
      ],
    }),
  );
  assert.equal(listas.ubicaciones.size, 3);
  assert.ok(listas.ubicaciones.has("Puertas traseras"));
  assert.equal(listas.medidas.size, 5);
  assert.ok(listas.medidas.has('5.25"'));
});
