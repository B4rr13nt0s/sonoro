"""
Sonoro — categoría "subwoofers" (subwoofer).
12" de chasis desnudo, sin caja.

    blender --background --python scripts/models3d/subwoofer.py

Referencia de medidas (metros):
    marco exterior      0.315 diametro (incluye las 8 orejas de montaje)
    surround exterior   0.300 diametro
    profundidad total   0.165 (base del motor -> cara superior del flange)

Lo que lo distingue de speaker.py y hay que respetar en la silueta lateral:
surround de media caña profunda (32 x 22 mm), basket de aluminio con 6 brazos
radiales y aberturas triangulares entre ellos, cono poco profundo con dust cap
grande, y un motor trasero que se come la mitad de la profundidad total.
"""

import math
import os
import sys


def _locate_common():
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
from _common import *  # noqa: F401,F403,E402

SEG = 64
SEG_SMALL = 24

Z_TOP = 0.1650              # cara superior del flange
R_TABS = 0.1575             # radio exterior con orejas -> 0.315 de diametro
R_FLANGE = 0.1500           # radio exterior del flange / surround
SURROUND_W = 0.0320         # ancho radial del surround
SURROUND_H = 0.0220         # altura de la media caña
R_SURROUND_IN = R_FLANGE - SURROUND_W    # 0.118, arranque del cono
Z_SURROUND = Z_TOP - SURROUND_H          # base del arco

CONE_DROP = 0.0350
R_DUSTCAP = 0.0550          # 110 mm de diametro
DUSTCAP_H = 0.0150

# motor: iman + placa + iman + placa polar superior = 0.078 (~mitad de 0.165)
R_MAGNET = 0.0825           # 165 mm
H_MAGNET = 0.0300
R_PLATE = 0.0725            # 145 mm
H_PLATE = 0.0080
Z_MAG_1 = 0.0000
Z_PLATE = Z_MAG_1 + H_MAGNET
Z_MAG_2 = Z_PLATE + H_PLATE
Z_TOP_PLATE = Z_MAG_2 + H_MAGNET
H_TOP_PLATE = 0.0100
Z_MOTOR_TOP = Z_TOP_PLATE + H_TOP_PLATE  # 0.078

R_VENT = 0.0120
R_BOLT = 0.0028
R_TAB = 0.0130
R_TAB_RING = R_TABS - R_TAB

ARM_COUNT = 6
ARM_W = 0.0230
ARM_T = 0.0150
TRIM_H = 0.0040             # aro embellecedor, unico acento de color


def spherical_cap_profile(radius_base, height, steps=8):
    sphere_r = (radius_base ** 2 + height ** 2) / (2.0 * height)
    a_max = math.asin(min(radius_base / sphere_r, 1.0))
    return [(sphere_r * math.sin(a_max * (1.0 - i / steps)),
             height - sphere_r * (1.0 - math.cos(a_max * (1.0 - i / steps))))
            for i in range(steps + 1)]


def build_flange():
    """Aro superior fundido: asiento del surround y corona de las orejas."""
    t = 0.0060
    profile = [
        (R_SURROUND_IN, Z_TOP),
        (R_FLANGE, Z_TOP),
        (R_FLANGE, Z_TOP - t),
        (R_FLANGE - 0.0080, Z_TOP - t - 0.0040),
        (R_SURROUND_IN, Z_TOP - t - 0.0040),
        (R_SURROUND_IN, Z_TOP),
    ]
    return lathe("basket-flange", profile, segments=SEG, material=brushed_alu())


def build_trim_ring():
    """Aro embellecedor de 4 mm sobre el borde del basket."""
    return tube("trim-ring", R_FLANGE + 0.0006, R_FLANGE - 0.0040, TRIM_H,
                segments=SEG, location=(0, 0, Z_TOP - TRIM_H / 2.0 - 0.0002),
                material=accent_orange())


def build_arms():
    """
    6 brazos radiales gruesos del flange al motor. Las 6 aberturas
    triangulares son el espacio negativo entre brazos — no se cortan.
    """
    r_out, z_out = R_FLANGE - 0.0140, Z_TOP - 0.0150
    r_in, z_in = R_PLATE - 0.0040, Z_MOTOR_TOP - 0.0040
    dr, dz = r_out - r_in, z_out - z_in
    length = math.hypot(dr, dz)
    # rotacion sobre Y: +pitch lleva +X hacia -Z, asi que el extremo exterior
    # (que va ARRIBA, al flange) necesita el signo negativo.
    pitch = -math.atan2(dz, dr)
    r_mid, z_mid = (r_out + r_in) / 2.0, (z_out + z_in) / 2.0

    parts = []

    def make(i, angle, pos):
        arm = box("basket-arm-%d" % (i + 1),
                  (length, ARM_W, ARM_T),
                  location=(r_mid * math.cos(angle), r_mid * math.sin(angle), z_mid),
                  rotation=(0.0, pitch, angle),
                  material=brushed_alu())
        apply_bevel(arm, 0.0025, segments=2)
        return arm

    parts += radial_instances(make, ARM_COUNT, 0.0, origin=(0, 0, 0))

    # cubo inferior que amarra los brazos a la placa polar
    hub = lathe("basket-hub", [
        (R_PLATE - 0.0020, Z_MOTOR_TOP - 0.0140),
        (R_PLATE + 0.0040, Z_MOTOR_TOP - 0.0140),
        (R_PLATE + 0.0040, Z_MOTOR_TOP),
        (R_PLATE - 0.0020, Z_MOTOR_TOP),
        (R_PLATE - 0.0020, Z_MOTOR_TOP - 0.0140),
    ], segments=SEG, material=brushed_alu())
    parts.append(hub)
    return parts


