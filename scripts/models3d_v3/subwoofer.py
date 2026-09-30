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

ARCHIVO = "subwoofer-3"

SEG = 64

# --- marco (m) ---------------------------------------------------------------
R_FRAME_OUT = 0.1575        # 0.315 de diámetro
R_FRAME_IN = 0.1350         # plancha de 22.5 mm de ancho radial
FRAME_T = 0.0060
Z_FRAME_TOP = 0.1610        # cara del marco
Z_FRAME_BOT = Z_FRAME_TOP - FRAME_T          # 0.1550
CHAMFER = 0.0020            # v1: 0.0013

R_BOLT = 0.0040             # barreno pasante de 8 mm
R_BOLT_RING = 0.1463        # centro exacto de la plancha
BOLT_COUNT = 8

R_GASKET_OUT = 0.1418       # libra el borde interior del barreno (0.1423)
GASKET_T = 0.0025

# --- surround y cono (m) -----------------------------------------------------
SURROUND_W = 0.0320
SURROUND_H = 0.0110
R_SURROUND_IN = R_FRAME_IN - SURROUND_W      # 0.1030, arranque del cono
Z_SURROUND_IN = 0.1508
Z_SURROUND_OUT = 0.1552

CONE_DROP = 0.0350
R_DUSTCAP = 0.0550          # 110 mm de diámetro
DUSTCAP_H = 0.0150

# --- motor: boot acanalado (m) -----------------------------------------------
R_BOOT = 0.0900
Z_BOOT_TOP = 0.0700
R_HUB = 0.0700
RIB_COUNT = 10
RIB_H = 0.0485

# --- basket (m) --------------------------------------------------------------
ARM_COUNT = 6
ARM_W = 0.0300
ARM_T = 0.0130

# --- placa de terminales (m) -------------------------------------------------
# Sobre la pared del basket, que sube a 54.6° de la horizontal: normal
# exterior (0.8151, -0.5794) en (r, z), de ahí theta = 0.6180 rad.
PLATE_RY = 0.6180
PLATE_R = 0.1004
PLATE_Z = 0.1040
TERM_OFFSET = 0.0240


def spherical_cap_profile(radius_base, height, steps=8):
    sphere_r = (radius_base ** 2 + height ** 2) / (2.0 * height)
    a_max = math.asin(min(radius_base / sphere_r, 1.0))
    return [(sphere_r * math.sin(a_max * (1.0 - i / steps)),
             height - sphere_r * (1.0 - math.cos(a_max * (1.0 - i / steps))))
            for i in range(steps + 1)]


def build_frame():
    """Plancha por revolución de perfil cerrado + 8 barrenos con UN boolean."""
    profile = [
        (R_FRAME_IN,            Z_FRAME_BOT),
        (R_FRAME_IN,            Z_FRAME_TOP - CHAMFER),
        (R_FRAME_IN + CHAMFER,  Z_FRAME_TOP),
        (R_FRAME_OUT - CHAMFER, Z_FRAME_TOP),
        (R_FRAME_OUT,           Z_FRAME_TOP - CHAMFER),
        (R_FRAME_OUT,           Z_FRAME_BOT + CHAMFER),
        (R_FRAME_OUT - CHAMFER, Z_FRAME_BOT),
        (R_FRAME_IN,            Z_FRAME_BOT),
    ]
    frame = lathe("mount-frame", profile, segments=SEG, material=brushed_alu())
    cutters = []
    for i in range(BOLT_COUNT):
        a = 2.0 * math.pi * i / BOLT_COUNT
        cutters.append(cylinder("bore-cutter-%d" % (i + 1), R_BOLT, 0.0400, segments=20,
                                location=(R_BOLT_RING * math.cos(a),
                                          R_BOLT_RING * math.sin(a), Z_FRAME_TOP)))
    boolean(frame, join_objects(cutters, "bore-cutters", prepare=False))
    return frame


def build_gasket():
    return tube("gasket", R_GASKET_OUT, R_FRAME_IN, GASKET_T, segments=SEG,
                location=(0.0, 0.0, Z_FRAME_TOP + GASKET_T / 2.0 - 0.0004),
                material=rubber())


def build_basket_shoulder():
    """Repisa del basket bajo el surround: evita el anillo oscuro que aparece
    cuando el surround muere en el aire en vez de sobre material."""
    profile = [
        (0.1000,     Z_SURROUND_IN - 0.0005),
        (R_FRAME_IN, Z_SURROUND_OUT - 0.0005),
        (R_FRAME_IN, Z_SURROUND_OUT - 0.0055),
        (0.1250,     0.1470),
        (0.1000,     Z_SURROUND_IN - 0.0055),
        (0.1000,     Z_SURROUND_IN - 0.0005),
    ]
    return lathe("basket-shoulder", profile, segments=SEG, material=brushed_alu())


def _wall():
    """Línea de la pared del basket, de la repisa a la corona del boot."""
    r_out, z_out = R_FRAME_IN - 0.0100, Z_FRAME_BOT - 0.0060
    r_in, z_in = R_HUB - 0.0040, Z_BOOT_TOP - 0.0040
    dr, dz = r_out - r_in, z_out - z_in
    return r_out, z_out, r_in, z_in, math.hypot(dr, dz), -math.atan2(dz, dr)


