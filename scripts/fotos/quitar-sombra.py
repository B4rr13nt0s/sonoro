"""Quita la sombra de fotos de producto sobre blanco.

uso: python -I scripts/fotos/quitar-sombra.py <entrada> <salida> <modelo.onnx> [regex-de-nombres]

el modelo es isnet-general-use.onnx de rembg (github.com/danielgatis/rembg, release
v0.0.0, ~170 MB). NO se versiona: bajarlo a una carpeta fuera del repo.
la salida son PNG sin sombra; después se pasan por normalizar-producto.mjs.
las vistas agua / conectores / instalada(o) / localizaciones se omiten (hay que copiarlas aparte).

- PNG con transparencia: el producto es lo opaco; la sombra es una capa
  semitransparente. Se conserva solo lo opaco.
- JPG: IS-Net (segmentación de objeto) sobre un recorte alrededor del producto;
  la máscara decide qué es producto. La sombra queda fuera de la máscara.
"""
import os, re, sys
import numpy as np
import cv2
import onnxruntime as ort
from PIL import Image

ENTRADA, SALIDA, MODELO = sys.argv[1], sys.argv[2], sys.argv[3]
FILTRO = re.compile(sys.argv[4]) if len(sys.argv) > 4 else None
OMITIR = re.compile(r"_(agua|conectores|instalad[ao]\d*|localizaciones)\.")
CORTE = float(os.environ.get("CORTE", 0.25))
SUAVE = float(os.environ.get("SUAVE", 1.0))
SOLIDEZ = float(os.environ.get("SOLIDEZ", 0.90))
SOLIDEZ_ELIPSE = float(os.environ.get("SOLIDEZ_ELIPSE", 0.80))
TEXTURA = float(os.environ.get("TEXTURA", 9))
LUM_MORDIDA = float(os.environ.get("LUM_MORDIDA", 110))

sesion = ort.InferenceSession(MODELO, providers=["CPUExecutionProvider"])
MEDIA = np.array([0.485, 0.456, 0.406], np.float32)


def matte_modelo(rgb):
    """Probabilidad de producto (0..1) para una foto RGB, mismo tamaño."""
    h, w = rgb.shape[:2]
    # recorte alrededor de lo que no es blanco (la sombra entra, da igual)
    no_blanco = (rgb.min(axis=2) < 245)
    ys, xs = np.where(no_blanco)
    if len(ys) == 0:
        return np.zeros((h, w), np.float32)
    m = int(0.06 * max(ys.max() - ys.min(), xs.max() - xs.min()))
    y0, y1 = max(0, ys.min() - m), min(h, ys.max() + 1 + m)
    x0, x1 = max(0, xs.min() - m), min(w, xs.max() + 1 + m)
    rec = rgb[y0:y1, x0:x1]
    ch, cw = rec.shape[:2]
    lado = max(ch, cw)
    lienzo = np.full((lado, lado, 3), 255, np.uint8)
    oy, ox = (lado - ch) // 2, (lado - cw) // 2
    lienzo[oy:oy + ch, ox:ox + cw] = rec
    x = cv2.resize(lienzo, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32)
    x = x / max(x.max(), 1e-6)
    x = (x - MEDIA) / 1.0
    x = x.transpose(2, 0, 1)[None]
    p = sesion.run(None, {sesion.get_inputs()[0].name: x})[0][0, 0]
    p = (p - p.min()) / max(p.max() - p.min(), 1e-6)
    p = cv2.resize(p, (lado, lado), interpolation=cv2.INTER_CUBIC)[oy:oy + ch, ox:ox + cw]
    out = np.zeros((h, w), np.float32)
    out[y0:y1, x0:x1] = p
    return out


def solido(p, rgb):
    """Máscara de producto: contorno completo del modelo, interior macizo, borde suave."""
    b = (p > CORTE).astype(np.uint8)
    k = max(3, int(round(max(b.shape) / 700)) | 1)
    b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    # fondo = lo alcanzable desde el borde por pixeles no-producto; lo demás es producto
    inv = (1 - b).astype(np.uint8)
    n, lab = cv2.connectedComponents(inv, connectivity=4)
    borde = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    fondo = np.isin(lab, borde[borde != 0])
    m = (~fondo).astype(np.uint8)
    m = rellenar_mordidas(m, rgb)
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), SUAVE)


