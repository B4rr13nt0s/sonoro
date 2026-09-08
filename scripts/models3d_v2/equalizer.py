"""
Sonoro — categoría "ecualizadores" (equalizer).
Ecualizador grafico de bajo tablero, media-DIN, chasis plano.

    blender --background --python scripts/models3d/equalizer.py

Referencia de medidas (metros):
    cuerpo    0.178 (X) x 0.085 (Y) x 0.030 (Z)   -> plancha baja
    bezel     0.190 x 0.036, placa frontal con orejas en los dos extremos
    controles 11 en fila ALINEADA A LA DERECHA sobre la cara frontal
    jacks     10 RCA de 0.009 mirando hacia ARRIBA, sobre el borde trasero
    total     0.036 de alto

Lo que se corrige respecto de la version anterior, mirando la foto de nuevo:
  - la hilera de controles NO esta centrada: arranca a media cara y se corre
    a la derecha; el tercio izquierdo de la cara frontal queda vacio, con
    solo dos barrenos chicos;
  - los controles son mas chicos de lo que supuse (bandas de 11 mm, no 14) y
    van muy juntos: 1.6 mm de luz;
  - el bezel frontal no baja hasta el piso: es una placa del alto del cuerpo
    con dos orejas que sobresalen a los costados, cada una con dos tornillos;
  - las perillas sobresalen de la cara y quedan al ras del canto inferior.

Icono de categoria: sin logos ni texto.
Frente hacia -Y, base en z = 0.
"""

import importlib
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
import _common                                             # noqa: E402
importlib.reload(_common)   # Blender cachea los modulos entre corridas
from _common import *  # noqa: F401,F403,E402

W = 0.1780
D = 0.0850
BODY_H = 0.0200                         # plancha mas delgada

BEZEL_T = 0.0035
BEZEL_H = 0.0260
EAR_W = 0.0060                          # oreja a cada costado

Z_BODY_BOT = 0.0030
Z_BODY_TOP = Z_BODY_BOT + BODY_H        # 0.023
Y_FRONT = -D / 2.0                      # -0.0425
Y_FACE = Y_FRONT - BEZEL_T              # -0.046
Y_BACK = D / 2.0                        # 0.0425

Z_CTRL = 0.0130                         # eje de la hilera

# (nombre, radio, cuanto sobresale). Bandas de 11 mm, dos grandes de 14 y el
# mini switch de dos posiciones, como en la foto.
CONTROLS = [
    ("sub-level", 0.0068, 0.0095),
    ("volume", 0.0068, 0.0095),
    ("source-switch", 0.0030, 0.0070),
    ("fader", 0.0055, 0.0088),
    ("band-50", 0.0055, 0.0088),
    ("band-125", 0.0055, 0.0088),
    ("band-315", 0.0055, 0.0088),
    ("band-750", 0.0055, 0.0088),
    ("band-2k2", 0.0055, 0.0088),
    ("band-6k", 0.0055, 0.0088),
    ("band-16k", 0.0055, 0.0088),
]
ROW_MARGIN = 0.0080                     # aire a cada canto de la cara

SEG_ROUND = 24


def control_positions():
    """
    Reparte los 11 controles a lo largo de TODA la cara frontal, con luz
    uniforme entre BORDES (no entre centros: con diametros distintos, el paso
    constante deja huecos desiguales) y margenes iguales a los dos cantos.
    """
    widths = [2 * r for (_, r, _) in CONTROLS]
    span = W - 2 * ROW_MARGIN
    gap = (span - sum(widths)) / (len(CONTROLS) - 1)
    x = -span / 2.0
    out = []
    for (name, r, out_len), w in zip(CONTROLS, widths):
        out.append((name, r, out_len, x + w / 2.0))
        x += w + gap
    return out, gap


