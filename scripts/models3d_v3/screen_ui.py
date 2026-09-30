"""
Sonoro — interfaz de la pantalla encendida, dibujada por código.

La usa screen.py como textura emisiva del vidrio. Se genera aquí, con numpy
(que viene con Blender), en vez de guardar una imagen en el repo: el modelo
se reproduce entero desde el script, igual que la geometría.

Es una interfaz GENÉRICA de receptor multimedia —fondo con aurora, carátula,
reloj, rejilla de apps y columna de controles—, con la disposición de un
equipo 2-DIN de hoy. Por la regla de los iconos de categoría (sin logos, sin
texto legible, sin marca):

  - ningún ícono reproduce el de una app o marca real: son glifos genéricos
    (barras de ecualizador, nota musical, rejilla, flecha, ondas, engrane);
  - donde un equipo real pondría texto hay barras redondeadas, y el reloj son
    bloques, no números.

Las coordenadas del layout están en píxeles de la imagen final (W x H). Se
dibuja a SS veces esa resolución y se promedia: eso es el antialias.

Se puede previsualizar sin Blender:

    python scripts/models3d_v3/screen_ui.py salida.png   (necesita Pillow)

También dibuja el LCD del receptor 1-DIN (`render_lcd`, lo usa head-unit.py).
"""

import math

import numpy as np

W, H = 1024, 544      # proporción del área activa del vidrio: 166 x 88 mm
SS = 3                # sobremuestreo
MARGIN = 12           # franja negra del vidrio alrededor de la imagen


# ------------------------------------------------------------ utilidades -----

def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


class Canvas:
    """Lienzo RGB en espacio sRGB (se compone como en una herramienta de diseño)."""

    def __init__(self, w=W, h=H, ss=SS):
        self.w, self.h, self.ss = w, h, ss
        self.rgb = np.zeros((h * ss, w * ss, 3), np.float32)

    def grid(self, x0, y0, x1, y1):
        s = self.ss
        i0 = max(0, int(math.floor(y0 * s)))
        i1 = min(self.h * s, int(math.ceil(y1 * s)))
        j0 = max(0, int(math.floor(x0 * s)))
        j1 = min(self.w * s, int(math.ceil(x1 * s)))
        if i0 >= i1 or j0 >= j1:
            return None
        ys = (np.arange(i0, i1, dtype=np.float32) + 0.5) / s
        xs = (np.arange(j0, j1, dtype=np.float32) + 0.5) / s
        X, Y = np.meshgrid(xs, ys)
        return (slice(i0, i1), slice(j0, j1)), X, Y

    def coverage(self, d):
        """Distancia con signo (px finales) -> cobertura con borde de 1 subpíxel."""
        return np.clip(0.5 - d * self.ss, 0.0, 1.0)

    def draw(self, bbox, sdf, fill, alpha=1.0, clip=None):
        """
        Pinta la forma `sdf(X, Y)` (negativa adentro) dentro de `bbox`.
        `fill`: color (3,) o función (X, Y) -> (h, w, 3).
        `clip`: otra sdf; la forma solo se ve donde esa también es negativa.
        """
        g = self.grid(*bbox)
        if g is None:
            return
        sl, X, Y = g
        cov = self.coverage(sdf(X, Y))
        if clip is not None:
            cov = cov * self.coverage(clip(X, Y))
        col = fill(X, Y) if callable(fill) else np.asarray(fill, np.float32)
        a = (cov * alpha)[..., None]
        self.rgb[sl] = self.rgb[sl] * (1.0 - a) + col * a

    def add(self, bbox, field, color):
        """Luz aditiva: `field(X, Y)` en 0..1 por `color`."""
        g = self.grid(*bbox)
        if g is None:
            return
        sl, X, Y = g
        self.rgb[sl] += field(X, Y)[..., None] * np.asarray(color, np.float32)

    def multiply(self, bbox, field):
        g = self.grid(*bbox)
        if g is None:
            return
        sl, X, Y = g
        self.rgb[sl] *= field(X, Y)[..., None]

    def result(self):
        s = self.ss
        img = self.rgb.reshape(self.h, s, self.w, s, 3).mean(axis=(1, 3))
        return np.clip(img, 0.0, 1.0)


