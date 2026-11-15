"""
Sonoro — categoría "subwoofers" (subwoofer), versión 3.
12" de chasis desnudo, sin caja.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/subwoofer.py

Geometría portada de scripts/models3d/subwoofer.py (v1), que generó el
subwoofer-2.glb publicado. Medidas sin cambios:

    marco exterior      0.315 de diámetro (plancha continua, SIN orejas)
    canto interior      0.270 de diámetro -> plancha de 22.5 mm de ancho
    profundidad total   0.165 (base del boot -> cresta del surround)

Lo que define la silueta lateral de esta categoría, y hay que respetar:

  - motor CUBIERTO por un boot acanalado, no una pila de imanes desnuda:
    0.180 de diámetro por 70 mm de alto, con 10 nervios verticales;
  - terminales en una PLACA rectangular sobre la pared del basket, a media
    altura, inclinada con la pared. No binding posts sobre orejas;
  - lazo de tinsel naranja entre los dos terminales: único acento de color;
  - gasket en la cara del marco, por dentro del círculo de barrenos;
  - basket de aluminio con 6 brazos radiales y aberturas triangulares entre
    ellos; cono poco profundo con dust cap grande.

El marco sigue las cuatro reglas del de la bocina: plancha continua por
revolución de perfil cerrado; UN solo boolean para los 8 barrenos; barrenos
en el centro exacto de la plancha (la tangencia con un canto cuelga el solver
EXACT); SIN hombro entre marco y surround, con los pies del surround a
alturas distintas. Por eso la cresta del surround (0.1652) queda sobre la
cara del marco (0.1610): en un sub de 12" eso es lo normal.

El gasket es la única pieza apoyada SOBRE la cara del marco, y va por dentro
del círculo de barrenos (termina en 0.1418 contra el 0.1423 del barreno).

Mira hacia arriba: `front` es «top» y no se gira nada.

Qué cambia respecto de la v1
----------------------------
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1).
  - Chaflán del marco de 2 mm (antes 1.3): el aro de aluminio agarra un
    brillo continuo en el canto.
  - Dust cap satinado: se separa del cono (texturado) por el brillo.
  - Lazo de tinsel suave (en la v1 era un tubo de 8 lados facetado).

subwoofer-4 (13 de noviembre de 2026): el acento naranja, al frente
-------------------------------------------------------------------
Era de los modelos que mejor se leían, pero mirado de cerca y por todos
lados tenía tres flojeras. No cambia nada de lo que define la silueta.

  - CONO en `graphite` (333336, rugosidad 0.50) en vez de textured-black:
    agarra una franja de brillo y se separa del dust cap, que sigue en
    satin-black y ahora es claramente más oscuro que el cono. Es el mismo
    cambio que en speaker-4.
  - PLACA DE TERMINALES girada 60° sobre el eje, de cara a la cámara del
    carrusel en la pose de reposo (ANG_CAMARA). A 0° quedaba a un costado,
    y el brazo que sí miraba a la cámara salía casi negro: su cara cae hacia
    el piso oscuro del estudio. Ahora ese brazo lleva la placa encima, y el
    lazo de tinsel naranja —el único acento de color— queda al frente.
  - PLACA TRASERA de aluminio en la base del boot, con el venteo del polo:
    la base era un disco negro liso. Va embutida en un rebaje del boot, a
    ras de z = 0.

subwoofer-5 (13 de noviembre de 2026): estructura tomada de un 12" real
-----------------------------------------------------------------------
A pedido del negocio, la ESTRUCTURA se rehace mirando fotos de un subwoofer
de chasis desnudo real (frente, costado y espalda). Solo la estructura: los
materiales son los de la paleta, y no hay logo, texto ni franjas de marca.
Con esto cambia la lista de arriba («lo que define la silueta»); manda esta:

  - MOTOR angosto y alto, bajo una cubierta LISA: 132 mm de diámetro (42 % del
    marco) por 60 mm, con dos cordones. Antes era un boot de 180 mm con diez
    nervios, más ancho que la canasta en su base.
  - CANASTA en cuenco: un aro alto bajo el marco y, colgando de él, seis
    brazos anchos que bajan curvos al collar del motor, en tres tramos que
    se angostan. Antes eran seis barras
    rectas. Van corridos 30° para que frente a la cámara caiga una ventana.
  - ARAÑA corrugada y formador de la bobina, visibles por las ventanas. Antes
    por ahí se veía el vacío hasta el otro lado.
  - MARCO con labio: la plancha sigue de 6 mm, pero un labio baja 10 mm por
    el canto y de costado se ve de 16 mm.
  - SURROUND alto: 19 mm de media caña (antes 11), 12 mm sobre el marco.
  - CONO con cordón de costura, y TAPA CENTRAL casi plana (7 mm, antes 15)
    con un aro en el canto.
  - BLOQUE DE TERMINALES: placa lisa sobre el collar y, debajo, una regleta
    con CUATRO postes en fila, con aro de polaridad naranja y negro. Reemplaza
    a la placa inclinada con dos terminales de resorte y el lazo de tinsel.
    El naranja sigue siendo el único acento de color, ahora en dos aros.
  - PLACA TRASERA con seis barrenos alrededor del venteo.

Las medidas exteriores no cambian: 315 mm de diámetro y 165 mm de alto. Las
cuatro reglas del marco y el gasket por dentro de los barrenos, tampoco.
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

ARCHIVO = "subwoofer-5"

SEG = 64

# --- marco (m) ---------------------------------------------------------------
R_FRAME_OUT = 0.1575        # 0.315 de diámetro
R_FRAME_IN = 0.1350         # plancha de 22.5 mm de ancho radial
FRAME_T = 0.0060
Z_FRAME_TOP = 0.1530        # cara del marco
Z_FRAME_BOT = Z_FRAME_TOP - FRAME_T          # 0.1470
LIP_W = 0.0060              # labio que baja por el canto exterior
Z_LIP_BOT = 0.1370          # el marco se ve de 16 mm de canto
CHAMFER = 0.0020            # v1: 0.0013

R_BOLT = 0.0040             # barreno pasante de 8 mm
R_BOLT_RING = 0.1463        # centro exacto de la plancha
BOLT_COUNT = 8

R_GASKET_OUT = 0.1418       # libra el borde interior del barreno (0.1423)
GASKET_T = 0.0025

# --- surround y cono (m) -----------------------------------------------------
SURROUND_W = 0.0320
# Media caña alta: sube 12 mm sobre el marco. 19.1 y no 20 para que la cresta
# quede en 0.1652, la altura de siempre: es el modelo más alto del carrusel y
# de su altura sale FRAME_HEIGHT, o sea el encuadre de los nueve.
SURROUND_H = 0.0191
R_SURROUND_IN = R_FRAME_IN - SURROUND_W      # 0.1030, arranque del cono
Z_SURROUND_IN = 0.1428
Z_SURROUND_OUT = 0.1472

CONE_DROP = 0.0350
R_STITCH = 0.0920           # cordón de costura, a 11 mm del surround
R_DUSTCAP = 0.0550          # 110 mm de diámetro
DUSTCAP_H = 0.0070          # casi plano

# --- motor: cubierta lisa (m) ------------------------------------------------
R_MOTOR = 0.0660            # 132 mm de diámetro: 42 % del marco
Z_MOTOR_TOP = 0.0600
R_BACK = 0.0460
BACK_T = 0.0040
R_POLE_VENT = 0.0110
R_BACK_BOLT = 0.0040
R_BACK_BOLT_RING = 0.0300
BACK_BOLT_COUNT = 6

# --- canasta: collar, brazos y araña (m) -------------------------------------
R_COLLAR = 0.0790
Z_COLLAR_BOT = 0.0520
Z_COLLAR_TOP = 0.0720
ARM_COUNT = 6
ARM_T = 0.0090
# Línea media de cada brazo, de la repisa al collar: (radio, z, ancho).
ARM_PATH = [
    (0.1270, 0.1395, 0.0500),
    (0.1150, 0.1150, 0.0460),
    (0.0970, 0.0900, 0.0420),
    (0.0780, 0.0700, 0.0400),
]

R_FORMER = 0.0320           # formador de la bobina, bajo el cono
Z_SPIDER = 0.0960
R_SPIDER_IN = R_FORMER
R_SPIDER_OUT = 0.0900
SPIDER_WAVES = 5
SPIDER_AMP = 0.0032
# La araña se ve chica y a través de una ventana: con 32 gajos y cuatro puntos
# por onda alcanza. A 64 gajos y ocho puntos gastaba 12,000 triángulos, la
# mitad del presupuesto del modelo.
SPIDER_SEG = 32

# --- bloque de terminales (m) ------------------------------------------------
# Hacia dónde mira la cámara del carrusel en la pose de reposo, medido desde
# +X hacia +Y de Blender (azimut 150° en el glTF). Los brazos van corridos
# medio paso (30°), así que ahí cae una VENTANA de la canasta, no un brazo: se
# ve la araña, y debajo, la placa y la fila de terminales.
ANG_CAMARA = math.radians(60.0)
ARM_PHASE = math.radians(30.0)

LABEL_W = 0.0900
LABEL_H = 0.0260
Z_LABEL = 0.0650
TERM_COUNT = 4
TERM_PITCH = 0.0190
Z_TERM = 0.0400


def spherical_cap_profile(radius_base, height, steps=8):
    sphere_r = (radius_base ** 2 + height ** 2) / (2.0 * height)
    a_max = math.asin(min(radius_base / sphere_r, 1.0))
    return [(sphere_r * math.sin(a_max * (1.0 - i / steps)),
             height - sphere_r * (1.0 - math.cos(a_max * (1.0 - i / steps))))
            for i in range(steps + 1)]


def cone_z(r):
    """Altura de la línea media del cono en el radio r."""
    t = (R_SURROUND_IN - r) / (R_SURROUND_IN - R_DUSTCAP)
    return Z_SURROUND_IN - CONE_DROP * (t ** 1.10)


def build_frame():
    """
    Plancha con labio por revolución de perfil cerrado + 8 barrenos con UN
    boolean. El labio baja 10 mm por el canto exterior: de costado el marco se
    ve grueso, de 16 mm, sin gastar una plancha maciza.
    """
    r_lip = R_FRAME_OUT - LIP_W
    profile = [
        (R_FRAME_IN,            Z_FRAME_BOT),
        (R_FRAME_IN,            Z_FRAME_TOP - CHAMFER),
        (R_FRAME_IN + CHAMFER,  Z_FRAME_TOP),
        (R_FRAME_OUT - CHAMFER, Z_FRAME_TOP),
        (R_FRAME_OUT,           Z_FRAME_TOP - CHAMFER),
        (R_FRAME_OUT,           Z_LIP_BOT + CHAMFER),
        (R_FRAME_OUT - CHAMFER, Z_LIP_BOT),
        (r_lip,                 Z_LIP_BOT),
        (r_lip,                 Z_FRAME_BOT),
        (R_FRAME_IN,            Z_FRAME_BOT),
    ]
    frame = lathe("mount-frame", profile, segments=SEG, material=brushed_alu())
    cutters = []
    for i in range(BOLT_COUNT):
        a = 2.0 * math.pi * i / BOLT_COUNT
        cutters.append(cylinder("bore-cutter-%d" % (i + 1), R_BOLT, 0.0300, segments=20,
                                location=(R_BOLT_RING * math.cos(a),
                                          R_BOLT_RING * math.sin(a), Z_FRAME_TOP)))
    boolean(frame, join_objects(cutters, "bore-cutters", prepare=False))
    return frame


def build_gasket():
    """Gasket apoyado SOBRE la cara del marco, 0.4 mm embutido. tube() ocupa
    de -1.5 a -0.5 de su largo respecto de `location` (ver _common.py): hasta
    subwoofer-4 se le pasaba el centro y quedaba hundido en la plancha, sin
    verse."""
    return tube("gasket", R_GASKET_OUT, R_FRAME_IN, GASKET_T, segments=SEG,
                location=(0.0, 0.0, Z_FRAME_TOP - 0.0004 + 1.5 * GASKET_T),
                material=rubber())


def build_basket_shoulder():
    """Repisa del basket bajo el surround: evita el anillo oscuro que aparece
    cuando el surround muere en el aire en vez de sobre material. De ella
    cuelgan los brazos."""
    profile = [
        (0.1000,     Z_SURROUND_IN - 0.0005),
        (R_FRAME_IN, Z_SURROUND_OUT - 0.0005),
        (R_FRAME_IN, Z_SURROUND_OUT - 0.0055),
        (0.1250,     Z_SURROUND_OUT - 0.0082),
        (0.1000,     Z_SURROUND_IN - 0.0055),
        (0.1000,     Z_SURROUND_IN - 0.0005),
    ]
    return lathe("basket-shoulder", profile, segments=SEG, material=brushed_alu())


def build_arms():
    """
    Canasta en cuenco: 6 brazos anchos que bajan curvos de la repisa al collar
    del motor, y entre ellos ventanas por las que se ve la araña. Cada brazo
    son tres tramos rectos sobre ARM_PATH, solapados en las uniones, que se
    angostan hacia el collar.
    """
    parts = []
    overlap = 0.0060
    for i in range(ARM_COUNT):
        angle = ARM_PHASE + 2.0 * math.pi * i / ARM_COUNT
        ca, sa = math.cos(angle), math.sin(angle)
        for k in range(len(ARM_PATH) - 1):
            (r0, z0, w0), (r1, z1, w1) = ARM_PATH[k], ARM_PATH[k + 1]
            dr, dz = r0 - r1, z0 - z1
            r_mid, z_mid = (r0 + r1) / 2.0, (z0 + z1) / 2.0
            seg = box("basket-arm-%d-%d" % (i + 1, k + 1),
                      (math.hypot(dr, dz) + overlap, (w0 + w1) / 2.0, ARM_T),
                      location=(r_mid * ca, r_mid * sa, z_mid),
                      rotation=(0.0, -math.atan2(dz, dr), angle),
                      material=brushed_alu())
            bevel(seg, 0.0025, segments=2)
            parts.append(seg)

    # Aro alto de la canasta: los brazos nacen de él, no del aire. Sin el aro
    # sus cabezas asomaban bajo el marco como tablones sueltos.
    parts.append(lathe("basket-rim", [
        (R_FRAME_IN - 0.0010, Z_FRAME_BOT - 0.0010),
        (R_FRAME_IN - 0.0010, 0.1330),
        (0.1190,              0.1215),
        (0.1100,              0.1215),
        (0.1250,              0.1330),
        (0.1250,              Z_FRAME_BOT - 0.0010),
        (R_FRAME_IN - 0.0010, Z_FRAME_BOT - 0.0010),
    ], segments=SEG, material=brushed_alu()))

    collar = lathe("basket-collar", [
        (R_MOTOR - 0.0020, Z_COLLAR_BOT),
        (R_COLLAR - 0.0020, Z_COLLAR_BOT),
        (R_COLLAR,          Z_COLLAR_BOT + 0.0020),
        (R_COLLAR,          Z_COLLAR_TOP - 0.0020),
        (R_COLLAR - 0.0020, Z_COLLAR_TOP),
        (R_MOTOR - 0.0020, Z_COLLAR_TOP),
        (R_MOTOR - 0.0020, Z_COLLAR_BOT),
    ], segments=SEG, material=brushed_alu())
    parts.append(collar)
    return parts


def build_spider():
    """
    Araña: el disco corrugado que centra la bobina. Es lo que se ve por las
    ventanas de la canasta; sin ella se veía el vacío hasta el otro lado. Va
    con el formador de la bobina, que la une al cono y tapa el hueco central.
    """
    steps = SPIDER_WAVES * 4
    top = []
    for i in range(steps + 1):
        t = i / steps
        top.append((R_SPIDER_IN + (R_SPIDER_OUT - R_SPIDER_IN) * t,
                    Z_SPIDER + SPIDER_AMP * math.sin(2.0 * math.pi * SPIDER_WAVES * t)))
    thick = 0.0014
    profile = top + [(r, z - thick) for (r, z) in reversed(top)]
    profile.append(profile[0])
    spider = lathe("spider", profile, segments=SPIDER_SEG, material=textured_black())

    former = lathe("coil-former", [
        (0.0000,   Z_MOTOR_TOP - 0.0020),
        (R_FORMER, Z_MOTOR_TOP - 0.0020),
        (R_FORMER, cone_z(R_DUSTCAP) + 0.0010),
        (0.0000,   cone_z(R_DUSTCAP) + 0.0010),
    ], segments=SPIDER_SEG, material=matte_black())
    return [spider, former]


def build_surround():
    """Media caña de 32 mm, alta (19 mm), con los dos pies a ALTURAS DISTINTAS."""
    r_in, r_out = R_SURROUND_IN, R_FRAME_IN + 0.0002
    r_center = (r_in + r_out) / 2.0
    r_arc = (r_out - r_in) / 2.0
    steps = 16
    profile = []
    for i in range(steps + 1):
        t = i / steps
        a = math.pi * t
        profile.append((r_center - r_arc * math.cos(a),
                        Z_SURROUND_IN + (Z_SURROUND_OUT - Z_SURROUND_IN) * t
                        + SURROUND_H * math.sin(a)))
    obj = lathe("surround", profile, segments=SEG, material=rubber())
    apply_solidify(obj, 0.0022, offset=0.0)
    return obj


def build_cone():
    """Cono poco profundo (35 mm de caída sobre 48 mm de recorrido radial), con
    un cordón de costura cerca del surround."""
    steps = 8
    profile = [(R_SURROUND_IN + (R_DUSTCAP - R_SURROUND_IN) * (i / steps),
                Z_SURROUND_IN - CONE_DROP * ((i / steps) ** 1.10)) for i in range(steps + 1)]
    profile.reverse()
    cone = lathe("cone", profile, segments=SEG, material=graphite())
    apply_solidify(cone, 0.0025, offset=0.0)

    stitch = torus("cone-stitch", R_STITCH, 0.0017, major_segments=SEG, minor_segments=6,
                   location=(0.0, 0.0, cone_z(R_STITCH) + 0.0012), material=satin_black())
    return [cone, stitch]


def build_dustcap():
    """Tapa central casi plana, con un aro en el canto donde pega al cono."""
    z_base = cone_z(R_DUSTCAP)
    profile = [(r, z_base + z) for (r, z) in spherical_cap_profile(R_DUSTCAP, DUSTCAP_H, 8)]
    profile.reverse()
    cap = lathe("dust-cap", profile, segments=SEG, close=True, material=satin_black())
    rim = torus("dust-cap-rim", R_DUSTCAP, 0.0026, major_segments=SEG, minor_segments=6,
                location=(0.0, 0.0, z_base + 0.0010), material=rubber())
    return [cap, rim]


def build_motor():
    """
    Motor bajo una cubierta lisa y angosta (132 mm por 60 mm de alto), con dos
    cordones que la cruzan, y la placa trasera de aluminio en la base con el
    venteo del polo y seis barrenos. El perfil cierra solo en r = 0.
    """
    parts = []
    # La base lleva un rebaje de 1.5 mm donde asienta la placa trasera: así
    # la placa queda a ras de z = 0 sin una cara coplanar con la cubierta.
    profile = [
        (0.0000,           0.0015),
        (R_BACK + 0.0010,  0.0015),
        (R_BACK + 0.0030,  0.0000),
        (R_MOTOR - 0.0050, 0.0000),
        (R_MOTOR,          0.0050),
        (R_MOTOR,          Z_MOTOR_TOP - 0.0040),
        (R_MOTOR - 0.0040, Z_MOTOR_TOP),
        (0.0000,           Z_MOTOR_TOP),
    ]
    cover = lathe("motor-cover", profile, segments=SEG, material=matte_black())
    parts.append(cover)

    # tube() no queda centrado en `location` (ver _common.py): se le suma su
    # largo para que cada cordón quede centrado en z.
    band_h = 0.0040
    for i, z in enumerate((0.0150, 0.0440)):
        parts.append(tube("motor-band-%d" % (i + 1), R_MOTOR + 0.0016, R_MOTOR - 0.0010,
                          band_h, segments=SEG, location=(0.0, 0.0, z + band_h),
                          material=satin_black()))

    back = cylinder("back-plate", R_BACK, BACK_T, segments=SEG,
                    location=(0.0, 0.0, BACK_T / 2.0), material=brushed_alu())
    bevel(back, 0.0012, segments=2)
    cutters = [cylinder("pole-vent-cutter", R_POLE_VENT, 0.0400, segments=24,
                        location=(0.0, 0.0, BACK_T / 2.0))]
    for i in range(BACK_BOLT_COUNT):
        a = 2.0 * math.pi * i / BACK_BOLT_COUNT
        cutters.append(cylinder("back-bolt-cutter-%d" % (i + 1), R_BACK_BOLT, 0.0400,
                                segments=16,
                                location=(R_BACK_BOLT_RING * math.cos(a),
                                          R_BACK_BOLT_RING * math.sin(a), BACK_T / 2.0)))
    boolean(back, join_objects(cutters, "back-plate-cutters", prepare=False))
    parts.append(back)
    return parts


def build_terminal_block():
    """
    Bloque de terminales, de cara a la cámara y bajo una ventana de la canasta:
    una placa lisa sobre el collar —donde un producto real lleva su etiqueta;
    acá va sin texto ni logo— y, debajo, una regleta con cuatro postes en fila
    (dos bobinas). El aro de cada poste marca la polaridad: naranja y negro.
    Se arma sobre +X y se gira ANG_CAMARA: (r, y) es radial y tangencial.
    """
    parts = []
    ca, sa = math.cos(ANG_CAMARA), math.sin(ANG_CAMARA)

    def place(r, y, z):
        return (r * ca - y * sa, r * sa + y * ca, z)

    flat = (0.0, 0.0, ANG_CAMARA)
    radial = (0.0, math.pi / 2.0, ANG_CAMARA)     # eje del cilindro hacia afuera

    plate = box("label-plate", (0.0100, LABEL_W, LABEL_H),
                location=place(R_COLLAR + 0.0010, 0.0, Z_LABEL), rotation=flat,
                material=matte_black())
    bevel(plate, 0.0020, segments=3)
    parts.append(plate)
    inset = box("label-plate-inset", (0.0030, LABEL_W - 0.0120, LABEL_H - 0.0100),
                location=place(R_COLLAR + 0.0055, 0.0, Z_LABEL), rotation=flat,
                material=satin_black())
    bevel(inset, 0.0008, segments=2)
    parts.append(inset)

    strip_r = R_MOTOR + 0.0040
    strip = box("terminal-strip", (0.0140, TERM_COUNT * TERM_PITCH + 0.0060, 0.0170),
                location=place(strip_r, 0.0, Z_TERM), rotation=flat,
                material=matte_black())
    bevel(strip, 0.0015, segments=2)
    parts.append(strip)

    for i in range(TERM_COUNT):
        y = (i - (TERM_COUNT - 1) / 2.0) * TERM_PITCH
        post = cylinder("terminal-post-%d" % (i + 1), 0.0046, 0.0170, segments=24,
                        location=place(strip_r + 0.0125, y, Z_TERM), rotation=radial,
                        material=chrome())
        bevel(post, 0.0010, segments=2)
        parts.append(post)
        # Aro de polaridad: ancho y saliente, para que el color se vea desde
        # la pose de reposo y no solo de frente.
        # tube() ocupa de -1.5 a -0.5 de su largo respecto de `location`:
        # con el centro quedaba enterrado en la regleta. Así va de 1 mm adentro
        # de la cara de la regleta a 6 mm afuera.
        parts.append(tube("terminal-collar-%d" % (i + 1), 0.0082, 0.0044, 0.0070,
                          segments=24, location=place(strip_r + 0.0165, y, Z_TERM),
                          rotation=radial,
                          material=accent_orange() if i % 2 == 0 else satin_black()))
    return parts


def main():
    reset_scene()
    parts = [build_frame(), build_gasket(), build_basket_shoulder(), build_surround()]
    parts += build_cone()
    parts += build_dustcap()
    parts += build_arms()
    parts += build_spider()
    parts += build_motor()
    parts += build_terminal_block()

    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "subwoofer")
    # xy="keep": el bloque de terminales sobresale de un solo lado; centrar el
    # bbox correría el eje del driver.
    finalize(obj, ARCHIVO, front="top", xy="keep",
             expected_dims=(0.315, 0.315, 0.165), ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
