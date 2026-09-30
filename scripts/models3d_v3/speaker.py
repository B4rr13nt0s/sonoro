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

ARCHIVO = "speaker-3"

# 72 segmentos en las piezas grandes: con 96 el conjunto pasa de 30k
# triángulos. A 72 el paso angular es de 5 grados.
SEG = 72
SEG_TWEETER = 48          # el tweeter es chico pero se mira de cerca

# --- radios (m) --------------------------------------------------------------
R_OUTER = 0.0825          # 165 mm de diámetro
R_FRAME_IN = 0.0705       # plancha de 12.0 mm de ancho radial
R_SURROUND_IN = 0.0610    # arranque del cono; surround de 9.5 mm
R_NECK = 0.0180           # cuello del cono
R_MAGNET = 0.0425
R_PLATE = 0.0300
R_VENT = 0.0060
R_BOLT = 0.0028           # barreno pasante 5.6 mm
R_BOLT_RING = 0.0765      # centro exacto de la plancha: (0.0705 + 0.0825) / 2.
                          # No poner el círculo más afuera: el barreno queda
                          # tangente al chaflán exterior y la tangencia es
                          # justo lo que cuelga el solver EXACT.
BOLT_COUNT = 8            # 8 a 45 grados; i=0 queda a las 3 en punto

# --- tweeter de pastilla (m) -------------------------------------------------
R_TW_BODY = 0.0190        # cuerpo cilíndrico, más ancho que el cuello del cono
R_TW_RIM = 0.0182         # canto de la cara superior, tras el redondeo
R_TW_MESH = 0.0158        # malla hundida: bisel de solo 2.4 mm de ancho

Z_TW_BASE = 0.0215
Z_TW_RIM = 0.0390         # cara del bisel: 17.5 mm de alto
Z_TW_APEX = 0.0384        # ápice de la malla: 0.6 mm POR DEBAJO del bisel

# --- alturas (m) -------------------------------------------------------------
Z_FRAME_TOP = 0.0550      # cara del marco: el punto más alto de la pieza
FRAME_T = 0.0030
Z_FRAME_BOT = Z_FRAME_TOP - FRAME_T          # 0.0520

Z_SURROUND_IN = 0.0498    # talón interior (donde nace el cono)
Z_SURROUND_OUT = 0.0521   # talón exterior, metido bajo la pared del marco
SURROUND_H = 0.0034       # cresta ~1.1 mm bajo la cara del marco

Z_NECK = 0.0235
Z_PLATE_TOP = 0.0205
Z_MAGNET_TOP = 0.0170

CHAMFER = 0.0012          # v1: 0.0007, invisible a tamaño de carrusel


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
    """Cesta troncocónica de 3 mm, escondida tras la pared interior del marco."""
    t = 0.0030
    outer = [
        (R_FRAME_IN, Z_FRAME_BOT - 0.0002),
        (0.0660, 0.0472),
        (0.0580, 0.0432),
        (0.0490, 0.0382),
        (0.0405, 0.0322),
        (0.0345, 0.0268),
        (R_PLATE + 0.0020, Z_PLATE_TOP),
    ]
    profile = list(outer) + [(r, z - t) for (r, z) in reversed(outer)]
    profile.append(profile[0])
    return lathe("basket", profile, segments=SEG, material=matte_black())


def build_surround():
    """
    Media caña de caucho de 9.5 mm con los dos talones a ALTURAS DISTINTAS:
    esa asimetría es la que elimina el escalón entre marco y surround. La
    cresta queda ~1.1 mm por debajo de la cara del marco.
    """
    r_in, r_out = R_SURROUND_IN, R_FRAME_IN + 0.0002
    r_center = (r_in + r_out) / 2.0
    r_arc = (r_out - r_in) / 2.0
    steps = 16

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
    steps = 20
    drop = Z_SURROUND_IN - Z_NECK
    profile = [(R_SURROUND_IN + (R_NECK - R_SURROUND_IN) * (i / steps),
                Z_SURROUND_IN - drop * ((i / steps) ** 1.10)) for i in range(steps + 1)]
    obj = lathe("cone", profile, segments=SEG, material=textured_black())
    apply_solidify(obj, 0.0009, offset=-1.0)
    return obj


def build_tweeter():
    """
    Tweeter de pastilla: carcasa (cilindro recto -> redondeo del canto ->
    bisel anular -> hueco) y malla casi plana, HUNDIDA 0.6 mm bajo el bisel.
    El cuerpo (r 0.0190) es más ancho que el cuello del cono (r 0.0180) y
    arranca por debajo del final del cono: la carcasa atraviesa el cono.
    """
    parts = []
    housing = [
        (0.0000,     Z_TW_BASE),
        (0.0186,     Z_TW_BASE),           # base, con el desmoldeo
        (R_TW_BODY,  Z_TW_BASE + 0.0035),
        (R_TW_BODY,  Z_TW_RIM - 0.0012),   # pared VERTICAL
        (0.0188,     Z_TW_RIM - 0.0003),   # redondeo del canto
        (R_TW_RIM,   Z_TW_RIM),            # cara del bisel
        (R_TW_MESH,  Z_TW_RIM),            # canto interior del bisel
        (R_TW_MESH,  Z_TW_RIM - 0.0022),   # pared del hueco
        (0.0000,     Z_TW_RIM - 0.0026),   # fondo del hueco
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
    """Imán cerámico, placa superior y venteo central."""
    parts = []
    mag = cylinder("magnet", R_MAGNET, Z_MAGNET_TOP, segments=SEG,
                   location=(0.0, 0.0, Z_MAGNET_TOP / 2.0), material=matte_black())
    bevel(mag, 0.0020, segments=3)
    boolean(mag, cylinder("vent-cutter", R_VENT, 0.0800, segments=20,
                          location=(0.0, 0.0, Z_MAGNET_TOP / 2.0)))
    parts.append(mag)

    plate = cylinder("pole-plate", R_PLATE, Z_PLATE_TOP - Z_MAGNET_TOP, segments=SEG,
                     location=(0.0, 0.0, (Z_PLATE_TOP + Z_MAGNET_TOP) / 2.0),
                     material=matte_black())
    bevel(plate, 0.0012, segments=2)
    boolean(plate, cylinder("vent-cutter", R_VENT, 0.0800, segments=20,
                            location=(0.0, 0.0, (Z_PLATE_TOP + Z_MAGNET_TOP) / 2.0)))
    parts.append(plate)
    return parts


def build_terminals():
    """Dos terminales push de 8 x 5 mm, con polaridad, mordiendo la cesta."""
    parts = []
    z = 0.0300
    for i, (s, mat) in enumerate(((1.0, accent_orange()), (-1.0, matte_black()))):
        y = s * 0.0068
        body = box("terminal-%d" % (i + 1), (0.0080, 0.0050, 0.0060),
                   location=(0.0410, y, z), material=chrome())
        bevel(body, 0.0006, segments=2)
        parts.append(body)
        parts.append(box("terminal-tab-%d" % (i + 1), (0.0030, 0.0036, 0.0014),
                         location=(0.0454, y, z), material=mat))
    return parts


def main():
    reset_scene()
    parts = [build_frame(), build_basket(), build_surround(), build_cone()]
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
             expected_dims=(0.165, 0.165, 0.055), ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
