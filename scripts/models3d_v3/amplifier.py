"""
Sonoro — categoría "amplificadores" (amplifier), versión 3.
Clase D de 4 canales, formato compacto.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/amplifier.py

Geometría portada de scripts/models3d/amplifier.py (v1), que generó el
amplifier.glb publicado. Medidas sin cambios:

    largo  0.260 (eje X)   <- paneles cortos en -X (entradas) y +X (potencia)
    ancho  0.175 (eje Y)   <- más las 2 orejas de montaje, que sobresalen
    alto   0.055 (eje Z)   <- pies 3 + cuerpo 40 + aletas 12

El rasgo silueta es el disipador: 14 aletas longitudinales corriendo los
260 mm. Nada de booleanos en las piezas estructurales.

El script construye con el frente hacia −Y (el costado largo con la oreja;
junto con el panel de entradas en −X es lo que ve la cámara en tres
cuartos). `finalize` lo gira a +Y: ya no necesita `giroBase`.

Qué cambia respecto de la v1
----------------------------
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1).
  - Aletas con bisel de 1 mm en dos pasos: cada aleta agarra una línea de
    brillo en el canto, que es lo que dibuja el disipador a tamaño de
    carrusel. Cuerpo con bisel de 3 mm en cuatro pasos.
  - Placa central negra, ahora VISIBLE: en la v1 quedaba enterrada 3 mm
    bajo la tapa (con su logo), así que no se veía. Sin logo.
  - Perillas y cilindros a 32 segmentos (antes 24).

amplifier-4 (13 de noviembre de 2026): que el aluminio tenga relieve
--------------------------------------------------------------------
En las capturas el amplifier-3 se leía como una caja gris pintada: el
aluminio reflejaba el mismo gris en la tapa, en las aletas y en el fondo de
los valles, y los dos costados largos eran planos. Era el modelo con menos
detalle (7,232 triángulos). Dos cambios, sin tocar la placa central:

  - OCLUSIÓN EN VÉRTICES, siempre (antes solo con --ao, que nadie usaba). Se
    hornea por vértice, así que hace falta un vértice donde la sombra
    cambia: la tapa del cuerpo es una sola cara y no tiene ninguno en los
    valles. Por eso cada valle entre aletas lleva su propio FONDO, una tira
    de aluminio 0.3 mm sobre la tapa, partida en tres tramos: los vértices
    de adentro salen oscuros y los de la boca del valle, claros.
  - NERVADURAS de extrusión en los dos costados largos: tres por lado, de
    4 mm de alto y 2 mm de saliente. Agarran una línea de brillo cada una y,
    con la oclusión, sombra entre ellas. Terminan 16 mm antes de cada
    esquina, así que el radio del modelo no cambia.

amplifier-5 (14 de noviembre de 2026): estructura tomada de un amplificador real
---------------------------------------------------------------------------------
A pedido del negocio, la ESTRUCTURA se rehace mirando fotos de un amplificador
real (de arriba, en tres cuartos por los dos extremos y de frente por los
dos). Solo la estructura: los materiales son los de la paleta, y no hay logo,
texto ni serigrafía. Con esto deja de valer el primer párrafo de este
encabezado («el rasgo silueta es el disipador: 14 aletas»): ya no hay aletas.

  - CUERPO extruido, bajo y liso: un perfil de aluminio cortado a medida
    (`extrude_x`), con la tapa en dos paneles cóncavos y los hombros
    redondeados. Antes era una caja con 14 aletas encima. De 55 mm de alto
    pasa a 45.
  - FRANJAS pulidas (chrome): una envuelve cada hombro y otra corre a cada
    lado de la banda central. Sobre el aluminio cepillado dibujan el perfil.
  - BANDA CENTRAL negra mate, de punta a punta: es la placa central de
    siempre (decisión del negocio: visible, negra mate y sin logo), que antes
    era un rectángulo entre las aletas.
  - TAPAS DE EXTREMO negras, 1.2 mm adentro del perfil, con ranuras de
    ventilación y un tornillo en cada esquina. Antes los conectores iban
    directo sobre las caras del cuerpo.
  - ENTRADAS (-X): cuatro RCA en cuadro, cuatro potenciómetros, un puerto,
    un switch y un RCA suelto.
  - POTENCIA (+X): bloque de alimentación de tres bornes, cuatro fusibles de
    cuchilla y bloque de salida de cuatro bornes. Los fusibles van en
    accent-orange: es el color del fusible.
  - PLACA BASE que asoma 12 mm por cada extremo, con los cuatro tornillos de
    montaje. Reemplaza a las orejas de los costados largos y a los pies.

SIN OCLUSIÓN. amplifier-4 la horneaba para oscurecer los valles entre aletas,
y costaba 15 KB; sin aletas no hay valles que oscurecer. El script vuelve a
aceptar --ao, como los demás, y no lo usa.
"""