# ------------------------------------------------------------ distancias -----

def sd_round_rect(cx, cy, w, h, r, angle=0.0):
    hw, hh = w / 2.0, h / 2.0
    ca, sa = math.cos(angle), math.sin(angle)

    def f(X, Y):
        dx, dy = X - cx, Y - cy
        if angle:
            dx, dy = dx * ca + dy * sa, -dx * sa + dy * ca
        qx = np.abs(dx) - (hw - r)
        qy = np.abs(dy) - (hh - r)
        outside = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2)
        inside = np.minimum(np.maximum(qx, qy), 0)
        return outside + inside - r
    return f


def sd_circle(cx, cy, r):
    return lambda X, Y: np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) - r


def sd_segment(x0, y0, x1, y1, th):
    def f(X, Y):
        px, py = X - x0, Y - y0
        bx, by = x1 - x0, y1 - y0
        t = np.clip((px * bx + py * by) / (bx * bx + by * by + 1e-12), 0.0, 1.0)
        return np.sqrt((px - bx * t) ** 2 + (py - by * t) ** 2) - th / 2.0
    return f


def sd_arc(cx, cy, r, th, a0, a1):
    """Arco de anillo con puntas redondas; ángulos en grados, sentido horario
    en pantalla (y hacia abajo), de a0 a a1."""
    r0, r1 = math.radians(a0), math.radians(a1)
    p0 = (cx + r * math.cos(r0), cy + r * math.sin(r0))
    p1 = (cx + r * math.cos(r1), cy + r * math.sin(r1))
    mid = (r0 + r1) / 2.0
    half = (r1 - r0) / 2.0

    def f(X, Y):
        dx, dy = X - cx, Y - cy
        ang = np.arctan2(dy, dx)
        delta = np.abs((ang - mid + math.pi) % (2 * math.pi) - math.pi)
        ring = np.abs(np.sqrt(dx * dx + dy * dy) - r) - th / 2.0
        cap = np.minimum(np.sqrt((X - p0[0]) ** 2 + (Y - p0[1]) ** 2),
                         np.sqrt((X - p1[0]) ** 2 + (Y - p1[1]) ** 2)) - th / 2.0
        return np.where(delta <= half, ring, cap)
    return f


def sd_poly(pts):
    """Polígono CONVEXO, puntos en cualquier sentido."""
    pts = [tuple(map(float, p)) for p in pts]
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
               for i in range(len(pts)))
    if area < 0:
        pts = pts[::-1]

    def f(X, Y):
        d = None
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            ex, ey = x1 - x0, y1 - y0
            ln = math.hypot(ex, ey)
            # distancia con signo a la recta del borde; afuera positiva
            di = ((X - x0) * ey - (Y - y0) * ex) / ln
            d = di if d is None else np.maximum(d, di)
        return d
    return f


def union(*fs):
    def f(X, Y):
        d = fs[0](X, Y)
        for g in fs[1:]:
            d = np.minimum(d, g(X, Y))
        return d
    return f


def subtract(a, b):
    return lambda X, Y: np.maximum(a(X, Y), -b(X, Y))


def linear(c0, c1, x0, y0, x1, y1):
    c0, c1 = hexc(c0), hexc(c1)
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy

    def f(X, Y):
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0.0, 1.0)[..., None]
        return c0 * (1.0 - t) + c1 * t
    return f


def gauss(cx, cy, rx, ry, strength):
    return lambda X, Y: strength * np.exp(-(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2))


def streak(points, sigma, strength):
    """Banda de luz a lo largo de una polilínea (la «aurora» del fondo)."""
    segs = list(zip(points[:-1], points[1:]))

    def f(X, Y):
        d = None
        for (x0, y0), (x1, y1) in segs:
            dd = sd_segment(x0, y0, x1, y1, 0.0)(X, Y)
            d = dd if d is None else np.minimum(d, dd)
        return strength * np.exp(-(d / sigma) ** 2)
    return f


