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

speaker-6 (15 de noviembre de 2026): la parte de atrás, como la de la foto
--------------------------------------------------------------------------
Pedido del negocio, con una foto de la bocina vista de espaldas: «que esta
parte se asemeje lo mayor posible». Sigue sin logo, texto ni etiqueta.

  - CANASTA Y PESTAÑA EN UNA SOLA CHAPA, pintada de gris claro (`grey-paint`,
    material nuevo de la paleta: en la foto es chapa pintada, no metal a la
    vista, y en brushed-alu salía casi negra porque refleja el piso). Un solo
    perfil de revolución: asiento sobre el motor, pared cónica, pestaña bajo
    el marco y un borde doblado hacia atrás. El marco negro del frente no
    cambia (correcciones 1 a 3): la pestaña queda debajo, 1.7 mm más adentro.
  - VENTANAS de trapecio con las esquinas redondeadas, recortadas de la
    chapa (un boolean), y brazos anchos de 35°. Antes eran cuatro tablones
    entre dos aros, con las ventanas en ángulo vivo.
  - PESTAÑA con los ocho barrenos del marco y ocho ranuras entre ellos, como
    los agujeros de montaje de la foto. Las ranuras no atraviesan el marco:
    por ellas se ve su cara de abajo, negra.
  - MOTOR como el de la foto: una banda de acero bajo la canasta y, cubriendo
    el imán, la funda de goma con el hombro redondeado, un cordón y el labio
    de atrás; adentro del labio, la placa trasera. Es más ancho (83 mm, antes
    76). Antes: tres discos apilados.
  - TERMINAL sobre la pared de la canasta, al borde de la ventana que mira a
    la cámara: un bloque aislante con dos lengüetas, ancha y angosta, que
    salen perpendiculares a la chapa. Antes era una regleta al pie de la
    ventana, con un manguito naranja que la foto no tiene.

Lo que NO se tomó de la foto: la etiqueta y el relieve con la marca (son
marca); el cable del tweeter, que sale por el centro de la placa trasera y
acá esa cara es la que apoya en el piso; y las orejas del contorno de la
pestaña (corrección 1: el contorno es circular).

speaker-7 (15 de noviembre de 2026): el terminal, como es y donde va
--------------------------------------------------------------------
El terminal de speaker-6 estaba mal leído: un bloque blanco sobre un brazo,
con las lengüetas saliendo perpendiculares a la chapa. El negocio mandó dos
fotos de cerca. Es así:

  - una REGLETA aislante oscura, plana y vertical, atravesada al pie de la
    ventana y centrada en ella (no sobre un brazo);
  - sujeta por un REMACHE central, un ojal con el agujero cuadrado, a un
    soporte oscuro que sube desde el aro de abajo de la canasta;
  - dos LENGÜETAS de pala, la ancha a la izquierda y la angosta a la
    derecha: cada una con su pata remachada sobre la regleta y la pala
    colgando hacia el imán, paralela al eje, con su agujero.

Va en la ventana que mira a la cámara. Sale el bloque de white-plastic.
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

ARCHIVO = "speaker-7"

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
R_BOOT = 0.0415           # funda de goma del imán: 83 mm, 50 % del marco
R_BAND = 0.0400           # banda de acero entre la funda y la canasta
R_BACK = 0.0300           # placa trasera, adentro del labio de la funda
R_VENT = 0.0045
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
Z_BOOT_TOP = 0.0150       # la funda cubre los 15 mm de atrás del motor
Z_PLATE_TOP = 0.0255      # hasta acá llega la banda de acero; encima, la canasta

CHAMFER = 0.0012          # v1: 0.0007, invisible a tamaño de carrusel

# --- canasta estampada (m) ---------------------------------------------------
# La pared es un tronco de cono, del asiento sobre el motor a la pestaña.
# Todo se ubica sobre esa línea con un parámetro t de 0 (abajo) a 1.
WALL_BOT = (0.0465, 0.0280)
WALL_TOP = (0.0708, 0.0650)
WALL_T = 0.0016           # chapa estampada
Z_FLANGE_BOT = 0.0657     # cara de atrás de la pestaña
Z_FLANGE_TOP = 0.0671     # cara de adelante: queda 0.1 mm adentro del marco
R_FLANGE = 0.0808         # 1.7 mm más adentro que el marco
LIP_T = 0.0010            # borde doblado hacia atrás
Z_LIP = 0.0651
WINDOW_COUNT = 4
WINDOW_ARC = math.radians(55.0)  # los brazos quedan de 35°
WINDOW_T = (0.20, 0.80)          # la ventana ocupa el 60 % central de la pared
WINDOW_FILLET = 0.0060
SLOT = (0.0090, 0.0032)          # ranuras de la pestaña: largo x ancho