import math
import os
import sys


def _locate_common():
    """Sirve headless (--python) y desde el Text Editor de Blender."""
    cands = [os.path.dirname(os.path.abspath(__file__)), os.getcwd(),
             os.path.join(os.getcwd(), "scripts", "models3d_v3")]
    try:
        import bpy
        for t in bpy.data.texts:
            if t.filepath:
                cands.append(os.path.dirname(os.path.abspath(bpy.path.abspath(t.filepath))))
    except Exception:
        pass
    for d in cands:
        if os.path.isfile(os.path.join(d, "_common.py")):
            return d
    raise RuntimeError("no encuentro _common.py de scripts/models3d_v3")


sys.path.insert(0, _locate_common())
import importlib                                            # noqa: E402
import _common                                              # noqa: E402
importlib.reload(_common)   # Blender cachea los módulos entre corridas
from _common import *       # noqa: F401,F403,E402

import bmesh                # noqa: E402  (después de _common, que importa bpy)

ARCHIVO = "amplifier-5"

# --- cuerpo extruido (m) -----------------------------------------------------
L_BODY = 0.2440             # largo del perfil de aluminio (X)
CAP_T = 0.0040              # cada tapa de extremo; el conjunto mide 252 mm
W = 0.1750                  # ancho (Y)
Y_HALF = W / 2.0            # 0.0875
X_CAP = L_BODY / 2.0 + CAP_T    # 0.126, cara exterior de las tapas

Z_BASE_TOP = 0.0035         # la placa base
Z_SIDE_TOP = 0.0340         # donde el costado empieza a redondear
Z_CENTER = 0.0430           # tapa, en la banda central
Z_SHOULDER = 0.0445         # cresta de los hombros
DIP = 0.0050                # cuánto se hunde cada panel

BAND_HALF = 0.0160          # banda central de 32 mm
STRIP_W = 0.0040            # franja pulida a cada lado de la banda
Y_DIP_END = 0.0740          # donde termina el panel y arranca el hombro
SHOULDER_A = Y_HALF - Y_DIP_END             # 13.5 mm, semieje horizontal
SHOULDER_B = Z_SHOULDER - Z_SIDE_TOP        # 10.5 mm, semieje vertical

N_DIP = 18                  # puntos de cada panel cóncavo
N_SHOULDER = 12             # puntos de cada hombro

# --- placa base (m) ----------------------------------------------------------
BASE_L = 0.2760             # asoma 12 mm por cada extremo: son las pestañas
BASE_W = 0.1600

SEG_ROUND = 32


def top_half():
    """Media tapa, del centro al costado derecho: lista de (y, z). Plana en la
    banda, un panel que se hunde y vuelve a subir, y el hombro que redondea
    hasta el costado. El seno al cuadrado deja el panel con pendiente cero en
    las dos puntas: empalma sin quiebre con la banda y con el hombro."""
    pts = [(0.0, Z_CENTER), (BAND_HALF + STRIP_W, Z_CENTER)]
    y0 = BAND_HALF + STRIP_W
    for i in range(1, N_DIP + 1):
        u = i / N_DIP
        rise = (Z_SHOULDER - Z_CENTER) * (u * u * (3.0 - 2.0 * u))
        pts.append((y0 + (Y_DIP_END - y0) * u,
                    Z_CENTER + rise - DIP * math.sin(math.pi * u) ** 2))
    for i in range(1, N_SHOULDER + 1):
        a = (math.pi / 2.0) * i / N_SHOULDER
        pts.append((Y_DIP_END + SHOULDER_A * math.sin(a),
                    Z_SIDE_TOP + SHOULDER_B * math.cos(a)))
    return pts


def body_section(inset=0.0):
    """Sección cerrada del cuerpo, en (y, z). `inset` la achica: las tapas de
    extremo van 1.2 mm adentro del perfil, que les queda de alero."""
    right = [(y - inset if y > 0 else y, z - inset) for (y, z) in top_half()]
    left = [(-y, z) for (y, z) in reversed(right)]
    edge = Y_HALF - inset
    return left + right[1:] + [
        (edge,          Z_BASE_TOP + 0.0035),
        (edge - 0.0020, Z_BASE_TOP),
        (-edge + 0.0020, Z_BASE_TOP),
        (-edge,         Z_BASE_TOP + 0.0035),
    ]