def box_around(cx, cy, rx, ry=None):
    ry = rx if ry is None else ry
    return (cx - rx, cy - ry, cx + rx, cy + ry)


# ------------------------------------------------------------------ layout -----

X0, Y0 = MARGIN, MARGIN
UW, UH = W - 2 * MARGIN, H - 2 * MARGIN
FULL = (0, 0, W, H)
WHITE = hexc("FFFFFF")


def U(u):
    return X0 + u * UW


def V(v):
    return Y0 + v * UH


def label(c, cx, y, w, h=11, alpha=0.9):
    """Lugar de un texto: una barra redondeada, nunca letras."""
    c.draw(box_around(cx, y, w / 2 + 2, h / 2 + 2), sd_round_rect(cx, y, w, h, h / 2),
           WHITE, alpha)


def background(c):
    ui = (X0, Y0, X0 + UW, Y0 + UH)
    c.draw(ui, sd_round_rect(W / 2, H / 2, UW, UH, 4),
           linear("18224D", "221A4A", X0, Y0, X0 + UW, Y0 + UH))
    # aurora: banda turquesa que cruza desde la izquierda y una violeta a la derecha
    c.add(ui, streak([(U(-0.05), V(0.64)), (U(0.22), V(0.53)), (U(0.45), V(0.49)),
                      (U(0.62), V(0.48))], 42, 0.40), hexc("1FA9C4"))
    c.add(ui, streak([(U(0.02), V(0.60)), (U(0.25), V(0.52)), (U(0.50), V(0.485))],
                     16, 0.13), hexc("5FE0EC"))
    c.add(ui, streak([(U(0.45), V(0.50)), (U(0.66), V(0.47)), (U(0.80), V(0.40))],
                     38, 0.40), hexc("9C4BE0"))
    c.add(ui, gauss(U(0.62), V(0.48), 110, 36, 0.28), hexc("E46AD6"))
    c.add(ui, gauss(U(0.93), V(0.50), 70, 230, 0.30), hexc("26BFD6"))
    c.add(ui, gauss(U(0.10), V(0.02), 320, 170, 0.20), hexc("3E54A8"))
    # se oscurece hacia abajo, como en cualquier fondo de este tipo
    c.multiply(ui, lambda X, Y: 1.0 - 0.38 * smoothstep(V(0.55), V(1.0), Y))


def album_art(c):
    x, y, s = U(0.07), V(0.10), 190.0
    cx, cy = x + s / 2, y + s / 2
    rect = sd_round_rect(cx, cy, s, s, 5)
    # sombra suave
    c.multiply(box_around(cx + 6, cy + 10, 150), lambda X, Y: 1.0 - 0.45 * np.exp(
        -np.maximum(sd_round_rect(cx + 4, cy + 8, s, s, 5)(X, Y), 0) ** 2 / 180.0))
    c.draw(box_around(cx, cy, s / 2 + 2), rect, linear("F3ECF5", "D9CDE9", x, y, x + s, y + s))
    # barras de «título»: rosa, en tres líneas, y una gris más chica
    for i, w in enumerate((92, 40, 70)):
        c.draw((x, y, x + s, y + s), sd_round_rect(x + 22 + w / 2, y + 30 + i * 22, w, 13, 6.5),
               hexc("D1356F"), 0.92)
    c.draw((x, y, x + s, y + s), sd_round_rect(x + 22 + 34, y + 112, 68, 7, 3.5),
           hexc("5B4E66"), 0.85)


def clock(c):
    # fecha: dos barras chicas; hora: bloques grandes. Sin números.
    label(c, U(0.505), V(0.135), 34, 9, 0.75)
    label(c, U(0.508), V(0.175), 26, 9, 0.75)
    y = V(0.155)
    for i, x in enumerate((U(0.550), U(0.580), U(0.625), U(0.655))):
        c.draw(box_around(x, y, 16, 24), sd_round_rect(x, y, 25, 40, 6), WHITE, 0.95)
    for dy in (-8, 8):
        c.draw(box_around(U(0.6025), y + dy, 5), sd_circle(U(0.6025), y + dy, 3.6), WHITE, 0.95)


