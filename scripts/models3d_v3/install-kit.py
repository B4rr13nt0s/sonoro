"""
Sonoro — categoría "kits de instalación" (install-kit), versión 3.
Bodegón de componentes agrupados sobre el piso, sin caja.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/install-kit.py

Parte de scripts/models3d/install-kit.py (v1), que generó el install-kit.glb
publicado: mismo inventario y misma fila de accesorios al frente, pero los
cables y el portafusible están rehechos (ver «Qué cambia»).

    área          ~0.30 (X) x 0.22 (Y), alto máximo ~0.03
    cable de poder 4 AWG rojo  (9 mm de diámetro), madeja de 5.2 vueltas
                   (3 en el piso y 2.2 encima)
    cable de tierra 4 AWG negro, madeja de 3.4 vueltas (2 y 1.4)
    cable de remoto 18 AWG azul (3.2 mm), madeja de 6.2 vueltas (4 y 2.2)
    portafusible ANL 0.096 x 0.036 x ~0.027

Cinco reglas que el script hace cumplir por código, no a ojo:

1. NADA FLOTA NI SE APILA. Cada grupo se apoya plano en el piso con
   snap_group_to_floor(): su punto más bajo queda exactamente en z = 0. Y
   dentro de cada cable, support_gap() mide cuánto aire queda debajo de cada
   tramo (hasta el piso o hasta el cable en el que se apoya) y el script
   falla si pasa de SUPPORT_MAX diámetros.
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
      * cada cable es una MADEJA: las vueltas se apoyan unas en otras, con
        un leve óvalo para que no parezca un toro perfecto (cómo se apilan
        cambió en install-kit-4, ver abajo);
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

Qué cambia en install-kit-4 (noviembre de 2026)
-----------------------------------------------
Pedido del negocio: «que las secciones de los cables que están flotando
dejen de flotar», y pulir el resto.

  - MADEJAS EN DOS CAPAS, TODAS APOYADAS. En install-kit-3 las vueltas iban
    rotando alrededor de un hueco (cinco puestos en una elipse): las de
    arriba no descansaban en nada, y las dos puntas salían de la madeja a
    media altura y bajaban en el aire a lo largo de 5 cm. Ahora cada cable
    es una espiral plana en el piso con las vueltas restantes montadas
    encima, y las dos puntas salen por el piso. Ver coil_path(). La altura
    de la capa de arriba se calcula apoyándola sobre la de abajo, y
    support_gap() lo exige (regla 1).
  - El cable de poder pasa de 4.2 a 5.2 vueltas y el de tierra de 4.2 a
    3.4: en dos capas, la madeja de tierra no admite más sin que su vuelta
    de adentro doble demasiado cerrada. El de remoto sigue en 6.2.
  - Las puntas del cable de tierra se giraron hacia el espacio libre (antes
    las dos salían hacia atrás).
  - TERMINALES DE OJO: ojo y lengüeta planos, de chapa, apoyados en el piso
    (el ojo era un toro y la lengüeta quedaba 0.9 mm en el aire), y la boca
    del barril.
  - CONECTORES BANANA rehechos: cuerpo rojo y negro, collar y espiga
    cromados, inclinados hasta apoyar la punta. Eran un cilindro cromado con
    tapa negra, sin espiga, 1.4 mm en el aire.
  - No cambian el portafusible, el inventario ni la fila de accesorios al
    frente.
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

ARCHIVO = "install-kit-4"

SEED = 20260903
RNG = random.Random(SEED)
MIN_GAP = 0.0060

# Madejas: centro, radio de la vuelta de afuera de la capa del piso (R), radio
# del cable, vueltas de la capa del piso (bottom, entero) y de la de arriba
# (top), ángulo del aro (grados) donde entra la punta A y largo de las dos
# colas. La punta B sale en theta0 + 360 x la fracción de `top`. Las puntas se
# eligen hacia el espacio libre: nunca hacia otro grupo.
POWER = dict(center=(-0.0580, 0.0180), R=0.0660, wire_r=0.0045, bottom=3, top=2.22,
             theta0=125.0, tail_a=0.058, tail_b=0.048)
GROUND = dict(center=(0.0740, 0.0560), R=0.0440, wire_r=0.0045, bottom=2, top=1.36,
              theta0=80.0, tail_a=0.050, tail_b=0.048)
REMOTE = dict(center=(0.1200, -0.0280), R=0.0265, wire_r=0.0016, bottom=4, top=2.18,
              theta0=-60.0, tail_a=0.030, tail_b=0.020)

# Separación entre dos vueltas vecinas de la capa del piso y distancia entre
# un cable y el que lo sostiene, las dos en diámetros. La primera deja la
# ranura oscura que permite contar las vueltas; la segunda es contacto, con
# el margen justo para que la malla (12 lados, tramos rectos) no se muerda.
PITCH = 1.07
REST = 1.04

# Un tramo está APOYADO si entre él y el piso, o el cable que tiene debajo,
# queda menos de esto (en diámetros). Si no, el script falla.
SUPPORT_MAX = 0.12

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

def coil_path(center, R, wire_r, bottom, top, theta0, tail_a, tail_b,
              splay=30.0, steps_per_turn=56):
    """
    Madeja de cable EN DOS CAPAS, como queda un cable enrollado a mano sobre
    una mesa. Todo el recorrido está apoyado: en el piso, o sobre el cable que
    tiene debajo.

      punta A   en el piso; entra por afuera, tangente a la primera vuelta
      piso      `bottom` vueltas en espiral plana hacia adentro, una pegada a
                la otra (PITCH diámetros entre centros)
      arriba    `top` vueltas: el cable sube por el costado de adentro de la
                espiral, la cruza en diagonal hacia afuera montado sobre las
                vueltas del piso (se acuesta en las ranuras y pasa por encima
                de cada vuelta) y baja al piso por el costado de afuera
      punta B   en el piso, sale por afuera

    (Hasta `install-kit-3` las vueltas iban rotando alrededor de un hueco:
    cinco puestos en una elipse, con aire en el medio. Las vueltas de arriba
    no se apoyaban en nada, y las dos puntas salían de la madeja a media
    altura (la del cable de poder, a 12.5 mm del piso) y bajaban en el aire
    a lo largo de 5 cm. Eran los «tramos flotando».)

    Cómo se arma. La espiral del piso es rho(th) = R - D x vueltas. La capa
    de arriba se describe con una coordenada c, en vueltas del piso contadas
    desde esa misma espiral prolongada hacia adentro: c = 0 es el final de la
    espiral, c entero es «encima de una vuelta», c + 1/2 es «en la ranura».
    En la vuelta g de la capa de arriba, las vueltas del piso están en c = k
    con k entre g y g + bottom. `pack` lleva c de 0 a (justo encima de la
    vuelta de más afuera) mientras se dan las vueltas enteras, y en la
    fracción final cruza la primera vuelta, la que viene de la punta A, y
    baja al piso por afuera. Dos pasadas de la capa de arriba quedan siempre
    a más de un diámetro una de otra: la separación la mide `path_clearance`.

    La ALTURA no se dibuja: se calcula. Para cada punto de la capa de arriba
    se busca el cable del piso más cercano en planta, y el punto queda a la
    altura a la que un cilindro se apoya sobre otro (REST diámetros entre
    centros). Donde la curva de apoyo hace un pico hacia abajo (el fondo de
    una ranura, el arranque desde el piso) se redondea hacia ARRIBA, nunca
    hacia abajo: un cable no dobla en ángulo, y así no se entierra en el que
    lo sostiene. `support_gap` mide después cuánto aire queda debajo de cada
    tramo y el script falla si pasa de SUPPORT_MAX.

    El aro lleva un óvalo leve, igual para todas las vueltas, para que no
    parezca un toro perfecto. Ver `tail` para cómo salen las puntas.
    """
    whole = int(math.floor(top))
    frac = top - whole
    if whole < 1 or frac < 0.05:
        raise ModelError("coil_path: `top` necesita al menos una vuelta entera "
                         "y una fracción para bajar al piso")
    total = bottom + top
    D = 2.0 * wire_r * PITCH
    Dr = 2.0 * wire_r * REST
    c_seam = whole + bottom - 1 + 0.2       # encima de la vuelta de más afuera
    c_end = whole + bottom + 1              # en el piso, por afuera
    ease = 0.15
    rate = c_seam / (whole - ease / 2.0)
    cx, cy = center
    th0 = math.radians(theta0)

    def pack(g):
        if g <= ease:                       # arranca sin tirón
            return rate * g * g / (2.0 * ease)
        if g <= whole:
            return rate * (g - ease / 2.0)
        u = min(1.0, (g - whole) / frac)    # Hermite: llega al piso sin pendiente
        u2, u3 = u * u, u * u * u
        return ((2.0 * u3 - 3.0 * u2 + 1.0) * c_seam + (u3 - 2.0 * u2 + u) * frac * rate
                + (3.0 * u2 - 2.0 * u3) * c_end)

    def plan(t):
        th = th0 + 2.0 * math.pi * t
        c = pack(t - bottom) if t > bottom else 0.0
        # óvalo leve: depende solo del ángulo del aro, igual para todas las
        # vueltas, así que no cambia la separación entre ellas
        rr = R * (1.0 + 0.035 * math.sin(2.0 * th + 0.7)) + D * (c - t)
        return cx + rr * math.cos(th), cy + rr * math.sin(th)

    def tail(t_end, sense, length):
        """
        Cola en planta desde la punta de la madeja (t_end). `sense` es +1 si
        el recorrido sale hacia adelante (la punta B) y -1 si sale hacia
        atrás (la punta A). Devuelve los puntos cada 0.25 mm.

        La cola es CONTINUA en dirección y en curvatura con la madeja:
        arranca con la tangente y la curvatura que trae la vuelta; esa
        curvatura se apaga en el primer quinto de la cola y, mientras, una
        curva suave en sentido contrario (una campana de curvatura, sin
        saltos) la abre `splay` grados hacia afuera. El cable se despega del
        rollo en una S larga, como cuando uno suelta la punta. (Hasta el 30 de
        septiembre de 2026 salía casi radial y doblaba ~60 grados de golpe.)

        Los radios de curvatura que salen de aquí los mide y los exige
        `bend_radii` en build_cable.
        """
        h = 0.002
        p0, p1, p2 = (Vector(plan(t_end - sense * k * h) + (0.0,)) for k in range(3))
        heading = math.atan2(p0.y - p1.y, p0.x - p1.x)
        # curvatura con signo en planta, en el sentido en que se recorre
        a1, a2, chord = p1 - p2, p0 - p1, p0 - p2
        k_coil = 2.0 * (a1.x * a2.y - a1.y * a2.x) / (a1.length * a2.length * chord.length)
        fade = 0.20 * length                  # la curvatura del rollo se apaga
        bell = 0.75 * length                  # campana de curvatura hacia afuera
        turn = -math.copysign(math.radians(splay), k_coil) - k_coil * fade / 2.0
        k_out = 2.0 * turn / bell             # integral de sin^2 en [0, bell] = bell/2
        ds = 0.00025
        x, y = p0.x, p0.y
        pts = []
        for i in range(1, int(round(length / ds)) + 1):
            s = i * ds
            k = k_coil * (1.0 - smoothstep(0.0, fade, s))
            if s < bell:
                k += k_out * math.sin(math.pi * s / bell) ** 2
            heading += k * ds
            x += math.cos(heading) * ds
            y += math.sin(heading) * ds
            pts.append((x, y))
        return pts

    def thin(pts, every=10):
        return [p for i, p in enumerate(pts, 1) if i % every == 0 or i == len(pts)]

    # --- lo que está en el piso: la punta A y la espiral de abajo ----------
    from mathutils.kdtree import KDTree
    fine = steps_per_turn * 8
    tail_a_pts = tail(0.0, -1.0, tail_a)
    lower = [(x, y, -(i + 1) * 0.00025 / (2.0 * math.pi * R))
             for i, (x, y) in enumerate(tail_a_pts)]
    lower += [plan(i / fine) + (i / fine,) for i in range(bottom * fine + 1)]
    tree = KDTree(len(lower))
    for i, (x, y, _t) in enumerate(lower):
        tree.insert(Vector((x, y, 0.0)), i)
    tree.balance()

    # --- altura de la capa de arriba: apoyada en lo de abajo ---------------
    n_top = int(round(top * fine))
    env = []
    for i in range(n_top + 1):
        t = bottom + top * i / n_top
        x, y = plan(t)
        best = None
        for (_co, j, d) in tree.find_range(Vector((x, y, 0.0)), Dr):
            # media vuelta de recorrido para atrás es el mismo tramo, no apoyo
            if t - lower[j][2] > 0.5 and (best is None or d < best):
                best = d
        env.append(0.0 if best is None else math.sqrt(max(0.0, Dr * Dr - best * best)))
    # redondeo hacia arriba (gaussiana de 0.8 diámetros de recorrido)
    step = 2.0 * math.pi * (R - D * bottom / 2.0) / fine
    sigma = 0.8 * 2.0 * wire_r / step
    half = int(3.0 * sigma) + 1
    kernel = [math.exp(-0.5 * (k / sigma) ** 2) for k in range(-half, half + 1)]
    norm = sum(kernel)
    lift = []
    for i in range(n_top + 1):
        acc = 0.0
        for k in range(-half, half + 1):
            acc += kernel[k + half] * env[min(n_top, max(0, i + k))]
        lift.append(max(env[i], acc / norm))

    def at(t):
        x, y = plan(t)
        z = wire_r
        if t > bottom:
            u = (t - bottom) / top * n_top
            i = min(n_top - 1, int(u))
            z += lift[i] + (lift[i + 1] - lift[i]) * (u - i)
        return Vector((x, y, z))

    n = int(total * steps_per_turn)
    coil = [at(total * i / n) for i in range(n + 1)]
    start = [Vector((x, y, wire_r)) for (x, y) in thin(tail_a_pts)]
    # la punta B termina de asentarse en el piso con un perfil coseno
    tail_b_pts = tail(total, 1.0, tail_b)
    z0 = coil[-1].z
    end = []
    for i, (x, y) in enumerate(tail_b_pts, 1):
        if i % 10 == 0 or i == len(tail_b_pts):
            u = min(1.0, i / (0.5 * len(tail_b_pts)))
            end.append(Vector((x, y, wire_r + (z0 - wire_r) * 0.5 * (1.0 + math.cos(math.pi * u)))))
    return list(reversed(start)) + coil + end, len(start), len(end)


def support_gap(path, wire_r, step=0.001):
    """
    Cuánto aire queda debajo del tramo peor apoyado: para cada punto del
    recorrido (remuestreado a 1 mm), la menor de dos distancias: al piso, y
    al cable en el que se apoya (otro tramo del mismo cable, más de 3
    diámetros de recorrido más allá y más bajo: debajo, o al costado cuando
    el cable sube recostado en la vuelta vecina). Cero es tocando.
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
    diam = 2.0 * wire_r
    worst = 0.0
    for i, p in enumerate(pts):
        gap = p.z - wire_r
        if gap > 1e-5:
            for (_co, j, d) in tree.find_range(p, diam * 1.5):
                if abs(arcs[i] - arcs[j]) > 3.0 * diam and pts[j].z < p.z - 1e-4:
                    gap = min(gap, d - diam)
        worst = max(worst, gap)
    return worst


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
        spec["center"], spec["R"], spec["wire_r"], spec["bottom"], spec["top"],
        spec["theta0"], spec["tail_a"], spec["tail_b"],
        splay=spec.get("splay", 30.0), steps_per_turn=steps_per_turn)
    need = 2.0 * spec["wire_r"]
    gap = path_clearance(path, spec["wire_r"])
    print("  %-14s separación mínima entre tramos: %.2f mm (diámetro %.2f mm)%s"
          % (name, gap * 1000, need * 1000, "" if gap >= need * 0.99 else "  <-- SE CRUZA"))
    if gap < need * 0.99:
        raise ModelError("%s: el cable se atraviesa a sí mismo (%.2f mm < %.2f mm)"
                         % (name, gap * 1000, need * 1000))
    air = support_gap(path, spec["wire_r"])
    print("  %-14s aire bajo el tramo peor apoyado: %.2f mm (máximo %.2f)%s"
          % (name, air * 1000, SUPPORT_MAX * need * 1000,
             "" if air <= SUPPORT_MAX * need else "  <-- FLOTA"))
    if air > SUPPORT_MAX * need:
        raise ModelError("%s: un tramo queda %.2f mm en el aire (máximo %.2f mm)"
                         % (name, air * 1000, SUPPORT_MAX * need * 1000))
    r_up, r_down = bend_radii(path, n_start, len(path) - 1 - n_end)
    r_all = bend_radii(path, len(path) - 4, 2)[0]
    r_min = BEND_MIN * need
    print("  %-14s radio de curvatura de las colas: %.1f / %.1f mm (mínimo %.1f); "
          "de todo el cable: %.1f mm%s"
          % (name, r_up * 1000, r_down * 1000, r_min * 1000, r_all * 1000,
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
    """
    6 terminales de ojo en abanico de ±14 grados apuntando al frente.

    Cada uno es una pieza de chapa estampada: el barril donde entra el cable
    (con la boca oscura atrás) y, de la misma chapa, la lengüeta y el ojo
    PLANOS, apoyados en el piso. Hasta `install-kit-3` el ojo era un toro, que
    se leía como una argolla, y la lengüeta quedaba 0.9 mm en el aire.
    """
    parts = []
    sheet = 0.0014                              # espesor de la chapa
    for i in range(6):
        yaw = math.radians(-90.0 + (i - 2.5) * 5.6) + jitter(1.5)
        ux, uy = math.cos(yaw), math.sin(yaw)
        ox = -0.1420 + i * 0.0140
        oy = -0.0820
        parts.append(cylinder("ring-terminal-barrel-%d" % (i + 1), 0.0032, 0.0130,
                              segments=16, location=(ox, oy, 0.0032),
                              rotation=(0.0, math.pi / 2.0, yaw), material=copper()))
        parts.append(cylinder("ring-terminal-mouth-%d" % (i + 1), 0.0023, 0.0006,
                              segments=12,
                              location=(ox - ux * 0.0064, oy - uy * 0.0064, 0.0032),
                              rotation=(0.0, math.pi / 2.0, yaw), material=rubber()))
        parts.append(box("ring-terminal-tab-%d" % (i + 1), (0.0070, 0.0058, sheet),
                         location=(ox + ux * 0.0085, oy + uy * 0.0085, sheet / 2.0),
                         rotation=(0.0, 0.0, yaw), material=copper()))
        # tube() ocupa de -1.5 a -0.5 de su largo: con 1.5 x sheet queda de 0 a sheet
        parts.append(tube("ring-terminal-eye-%d" % (i + 1), 0.0062, 0.0030, sheet,
                          segments=24,
                          location=(ox + ux * 0.0150, oy + uy * 0.0150, 1.5 * sheet),
                          rotation=(0.0, 0.0, yaw), material=copper()))
    return snap_group_to_floor(parts)


def build_banana_pair():
    """
    Par de conectores banana, uno rojo y uno negro (la polaridad, el mismo
    código de color de los cables), apuntando al frente.

    Cuerpo de plástico, collar y espiga cromados con la punta afinada. Cada
    conector se construye sobre su eje y después se inclina hasta que la
    punta de la espiga toca el piso: descansa en el borde del cuerpo y en la
    punta, como queda uno de verdad sobre una mesa. Hasta `install-kit-3`
    eran un cilindro cromado con una tapa negra, sin espiga, y el cilindro
    quedaba 1.4 mm en el aire.
    """
    r_body, r_tip, reach = 0.0046, 0.0011, 0.0200
    tilt = math.atan2(r_body - r_tip, reach)
    along = (0.0, math.pi / 2.0, 0.0)
    parts = []
    for i, (x, yaw_deg, plastic) in enumerate(((-0.0490, -84.0, cable_red),
                                               (-0.0370, -96.0, cable_black))):
        yaw = math.radians(yaw_deg) + jitter(2)
        M = (Matrix.Translation(Vector((x, -0.0860, 0.0)))
             @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(tilt, 4, "Y"))

        def lay(obj):
            obj.data.transform(M)
            obj.data.update()
            return obj

        tag = "banana-plug-%d" % (i + 1)
        body = cylinder(tag + "-body", r_body, 0.0170, segments=20,
                        location=(-0.0085, 0.0, 0.0), rotation=along, material=plastic())
        bevel(body, 0.0008, segments=2)
        one = [
            lay(body),
            lay(cylinder(tag + "-entry", 0.0026, 0.0008, segments=12,
                         location=(-0.0172, 0.0, 0.0), rotation=along, material=rubber())),
            lay(cylinder(tag + "-collar", 0.0034, 0.0030, segments=16,
                         location=(0.0015, 0.0, 0.0), rotation=along, material=chrome())),
            lay(cylinder(tag + "-pin", 0.0020, 0.0152, segments=12,
                         location=(0.0104, 0.0, 0.0), rotation=along, material=chrome())),
            lay(cone(tag + "-tip", 0.0020, r_tip, 0.0020, segments=12,
                     location=(0.0190, 0.0, 0.0), rotation=along, material=chrome())),
        ]
        parts += snap_group_to_floor(one)
    return parts


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