Z_SPIDER = 0.0345
R_SPIDER_OUT = 0.0505
SPIDER_WAVES = 4
SPIDER_AMP = 0.0015

# Hacia dónde mira la cámara del carrusel en la pose de reposo, medido desde
# +X hacia +Y de Blender (azimut 150° en el glTF). Los cuatro brazos van
# corridos 45° respecto de ese ángulo: frente a la cámara cae una VENTANA, por
# la que se ve la araña, y al pie de esa ventana va el terminal.
ANG_CAMARA = math.radians(60.0)


def wall(t, offset=0.0):
    """Punto (r, z) de la pared de la canasta en t, corrido `offset` hacia
    afuera (negativo: hacia adentro del cuenco)."""
    dr, dz = WALL_TOP[0] - WALL_BOT[0], WALL_TOP[1] - WALL_BOT[1]
    length = math.hypot(dr, dz)
    return (WALL_BOT[0] + dr * t + (dz / length) * offset,
            WALL_BOT[1] + dz * t - (dr / length) * offset)


def wall_frame():
    """Normal hacia afuera y dirección «pared arriba» de la canasta, en (r, z)."""
    dr, dz = WALL_TOP[0] - WALL_BOT[0], WALL_TOP[1] - WALL_BOT[1]
    length = math.hypot(dr, dz)
    return (dz / length, -dr / length), (dr / length, dz / length)


def rounded_polygon(points, radius, steps=5):
    """Polígono convexo (en sentido antihorario) con las esquinas redondeadas."""
    out = []
    n = len(points)
    for i in range(n):
        p = Vector(points[i] + (0.0,))
        d1 = (Vector(points[i - 1] + (0.0,)) - p).normalized()
        d2 = (Vector(points[(i + 1) % n] + (0.0,)) - p).normalized()
        half = d1.angle(d2) / 2.0
        reach = radius / math.tan(half)
        center = p + (d1 + d2).normalized() * (radius / math.sin(half))
        a = p + d1 * reach - center
        b = p + d2 * reach - center
        a0 = math.atan2(a.y, a.x)
        sweep = (math.atan2(b.y, b.x) - a0 + math.pi) % (2.0 * math.pi) - math.pi
        for k in range(steps + 1):
            ang = a0 + sweep * k / steps      # (Vector.slerp normaliza: no sirve)
            out.append((center.x + radius * math.cos(ang), center.y + radius * math.sin(ang)))
    return out