def build_mount_tabs():
    """8 orejas con barreno pasante."""
    def make(i, angle, pos):
        x, y, _ = pos
        z = Z_TOP - 0.0030
        tab = cylinder("mount-tab-%d" % (i + 1), R_TAB, 0.0060,
                       segments=SEG_SMALL, location=(x, y, z),
                       material=brushed_alu())
        apply_bevel(tab, 0.0012, segments=2)
        bore = cylinder("bore-cutter", R_BOLT, 0.0400, segments=16,
                        location=(x, y, z))
        boolean(tab, bore)
        return tab

    return radial_instances(make, 8, R_TAB_RING, phase=math.pi / 8)


def build_surround():
    """Media caña profunda: 32 mm de ancho radial, 22 mm de alto."""
    r_arc = SURROUND_W / 2.0
    r_center = R_SURROUND_IN + r_arc
    steps = 14
    profile = [(r_center - r_arc * math.cos(math.pi * i / steps),
                Z_SURROUND + SURROUND_H * math.sin(math.pi * i / steps))
               for i in range(steps + 1)]
    obj = lathe("surround", profile, segments=SEG, material=rubber())
    apply_solidify(obj, 0.0022, offset=0.0)
    return obj


def build_cone():
    """Cono poco profundo: 35 mm de caida sobre 63 mm de recorrido radial."""
    steps = 8
    profile = []
    for i in range(steps + 1):
        t = i / steps
        profile.append((R_SURROUND_IN + (R_DUSTCAP - R_SURROUND_IN) * t,
                        Z_SURROUND - CONE_DROP * (t ** 1.10)))
    profile.reverse()
    obj = lathe("cone", profile, segments=SEG, material=textured_black())
    apply_solidify(obj, 0.0025, offset=0.0)
    return obj


def build_dustcap():
    z_base = Z_SURROUND - CONE_DROP
    profile = [(r, z_base + z)
               for (r, z) in spherical_cap_profile(R_DUSTCAP, DUSTCAP_H, 9)]
    profile.reverse()
    return lathe("dust-cap", profile, segments=SEG, close=True,
                 material=textured_black())


def build_motor():
    """
    Pila iman / placa / iman / placa polar. Domina la vista lateral.

    Un solo perfil cerrado revolucionado, con el barreno de venteo incluido en
    el perfil. Antes esto eran 4 cilindros unidos + un boolean para el venteo:
    el boolean EXACT sobre esa malla no-manifold se comia las piezas de arriba
    y dejaba un nucleo suelto en el centro.
    """
    profile = [
        (R_VENT, Z_MAG_1),
        (R_MAGNET, Z_MAG_1),
        (R_MAGNET, Z_PLATE),
        (R_PLATE, Z_PLATE),
        (R_PLATE, Z_MAG_2),
        (R_MAGNET, Z_MAG_2),
        (R_MAGNET, Z_TOP_PLATE),
        (R_PLATE, Z_TOP_PLATE),
        (R_PLATE, Z_MOTOR_TOP),
        (R_VENT, Z_MOTOR_TOP),
        (R_VENT, Z_MAG_1),
    ]
    stack = lathe("motor-stack", profile, segments=SEG, material=matte_black())
    apply_bevel(stack, 0.0018, segments=2)
    return [stack]


def build_binding_posts():
    """Binding posts de 14 mm sobre dos orejas salientes del basket."""
    parts = []
    z = Z_MOTOR_TOP + 0.0060          # a la altura del hub, fuera del cono
    for sign, ring_mat, name in ((1.0, accent_orange(), "positive"),
                                 (-1.0, matte_black(), "negative")):
        ear = box("terminal-ear-%s" % name, (0.0300, 0.0300, 0.0100),
                  location=(sign * (R_PLATE + 0.0110), 0.0, z),
                  material=brushed_alu())
        apply_bevel(ear, 0.0018, segments=2)
        parts.append(ear)

        x = sign * (R_PLATE + 0.0150)
        parts.append(tube("binding-post-ring-%s" % name, 0.0070, 0.0048, 0.0028,
                          segments=SEG_SMALL, location=(x, 0.0, z + 0.0064),
                          material=ring_mat))
        post = cylinder("binding-post-%s" % name, 0.0048, 0.0130,
                        segments=SEG_SMALL, location=(x, 0.0, z + 0.0115),
                        material=chrome())
        apply_bevel(post, 0.0008, segments=1)
        parts.append(post)
        parts.append(cylinder("binding-post-nut-%s" % name, 0.0062, 0.0034,
                              segments=6, location=(x, 0.0, z + 0.0155),
                              material=chrome()))
    return parts


def main():
    reset_scene()
    parts = [build_flange(), build_surround(), build_cone(), build_dustcap(),
             build_trim_ring()]
    parts += build_arms()
    parts += build_mount_tabs()
    parts += build_motor()
    parts += build_binding_posts()

    # diagnostico por pieza: una pieza en 0 triangulos delata un lathe degenerado
    print("\npiezas (triangulos):")
    for p in parts:
        print("  %-28s %6d" % (p.name, triangle_count(p)))

    # nada de objetos huerfanos: si un cutter sobrevivio a un modifier_apply
    # fallido, aparece aca y se borra antes de unir.
    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "subwoofer")
    finalize(obj, "subwoofer", expected_dims=(0.315, 0.315, 0.165))


if __name__ == "__main__":
    main()
