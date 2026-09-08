"""
Sonoro — categoría "bocinas" (speaker).
Coaxial de 6.5", sin caja acústica.

    blender --background --python scripts/models3d/speaker.py

Referencia de medidas (metros):
    marco exterior      0.165 diametro (incluye las 4 orejas de montaje)
    profundidad total   0.055 (base del iman -> cara superior del flange)
    corte del cono      0.147 diametro (borde exterior del surround)

Eje del driver = Z de Blender, iman abajo con la base en z = 0, cara del cono
hacia +Z. El exportador (+Y up) lo convierte a Y arriba en el glTF.
El cono y el surround son revoluciones explicitas de perfil (lathe), no conos
primitivos apilados: la silueta lateral es lo que hace que se lea como bocina.
"""

import importlib
import math
import os
import sys


def _locate_common():
    """
    Encuentra _common.py tanto headless (--python) como corriendo desde el
    Text Editor de Blender, donde __file__ puede llegar como ruta relativa.
    """
    cands = []
    try:
        import bpy
        cands.append(os.path.dirname(os.path.abspath(bpy.path.abspath(__file__))))
        for t in bpy.data.texts:
            if t.filepath:
                cands.append(os.path.dirname(
                    os.path.abspath(bpy.path.abspath(t.filepath))))
    except Exception:
        pass
    cands.append(os.path.dirname(os.path.abspath(__file__)))
    cands.append(os.getcwd())
    cands.append(os.path.join(os.getcwd(), "scripts", "models3d"))
    for d in cands:
        if d and os.path.isfile(os.path.join(d, "_common.py")):
            return d
    raise RuntimeError(
        "no encuentro _common.py. Agrega su carpeta a mano en la Python "
        "Console de Blender:\n"
        "    import sys; sys.path.append(r'C:\\ruta\\al\\repo\\scripts\\models3d')")


sys.path.insert(0, _locate_common())
import _common                                             # noqa: E402
importlib.reload(_common)   # Blender cachea los modulos entre corridas
from _common import *  # noqa: F401,F403,E402

SEG = 64          # segmentos de las revoluciones principales
SEG_SURROUND = 96  # el surround necesita mas: es la curva mas visible
SEG_SMALL = 32

R_FRAME_TABS = 0.0825     # radio exterior con orejas -> 165 mm de diametro
R_FLANGE = 0.0750         # radio del flange circular
R_CONE_CUT = 0.0735       # radio de corte del cono (borde exterior del surround)
R_SURROUND_IN = 0.0615    # borde interior del surround = arranque del cono
SURROUND_W = 0.0120       # ancho radial del surround
SURROUND_H = 0.0060       # altura (media caña)
Z_FLANGE_TOP = 0.0550
Z_SURROUND = Z_FLANGE_TOP - SURROUND_H   # base del arco del surround
CONE_DROP = 0.0280
R_DUSTCAP = 0.0200
DUSTCAP_H = 0.0080
R_MAGNET = 0.0425
H_MAGNET = 0.0180
R_VENT = 0.0060
R_TWEETER = 0.0100
TWEETER_H = 0.0060
R_POST = 0.0015
R_BOLT = 0.00225          # barreno pasante 4.5 mm
R_TAB_RING = 0.0720       # centro de las orejas


def spherical_cap_profile(radius_base, height, steps=8):
    """Perfil (r, z) de un casquete esferico, de la base al apex."""
    sphere_r = (radius_base ** 2 + height ** 2) / (2.0 * height)
    a_max = math.asin(min(radius_base / sphere_r, 1.0))
    out = []
    for i in range(steps + 1):
        a = a_max * (1.0 - i / steps)
        out.append((sphere_r * math.sin(a),
                    height - sphere_r * (1.0 - math.cos(a))))
    return out


def build_basket():
    """Marco estampado: perfil cerrado de 3 mm de pared, revolucionado."""
    t = 0.0030
    profile = [
        (R_SURROUND_IN, Z_FLANGE_TOP),
        (R_FLANGE, Z_FLANGE_TOP),
        (R_FLANGE, Z_FLANGE_TOP - t),
        (0.0700, 0.0490),
        (0.0570, 0.0375),
        (0.0430, 0.0270),
        (0.0330, 0.0205),
        (0.0300, 0.0180),
        (0.0300, 0.0150),
        (0.0300 - t, 0.0150),
        (0.0300 - t, 0.0190),
        (0.0320, 0.0230),
        (0.0420, 0.0300),
        (0.0550, 0.0405),
        (0.0672, 0.0508),
        (R_SURROUND_IN, Z_FLANGE_TOP - t),
    ]
    profile.append(profile[0])
    return lathe("basket-frame", profile, segments=SEG, material=matte_black())


def build_mount_tabs():
    """
    4 orejas a 90 grados, cada una con barreno pasante de 4.5 mm.
    Van sobre los ejes X e Y (phase = 0), no en diagonal: con las orejas a 45
    grados su aporte al ancho es R*cos(45)+r = 61 mm y el diametro exterior
    medido caia a 150 mm (el del flange). Sobre los ejes, el modelo mide los
    165 mm pedidos.
    """
    tabs = []

    def make(i, angle, pos):
        x, y, _ = pos
        z = Z_FLANGE_TOP - 0.0015
        tab = cylinder("mount-tab-%d" % (i + 1), 0.0105, 0.0030,
                       segments=SEG_SMALL, location=(x, y, z),
                       material=matte_black())
        apply_bevel(tab, 0.0008, segments=2)
        bore = cylinder("bore-cutter", R_BOLT, 0.0200, segments=24,
                        location=(x, y, z))
        boolean(tab, bore)
        return tab

    tabs += radial_instances(make, 4, R_TAB_RING, origin=(0, 0, 0), phase=0.0)
    return tabs