def prism(name, outline, origin, ex, ey, ez, back, front):
    """Prisma cerrado: el contorno 2D `outline`, puesto en el plano (ex, ey)
    que pasa por `origin`, extruido sobre ez de -back a +front. Cortador de
    las ventanas y de las ranuras."""
    origin, ex, ey, ez = (Vector(v) for v in (origin, ex, ey, ez))
    bm = bmesh.new()
    lo = [bm.verts.new(origin + ex * x + ey * y - ez * back) for (x, y) in outline]
    hi = [bm.verts.new(origin + ex * x + ey * y + ez * front) for (x, y) in outline]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _common._from_bmesh(name, bm, None)


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
    Canasta y pestaña en una sola chapa estampada y pintada de gris, como la
    de la foto: el asiento sobre el motor, la pared cónica, la pestaña que
    queda bajo el marco y un borde doblado hacia atrás. Las cuatro ventanas
    (trapecios de esquinas redondeadas), los ocho barrenos y las ocho ranuras
    de la pestaña se recortan con UN solo boolean.

    El marco negro del frente no cambia: la pestaña va debajo y 1.7 mm más
    adentro, así que de frente solo asoma como un filo claro bajo el canto.
    """
    (nr, nz), (vr, vz) = wall_frame()
    top_t = 1.0 + (Z_FLANGE_TOP - wall(1.0, -WALL_T)[1]) / (WALL_TOP[1] - WALL_BOT[1])
    profile = [
        (R_FORMER + 0.0010, Z_PLATE_TOP),               # asiento, cara de atrás
        (WALL_BOT[0] - 0.0022, Z_PLATE_TOP),
        (WALL_BOT[0] - 0.0006, Z_PLATE_TOP + 0.0008),   # canto del asiento
        WALL_BOT,                                       # pared, cara de atrás
        wall(0.07),         # un anillo cerca de cada doblez: el redondeo del
        wall(0.93),         # sombreado queda ahí y la pared sale recta
        WALL_TOP,
        (WALL_TOP[0] + 0.0014, Z_FLANGE_BOT),           # doblez hacia la pestaña
        (R_FLANGE - LIP_T, Z_FLANGE_BOT),
        (R_FLANGE - LIP_T, Z_LIP),                      # borde doblado
        (R_FLANGE, Z_LIP),
        (R_FLANGE, Z_FLANGE_TOP),
        wall(top_t, -WALL_T),                           # cara de adelante
        wall(0.93, -WALL_T),
        wall(0.07, -WALL_T),
        wall(0.0, -WALL_T),
        (R_FORMER + 0.0010, Z_PLATE_TOP + 0.0022),
    ]
    basket = lathe("basket", profile + [profile[0]], segments=SEG, material=grey_paint())

    cutters = []
    # ventanas: el contorno se dibuja en el plano tangente a la pared en el
    # centro de la ventana y se extruye sobre la normal
    t0, t1 = WINDOW_T
    length = math.hypot(WALL_TOP[0] - WALL_BOT[0], WALL_TOP[1] - WALL_BOT[1])
    r_mid = wall((t0 + t1) / 2.0)[0]
    half_v = (t1 - t0) * length / 2.0
    w0 = wall(t0)[0] * math.sin(WINDOW_ARC / 2.0)
    w1 = wall(t1)[0] * math.sin(WINDOW_ARC / 2.0)
    outline = rounded_polygon([(-w0, -half_v), (w0, -half_v), (w1, half_v), (-w1, half_v)],
                              WINDOW_FILLET)
    for i in range(WINDOW_COUNT):
        az = ANG_CAMARA + 2.0 * math.pi * i / WINDOW_COUNT
        ca, sa = math.cos(az), math.sin(az)
        rm, zm = wall((t0 + t1) / 2.0, -WALL_T / 2.0)
        cutters.append(prism("window-cutter-%d" % (i + 1), outline,
                             (rm * ca, rm * sa, zm),
                             (-sa, ca, 0.0),                     # tangencial
                             (vr * ca, vr * sa, vz),             # pared arriba
                             (nr * ca, nr * sa, nz),             # normal
                             back=0.0300, front=0.0120))
    # barrenos (los mismos ocho del marco) y ranuras entre ellos
    slot = rounded_polygon([(-SLOT[0] / 2.0, -SLOT[1] / 2.0), (SLOT[0] / 2.0, -SLOT[1] / 2.0),
                            (SLOT[0] / 2.0, SLOT[1] / 2.0), (-SLOT[0] / 2.0, SLOT[1] / 2.0)],
                           SLOT[1] / 2.0 - 0.0001, steps=4)
    for i in range(BOLT_COUNT):
        a = 2.0 * math.pi * i / BOLT_COUNT
        cutters.append(cylinder("flange-bore-cutter-%d" % (i + 1), R_BOLT, 0.0120,
                                segments=20,
                                location=(R_BOLT_RING * math.cos(a),
                                          R_BOLT_RING * math.sin(a), 0.0655)))
        a += math.pi / BOLT_COUNT
        ca, sa = math.cos(a), math.sin(a)
        cutters.append(prism("flange-slot-cutter-%d" % (i + 1), slot,
                             (R_BOLT_RING * ca, R_BOLT_RING * sa, 0.0655),
                             (-sa, ca, 0.0), (ca, sa, 0.0), (0.0, 0.0, 1.0),
                             back=0.0060, front=0.0060))
    boolean(basket, join_objects(cutters, "basket-cutters", prepare=False))
    return [basket]


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
    Motor como el de la foto, de atrás hacia adelante: la placa trasera,
    hundida 1.2 mm adentro del labio de la funda; la funda de goma que cubre
    el imán, con el hombro redondeado, un cordón moldeado y el labio de atrás
    (sobre el que apoya la bocina); y la banda de acero que queda a la vista
    entre la funda y el asiento de la canasta.
    """
    back = cylinder("back-plate", R_BACK + 0.0003, 0.0048, segments=SEG_MOTOR,
                    location=(0.0, 0.0, 0.0036), material=brushed_alu())
    cutters = [cylinder("vent-cutter", R_VENT, 0.0200, segments=20,
                        location=(0.0, 0.0, 0.0036))]
    for sx in (-1.0, 1.0):                       # dos barrenos ciegos de la placa
        cutters.append(cylinder("back-dimple-cutter", 0.0022, 0.0200, segments=12,
                                location=(sx * 0.0150, 0.0, 0.0036)))
    boolean(back, join_objects(cutters, "back-cutters", prepare=False))

    shoulder = 0.0040
    boot = [(R_BACK, 0.0), (R_BOOT - shoulder, 0.0)]
    for k in range(1, 6):                        # hombro redondeado
        a = math.radians(-90.0 + 90.0 * k / 5.0)
        boot.append((R_BOOT - shoulder + shoulder * math.cos(a),
                     shoulder + shoulder * math.sin(a)))
    boot += [
        (R_BOOT, 0.0116),
        (R_BOOT + 0.0007, 0.0122),               # cordón
        (R_BOOT + 0.0007, 0.0134),
        (R_BOOT, 0.0140),
        (R_BOOT, Z_BOOT_TOP + 0.0002),
        (R_BACK, Z_BOOT_TOP + 0.0002),
    ]
    boot_obj = lathe("magnet-boot", boot + [boot[0]], segments=SEG_MOTOR, material=rubber())

    band = cylinder("motor-band", R_BAND, Z_PLATE_TOP - Z_BOOT_TOP, segments=SEG_MOTOR,
                    location=(0.0, 0.0, (Z_PLATE_TOP + Z_BOOT_TOP) / 2.0),
                    material=brushed_alu())
    bevel(band, 0.0010, segments=2)
    return [back, boot_obj, band]


