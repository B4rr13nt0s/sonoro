"""
Sonoro — categoría "kits de instalación" (install-kit), versión 3.
Bodegón de componentes agrupados sobre el piso, sin caja.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/install-kit.py

Parte de scripts/models3d/install-kit.py (v1), que generó el install-kit.glb
publicado: mismo inventario y misma fila de accesorios al frente, pero los
cables y el portafusible están rehechos (ver «Qué cambia»).

    área          ~0.30 (X) x 0.22 (Y), alto máximo ~0.03
    cable de poder 4 AWG rojo  (9 mm de diámetro), madeja de 4.2 vueltas
    cable de tierra 4 AWG negro, madeja de 4.2 vueltas
    cable de remoto 18 AWG azul (3.2 mm), madeja de 6.2 vueltas
    portafusible ANL 0.096 x 0.036 x ~0.027

Cinco reglas que el script hace cumplir por código, no a ojo:

1. NADA FLOTA NI SE APILA. Cada grupo se apoya plano en el piso con
   snap_group_to_floor(): su punto más bajo queda exactamente en z = 0.
2. NADA SE TOCA. audit_layout() mide la separación real en planta entre
   cada par de grupos (vértice a vértice) y avisa si baja de 6 mm.
3. LO QUE SE CONECTA, PENETRA. Ojos unidos al barril por lengüeta, fusible
   atornillado a los bornes, hebras de cobre metidas en el forro.
4. UN CABLE NO SE ATRAVIESA A SÍ MISMO. path_clearance() mide la distancia
   mínima entre tramos no vecinos de cada cable y el script falla si baja
   del diámetro.
5. UN CABLE NO SE QUIEBRA. Las colas salen de la madeja sin cambio brusco de
   dirección ni de curvatura, y bend_radii() exige que ningún tramo de cola
   doble con radio menor a BEND_MIN diámetros; si no, el script falla.

Rotaciones deterministas: semilla fija, y las llamadas al generador en el
mismo orden en cada corrida.

FRENTE: la fila de accesorios está en −Y, como la describe la v1. El modelo
publicado se mostraba sin giro y los accesorios quedaban al fondo, detrás de
los rollos; aquí `front="-Y"` los trae adelante.

Qué cambia respecto de la v1
----------------------------
  - CABLES. En la v1 eran espirales planas con aire entre vueltas, de sección
    gruesa y mate: se leían como mangueras o rollos de plastilina. Ahora:
      * cada cable es una MADEJA: las vueltas se apoyan unas en otras y van
        rotando alrededor del corte del aro, como un cable enrollado de
        fábrica, con un leve óvalo para que no parezca un toro perfecto;
      * las dos puntas SALEN de la madeja en una S larga, sin quiebres, y
        terminan pelado, con las hebras de cobre a la vista: es el rasgo que
        dice «cable» a cualquier tamaño;
      * calibres reales: el 4 AWG pasa de 11 a 9 mm y el de remoto de 5.2 a
        3.2 mm;
      * forro de PVC con brillo (rugosidad 0.34 en vez de 0.9).
  - PORTAFUSIBLE ANL rehecho: base negra de esquinas redondas, bornes con
    baño dorado (entrada de cable y tornillo prisionero), el fusible ANL
    (cuerpo blanco, cuchillas plateadas, tuercas) y tapa transparente.
    En la v1 era una caja ahumada con una laminilla de cobre.
  - Sin los dos terminales de bocina (los cubitos negros junto al rollo azul).
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1).
"""

import math
import os
import random
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

ARCHIVO = "install-kit-3"

SEED = 20260903
RNG = random.Random(SEED)
MIN_GAP = 0.0060

# Madejas: centro, radio del aro, radio del cable, vueltas completas y
# ángulos del aro (grados) donde salen las puntas. Colas: largo de la de
# arriba (el principio) y de la de abajo (el final), y cuánto avanza la de
# arriba a su altura antes de empezar a bajar. Las puntas se eligen hacia el
# espacio libre: nunca hacia otro grupo.
POWER = dict(center=(-0.0580, 0.0180), R=0.0560, wire_r=0.0045, full=4,
             theta0=140.0, theta1=205.0, tail_up=0.072, tail_down=0.048, delay=0.016)