def extrude_x(name, section, x0, x1, material):
    """Extruye una sección cerrada (lista de (y, z)) a lo largo de X, con una
    tapa en cada punta. Es como sale un amplificador de verdad: un perfil de
    aluminio cortado a medida."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for (y, z) in section]
    b = [bm.verts.new((x1, y, z)) for (y, z) in section]
    n = len(section)
    for j in range(n):
        bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _common._from_bmesh(name, bm, material)


def build_body():
    """Perfil extruido: tapa en dos paneles cóncavos, hombros redondeados."""
    return [extrude_x("chassis", body_section(), -L_BODY / 2.0, L_BODY / 2.0,
                      brushed_alu())]


def build_trim():
    """
    Lo que va sobre el perfil, todo a lo largo: la banda central negra, una
    franja pulida a cada lado de ella y una franja pulida que envuelve cada
    hombro. La banda es la placa central del modelo de siempre —negra mate y
    sin logo—, ahora de punta a punta.
    """
    parts = []
    z = Z_CENTER + 0.0002
    band = box("center-band", (L_BODY, 2 * BAND_HALF, 0.0016),
               location=(0.0, 0.0, z), material=matte_black())
    parts.append(band)
    for i, sy in enumerate((-1, 1)):
        parts.append(box("band-strip-%d" % (i + 1), (L_BODY, STRIP_W, 0.0016),
                         location=(0.0, sy * (BAND_HALF + STRIP_W / 2.0), z),
                         material=chrome()))

    # Franja del hombro: una cáscara que sigue la curva, 1.4 mm afuera del
    # perfil y 1.2 mm adentro (esa parte queda escondida en el cuerpo). Con
    # 0.6 mm no se distinguía: franja y cuerpo son los dos metal claro, y lo
    # único que la dibuja es el escalón de sus cantos.
    steps = 10
    a0, a1 = math.radians(14.0), math.radians(74.0)
    outer, inner = [], []
    for k in range(steps + 1):
        a = a0 + (a1 - a0) * k / steps
        outer.append((Y_DIP_END + (SHOULDER_A + 0.0014) * math.sin(a),
                      Z_SIDE_TOP + (SHOULDER_B + 0.0014) * math.cos(a)))
        inner.append((Y_DIP_END + (SHOULDER_A - 0.0012) * math.sin(a),
                      Z_SIDE_TOP + (SHOULDER_B - 0.0012) * math.cos(a)))
    section = outer + list(reversed(inner))
    parts.append(extrude_x("shoulder-strip-1", section, -L_BODY / 2.0, L_BODY / 2.0,
                           chrome()))
    parts.append(extrude_x("shoulder-strip-2", [(-y, zz) for (y, zz) in reversed(section)],
                           -L_BODY / 2.0, L_BODY / 2.0, chrome()))
    return parts


def build_end_caps():
    """
    Tapas de extremo: placas negras 1.2 mm adentro del perfil, con tres
    ranuras de ventilación a cada lado y un tornillo en cada esquina.
    """
    parts = []
    section = body_section(inset=0.0012)
    rot = (0.0, math.pi / 2.0, 0.0)
    for i, sx in enumerate((-1, 1)):
        x_in, x_out = sx * L_BODY / 2.0, sx * X_CAP
        parts.append(extrude_x("end-cap-%d" % (i + 1), section,
                               min(x_in, x_out), max(x_in, x_out), satin_black()))
        for j, sy in enumerate((-1, 1)):
            for k in range(3):
                parts.append(box("cap-vent-%d-%d-%d" % (i + 1, j + 1, k + 1),
                                 (0.0012, 0.0018, 0.0130),
                                 location=(x_out + sx * 0.0002,
                                           sy * (0.0700 + k * 0.0045), 0.0195),
                                 material=rubber()))
            for k, z in enumerate((0.0085, 0.0315)):
                parts.append(hex_socket("cap-screw-%d-%d-%d" % (i + 1, j + 1, k + 1),
                                        0.0022, 0.0020,
                                        (x_out + sx * 0.0004, sy * 0.0810, z),
                                        rot, chrome()))
    return parts


def hex_socket(name, radius, depth, location, rotation, material_):
    """Barreno hexagonal hundido, como cilindro de 6 lados (sin boolean)."""
    return cylinder(name, radius, depth, segments=6, location=location,
                    rotation=rotation, material=material_)


def build_input_panel():
    """
    Tapa A (-X): cuatro RCA en cuadro, cuatro potenciómetros, un puerto, un
    switch y un RCA suelto. Es la que ve la cámara en tres cuartos.
    """
    parts = []
    x = -X_CAP
    rot = (0.0, math.pi / 2.0, 0.0)          # eje de los cilindros sobre X
    z_mid = 0.0200

    def rca(name, y, z, orange):
        parts.append(cylinder("rca-jack-%s" % name, 0.0045, 0.0090,
                              segments=SEG_ROUND, location=(x - 0.0030, y, z),
                              rotation=rot, material=chrome()))
        # tube() ocupa de -1.5 a -0.5 de su largo respecto de `location` (ver
        # _common.py): así el aro va de 0.4 a 2.6 mm afuera de la tapa.
        parts.append(tube("rca-ring-%s" % name, 0.0058, 0.0045, 0.0022,
                          segments=SEG_ROUND, location=(x + 0.0007, y, z),
                          rotation=rot,
                          material=accent_orange() if orange else brushed_alu()))
        parts.append(cylinder("rca-pin-%s" % name, 0.0012, 0.0060,
                              segments=12, location=(x - 0.0020, y, z),
                              rotation=rot, material=chrome()))

    for i, y in enumerate((-0.0620, -0.0470)):
        for j, z in enumerate((0.0270, 0.0130)):
            rca("%d-%d" % (i + 1, j + 1), y, z, orange=(j == 0))
    rca("link", 0.0620, z_mid, orange=False)

    for i, y in enumerate((-0.0270, -0.0140, 0.0200, 0.0330)):
        knob = cylinder("gain-pot-%d" % (i + 1), 0.0045, 0.0060,
                        segments=24, location=(x - 0.0022, y, z_mid),
                        rotation=rot, material=satin_black())
        bevel(knob, 0.0008, segments=2)
        parts.append(knob)
        parts.append(box("gain-pot-notch-%d" % (i + 1), (0.0016, 0.0010, 0.0036),
                         location=(x - 0.0048, y, z_mid + 0.0021),
                         material=brushed_alu()))

    port = box("remote-port", (0.0030, 0.0110, 0.0100),
               location=(x - 0.0010, 0.0030, z_mid), material=textured_black())
    parts.append(port)

    parts.append(box("switch-well", (0.0030, 0.0120, 0.0070),
                     location=(x - 0.0010, 0.0470, z_mid), material=textured_black()))
    lever = box("switch-lever", (0.0026, 0.0045, 0.0050),
                location=(x - 0.0022, 0.0440, z_mid), material=brushed_alu())
    bevel(lever, 0.0005, segments=2)
    parts.append(lever)
    return parts


def build_power_panel():
    """
    Tapa B (+X): bloque de alimentación de tres bornes, cuatro fusibles de
    cuchilla en el centro y bloque de salida de cuatro bornes. Los fusibles
    van en naranja: es el color del fusible, no un adorno.
    """
    parts = []
    x = X_CAP
    rot = (0.0, math.pi / 2.0, 0.0)
    z_mid = 0.0200

    def block(name, y_center, width, sockets, socket_r):
        blk = box(name, (0.0090, width, 0.0200), location=(x + 0.0040, y_center, z_mid),
                  material=matte_black())
        bevel(blk, 0.0012, segments=2)
        parts.append(blk)
        pitch = width / sockets
        for k in range(sockets):
            y = y_center + (k - (sockets - 1) / 2.0) * pitch
            parts.append(hex_socket("%s-socket-%d" % (name, k + 1), socket_r, 0.0050,
                                    (x + 0.0066, y, z_mid), rot, chrome()))

    block("power-block", -0.0500, 0.0420, 3, 0.0040)
    block("speaker-block", 0.0490, 0.0440, 4, 0.0030)

    for k in range(4):
        y = (k - 1.5) * 0.0095
        fuse = box("fuse-%d" % (k + 1), (0.0070, 0.0056, 0.0190),
                   location=(x + 0.0030, y, z_mid - 0.0010), material=accent_orange())
        bevel(fuse, 0.0008, segments=2)
        parts.append(fuse)
        parts.append(box("fuse-blade-%d" % (k + 1), (0.0010, 0.0018, 0.0110),
                         location=(x + 0.0066, y, z_mid - 0.0010), material=chrome()))
    return parts


def build_base_plate():
    """Placa base: asoma 12 mm por cada extremo, y ahí van los cuatro
    tornillos de montaje. Reemplaza a las orejas de los costados y a los pies."""
    parts = []
    plate = box("base-plate", (BASE_L, BASE_W, Z_BASE_TOP + 0.0005),
                location=(0.0, 0.0, (Z_BASE_TOP + 0.0005) / 2.0), material=brushed_alu())
    bevel(plate, 0.0010, segments=2)
    parts.append(plate)
    for i, (sx, sy) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        parts.append(hex_socket("mount-bolt-%d" % (i + 1), 0.0028, 0.0030,
                                (sx * (BASE_L / 2.0 - 0.0055), sy * (BASE_W / 2.0 - 0.0140),
                                 Z_BASE_TOP), (0, 0, 0), chrome()))
    return parts


def main():
    reset_scene()
    parts = build_body()
    parts += build_trim()
    parts += build_end_caps()
    parts += build_input_panel()
    parts += build_power_panel()
    parts += build_base_plate()

    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "amplifier")
    # en X no se compara: los 252 mm son del cuerpo con sus tapas, y la placa
    # base y los conectores suman al bbox
    finalize(obj, ARCHIVO, front="-Y", expected_dims=(None, None, 0.045),
             ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