def build_terminals():
    """
    Terminal como el de las fotos: una regleta aislante oscura, plana y
    vertical, atravesada al pie de la ventana que mira a la cámara; un
    remache central (ojal con agujero cuadrado) que la sujeta a un soporte
    que sube desde el aro de abajo de la canasta; y dos lengüetas de pala, la ancha a la izquierda y la
    angosta a la derecha, con la pata sobre la regleta y la pala colgando
    hacia el imán, paralela al eje.

    Se arma en un marco local centrado en la regleta: a = radial hacia
    afuera (la cara que se ve), b = tangencial (hacia la derecha de quien
    mira desde afuera), c = hacia arriba.
    """
    ca, sa = math.cos(ANG_CAMARA), math.sin(ANG_CAMARA)
    r0 = wall(WINDOW_T[0])[0] + 0.0018          # justo por fuera del pie de la ventana
    z0 = wall(WINDOW_T[0])[1] + 0.0022
    M = Matrix((
        (ca, -sa, 0.0, r0 * ca),
        (sa, ca, 0.0, r0 * sa),
        (0.0, 0.0, 1.0, z0),
        (0.0, 0.0, 0.0, 1.0),
    ))

    def lay(obj):
        obj.data.transform(M)
        obj.data.update()
        return obj

    strip_t, strip_w, strip_h = 0.0015, 0.0300, 0.0100
    face = strip_t / 2.0
    strip = box("terminal-strip", (strip_t, strip_w, strip_h), material=matte_black())
    bevel(strip, 0.0005, segments=1)
    # el soporte: sube desde el aro de abajo, por detrás de la regleta, y
    # asoma por encima de ella. Oscuro, como en la foto: en gris se leía como
    # un bloque suelto.
    tab = box("terminal-tab", (0.0030, 0.0090, 0.0105),
              location=(-0.0020, 0.0, 0.0018), material=matte_black())
    parts = [lay(strip), lay(tab)]

    # remache central: ojal con el agujero cuadrado
    parts.append(lay(cylinder("terminal-eyelet", 0.0027, 0.0008, segments=16,
                              location=(face + 0.0004, 0.0, 0.0002),
                              rotation=(0.0, math.pi / 2.0, 0.0), material=chrome())))
    parts.append(lay(box("terminal-eyelet-hole", (0.0006, 0.0018, 0.0018),
                         location=(face + 0.0007, 0.0, 0.0002), material=rubber())))

    # lengüetas: pata remachada arriba y pala colgando por debajo de la regleta
    lug_t = 0.0009
    for name, b, pad_w, blade_w, blade_len, hole in (
            ("wide", -0.0098, 0.0078, 0.0063, 0.0090, (0.0022, 0.0026)),
            ("narrow", 0.0100, 0.0058, 0.0032, 0.0080, (0.0012, 0.0018))):
        a = face + lug_t / 2.0
        pad = box("lug-pad-%s" % name, (lug_t, pad_w, 0.0072),
                  location=(a, b, 0.0006), material=brushed_alu())
        bevel(pad, 0.0003, segments=1)
        parts.append(lay(pad))
        blade = box("lug-blade-%s" % name, (lug_t, blade_w, blade_len + 0.0030),
                    location=(a, b, -strip_h / 2.0 - blade_len / 2.0 + 0.0015),
                    material=brushed_alu())
        bevel(blade, 0.0003, segments=1)
        parts.append(lay(blade))
        parts.append(lay(box("lug-hole-%s" % name, (0.0004, hole[0], hole[1]),
                             location=(a + lug_t / 2.0, b, -strip_h / 2.0 - blade_len * 0.55),
                             material=rubber())))
        # el remache de la pata
        parts.append(lay(cylinder("lug-rivet-%s" % name, 0.0013, 0.0006, segments=10,
                                  location=(a + lug_t / 2.0 + 0.0002, b, 0.0022),
                                  rotation=(0.0, math.pi / 2.0, 0.0), material=chrome())))
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