GROUND = dict(center=(0.0700, 0.0560), R=0.0340, wire_r=0.0045, full=4,
              theta0=40.0, theta1=100.0, tail_up=0.072, tail_down=0.048, delay=0.016)
REMOTE = dict(center=(0.1200, -0.0280), R=0.0210, wire_r=0.0016, full=6,
              theta0=-60.0, theta1=5.0, tail_up=0.032, tail_down=0.020, delay=0.007)

# Radio de curvatura mínimo de las colas, en diámetros del cable.
BEND_MIN = 3.0


def jitter(deg=3.0):
    return math.radians(RNG.uniform(-deg, deg))


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


# --------------------------------------------------------- apoyo / audit ----

def snap_group_to_floor(objs, z=0.0):
    """Baja el grupo entero hasta que su punto más bajo quede en z."""
    bpy.context.view_layer.update()
    lo, _ = world_bounds(objs)
    for o in objs:
        o.data.transform(Matrix.Translation(Vector((0.0, 0.0, z - lo.z))))
        o.data.update()
    bpy.context.view_layer.update()
    return objs


def audit_layout(groups):
    """
    Separación real en planta entre cada par de grupos: la distancia mínima
    entre sus vértices proyectados al piso. (Antes comparaba cajas
    envolventes, y la caja de un rollo grande tapa medio bodegón: marcaba
    como pegados grupos que estaban a 2 cm.)
    """
    from mathutils.kdtree import KDTree
    print("\nauditoría de layout (separación XY entre grupos):")
    flat = {}
    for name, objs in groups.items():
        pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
        flat[name] = [Vector((p.x, p.y, 0.0)) for p in pts]
    names = list(groups.keys())
    ok = True
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            tree = KDTree(len(flat[b]))
            for k, p in enumerate(flat[b]):
                tree.insert(p, k)
            tree.balance()
            gap = min(tree.find(p)[2] for p in flat[a])
            flag = "  <-- REVISAR" if gap < MIN_GAP else ""
            ok = ok and not flag
            print("  %-16s %-16s %6.1f mm%s" % (a, b, gap * 1000, flag))
    print("  resultado: %s" % ("todo separado" if ok else "hay pares muy juntos"))
    for name, objs in groups.items():
        lo, _ = world_bounds(objs)
        if abs(lo.z) >= 1e-4:
            print("  %-16s z mínimo %.2f mm  <-- FLOTA / HUNDIDO" % (name, lo.z * 1000))


# ---------------------------------------------------------------- cables ----

