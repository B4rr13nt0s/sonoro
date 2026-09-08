"""
Sonoro — categoría "pantallas" (screen).
Receptor 2-DIN con pantalla tactil de cara completa y jaula metalica expuesta.

    blender --background --python scripts/models3d/screen.py

Referencia de medidas (metros):
    cara     0.178 (X) x 0.100 (Z) x 0.014 (grosor del bezel)
    activa   0.166 x 0.088, hundida 1.5 mm  -> bisel de 6 mm, edge to edge
    jaula    0.160 (X) x 0.092 (Z) x 0.150 (Y), brushed-alu, mas angosta
             que la cara por los 4 lados
    total Y  0.177 = bezel 0.014 + jaula 0.150 + conectores 0.013
             (el mazo de cable sale 0.040 mas y no cuenta en la cota)

Arquitectura tomada de las fotos: la losa de vidrio ES la cara del aparato,
pegada al chasis, sin brazo ni hueco de aire. La diferencia contra
head-unit.py es la proporcion: alla 1-DIN con perilla y LCD chico, aca 2-DIN
donde el vidrio se come toda la cara y no hay ningun control giratorio.

Icono de categoria: sin logos, sin texto, sin iconos de interfaz.
Frente hacia -Y, base en z = 0.
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

# --- cara / bezel
W = 0.1780
H = 0.1000
BEZEL_T = 0.0140
Y_FRONT = -0.0885
Y_FACE = Y_FRONT + 0.0002
Y_BEZEL_BACK = Y_FRONT + BEZEL_T        # -0.0745

# --- area activa (edge to edge, bisel de 6 mm)
ACT_W = 0.1660
ACT_H = 0.0880
ACT_SINK = 0.0015
Z_ACT_C = 0.0510                        # levemente arriba del centro

# --- franja tactil izquierda, dentro del vidrio
STRIP_W = 0.0150

# --- jaula
CG_W = 0.1600
CG_H = 0.0920
CG_D = 0.1500
Y_CG_BACK = Y_BEZEL_BACK + CG_D         # 0.0755
Z_CG_BOT = (H - CG_H) / 2.0             # 0.004
Z_CG_TOP = Z_CG_BOT + CG_H              # 0.096

SEG_ROUND = 28


def build_bezel():
    """Cara completa: losa de bezel con esquinas redondeadas y canto biselado."""
    bez = box("front-bezel", (W, BEZEL_T, H),
              location=(0.0, Y_FRONT + BEZEL_T / 2.0, H / 2.0),
              material=matte_black())
    apply_bevel(bez, 0.0045, segments=3)
    return [bez]


def build_glass():
    """
    Panel de vidrio hundido 1.5 mm, casi a sangre. Lleva un reborde continuo
    en relieve alrededor (una sola pieza, no 4 barras: las juntas de esquina
    se ven) para que la ventana se lea sobre el bezel negro.
    """
    parts = []
    fw = 0.0022
    proud = 0.0010

    relief = box("screen-relief", (ACT_W + 2 * fw, proud + 0.0022,
                                   ACT_H + 2 * fw),
                 location=(0.0, Y_FACE - proud / 2.0 + 0.0007, Z_ACT_C),
                 material=matte_black())
    apply_bevel(relief, 0.0007, segments=3)
    parts.append(relief)

    parts.append(box("screen-recess", (ACT_W + 0.0012, 0.0032, ACT_H + 0.0012),
                     location=(0.0, Y_FRONT + 0.0020, Z_ACT_C),
                     material=textured_black()))
    parts.append(box("screen-glass-panel", (ACT_W, 0.0018, ACT_H),
                     location=(0.0, Y_FACE - proud - 0.0002, Z_ACT_C),
                     material=screen_glass()))
    return parts


def build_touch_strip():
    """
    Columna tactil al canto izquierdo del vidrio: 4 marcas hundidas.
    Es geometria, no iconos — no lleva simbolos legibles.
    """
    parts = []
    x_strip = -ACT_W / 2.0 + STRIP_W / 2.0 + 0.0020
    y = Y_FACE - 0.0014
    for i in range(4):
        z = Z_ACT_C + (1.5 - i) * 0.0170
        mark = box("touch-mark-%d" % (i + 1), (0.0075, 0.0012, 0.0075),
                   location=(x_strip, y, z), material=textured_black())
        apply_bevel(mark, 0.0008, segments=2)
        parts.append(mark)
    return parts


def build_face_details():
    """Ventana de IR, microfono y punto indicador en la ceja inferior."""
    parts = []
    y = Y_FACE - 0.0008
    z = 0.0048
    parts.append(box("ir-window", (0.0090, 0.0014, 0.0024),
                     location=(-0.0700, y, z), material=textured_black()))
    parts.append(cylinder("mic-port", 0.0011, 0.0016, segments=12,
                          location=(0.0700, y, z),
                          rotation=(math.pi / 2.0, 0.0, 0.0),
                          material=textured_black()))
    parts.append(cylinder("power-indicator", 0.0013, 0.0014, segments=12,
                          location=(0.0000, y, z),
                          rotation=(math.pi / 2.0, 0.0, 0.0),
                          material=accent_orange()))

    rot = (math.pi / 2.0, 0.0, 0.0)
    parts.append(tube("reset-ring", 0.0022, 0.0012, 0.0016, segments=16,
                      location=(0.0820, y, 0.0510), rotation=rot,
                      material=textured_black()))
    return parts


def build_cage():
    """Jaula metalica expuesta, mas angosta que la cara por los 4 lados."""
    cage = box("chassis-cage", (CG_W, CG_D, CG_H),
               location=(0.0, Y_BEZEL_BACK + CG_D / 2.0, Z_CG_BOT + CG_H / 2.0),
               material=brushed_alu())
    apply_bevel(cage, 0.0018, segments=2)
    return [cage]


def build_side_rails():
    """
    Rieles de montaje laterales con ranuras, como los de la foto: dos flejes
    atornillados a los costados de la jaula.
    """
    parts = []
    for sx in (-1, 1):
        side = "l" if sx < 0 else "r"
        rail = box("mount-rail-%s" % side, (0.0016, CG_D - 0.0180, 0.0180),
                   location=(sx * (CG_W / 2.0 + 0.0008),
                             Y_BEZEL_BACK + CG_D / 2.0 + 0.0040,
                             Z_CG_BOT + CG_H - 0.0230),
                   material=brushed_alu())
        apply_bevel(rail, 0.0004, segments=1)
        parts.append(rail)

        for i in range(4):
            y = Y_BEZEL_BACK + 0.0280 + i * 0.0300
            if y > Y_CG_BACK - 0.0140:
                break
            parts.append(box("mount-rail-slot-%s-%d" % (side, i + 1),
                             (0.0012, 0.0130, 0.0040),
                             location=(sx * (CG_W / 2.0 + 0.0014), y,
                                       Z_CG_BOT + CG_H - 0.0230),
                             material=textured_black()))
    return parts


def build_louvers():
    """
    Celosias estampadas en tapa y costados. Ranuras hundidas 0.5 mm en vez de
    agujeros booleanos (misma decision que en amplifier.py y head-unit.py).
    """
    parts = []
    y0 = Y_BEZEL_BACK + 0.0190
    pitch = 0.0135

    for i in range(10):
        y = y0 + i * pitch
        if y > Y_CG_BACK - 0.0120:
            break
        for j, x in enumerate((-0.0470, -0.0155, 0.0155, 0.0470)):
            parts.append(box("louver-top-%02d-%d" % (i + 1, j + 1),
                             (0.0235, 0.0036, 0.0010),
                             location=(x, y, Z_CG_TOP - 0.0003),
                             material=textured_black()))
        for sx in (-1, 1):
            parts.append(box("louver-side-%s-%02d" % (
                "l" if sx < 0 else "r", i + 1),
                (0.0010, 0.0036, 0.0300),
                location=(sx * (CG_W / 2.0 - 0.0003), y, Z_CG_BOT + 0.0230),
                material=textured_black()))
    return parts


def _segment(name, p0, p1, radius, material_, segments=12):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    rot = d.to_track_quat("Z", "Y").to_euler()
    return cylinder(name, radius, d.length, segments=segments,
                    location=tuple((p0 + p1) / 2.0),
                    rotation=(rot.x, rot.y, rot.z), material=material_)


def build_rear():
    """ISO A/B, 6 RCA, antena DIN, USB tipo A de 12 x 5 mm y el mazo."""
    parts = []
    y = Y_CG_BACK
    rot_y = (math.pi / 2.0, 0.0, 0.0)

    iso = box("iso-connector", (0.0450, 0.0130, 0.0180),
              location=(-0.0430, y + 0.0065, 0.0700), material=matte_black())
    apply_bevel(iso, 0.0008, segments=1)
    parts.append(iso)

    for i in range(6):
        x = -0.0170 + (i % 3) * 0.0170
        z = 0.0400 if i < 3 else 0.0180
        parts.append(cylinder("preout-rca-%d" % (i + 1), 0.0044, 0.0110,
                              segments=SEG_ROUND,
                              location=(x, y + 0.0055, z),
                              rotation=rot_y, material=chrome()))
        parts.append(tube("preout-rca-ring-%d" % (i + 1), 0.0056, 0.0044, 0.0020,
                          segments=SEG_ROUND, location=(x, y + 0.0100, z),
                          rotation=rot_y,
                          material=accent_orange() if i % 2 == 0 else brushed_alu()))

    usb = box("usb-port", (0.0120, 0.0100, 0.0050),
              location=(0.0500, y + 0.0050, 0.0180), material=brushed_alu())
    apply_bevel(usb, 0.0006, segments=1)
    parts.append(usb)
    parts.append(box("usb-port-well", (0.0096, 0.0060, 0.0026),
                     location=(0.0500, y + 0.0072, 0.0180),
                     material=textured_black()))

    parts.append(cylinder("antenna-connector", 0.0058, 0.0130,
                          segments=SEG_ROUND,
                          location=(0.0620, y + 0.0065, 0.0430),
                          rotation=rot_y, material=chrome()))

    # el mazo no baja de z = 0.008: si cruzara el plano de base, center_on_base
    # levantaria todo el modelo y el origen dejaria de estar en la base.
    path = [(0.0430, y + 0.0020, 0.0640),
            (0.0430, y + 0.0180, 0.0620),
            (0.0430, y + 0.0320, 0.0520),
            (0.0430, y + 0.0400, 0.0350),
            (0.0430, y + 0.0410, 0.0180),
            (0.0430, y + 0.0400, 0.0080)]
    for i in range(len(path) - 1):
        parts.append(_segment("wire-harness-%02d" % (i + 1), path[i], path[i + 1],
                              0.0072, rubber(), segments=14))
    for i, p in enumerate(path[1:-1]):
        parts.append(sphere("wire-harness-joint-%02d" % (i + 1), 0.0072,
                            segments=14, rings=7, location=p, material=rubber()))
    parts.append(box("harness-boot", (0.0215, 0.0055, 0.0200),
                     location=(0.0430, y + 0.0028, 0.0640),
                     material=matte_black()))
    return parts


def main():
    reset_scene()
    parts = []
    parts += build_bezel()
    parts += build_glass()
    parts += build_touch_strip()
    parts += build_face_details()
    parts += build_cage()
    parts += build_side_rails()
    parts += build_louvers()
    parts += build_rear()

    print("\npiezas: %d" % len(parts))
    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "screen")
    finalize(obj, "screen", expected_dims=(0.178, None, 0.100))


if __name__ == "__main__":
    main()