def build_surround():
    """
    Media caña de caucho, 12 x 6 mm: perfil de arco + modificador Screw con 96
    segmentos radiales. La version anterior tejia el arco con 10 pasos y 64
    segmentos y con auto-smooth a 30 grados el quiebre entre pasos se leia
    como un aro dentado; con el arco a 20 pasos ningun angulo entre tramos
    contiguos supera los 30 grados y la superficie sale continua.
    """
    r_arc = SURROUND_W / 2.0
    r_center = R_SURROUND_IN + r_arc
    z_base = Z_FLANGE_TOP - SURROUND_H
    steps = 20
    profile = [(R_SURROUND_IN - 0.0025, z_base - 0.0007)]      # talon interior
    for i in range(steps + 1):
        a = math.pi * i / steps                                # interior -> exterior
        profile.append((r_center - r_arc * math.cos(a),
                        z_base + SURROUND_H * math.sin(a)))
    profile.append((R_CONE_CUT + 0.0030, z_base - 0.0007))     # talon exterior
    return screw_revolve("surround", profile, segments=SEG_SURROUND,
                         material=rubber(), thickness=0.0011)


def build_cone():
    """Tronco-cono levemente concavo, 28 mm de caida, de surround a dust cap."""
    steps = 9
    profile = []
    for i in range(steps + 1):
        t = i / steps
        r = R_SURROUND_IN + (R_DUSTCAP - R_SURROUND_IN) * t
        z = Z_SURROUND - CONE_DROP * (t ** 1.18)   # concavidad hacia el centro
        profile.append((r, z))
    profile.reverse()                              # de abajo hacia arriba
    obj = lathe("cone", profile, segments=SEG, material=textured_black())
    apply_solidify(obj, 0.0012, offset=0.0)
    return obj


def build_dustcap():
    z_base = Z_SURROUND - CONE_DROP
    profile = [(r, z_base + z) for (r, z) in spherical_cap_profile(R_DUSTCAP, DUSTCAP_H, 8)]
    profile.reverse()
    return lathe("dust-cap", profile, segments=SEG, close=True,
                 material=matte_black())


def build_tweeter():
    """Cupula coaxial de 20 mm sobre un poste-puente de 3 mm anclado al cono."""
    parts = []
    z_cone_center = Z_SURROUND - CONE_DROP
    z_dome_base = z_cone_center + 0.0110

    parts.append(cylinder("tweeter-post", R_POST, 0.0230, segments=16,
                          location=(0, 0, z_cone_center + 0.0005),
                          material=brushed_alu()))
    parts.append(cylinder("tweeter-collar", 0.0105, 0.0018, segments=48,
                          location=(0, 0, z_dome_base + 0.0009),
                          material=brushed_alu()))
    dome = [(r, z_dome_base + 0.0018 + z)
            for (r, z) in spherical_cap_profile(R_TWEETER, TWEETER_H, 8)]
    dome.reverse()
    parts.append(lathe("tweeter-dome", dome, segments=48, close=True,
                       material=brushed_alu()))
    return parts


def build_magnet():
    mag = cylinder("magnet", R_MAGNET, H_MAGNET, segments=SEG,
                   location=(0, 0, H_MAGNET / 2.0), material=matte_black())
    apply_bevel(mag, 0.0015, segments=2)
    vent = cylinder("vent-cutter", R_VENT, H_MAGNET * 3, segments=24,
                    location=(0, 0, H_MAGNET / 2.0))
    boolean(mag, vent)
    return mag


def build_terminals():
    """Dos push terminals de 8 x 5 mm en el costado del basket."""
    parts = []
    z = 0.0300
    x = 0.0500
    parts.append(box("terminal-housing", (0.0060, 0.0220, 0.0130),
                     location=(x, 0.0, z), material=chrome()))
    apply_bevel(parts[-1], 0.0006, segments=1)
    for name, y, mat in (("terminal-positive", 0.0058, accent_orange()),
                         ("terminal-negative", -0.0058, matte_black())):
        tab = box(name, (0.0050, 0.0080, 0.0050),
                  location=(x + 0.0040, y, z), material=mat)
        apply_bevel(tab, 0.0004, segments=1)
        parts.append(tab)
    return parts


def main():
    reset_scene()
    parts = [build_basket(), build_surround(), build_cone(), build_dustcap(),
             build_magnet()]
    parts += build_mount_tabs()
    parts += build_tweeter()
    parts += build_terminals()

    obj = join_objects(parts, "speaker")
    # xy="keep": los terminales sobresalen de un solo lado, asi que centrar el
    # bbox correria el eje del driver y el tweeter dejaria de estar sobre el
    # eje del cono. El eje de construccion ya es (0, 0).
    finalize(obj, "speaker", expected_dims=(0.165, 0.165, 0.055), xy="keep")


if __name__ == "__main__":
    main()