TILE = 92.0


def tile(c, cx, cy, c0, c1):
    c.multiply(box_around(cx + 2, cy + 8, 70), lambda X, Y: 1.0 - 0.35 * np.exp(
        -np.maximum(sd_round_rect(cx + 2, cy + 6, TILE, TILE, 22)(X, Y), 0) ** 2 / 90.0))
    c.draw(box_around(cx, cy, TILE / 2 + 2), sd_round_rect(cx, cy, TILE, TILE, 22),
           linear(c0, c1, cx - TILE / 2, cy - TILE / 2, cx + TILE / 2, cy + TILE / 2))
    # brillo superior del tile
    c.draw(box_around(cx, cy, TILE / 2 + 2),
           sd_round_rect(cx, cy, TILE, TILE, 22), WHITE, 0.10,
           clip=lambda X, Y: (Y - (cy - 4)))


def glyph_eq_bars(c, cx, cy):
    for dx, h in ((-24, 26), (-8, 46), (8, 34), (24, 18)):
        c.draw(box_around(cx + dx, cy, 8, 30),
               sd_round_rect(cx + dx, cy + 22 - h / 2, 10, h, 5), WHITE)


def glyph_note(c, cx, cy):
    c.draw(box_around(cx, cy, 40), union(
        sd_circle(cx - 9, cy + 16, 11.5),
        sd_segment(cx + 1.5, cy + 16, cx + 1.5, cy - 24, 5.5),
        sd_segment(cx + 1.5, cy - 24, cx + 19, cy - 13, 6.5)), WHITE)


def glyph_grid(c, cx, cy):
    for dx in (-13, 13):
        for dy in (-13, 13):
            c.draw(box_around(cx + dx, cy + dy, 13),
                   sd_round_rect(cx + dx, cy + dy, 21, 21, 5.5), WHITE)


def glyph_nav(c, cx, cy):
    tip, left, notch, bottom = ((cx + 24, cy - 24), (cx - 26, cy - 3),
                                (cx - 2, cy + 2), (cx + 3, cy + 26))
    c.draw(box_around(cx, cy, 30), union(sd_poly([tip, left, notch]),
                                         sd_poly([tip, notch, bottom])), WHITE)


def glyph_waves(c, cx, cy):
    col = hexc("FF6B5E")
    c.draw(box_around(cx, cy, 10), sd_circle(cx, cy, 7.5), col)
    for r in (19, 31):
        c.draw(box_around(cx, cy, r + 6), union(sd_arc(cx, cy, r, 6.5, 135, 225),
                                                sd_arc(cx, cy, r, 6.5, -45, 45)), col)


def glyph_gear(c, cx, cy):
    col = hexc("C9CCD6")
    teeth = [sd_round_rect(cx, cy, 13, 66, 3, angle=math.radians(a)) for a in (0, 45, 90, 135)]
    gear = union(sd_circle(cx, cy, 25), *teeth)
    c.draw(box_around(cx, cy, 36), subtract(gear, sd_circle(cx, cy, 11)), col)


def app_grid(c):
    row1, row2 = V(0.36), V(0.685)
    apps = [
        (U(0.560), row1, ("FF6A55", "E8364E"), glyph_eq_bars, 66),
        (U(0.690), row1, ("3D8CFF", "1D5ED8"), glyph_note, 80),
        (U(0.140), row2, ("3ED472", "1E9E4A"), glyph_grid, 88),
        (U(0.305), row2, ("22C3D2", "1386A8"), glyph_nav, 96),
        (U(0.480), row2, None, glyph_waves, 52),
        (U(0.645), row2, None, glyph_gear, 70),
    ]
    for cx, cy, colors, glyph, lw in apps:
        if colors:
            tile(c, cx, cy, *colors)
        glyph(c, cx, cy)
        label(c, cx, cy + TILE / 2 + 22, lw, 12)