def coil_path(center, R, wire_r, full, theta0, theta1, tail_up, tail_down, delay,
              splay=30.0, steps_per_turn=56):
    """
    Madeja de cable: `turns` vueltas alrededor de un aro de radio R, que se
    apoyan unas en otras sin atravesarse.

    En el corte del aro hay S = ceil(turns) PUESTOS repartidos en una elipse,
    y cada vuelta avanza un puesto. En un mismo ángulo del aro nunca hay más
    de S tramos de cable, así que cada uno cae en un puesto distinto, y dos
    puestos vecinos están separados por el diámetro del cable más 10 % de
    aire: esa ranura oscura es la que deja contar las vueltas.

    (Hasta el 30 de septiembre de 2026 los puestos se repartían entre
    `turns`, que no es entero: la primera y la última vuelta caían a 15° una
    de otra en el corte y se atravesaban, y las colas bajaban cruzando las
    vueltas de afuera. Era el «cable que se superpone a sí mismo».)

    La elipse es más ancha que alta (1.35 : 1): las vueltas se acuestan como
    un cable enrollado a mano sobre una mesa. La separación mínima la fija el
    eje corto, así que la cuenta vale igual.

    Puntas: `theta0` y `theta1` son los ángulos del aro donde salen; las
    vueltas son `full` + la fracción entre los dos. Los puestos de salida de
    las dos puntas quedan simétricos alrededor del punto MÁS DE AFUERA del
    corte: la del principio, arriba de ese punto, y la del final, abajo.
    Ningún tramo de la madeja queda más afuera que ellas, así que las colas
    se van hacia afuera sin cruzar nada. Ver `tail` para cómo salen.
    """
    turns = full + ((theta1 - theta0) % 360.0) / 360.0
    slots = math.ceil(turns)
    dpsi = 2.0 * math.pi / slots
    D = 2.0 * wire_r * 1.10
    rho = D / (2.0 * math.sin(math.pi / slots))
    rho_r = rho * 1.35
    zc = rho + wire_r                     # el puesto más bajo apoya en z = 0
    cx, cy = center
    th0 = math.radians(theta0)
    # corrimiento total del puesto entre la primera y la última punta, entre
    # -pi y pi; las puntas quedan en +w/2 y -w/2 del punto de afuera (psi = 0)
    sweep = (turns * dpsi + math.pi) % (2.0 * math.pi) - math.pi
    psi0 = -sweep / 2.0

    def at(t):
        th = th0 + 2.0 * math.pi * t
        psi = psi0 + dpsi * t
        # óvalo leve: depende solo del ángulo del aro, igual para todas las
        # vueltas, así que no cambia la separación entre ellas
        rr = R * (1.0 + 0.035 * math.sin(2.0 * th + 0.7)) + rho_r * math.cos(psi)
        return Vector((cx + rr * math.cos(th), cy + rr * math.sin(th),
                       zc + rho * math.sin(psi)))

    n = int(turns * steps_per_turn)
    coil = [at(turns * i / n) for i in range(n + 1)]

    def tail(t_end, sense, length, delay_):
        """
        Cola desde la punta de la madeja (t_end) hasta el piso. `sense` es +1
        si el recorrido sale hacia adelante (el final) y −1 si sale hacia
        atrás (el principio).

        Hasta el 30 de septiembre de 2026 la cola salía casi radial: el cable
        doblaba ~60° de golpe en el punto de salida y se veía un quiebre. Un
        cable de verdad no dobla así; la cola aquí es CONTINUA en dirección y
        en curvatura con la madeja:

          * en planta arranca con la tangente y la curvatura que trae la
            vuelta; esa curvatura se apaga en el primer quinto de la cola y,
            mientras, una curva suave en sentido contrario (una campana de
            curvatura, sin saltos) la abre `splay` grados hacia afuera. El
            cable se despega del rollo en una S larga, como cuando uno suelta
            la punta;
          * en alto se queda a la altura de su puesto durante `delay_` (lo
            que tarda en librar las vueltas de abajo) y después baja al piso
            con un perfil coseno, sin pendiente al empezar ni al terminar; los
            últimos milímetros van apoyados, para que la punta pelada quede
            en el piso.

        Los radios de curvatura que salen de aquí los mide y los exige
        `bend_radii` en build_cable.
        """
        h = 0.002
        p0, p1, p2 = at(t_end), at(t_end - sense * h), at(t_end - 2.0 * sense * h)
        heading = math.atan2(p0.y - p1.y, p0.x - p1.x)
        # curvatura con signo en planta, en el sentido en que se recorre
        a1, a2 = p1 - p2, p0 - p1
        a1.z = a2.z = 0.0
        chord = Vector((p0.x - p2.x, p0.y - p2.y, 0.0))
        k_coil = 2.0 * (a1.x * a2.y - a1.y * a2.x) / (a1.length * a2.length * chord.length)
        fade = 0.20 * length                  # la curvatura del rollo se apaga
        bell = 0.75 * length                  # campana de curvatura hacia afuera
        turn = -math.copysign(math.radians(splay), k_coil) - k_coil * fade / 2.0
        k_out = 2.0 * turn / bell             # integral de sin^2 en [0, bell] = bell/2
        flat = min(0.005, 0.15 * length)
        z0, z1 = p0.z, wire_r
        ds = 0.00025
        x, y = p0.x, p0.y
        pts = []
        steps = int(round(length / ds))
        every = max(1, int(round(0.0025 / ds)))
        for i in range(1, steps + 1):
            s = i * ds
            k = k_coil * (1.0 - smoothstep(0.0, fade, s))
            if s < bell:
                k += k_out * math.sin(math.pi * s / bell) ** 2
            heading += k * ds
            x += math.cos(heading) * ds
            y += math.sin(heading) * ds
            u = min(1.0, max(0.0, (s - delay_) / (length - delay_ - flat)))
            z = z0 + (z1 - z0) * 0.5 * (1.0 - math.cos(math.pi * u))
            if i % every == 0 or i == steps:
                pts.append(Vector((x, y, z)))
        return pts

    start = tail(0.0, -1.0, tail_up, delay)
    end = tail(turns, 1.0, tail_down, 0.0)
    return list(reversed(start)) + coil + end, len(start), len(end)