def build_body():
    """Plancha principal, con la tapa marcada por una junta perimetral."""
    parts = []
    body = box("chassis", (W, D, BODY_H),
               location=(0.0, 0.0, Z_BODY_BOT + BODY_H / 2.0),
               material=matte_black())
    apply_bevel(body, 0.0012, segments=2)
    parts.append(body)

    # tapa superior: el bisel del cuerpo abre el canto de la cara de arriba y
    # desde esa vista se veia el interior. Esta chapa la cierra, dentro de la
    # envolvente actual (no cambia los 190 x 105 x 26 mm).
    #
    # Va HUNDIDA 0.4 mm, no a ras. A ras su cara superior quedaba EXACTAMENTE
    # coplanar con la cara de arriba del chasis, sobre un area de 188 x 103 mm:
    # z-fighting puro. Se veia como una costura diagonal (el corte de los dos
    # triangulos del quad) que aparecia y desaparecia segun el angulo de camara.
    # Hundirla deja al chasis como unica superficie visible arriba y a la tapa
    # cerrando el canto del bisel desde abajo, que es su unica funcion.
    cover = box("top-cover", (W - 0.0010, D - 0.0010, 0.0016),
                location=(0.0, 0.0, Z_BODY_TOP - 0.0012),
                material=matte_black())
    apply_bevel(cover, 0.0005, segments=1)
    parts.append(cover)
    parts.append(box("bottom-plate", (W - 0.0010, D - 0.0010, 0.0016),
                     location=(0.0, 0.0, Z_BODY_BOT + 0.0008),
                     material=textured_black()))

    # junta de la tapa: banda hundida que recorre los costados y la trasera
    for name, size, loc in (
        ("chassis-seam-left", (0.0012, D - 0.0060, 0.0016),
         (-W / 2.0 + 0.0002, 0.0, Z_BODY_TOP - 0.0075)),
        ("chassis-seam-right", (0.0012, D - 0.0060, 0.0016),
         (W / 2.0 - 0.0002, 0.0, Z_BODY_TOP - 0.0075)),
    ):
        parts.append(box(name, size, location=loc, material=textured_black()))
    return parts


def build_bezel():
    """Placa frontal del alto del cuerpo, con oreja y dos tornillos por lado."""
    parts = []
    bezel = box("front-bezel", (W + 2 * EAR_W, BEZEL_T, BEZEL_H),
                location=(0.0, Y_FRONT - BEZEL_T / 2.0, BEZEL_H / 2.0),
                material=matte_black())
    apply_bevel(bezel, 0.0010, segments=2)
    parts.append(bezel)

    # cuatro tornillos en las esquinas de la CARA frontal: mismo retiro (7.5 mm)
    # respecto del canto vertical y del horizontal mas cercanos
    inset = 0.0035
    face_half_w = W / 2.0 + EAR_W
    for i, sx in enumerate((-1, 1)):
        for j, z in enumerate((inset, BEZEL_H - inset)):
            parts.append(cylinder("bezel-screw-%d-%d" % (i + 1, j + 1),
                                  0.0020, 0.0016, segments=SEG_ROUND,
                                  location=(sx * (face_half_w - inset),
                                            Y_FACE + 0.0003, z),
                                  rotation=(math.pi / 2.0, 0.0, 0.0),
                                  material=brushed_alu()))

    # dos barrenos chicos, uno a cada canto de la cara
    for j, x in enumerate((-0.0855, 0.0855)):
        parts.append(cylinder("face-bore-%d" % (j + 1), 0.0018, 0.0022,
                              segments=14,
                              location=(x, Y_FACE + 0.0006, Z_CTRL),
                              rotation=(math.pi / 2.0, 0.0, 0.0),
                              material=textured_black()))
    return parts


def build_control_row():
    """
    Hilera de controles repartida en toda la cara. Cada perilla: nido hundido,
    cuerpo troncoconico y punto indicador girado distinto.
    """
    parts = []
    positions, gap = control_positions()
    rot = (math.pi / 2.0, 0.0, 0.0)

    for i, (name, r, out_len, x) in enumerate(positions):
        parts.append(cylinder("control-well-%s" % name, r + 0.0007, 0.0016,
                              segments=SEG_ROUND,
                              location=(x, Y_FACE + 0.0007, Z_CTRL),
                              rotation=rot, material=textured_black()))

        if name == "source-switch":
            lever = box("switch-lever", (0.0034, out_len, 0.0080),
                        location=(x, Y_FACE - out_len / 2.0 + 0.0003,
                                  Z_CTRL + 0.0016),
                        material=matte_black())
            apply_bevel(lever, 0.0005, segments=2)
            parts.append(lever)
            continue

        knob = cone("knob-%s" % name, r, r - 0.0007, out_len,
                    segments=SEG_ROUND,
                    location=(x, Y_FACE - out_len / 2.0 + 0.0003, Z_CTRL),
                    rotation=(-math.pi / 2.0, 0.0, 0.0),
                    material=matte_black())
        apply_bevel(knob, 0.0005, segments=2)
        parts.append(knob)

        ang = math.radians((-130.0 + i * 29.0) % 360.0)
        dot_mat = accent_orange() if name == "sub-level" else brushed_alu()
        parts.append(cylinder("knob-dot-%s" % name, 0.0007, 0.0012, segments=8,
                              location=(x + (r - 0.0022) * math.sin(ang),
                                        Y_FACE - out_len - 0.0002,
                                        Z_CTRL + (r - 0.0022) * math.cos(ang)),
                              rotation=rot, material=dot_mat))
    return parts, gap