def panel(c, x0, y0, x1, y1, r=14):
    cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    c.draw((x0 - 2, y0 - 2, x1 + 2, y1 + 2), sd_round_rect(cx, cy, w, h, r),
           linear("1E3366", "14234D", x0, y0, x1, y1), 0.80)
    c.draw((x0 - 2, y0 - 2, x1 + 2, y1 + 2),
           lambda X, Y: np.abs(sd_round_rect(cx, cy, w, h, r)(X, Y)) - 1.1,
           hexc("6FB2E0"), 0.55)
    return cx, cy


def controls(c):
    x0, x1 = U(0.795), U(0.975)
    # tarjeta de «pista»: degradado violeta a turquesa con dos barras
    y0, y1 = V(0.05), V(0.22)
    cx = (x0 + x1) / 2
    c.draw((x0 - 2, y0 - 2, x1 + 2, y1 + 2),
           sd_round_rect(cx, (y0 + y1) / 2, x1 - x0, y1 - y0, 16),
           linear("6C47D8", "2A93B8", x0, y0, x1, y1), 0.95)
    label(c, cx, y0 + 26, 120, 13, 0.95)
    label(c, cx, y0 + 52, 90, 13, 0.95)

    # reproducir / silencio
    gap = 8
    mid = (x0 + x1) / 2
    y0, y1 = V(0.255), V(0.415)
    a = panel(c, x0, y0, mid - gap / 2, y1)
    b = panel(c, mid + gap / 2, y0, x1, y1)
    c.draw(box_around(*a, 16), sd_poly([(a[0] - 8, a[1] - 12), (a[0] - 8, a[1] + 12),
                                        (a[0] + 12, a[1])]), WHITE)
    bx, by = b
    c.draw(box_around(bx, by, 22), union(
        sd_round_rect(bx - 14, by, 7, 10, 1.5),
        sd_poly([(bx - 12, by - 5), (bx - 3, by - 12), (bx - 3, by + 12), (bx - 12, by + 5)])),
        WHITE)
    c.draw(box_around(bx + 9, by, 9), union(sd_segment(bx + 4, by - 5, bx + 14, by + 5, 3),
                                            sd_segment(bx + 4, by + 5, bx + 14, by - 5, 3)), WHITE)

    # volumen
    y0, y1 = V(0.445), V(0.595)
    px, py = panel(c, x0, y0, x1, y1)
    c.draw(box_around(px - 34, py, 14), sd_segment(px - 46, py, px - 22, py, 4), WHITE)
    c.draw(box_around(px + 34, py, 14), union(sd_segment(px + 22, py, px + 46, py, 4),
                                              sd_segment(px + 34, py - 12, px + 34, py + 12, 4)),
           WHITE)

    # anterior / siguiente
    y0, y1 = V(0.625), V(0.775)
    px, py = panel(c, x0, y0, x1, y1)
    for sgn, ox in ((-1, px - 34), (1, px + 34)):
        # «siguiente» (sgn = +1): dos triángulos hacia la derecha y la barra;
        # «anterior» es el espejo
        tris = [sd_poly([(ox - sgn * 13, py - 9), (ox - sgn * 13, py + 9), (ox - sgn * 2, py)]),
                sd_poly([(ox - sgn * 2, py - 9), (ox - sgn * 2, py + 9), (ox + sgn * 9, py)]),
                sd_round_rect(ox + sgn * 11.5, py, 3, 18, 1)]
        c.draw(box_around(ox, py, 18), union(*tris), WHITE)

    # paginador en píldora
    y0, y1 = V(0.81), V(0.90)
    cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    c.draw((x0 - 2, y0 - 2, x1 + 2, y1 + 2), sd_round_rect(cx, cy, w, h, h / 2),
           hexc("101A45"), 0.75)
    c.draw((x0 - 2, y0 - 2, x1 + 2, y1 + 2),
           lambda X, Y: np.abs(sd_round_rect(cx, cy, w, h, h / 2)(X, Y)) - 1.1,
           hexc("5C8CE0"), 0.8)
    for sgn, ox in ((-1, x0 + 26), (1, x1 - 26)):
        for k in (0, 7):
            x = ox + sgn * k
            c.draw(box_around(x, cy, 10), union(
                sd_segment(x - sgn * 4, cy - 6, x + sgn * 2, cy, 2.6),
                sd_segment(x + sgn * 2, cy, x - sgn * 4, cy + 6, 2.6)), WHITE, 0.9)
    for i, dx in enumerate((-14, 0, 14)):
        col = hexc("58A6FF") if i == 0 else WHITE
        c.draw(box_around(cx + dx, cy, 6), sd_circle(cx + dx, cy, 4.2), col,
               1.0 if i == 0 else 0.45)