def bend_radii(path, first, last):
    """
    Radio de curvatura mínimo (3D) de las colas: de path[0] a path[first] y de
    path[last] al final, incluido el empalme con la madeja. Circunferencia
    por tres puntos consecutivos.
    """
    def radius(a, b, c):
        ab, bc, ac = (b - a).length, (c - b).length, (c - a).length
        cr = (b - a).cross(c - b).length
        return float("inf") if cr < 1e-12 else ab * bc * ac / (2.0 * cr)
    lo_a = min(radius(*path[i:i + 3]) for i in range(0, first + 2))
    lo_b = min(radius(*path[i:i + 3]) for i in range(last - 2, len(path) - 2))
    return lo_a, lo_b


def path_clearance(path, wire_r, step=0.001):
    """
    Distancia mínima entre dos tramos del MISMO cable que no son vecinos a lo
    largo del recorrido (más de 3 diámetros de arco entre ellos). Tiene que
    ser al menos el diámetro: si no, el cable se atraviesa a sí mismo.
    Se remuestrea a 1 mm para no saltarse un cruce entre muestras.
    """
    from mathutils.kdtree import KDTree
    pts, arcs = [path[0]], [0.0]
    for a, b in zip(path[:-1], path[1:]):
        seg = (b - a).length
        k = max(1, int(seg / step))
        for i in range(1, k + 1):
            pts.append(a.lerp(b, i / k))
            arcs.append(arcs[-1] + seg / k)
    tree = KDTree(len(pts))
    for i, p in enumerate(pts):
        tree.insert(p, i)
    tree.balance()
    min_arc = 3.0 * 2.0 * wire_r
    worst = float("inf")
    for i, p in enumerate(pts):
        for (_co, j, d) in tree.find_range(p, 2.0 * wire_r * 1.5):
            if abs(arcs[i] - arcs[j]) > min_arc and d < worst:
                worst = d
    return worst


def stripped_end(tag, tip, direction, wire_r):
    """
    Punta pelada: 7 hebras de cobre (una al centro y seis alrededor) que
    salen del forro. Arrancan 0.5 mm adentro, para que no quede junta.
    """
    d = direction.normalized()
    ref = Vector((0.0, 0.0, 1.0)) if abs(d.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    side = d.cross(ref).normalized()
    up = side.cross(d).normalized()
    rot = d.to_track_quat("Z", "Y").to_euler()
    core_r = wire_r * 0.62
    sr = core_r / 3.0
    length = max(0.0045, wire_r * 1.8)
    offsets = [(0.0, 0.0)] + [(2.0 * sr * math.cos(k * math.pi / 3.0),
                                2.0 * sr * math.sin(k * math.pi / 3.0)) for k in range(6)]
    parts = []
    for k, (a, b) in enumerate(offsets):
        c = tip + side * a + up * b + d * (length / 2.0 - 0.0005)
        parts.append(cylinder("%s-strand-%d" % (tag, k + 1), sr * 1.03, length, segments=8,
                              location=tuple(c), rotation=(rot.x, rot.y, rot.z),
                              material=copper()))
    return parts


def build_cable(name, material_, spec, sides=12, steps_per_turn=56):
    path, n_start, n_end = coil_path(
        spec["center"], spec["R"], spec["wire_r"], spec["full"],
        spec["theta0"], spec["theta1"], spec["tail_up"], spec["tail_down"],
        spec["delay"], splay=spec.get("splay", 30.0), steps_per_turn=steps_per_turn)
    gap = path_clearance(path, spec["wire_r"])
    need = 2.0 * spec["wire_r"]
    print("  %-14s separación mínima entre tramos: %.2f mm (diámetro %.2f mm)%s"
          % (name, gap * 1000, need * 1000, "" if gap >= need * 0.99 else "  <-- SE CRUZA"))
    if gap < need * 0.99:
        raise ModelError("%s: el cable se atraviesa a sí mismo (%.2f mm < %.2f mm)"
                         % (name, gap * 1000, need * 1000))
    r_up, r_down = bend_radii(path, n_start, len(path) - 1 - n_end)
    r_min = BEND_MIN * need
    print("  %-14s radio de curvatura de las colas: %.1f / %.1f mm (mínimo %.1f)%s"
          % (name, r_up * 1000, r_down * 1000, r_min * 1000,
             "" if min(r_up, r_down) >= r_min else "  <-- DOBLEZ"))
    if min(r_up, r_down) < r_min:
        raise ModelError("%s: una cola dobla con radio %.1f mm < %.1f mm"
                         % (name, min(r_up, r_down) * 1000, r_min * 1000))
    parts = [swept_tube(name, path, spec["wire_r"], sides=sides, material=material_)]
    parts += stripped_end(name + "-a", path[0], path[0] - path[1], spec["wire_r"])
    parts += stripped_end(name + "-b", path[-1], path[-1] - path[-2], spec["wire_r"])
    return snap_group_to_floor(parts)


# --------------------------------------------------------- portafusible -----

def rounded_slab(name, w, d, h, r, location, yaw=0.0, material=None, segs=6):
    """Losa de planta rectangular con esquinas redondeadas (radio r),
    centrada en XY y apoyada en location.z."""
    pts = []
    for (sx, sy, a0) in ((1, 1, 0.0), (-1, 1, 90.0), (-1, -1, 180.0), (1, -1, 270.0)):
        ccx, ccy = sx * (w / 2.0 - r), sy * (d / 2.0 - r)
        for k in range(segs + 1):
            a = math.radians(a0 + 90.0 * k / segs)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, 0.0)) for (x, y) in pts]
    top = [bm.verts.new((x, y, h)) for (x, y) in pts]
    n = len(pts)
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.transform(Matrix.Translation(Vector(location)) @ Matrix.Rotation(yaw, 4, "Z"))
    return _common._from_bmesh(name, bm, material)


