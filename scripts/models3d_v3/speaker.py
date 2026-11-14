"""
Sonoro — categoría "bocinas" (speaker), versión 3.
Coaxial de 6.5", sin caja acústica.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/speaker.py

Geometría portada de scripts/models3d/speaker.py (v1), que generó el
speaker-2.glb publicado. Frente (metros):

    canto exterior del marco    0.0825
    canto interior del marco    0.0705   -> plancha de 12.0 mm de ancho
    arranque del cono           0.0610   -> surround de 9.5 mm
    cuello del cono             0.0180
    cuerpo del tweeter          0.0190   -> pastilla cilíndrica de 17.5 mm

Historial de correcciones de la v1, para no repetirlas:

  1. NO hay almohadillas bajo los barrenos. El marco es un disco perfectamente
     circular. En su momento R_BOLT_RING + R_PAD daba 0.0865 contra un R_OUTER
     de 0.0825: las almohadillas asomaban 4 mm fuera del contorno y el marco se
     leía como una flor de 8 pétalos.

  2. NO hay hombro entre el marco y el surround. El talón exterior del
     surround muere contra la pared interior del marco (mismo radio). Cuando
     el borde del surround quedaba 2.5 mm adentro, la repisa de la cesta
     asomaba como un anillo oscuro y la pieza se leía como un plato hondo.

  3. El cono es MÁS CLARO que el marco. En la paleta v3: cono textured-black
     (2A2A2B), marco satin-black (1F1F21). No invertirlos.

  4. La cúpula del tweeter NO se hace con sphere(). Una esfera sube su radio
     completo desde su centro: para hundirla habría que enterrar el centro más
     de un radio y no queda nada visible, y con menos, asoma. Todas las
     cúpulas van por perfil de lathe, con el ápice puesto a mano.

  5. El tweeter es una PASTILLA cilíndrica de pared vertical, no un cono ni
     una bala. Pasaron dos intentos troncocónicos (relación aro/base 0.71 y
     luego 0.55) antes de leer bien la referencia: la pared no lleva
     conicidad, el bisel superior es angosto y la malla va HUNDIDA bajo el
     bisel, no asomando por encima.

La malla del tweeter va lisa (no se modela la perforación: serían decenas de
miles de triángulos) y se separa del cuerpo solo por tono y brillo.

El marco se construye con `lathe` y perfil cerrado, no con `tube` + bevel: el
corte transversal tiene cara plana, chaflán y pared interior de verdad.

Eje del driver = Z de Blender, imán abajo con la base en z = 0, cara del cono
hacia +Z (el export la convierte a +Y del glTF). Mira hacia arriba: `front`
es «top» y no se gira nada.

Qué cambia respecto de la v1
----------------------------
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1).
  - Marco satinado con chaflán de 1.2 mm (antes 0.7): el canto del marco
    agarra el brillo que separa el marco del cono.
  - Carcasa del tweeter en negro piano: un anillo de brillo en el centro.
  - Imán con bisel de 2 mm (antes 1.5).

speaker-4 (13 de noviembre de 2026): que no sea una silueta negra
-----------------------------------------------------------------
Es el primer producto del carrusel y era el más plano: cinco negros y casi
nada de metal (el aro del tweeter y dos terminales de 8 mm). El subwoofer,
con aro y canasta de aluminio, se leía mucho mejor. Tres cambios:

  - CONO en `graphite` (333336, rugosidad 0.50) en vez de textured-black
    (2A2A2B, 0.90): agarra una franja de brillo y se separa del borde de
    goma. Sigue siendo más claro que el marco (corrección 3 de la v1).
  - MOTOR con sus tres piezas de verdad: placa trasera y placa superior de
    acero (brushed-alu, r 39.5 mm, 4.5 mm cada una) y, entre las dos, el
    imán cerámico negro (r 42.5 mm). Antes era un cilindro negro entero y
    una placa negra de 30 mm escondida bajo la cesta. Las dos placas se ven
    como franjas claras desde la pose de reposo, y la trasera le da algo que
    leer a la base, que desde abajo era un disco negro.
  - TERMINALES de 12 x 7.5 x 9 mm (antes 8 x 5 x 6) y girados 60° sobre el
    eje: quedan de cara a la cámara en la pose de reposo (azimut 150° del
    carrusel = 60° desde +X hacia +Y en Blender). A 0° caían a un costado,
    medio tapados por el marco.

Medidas exteriores sin cambios: 165 mm de diámetro, 55 mm de alto.

speaker-5 (14 de noviembre de 2026): estructura tomada de un coaxial real
-------------------------------------------------------------------------
A pedido del negocio, la ESTRUCTURA se rehace mirando fotos de un coaxial de
6.5" real (de costado, de espaldas y de frente). Solo la estructura: los
materiales son los de la paleta, y no hay logo, texto ni etiqueta de marca.

  - PROFUNDIDAD: 70 mm (antes 55). La bocina era un plato; ahora tiene la
    proporción de un driver, con canasta honda e imán grande. El diámetro no
    cambia, así que no cambia ningún displayScale; sí cambia `height` en
    lib/models3d.ts, que es con lo que el carrusel la centra.
  - CANASTA de chapa estampada, a la vista: un aro bajo el marco, un aro que
    asienta en el motor y, entre los dos, cuatro brazos curvos con cuatro
    ventanas. Antes era un tronco de cono cerrado, escondido bajo el marco. En
    brushed-alu, como la canasta del subwoofer: se probó en anodized-black y
    se perdía contra el imán y el marco. Los brazos son sectores de
    revolución (`sector`), no tablones.
  - ARAÑA corrugada y formador de la bobina, visibles por las ventanas.
  - MOTOR más grande: imán de 76 mm por 17 mm (antes 85 por 11.5), con la
    placa trasera más chica que el imán y la superior apenas menor.
  - TERMINALES de lengüeta: una regleta al pie de la ventana que mira a la
    cámara, con dos palas, ancha y angosta. Reemplazan a los dos bloques
    cromados. El naranja queda en el manguito de la pala positiva.
  - TWEETER más ancho: 44 mm (antes 38), con las mismas reglas de la
    corrección 5: pastilla de pared vertical y malla hundida.

Lo que NO se tomó de las fotos, por las correcciones de arriba: las orejas y
ranuras de montaje del marco (corrección 1: el marco es un disco circular),
ni la trama del cono ni la rejilla del tweeter (decenas de miles de
triángulos). El cono y el surround bajaron de 20 y 16 pasos a 10 y 12 para
pagar la canasta y la araña sin subir el peso.
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

ARCHIVO = "speaker-5"

# 72 segmentos en las piezas grandes: con 96 el conjunto pasa de 30k
# triángulos. A 72 el paso angular es de 5 grados.
SEG = 72
SEG_TWEETER = 48          # el tweeter es chico pero se mira de cerca
SEG_INNER = 36            # araña y formador: se ven chicos y por una ventana
SEG_MOTOR = 48            # imán y placas: cilindros lisos, a 48 no se nota

# --- radios (m) --------------------------------------------------------------
R_OUTER = 0.0825          # 165 mm de diámetro
R_FRAME_IN = 0.0705       # plancha de 12.0 mm de ancho radial
R_SURROUND_IN = 0.0610    # arranque del cono; surround de 9.5 mm
R_NECK = 0.0180           # cuello del cono
R_MAGNET = 0.0380         # imán de 76 mm: 46 % del marco
R_YOKE = 0.0360           # placa superior de acero
R_BACK = 0.0340           # placa trasera, más chica que el imán
R_VENT = 0.0060
R_FORMER = 0.0190         # formador de la bobina
R_BOLT = 0.0028           # barreno pasante 5.6 mm
R_BOLT_RING = 0.0765      # centro exacto de la plancha: (0.0705 + 0.0825) / 2.
                          # No poner el círculo más afuera: el barreno queda
                          # tangente al chaflán exterior y la tangencia es
                          # justo lo que cuelga el solver EXACT.
BOLT_COUNT = 8            # 8 a 45 grados; i=0 queda a las 3 en punto

# --- tweeter de pastilla (m) -------------------------------------------------
R_TW_BODY = 0.0220        # cuerpo cilíndrico, más ancho que el cuello del cono
R_TW_RIM = 0.0211         # canto de la cara superior, tras el redondeo
R_TW_MESH = 0.0183        # malla hundida: bisel de 2.8 mm de ancho

Z_TW_BASE = 0.0365
Z_TW_RIM = 0.0540         # cara del bisel: 17.5 mm de alto
Z_TW_APEX = 0.0534        # ápice de la malla: 0.6 mm POR DEBAJO del bisel

# --- alturas (m) -------------------------------------------------------------
Z_FRAME_TOP = 0.0700      # cara del marco: el punto más alto de la pieza
FRAME_T = 0.0030
Z_FRAME_BOT = Z_FRAME_TOP - FRAME_T          # 0.0670

Z_SURROUND_IN = 0.0648    # talón interior (donde nace el cono)
Z_SURROUND_OUT = 0.0671   # talón exterior, metido bajo la pared del marco
SURROUND_H = 0.0034       # cresta ~1.1 mm bajo la cara del marco

Z_NECK = 0.0385
Z_YOKE_TOP = 0.0045       # placa trasera de 4.5 mm
Z_MAGNET_TOP = 0.0215     # imán de 17 mm
Z_PLATE_TOP = 0.0255      # placa superior de 4 mm

CHAMFER = 0.0012          # v1: 0.0007, invisible a tamaño de carrusel

# --- canasta estampada (m) ---------------------------------------------------
# La pared es un tronco de cono, del piso de la canasta a la cara de abajo del
# marco. Todo se ubica sobre esa línea con un parámetro t de 0 (abajo) a 1.
WALL_BOT = (0.0440, 0.0270)
WALL_TOP = (0.0715, 0.0672)
WALL_T = 0.0022           # chapa estampada
T_LOW_RING = 0.22         # el aro de abajo llega hasta acá
T_HIGH_RING = 0.74        # el aro de arriba empieza acá
SPOKE_COUNT = 4
SPOKE_ARC = math.radians(29.0)   # cada brazo: 35 mm arriba, 22 mm abajo

Z_SPIDER = 0.0345
R_SPIDER_OUT = 0.0470
SPIDER_WAVES = 4
SPIDER_AMP = 0.0015

# Hacia dónde mira la cámara del carrusel en la pose de reposo, medido desde
# +X hacia +Y de Blender (azimut 150° en el glTF). Los cuatro brazos van
# corridos 45° respecto de ese ángulo: frente a la cámara cae una VENTANA, por
# la que se ve la araña, y al pie de esa ventana van los terminales.
ANG_CAMARA = math.radians(60.0)


def wall(t, offset=0.0):
    """Punto (r, z) de la pared de la canasta en t, corrido `offset` hacia
    afuera (negativo: hacia adentro del cuenco)."""
    dr, dz = WALL_TOP[0] - WALL_BOT[0], WALL_TOP[1] - WALL_BOT[1]
    length = math.hypot(dr, dz)
    return (WALL_BOT[0] + dr * t + (dz / length) * offset,
            WALL_BOT[1] + dz * t - (dr / length) * offset)


def wall_band(t0, t1, extra=0.0):
    """Sección cerrada de la chapa entre t0 y t1. `extra` la engrosa a los
    dos lados: los brazos van 0.3 mm más gruesos que los aros para que sus
    caras no queden coplanares con las de ellos donde se solapan."""
    return [wall(t0, extra), wall(t1, extra),
            wall(t1, -WALL_T - extra), wall(t0, -WALL_T - extra)]


def sector(name, section, a0, a1, steps, material):
    """Revoluciona una sección cerrada (lista de (r, z)) solo entre dos
    ángulos, con tapas en los extremos. Es `lathe` para una pieza que no da
    la vuelta entera: un brazo de chapa curvado con la canasta, no un tablón."""
    bm = bmesh.new()
    rings = []
    for k in range(steps + 1):
        a = a0 + (a1 - a0) * k / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z))
                      for (r, z) in section])
    n = len(section)
    for k in range(steps):
        for j in range(n):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % n],
                          rings[k + 1][(j + 1) % n], rings[k + 1][j]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _common._from_bmesh(name, bm, material)


def build_frame():
    """Plancha del marco por revolución de perfil cerrado, más 8 barrenos con
    UN solo boolean sobre plancha lisa."""
    profile = [
        (R_FRAME_IN,           Z_FRAME_BOT),
        (R_FRAME_IN,           Z_FRAME_TOP - CHAMFER),
        (R_FRAME_IN + CHAMFER, Z_FRAME_TOP),           # chaflán interior
        (R_OUTER - CHAMFER,    Z_FRAME_TOP),           # cara superior plana
        (R_OUTER,              Z_FRAME_TOP - CHAMFER), # chaflán exterior
        (R_OUTER,              Z_FRAME_BOT + CHAMFER),
        (R_OUTER - CHAMFER,    Z_FRAME_BOT),
        (R_FRAME_IN,           Z_FRAME_BOT),
    ]
    frame = lathe("mount-frame", profile, segments=SEG, material=satin_black())

    cutters = []
    for i in range(BOLT_COUNT):
        a = 2.0 * math.pi * i / BOLT_COUNT
        x, y = R_BOLT_RING * math.cos(a), R_BOLT_RING * math.sin(a)
        # el cortador desborda 8.5 mm por arriba y por abajo de la plancha:
        # ninguna cara suya queda coplanar con una cara del marco
        cutters.append(cylinder("bore-cutter-%d" % (i + 1), R_BOLT, 0.0200,
                                segments=20, location=(x, y, Z_FRAME_TOP)))
    boolean(frame, join_objects(cutters, "bore-cutters", prepare=False))
    return frame


def build_basket():
    """
    Canasta de chapa estampada, en cuenco: un aro arriba, pegado bajo el
    marco; un aro abajo, que asienta en el motor; y entre los dos, cuatro
    brazos curvos que dejan cuatro ventanas. En aluminio, como la canasta del
    subwoofer: en anodizado negro se perdía contra el imán y el marco —negro
    sobre negro, que era justo el problema de la bocina— y las ventanas no se
    leían. El marco sigue negro: queda como un aro oscuro sobre la chapa clara.
    """
    mat = brushed_alu
    parts = []
    for name, t0, t1 in (("basket-ring-low", 0.0, T_LOW_RING),
                         ("basket-ring-high", T_HIGH_RING, 1.0)):
        section = wall_band(t0, t1)
        parts.append(lathe(name, section + [section[0]], segments=SEG, material=mat()))

    # Piso de la canasta, sobre la placa superior del motor.
    parts.append(lathe("basket-floor", [
        (R_FORMER + 0.0010, Z_PLATE_TOP),
        (WALL_BOT[0] + 0.0005, Z_PLATE_TOP),
        (WALL_BOT[0] + 0.0005, WALL_BOT[1] + 0.0010),
        (R_FORMER + 0.0010, WALL_BOT[1] + 0.0010),
        (R_FORMER + 0.0010, Z_PLATE_TOP),
    ], segments=SEG, material=mat()))

    section = wall_band(T_LOW_RING - 0.04, T_HIGH_RING + 0.04, extra=0.0003)
    for i in range(SPOKE_COUNT):
        center = ANG_CAMARA + math.pi / SPOKE_COUNT + 2.0 * math.pi * i / SPOKE_COUNT
        parts.append(sector("basket-spoke-%d" % (i + 1), section,
                            center - SPOKE_ARC / 2.0, center + SPOKE_ARC / 2.0,
                            steps=4, material=mat()))
    return parts


def build_spider():
    """
    Araña corrugada y formador de la bobina: lo que se ve por las ventanas de
    la canasta. Sin ellos, por una ventana se veía la de enfrente.
    """
    steps = SPIDER_WAVES * 4
    top = []
    for i in range(steps + 1):
        t = i / steps
        top.append((R_FORMER + (R_SPIDER_OUT - R_FORMER) * t,
                    Z_SPIDER + SPIDER_AMP * math.sin(2.0 * math.pi * SPIDER_WAVES * t)))
    thick = 0.0010
    profile = top + [(r, z - thick) for (r, z) in reversed(top)]
    profile.append(profile[0])
    spider = lathe("spider", profile, segments=SEG_INNER, material=textured_black())

    former = lathe("coil-former", [
        (0.0000,   Z_PLATE_TOP - 0.0010),
        (R_FORMER, Z_PLATE_TOP - 0.0010),
        (R_FORMER, Z_NECK + 0.0020),
        (0.0000,   Z_NECK + 0.0020),
    ], segments=SEG_INNER, material=matte_black())
    return [spider, former]


def build_surround():
    """
    Media caña de caucho de 9.5 mm con los dos talones a ALTURAS DISTINTAS:
    esa asimetría es la que elimina el escalón entre marco y surround. La
    cresta queda ~1.1 mm por debajo de la cara del marco.
    """
    r_in, r_out = R_SURROUND_IN, R_FRAME_IN + 0.0002
    r_center = (r_in + r_out) / 2.0
    r_arc = (r_out - r_in) / 2.0
    steps = 12

    profile = [(r_in - 0.0020, Z_SURROUND_IN - 0.0006)]      # talón interior
    for i in range(steps + 1):
        t = i / steps
        a = math.pi * t
        profile.append((r_center - r_arc * math.cos(a),
                        Z_SURROUND_IN + (Z_SURROUND_OUT - Z_SURROUND_IN) * t
                        + SURROUND_H * math.sin(a)))
    profile.append((r_out + 0.0004, Z_SURROUND_OUT - 0.0010))  # talón exterior
    return screw_revolve("surround", profile, segments=SEG, material=rubber(),
                         thickness=0.0010)


def build_cone():
    """Cono liso y continuo, sin dust cap: 26 mm de caída, casi recto."""
    steps = 10
    drop = Z_SURROUND_IN - Z_NECK
    profile = [(R_SURROUND_IN + (R_NECK - R_SURROUND_IN) * (i / steps),
                Z_SURROUND_IN - drop * ((i / steps) ** 1.10)) for i in range(steps + 1)]
    obj = lathe("cone", profile, segments=SEG, material=graphite())
    apply_solidify(obj, 0.0009, offset=-1.0)
    return obj


def build_tweeter():
    """
    Tweeter de pastilla: carcasa (cilindro recto -> redondeo del canto ->
    bisel anular -> hueco) y malla casi plana, HUNDIDA 0.6 mm bajo el bisel.
    El cuerpo (r 0.0220) es más ancho que el cuello del cono (r 0.0180) y
    arranca por debajo del final del cono: la carcasa atraviesa el cono.
    """
    parts = []
    housing = [
        (0.0000,             Z_TW_BASE),
        (R_TW_BODY - 0.0004, Z_TW_BASE),           # base, con el desmoldeo
        (R_TW_BODY,          Z_TW_BASE + 0.0035),
        (R_TW_BODY,          Z_TW_RIM - 0.0012),   # pared VERTICAL
        (R_TW_BODY - 0.0002, Z_TW_RIM - 0.0003),   # redondeo del canto
        (R_TW_RIM,           Z_TW_RIM),            # cara del bisel
        (R_TW_MESH,          Z_TW_RIM),            # canto interior del bisel
        (R_TW_MESH,          Z_TW_RIM - 0.0022),   # pared del hueco
        (0.0000,             Z_TW_RIM - 0.0026),   # fondo del hueco
    ]
    parts.append(lathe("tweeter-housing", housing, segments=SEG_TWEETER,
                       material=gloss_black()))

    steps = 8
    z_edge = Z_TW_APEX - 0.0012
    dome = [(0.0, Z_TW_APEX)]
    for i in range(1, steps + 1):
        t = i / steps
        dome.append((R_TW_MESH * math.sin(math.pi / 2.0 * t),
                     Z_TW_APEX - (Z_TW_APEX - z_edge) * (1.0 - math.cos(math.pi / 2.0 * t))))
    dome.append((R_TW_MESH, z_edge - 0.0014))
    dome.append((0.0, z_edge - 0.0014))          # fondo plano: sólido cerrado
    parts.append(lathe("tweeter-mesh", dome, segments=SEG_TWEETER,
                       material=textured_black()))
    return parts


def build_motor():
    """
    Motor en sus tres piezas, de abajo hacia arriba: placa trasera de acero,
    imán cerámico y placa superior de acero, con el venteo central pasante.
    El imán sobresale de las dos placas, y la trasera es la más chica, como
    en un driver de verdad.
    """
    parts = []
    for name, radius, z0, z1, mat, bev in (
        ("back-plate", R_BACK, 0.0, Z_YOKE_TOP, brushed_alu(), 0.0015),
        ("magnet", R_MAGNET, Z_YOKE_TOP, Z_MAGNET_TOP, matte_black(), 0.0020),
        ("top-plate", R_YOKE, Z_MAGNET_TOP, Z_PLATE_TOP, brushed_alu(), 0.0010),
    ):
        part = cylinder(name, radius, z1 - z0, segments=SEG_MOTOR,
                        location=(0.0, 0.0, (z0 + z1) / 2.0), material=mat)
        bevel(part, bev, segments=2)
        boolean(part, cylinder("vent-cutter", R_VENT, 0.0800, segments=20,
                               location=(0.0, 0.0, (z0 + z1) / 2.0)))
        parts.append(part)
    return parts


def build_terminals():
    """
    Regleta de terminales al pie de la ventana que mira a la cámara, sobre el
    aro de abajo de la canasta: una tira aislante y dos lengüetas de pala,
    una ancha y una angosta, que salen hacia afuera y algo hacia abajo. La
    ancha lleva un manguito naranja: es la positiva. Se arma sobre +X y se
    gira ANG_CAMARA: (r, y) es radial y tangencial.
    """
    parts = []
    ca, sa = math.cos(ANG_CAMARA), math.sin(ANG_CAMARA)

    def place(r, y, z):
        return (r * ca - y * sa, r * sa + y * ca, z)

    r_wall, z_wall = wall(0.14)
    strip = box("terminal-strip", (0.0050, 0.0260, 0.0100),
                location=place(r_wall + 0.0015, 0.0, z_wall),
                rotation=(0.0, 0.0, ANG_CAMARA), material=matte_black())
    bevel(strip, 0.0010, segments=2)
    parts.append(strip)

    tilt = math.radians(18.0)                    # las palas caen hacia afuera
    for name, y, width, length, sleeve in (("wide", 0.0065, 0.0070, 0.0125, accent_orange),
                                           ("narrow", -0.0070, 0.0046, 0.0105, satin_black)):
        r_mid = r_wall + 0.0030 + (length / 2.0) * math.cos(tilt)
        z_mid = z_wall - (length / 2.0) * math.sin(tilt)
        blade = box("spade-%s" % name, (length, width, 0.0013),
                    location=place(r_mid, y, z_mid),
                    rotation=(0.0, tilt, ANG_CAMARA), material=chrome())
        bevel(blade, 0.0004, segments=1)
        parts.append(blade)
        parts.append(box("spade-sleeve-%s" % name, (0.0045, width + 0.0022, 0.0038),
                         location=place(r_wall + 0.0052, y, z_wall - 0.0006),
                         rotation=(0.0, tilt, ANG_CAMARA), material=sleeve()))
    return parts


def main():
    reset_scene()
    parts = [build_frame(), build_surround(), build_cone()]
    parts += build_basket()
    parts += build_spider()
    parts += build_tweeter()
    parts += build_motor()
    parts += build_terminals()

    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "speaker")
    # xy="keep": los terminales sobresalen de un solo lado, así que centrar el
    # bbox correría el eje del driver y el tweeter dejaría de estar sobre el
    # eje del cono. El eje de construcción ya es (0, 0).
    finalize(obj, ARCHIVO, front="top", xy="keep",
             expected_dims=(0.165, 0.165, 0.070), ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