def rellenar_mordidas(m, rgb):
    """Si el producto es una pieza casi convexa (frente de bocina, de subwoofer)
    y al contorno le falta un trozo OSCURO (rejilla que el modelo no vio), se
    rellena con el casco convexo. Un trozo claro sería fondo o sombra: no se toca."""
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n < 2:
        return m
    areas = st[1:, cv2.CC_STAT_AREA]
    i = 1 + int(np.argmax(areas))
    if areas.max() < 0.85 * areas.sum():
        return m
    comp = (lab == i).astype(np.uint8)
    cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
    casco = np.zeros_like(comp)
    cv2.fillConvexPoly(casco, hull, 1)
    sol = comp.sum() / max(casco.sum(), 1)
    if sol < SOLIDEZ_ELIPSE:
        return m
    lum = rgb.astype(np.float32).mean(axis=2)

    def oscuro(relleno):
        extra = (relleno > 0) & (m == 0)
        return extra.sum() >= 50 and lum[extra].mean() <= LUM_MORDIDA

    # frentes de bocina: el contorno bueno es una elipse; se ajusta con RANSAC
    # (los puntos de la mordida son los atípicos) y se rellena
    cc, _ = cv2.findContours(casco, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    el = elipse_robusta(max(cc, key=cv2.contourArea)[:, 0, :].astype(np.float32), max(m.shape), float(casco.sum()))
    if el is not None:
        (cx, cy), (w, h), ang = el
        f = np.zeros_like(comp)
        cv2.ellipse(f, (int(round(cx)), int(round(cy))), (int(w / 2 * 0.995), int(h / 2 * 0.995)), ang, 0, 360, 1, -1)
        if oscuro(f):
            return np.maximum(m, f)
    if sol >= SOLIDEZ and oscuro(casco):
        return np.maximum(m, casco)
    return m


def elipse_robusta(pts, lado, area):
    """Elipse que mejor explica el contorno (RANSAC); None si no es elíptico."""
    if len(pts) < 50:
        return None
    rng = np.random.default_rng(1)
    tol = 0.010 * lado
    mejor, n_mejor = None, 0
    for _ in range(1500):
        idx = rng.choice(len(pts), 8, replace=False)
        try:
            (cx, cy), (w, h), ang = cv2.fitEllipse(pts[idx])
        except cv2.error:
            continue
        # plausible: no degenerada y de un área parecida a la de la pieza (le falta, como mucho, una mordida)
        if min(w, h) < 0.3 * max(w, h) or not (0.97 <= np.pi / 4 * w * h / area <= 1.35):
            continue
        a = np.deg2rad(ang)
        dx, dy = pts[:, 0] - cx, pts[:, 1] - cy
        xr = dx * np.cos(a) + dy * np.sin(a)
        yr = -dx * np.sin(a) + dy * np.cos(a)
        r = np.sqrt((xr / (w / 2)) ** 2 + (yr / (h / 2)) ** 2)
        d = np.abs(r - 1) * min(w, h) / 2
        n_in = int((d < tol).sum())
        if n_in > n_mejor:
            mejor, n_mejor = ((cx, cy), (w, h), ang), n_in
    if mejor is None or n_mejor < 0.4 * len(pts):
        return None
    # reajuste con los que concuerdan
    (cx, cy), (w, h), ang = mejor
    a = np.deg2rad(ang)
    dx, dy = pts[:, 0] - cx, pts[:, 1] - cy
    xr = dx * np.cos(a) + dy * np.sin(a)
    yr = -dx * np.sin(a) + dy * np.cos(a)
    r = np.sqrt((xr / (w / 2)) ** 2 + (yr / (h / 2)) ** 2)
    ok = np.abs(r - 1) * min(w, h) / 2 < tol
    try:
        return cv2.fitEllipse(pts[ok])
    except cv2.error:
        return mejor


def procesar(ruta):
    im = Image.open(ruta)
    tiene_alfa = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    if tiene_alfa:
        rgba = np.array(im.convert("RGBA"))
        rgb = rgba[..., :3]
        m = (rgba[..., 3] >= 250).astype(np.float32)
        m = cv2.GaussianBlur(m, (0, 0), 0.9)
        modo = "alfa"
    else:
        rgb = np.array(im.convert("RGB"))
        p = matte_modelo(rgb)
        m = solido(p, rgb)
        modo = "modelo"
    mf = m[..., None]
    out = rgb.astype(np.float32) * mf + 255.0 * (1 - mf)
    return out.round().astype(np.uint8), modo, float(m.mean())


os.makedirs(SALIDA, exist_ok=True)
for f in sorted(os.listdir(ENTRADA)):
    if not re.search(r"\.(png|jpe?g)$", f, re.I):
        continue
    if FILTRO and not FILTRO.search(f):
        continue
    if OMITIR.search(f):
        continue
    out, modo, area = procesar(os.path.join(ENTRADA, f))
    Image.fromarray(out).save(os.path.join(SALIDA, os.path.splitext(f)[0] + ".png"), compress_level=1)
    print(f"{f}\t{modo}\t{area:.3f}", flush=True)