def build_fuse_holder():
    """
    Portafusible ANL, en coordenadas locales (eje largo sobre X) y después
    girado y llevado a su lugar:

      base      96 x 36 x 10 mm, negra, esquinas de 6 mm
      bornes    dorados en cada punta: 12 x 26 x 14 mm, con la entrada del
                cable 4 AWG en la cara de afuera y un tornillo prisionero
                arriba; de cada borne sale hacia adentro una platina dorada
      fusible   ANL de 64 mm: cuerpo blanco al centro y cuchillas plateadas
                atornilladas sobre las platinas, con tuerca
      tapa      transparente, 72 x 30 x 17 mm, cubre el fusible
    """
    cx, cy = 0.0350, -0.0860
    yaw = math.radians(6.0) + jitter(2)
    M = Matrix.Translation(Vector((cx, cy, 0.0))) @ Matrix.Rotation(yaw, 4, "Z")

    def place(obj):
        obj.data.transform(M)
        obj.data.update()
        return obj

    parts = []
    base_h = 0.0100
    base = rounded_slab("fuse-holder-base", 0.0960, 0.0360, base_h, 0.0060, (0, 0, 0),
                        material=matte_black())
    bevel(base, 0.0015, segments=2)
    parts.append(place(base))

    for i, s in enumerate((-1.0, 1.0)):
        xb = s * 0.0420                         # centro del borne (x ±36..±48)
        blk = box("fuse-terminal-%d" % (i + 1), (0.0120, 0.0260, 0.0140),
                  location=(xb, 0.0, base_h + 0.0070), material=gold())
        bevel(blk, 0.0012, segments=2)
        parts.append(place(blk))
        # entrada del cable, en la cara de afuera
        parts.append(place(cylinder("fuse-terminal-entry-%d" % (i + 1), 0.0050, 0.0010,
                                    segments=24,
                                    location=(xb + s * 0.0058, 0.0, base_h + 0.0065),
                                    rotation=(0.0, math.pi / 2.0, 0.0), material=rubber())))
        # tornillo prisionero arriba, con su hexágono
        top = base_h + 0.0140
        parts.append(place(cylinder("fuse-terminal-screw-%d" % (i + 1), 0.0034, 0.0010,
                                    segments=24, location=(xb, 0.0, top + 0.0004),
                                    material=chrome())))
        parts.append(place(cylinder("fuse-terminal-hex-%d" % (i + 1), 0.0016, 0.0010,
                                    segments=6, location=(xb, 0.0, top + 0.0006),
                                    rotation=(0.0, 0.0, jitter(30)), material=rubber())))
        # platina dorada hacia adentro, bajo la cuchilla del fusible
        parts.append(place(box("fuse-bus-plate-%d" % (i + 1), (0.0140, 0.0180, 0.0012),
                               location=(s * 0.0300, 0.0, base_h + 0.0006), material=gold())))

    # fusible ANL
    z0 = base_h + 0.0012
    for i, s in enumerate((-1.0, 1.0)):
        blade = box("anl-blade-%d" % (i + 1), (0.0140, 0.0170, 0.0016),
                    location=(s * 0.0250, 0.0, z0 + 0.0008), material=brushed_alu())
        bevel(blade, 0.0004, segments=1)
        parts.append(place(blade))
        parts.append(place(cylinder("anl-nut-%d" % (i + 1), 0.0052, 0.0042, segments=6,
                                    location=(s * 0.0262, 0.0, z0 + 0.0016 + 0.0021),
                                    rotation=(0.0, 0.0, jitter(30)), material=chrome())))
    body = box("anl-body", (0.0360, 0.0140, 0.0100),
               location=(0.0, 0.0, z0 + 0.0050), material=white_plastic())
    bevel(body, 0.0015, segments=2)
    parts.append(place(body))

    lid = rounded_slab("fuse-holder-lid", 0.0720, 0.0300, 0.0170, 0.0050,
                       (0.0, 0.0, base_h), material=clear_plastic())
    bevel(lid, 0.0030, segments=3)
    parts.append(place(lid))
    return snap_group_to_floor(parts)