def build_rear_jacks():
    """
    10 RCA y la bornera, en la CARA TRASERA (la tapa queda limpia: no lleva
    nada arriba).
    """
    parts = []
    rot = (math.pi / 2.0, 0.0, 0.0)
    z = Z_BODY_BOT + BODY_H / 2.0
    pitch = 0.0125
    x0 = -0.0790
    for i in range(10):
        x = x0 + i * pitch
        parts.append(cylinder("rear-jack-%d" % (i + 1), 0.0042, 0.0062,
                              segments=SEG_ROUND,
                              location=(x, Y_BACK + 0.0031, z),
                              rotation=rot, material=chrome()))
        parts.append(tube("rear-jack-ring-%d" % (i + 1), 0.0054, 0.0042, 0.0014,
                          segments=SEG_ROUND,
                          location=(x, Y_BACK + 0.0055, z),
                          rotation=rot,
                          material=accent_orange() if i % 2 == 0 else brushed_alu()))
        parts.append(cylinder("rear-jack-pin-%d" % (i + 1), 0.0011, 0.0034,
                              segments=10,
                              location=(x, Y_BACK + 0.0028, z),
                              rotation=rot, material=chrome()))

    blk = box("power-terminal-block", (0.0260, 0.0055, 0.0110),
              location=(0.0640, Y_BACK + 0.0027, z), material=textured_black())
    apply_bevel(blk, 0.0006, segments=1)
    parts.append(blk)
    for i in range(3):
        parts.append(cylinder("power-terminal-screw-%d" % (i + 1), 0.0026, 0.0020,
                              segments=6,
                              location=(0.0560 + i * 0.0080, Y_BACK + 0.0056, z),
                              rotation=rot, material=chrome()))
    return parts


def build_side_bores():
    """Dos barrenos de montaje en cada costado del cuerpo."""
    parts = []
    for i, sx in enumerate((-1, 1)):
        for j, y in enumerate((-0.0180, 0.0060)):
            parts.append(cylinder("side-bore-%d-%d" % (i + 1, j + 1),
                                  0.0021, 0.0024, segments=12,
                                  location=(sx * (W / 2.0 - 0.0002), y,
                                            Z_BODY_BOT + 0.0065),
                                  rotation=(0.0, math.pi / 2.0, 0.0),
                                  material=textured_black()))
    return parts


def main():
    reset_scene()
    parts = []
    parts += build_body()
    parts += build_bezel()
    row, gap = build_control_row()
    parts += row
    parts += build_rear_jacks()
    parts += build_side_bores()

    positions, _ = control_positions()
    print("\nhilera: %d controles repartidos en toda la cara" % len(CONTROLS))
    print("  luz uniforme entre bordes : %.1f mm" % (gap * 1000))
    print("  primer / ultimo canto     : %+.1f / %+.1f mm (cara %.0f mm)"
          % ((positions[0][3] - positions[0][1]) * 1000,
             (positions[-1][3] + positions[-1][1]) * 1000, W * 1000))
    print("  alto total                : %.1f mm" % (BEZEL_H * 1000))
    print("  tapa superior             : sin nada montado")
    print("piezas: %d" % len(parts))

    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "equalizer")
    # El basename lleva version porque /models/* se sirve con
    # Cache-Control: immutable — ver CLAUDE.md § Modelos 3D.
    finalize(obj, "equalizer-2", expected_dims=(None, None, None))


if __name__ == "__main__":
    main()