def bottom_bar(c):
    x0, x1, y0, y1 = U(0.03), U(0.765), V(0.885), V(0.975)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    c.draw((x0, y0, x1, y1), sd_round_rect(cx, cy, x1 - x0, y1 - y0, 10),
           hexc("0A1030"), 0.55)
    gx = x0 + 34
    for i in range(3):
        for j in range(3):
            c.draw(box_around(gx + (i - 1) * 10, cy + (j - 1) * 10, 5),
                   sd_round_rect(gx + (i - 1) * 10, cy + (j - 1) * 10, 7, 7, 1.5), WHITE)
    label(c, gx + 30 + 44, cy, 88, 13)
    px = x1 - 110
    c.draw(box_around(px, cy, 14), sd_segment(px - 8, cy + 9, px + 8, cy - 9, 4.5), WHITE)
    label(c, px + 40, cy, 48, 12)


# ------------------------------------------------ LCD del receptor 1-DIN -----

LCD_W, LCD_H = 512, 64    # proporción del LCD de head-unit: 100 x 12.5 mm


def render_lcd():
    """
    Franja de LCD del receptor 1-DIN (head-unit), encendida: fondo azul
    oscuro, glifo de ecualizador, dos barras de «pista» y el reloj en
    bloques. Mismas reglas que la pantalla: nada legible, nada de marca.
    """
    c = Canvas(LCD_W, LCD_H)
    m = 3
    full = (0, 0, LCD_W, LCD_H)
    c.draw(full, sd_round_rect(LCD_W / 2, LCD_H / 2, LCD_W - 2 * m, LCD_H - 2 * m, 3),
           linear("132659", "1B1848", m, m, LCD_W - m, LCD_H - m))
    c.add(full, gauss(LCD_W * 0.38, LCD_H * 0.62, 190, 26, 0.22), hexc("1FA9C4"))
    c.add(full, gauss(LCD_W * 0.72, LCD_H * 0.40, 120, 22, 0.16), hexc("9C4BE0"))
    teal = hexc("5FE0EC")
    for dx, h in ((-15, 16), (-5, 30), (5, 22), (15, 12)):
        c.draw(box_around(40 + dx, 32, 6, 20), sd_round_rect(40 + dx, 47 - h / 2, 6, h, 3), teal)
    label(c, 72 + 80, 24, 160, 11, 0.95)
    label(c, 72 + 54, 42, 108, 8, 0.65)
    y = 32
    for x in (410, 428, 456, 474):
        c.draw(box_around(x, y, 9, 15), sd_round_rect(x, y, 14, 26, 3.5), WHITE, 0.95)
    for dy in (-6, 6):
        c.draw(box_around(442, y + dy, 4), sd_circle(442, y + dy, 2.4), WHITE, 0.95)
    return c.result()


def render():
    """Devuelve la interfaz como array (H, W, 3) en sRGB 0..1, fila 0 arriba."""
    c = Canvas()
    background(c)
    album_art(c)
    clock(c)
    app_grid(c)
    controls(c)
    bottom_bar(c)
    return c.result()


if __name__ == "__main__":
    import sys
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else "screen-ui.png"
    Image.fromarray((render() * 255 + 0.5).astype(np.uint8)).save(out)
    lcd = out.rsplit(".", 1)[0] + "-lcd.png"
    Image.fromarray((render_lcd() * 255 + 0.5).astype(np.uint8)).save(lcd)
    print(out, lcd)