def build_arms():
    """6 brazos radiales; las aberturas son el espacio entre ellos."""
    r_out, z_out, r_in, z_in, length, pitch = _wall()
    r_mid, z_mid = (r_out + r_in) / 2.0, (z_out + z_in) / 2.0
    parts = []

    def make(i, angle, pos):
        arm = box("basket-arm-%d" % (i + 1), (length, ARM_W, ARM_T),
                  location=(r_mid * math.cos(angle), r_mid * math.sin(angle), z_mid),
                  rotation=(0.0, pitch, angle), material=brushed_alu())
        bevel(arm, 0.0025, segments=3)
        return arm

    parts += radial_instances(make, ARM_COUNT, 0.0, origin=(0, 0, 0))
    parts.append(lathe("basket-hub", [
        (R_HUB - 0.0060, Z_BOOT_TOP - 0.0120),
        (R_HUB + 0.0060, Z_BOOT_TOP - 0.0120),
        (R_HUB + 0.0060, Z_BOOT_TOP + 0.0020),
        (R_HUB - 0.0060, Z_BOOT_TOP + 0.0020),
        (R_HUB - 0.0060, Z_BOOT_TOP - 0.0120),
    ], segments=SEG, material=brushed_alu()))
    return parts


def build_surround():
    """Media caña de 32 mm con los dos pies a ALTURAS DISTINTAS."""
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
    """Cono poco profundo: 35 mm de caída sobre 48 mm de recorrido radial."""
    steps = 8
    profile = [(R_SURROUND_IN + (R_DUSTCAP - R_SURROUND_IN) * (i / steps),
                Z_SURROUND_IN - CONE_DROP * ((i / steps) ** 1.10)) for i in range(steps + 1)]
    profile.reverse()
    obj = lathe("cone", profile, segments=SEG, material=textured_black())
    apply_solidify(obj, 0.0025, offset=0.0)
    return obj


def build_dustcap():
    z_base = Z_SURROUND_IN - CONE_DROP
    profile = [(r, z_base + z) for (r, z) in spherical_cap_profile(R_DUSTCAP, DUSTCAP_H, 12)]
    profile.reverse()
    return lathe("dust-cap", profile, segments=SEG, close=True, material=satin_black())


def build_motor_boot():
    """Boot sobre el motor: cilindro de 0.180 x 70 mm, hombro redondeado y 10
    nervios verticales. El perfil cierra solo en r = 0 arriba y abajo."""
    parts = []
    profile = [
        (0.0000, 0.0000),
        (0.0860, 0.0000),
        (R_BOOT, 0.0045),
        (R_BOOT, 0.0555),          # pared recta: es donde van los nervios
        (0.0885, 0.0625),          # hombro
        (0.0830, 0.0672),
        (R_HUB,  Z_BOOT_TOP),
        (0.0000, Z_BOOT_TOP),
    ]
    boot = lathe("motor-boot", profile, segments=SEG, material=matte_black())
    bevel(boot, 0.0025, segments=2)
    parts.append(boot)

    def rib(i, angle, pos):
        r = box("boot-rib-%d" % (i + 1), (0.0050, 0.0130, RIB_H),
                location=(R_BOOT * math.cos(angle), R_BOOT * math.sin(angle),
                          0.0060 + RIB_H / 2.0),
                rotation=(0.0, 0.0, angle), material=matte_black())
        bevel(r, 0.0015, segments=2)
        return r

    parts += radial_instances(rib, RIB_COUNT, 0.0, origin=(0, 0, 0))
    return parts


def build_terminal_plate():
    """Placa de terminales sobre la pared del basket, inclinada con ella, con
    dos terminales de resorte y el lazo de tinsel colgando entre ellos."""
    parts = []
    plate = box("terminal-plate", (0.0090, 0.0900, 0.0360),
                location=(PLATE_R, 0.0, PLATE_Z), rotation=(0.0, PLATE_RY, 0.0),
                material=matte_black())
    bevel(plate, 0.0015, segments=2)
    parts.append(plate)

    nr, nz = math.cos(PLATE_RY), -math.sin(PLATE_RY)
    for sign, mat, name in ((1.0, accent_orange(), "positive"),
                            (-1.0, brushed_alu(), "negative")):
        term = box("spring-terminal-%s" % name, (0.0070, 0.0180, 0.0160),
                   location=(PLATE_R + 0.0070 * nr, sign * TERM_OFFSET,
                             PLATE_Z + 0.0070 * nz),
                   rotation=(0.0, PLATE_RY, 0.0), material=mat)
        bevel(term, 0.0010, segments=2)
        parts.append(term)

    steps = 16
    path = []
    for i in range(steps + 1):
        t = i / steps
        sag = math.sin(math.pi * t)
        path.append((PLATE_R + 0.0040 * nr + 0.0030 * sag,
                     TERM_OFFSET * (1.0 - 2.0 * t),
                     PLATE_Z + 0.0040 * nz - 0.0090 - 0.0190 * sag))
    parts.append(swept_tube("tinsel-lead", path, 0.0022, sides=10,
                            material=accent_orange()))
    return parts


def main():
    reset_scene()
    parts = [build_frame(), build_gasket(), build_basket_shoulder(),
             build_surround(), build_cone(), build_dustcap()]
    parts += build_arms()
    parts += build_motor_boot()
    parts += build_terminal_plate()

    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "subwoofer")
    # xy="keep": la placa de terminales sobresale de un solo lado; centrar el
    # bbox correría el eje del driver.
    finalize(obj, ARCHIVO, front="top", xy="keep",
             expected_dims=(0.315, 0.315, 0.165), ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