# ------------------------------------------------------------- accesorios ---

def build_ring_terminals():
    """6 terminales de ojo en abanico de ±14 grados apuntando al frente."""
    parts = []
    for i in range(6):
        yaw = math.radians(-90.0 + (i - 2.5) * 5.6) + jitter(1.5)
        ux, uy = math.cos(yaw), math.sin(yaw)
        ox = -0.1420 + i * 0.0140
        oy = -0.0820
        parts.append(cylinder("ring-terminal-barrel-%d" % (i + 1), 0.0032, 0.0130,
                              segments=16, location=(ox, oy, 0.0032),
                              rotation=(0.0, math.pi / 2.0, yaw), material=copper()))
        parts.append(box("ring-terminal-tab-%d" % (i + 1), (0.0060, 0.0055, 0.0014),
                         location=(ox + ux * 0.0080, oy + uy * 0.0080, 0.0016),
                         rotation=(0.0, 0.0, yaw), material=copper()))
        parts.append(torus("ring-terminal-eye-%d" % (i + 1), 0.0046, 0.0016,
                           major_segments=20, minor_segments=8,
                           location=(ox + ux * 0.0142, oy + uy * 0.0142, 0.0016),
                           rotation=(0.0, 0.0, yaw), material=copper()))
    return snap_group_to_floor(parts)


def build_banana_pair():
    """Par de conectores banana, apuntando al frente."""
    parts = []
    for i, (x, yaw_deg) in enumerate(((-0.0490, -84.0), (-0.0370, -96.0))):
        yaw = math.radians(yaw_deg) + jitter(2)
        y = -0.0920
        parts.append(cylinder("banana-plug-%d" % (i + 1), 0.0040, 0.0230, segments=16,
                              location=(x, y, 0.0040),
                              rotation=(0.0, math.pi / 2.0, yaw), material=chrome()))
        parts.append(cylinder("banana-plug-collar-%d" % (i + 1), 0.0054, 0.0080,
                              segments=16,
                              location=(x - math.cos(yaw) * 0.0125,
                                        y - math.sin(yaw) * 0.0125, 0.0040),
                              rotation=(0.0, math.pi / 2.0, yaw), material=satin_black()))
    return snap_group_to_floor(parts)


def main():
    reset_scene()
    groups = {
        "power-cable": build_cable("power-cable", cable_red(), POWER),
        "ground-cable": build_cable("ground-cable", cable_black(), GROUND, steps_per_turn=48),
        "remote-cable": build_cable("remote-cable", cable_blue(), REMOTE, sides=8,
                                    steps_per_turn=40),
        "fuse-holder": build_fuse_holder(),
        "ring-terminals": build_ring_terminals(),
        "banana-pair": build_banana_pair(),
    }
    audit_layout(groups)

    parts = [o for objs in groups.values() for o in objs]
    print("\npiezas: %d (semilla %d)" % (len(parts), SEED))
    discard_orphans(parts)
    obj = join_objects(parts, "install-kit")
    finalize(obj, ARCHIVO, front="-Y", ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
