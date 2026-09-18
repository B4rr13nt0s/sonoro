// Quita el fondo blanco: relleno desde los bordes sobre píxeles casi blancos,
// y en la franja de contacto con el producto, "color a alfa" para bordes suaves.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

// Los originales NO viven en public/: pesan 14 MB y no se sirven nunca, solo
// alimentan a este script. Lo que se publica son las copias sin fondo.
const ORIGEN = "assets/fotos_pagina_de_inicio";
const DESTINO = "public/fotos_pagina_de_inicio";
const UMBRAL = 232; // min(R,G,B) >= UMBRAL cuenta como fondo alcanzable
// Dos fotos no se resuelven con tolerancia, porque lo que sobra es tan
// oscuro como partes del producto: al subirla se mordían el crossover del
// 165AS y el borde del empaque del CAK82. Van recortadas A MANO, con el
// contorno trazado sobre la foto (contornos.json, en coordenadas de un
// lienzo de 1000 de ancho; ver rejilla.cjs, zona.cjs y ver-contorno.cjs):
//   poligono   → se conserva solo lo de adentro (CAK82: el empaque rojo,
//                sin el plástico transparente que quedaba de halo).
//   corteAbajo → se borra lo que quede debajo de la línea (165AS: la
//                superficie y la sombra donde se apoyan las bocinas).
const MANUAL = JSON.parse(fs.readFileSync(new URL("./contornos.json", import.meta.url), "utf8"));
const BANDA = 3; // px de borde suavizado
const MAX = 1200;
// Fotos donde el producto encierra fondo (espirales de cable): también se
// vacían los huecos blancos cerrados.
const CON_HUECOS = /^(4GKIT|8GKIT)_/;

fs.mkdirSync(DESTINO, { recursive: true });

(async () => {
  const archivos = fs.readdirSync(ORIGEN).filter((f) => /\.(png|jpe?g)$/i.test(f));
  for (const f of archivos) {
    const { data, info } = await sharp(path.join(ORIGEN, f))
      .flatten({ background: "#ffffff" })
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const W = info.width,
      H = info.height,
      N = W * H;
    const minc = (p) => Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    const umbral = (MANUAL.umbral && MANUAL.umbral[f]) || UMBRAL;

    // 1. Relleno desde los bordes.
    const fondo = new Uint8Array(N);
    const cola = new Int32Array(N);
    let ini = 0,
      fin = 0;
    const empujar = (p) => {
      if (!fondo[p] && minc(p) >= umbral) {
        fondo[p] = 1;
        cola[fin++] = p;
      }
    };
    for (let x = 0; x < W; x++) {
      empujar(x);
      empujar((H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      empujar(y * W);
      empujar(y * W + W - 1);
    }
    const expandir = () => {
      while (ini < fin) {
        const p = cola[ini++],
          x = p % W,
          y = (p / W) | 0;
        if (x > 0) empujar(p - 1);
        if (x < W - 1) empujar(p + 1);
        if (y > 0) empujar(p - W);
        if (y < H - 1) empujar(p + W);
      }
    };
    expandir();
    // Huecos cerrados: solo componentes grandes (> 0.2 % de la foto), para no
    // borrar letras o reflejos blancos del producto.
    if (CON_HUECOS.test(f)) {
      for (let s = 0; s < N; s++) {
        if (fondo[s] || minc(s) < umbral) continue;
        const desde = fin;
        empujar(s);
        expandir();
        if (fin - desde < N * 0.002) for (let k = desde; k < fin; k++) fondo[cola[k]] = 2;
      }
      for (let p = 0; p < N; p++) if (fondo[p] === 2) fondo[p] = 0;
    }

    // 1.b Sellado: el borde del plástico del CAK82 es casi tan blanco como el
    // fondo, así que el relleno se colaba por hilitos y abría manchas dentro
    // del empaque. Una apertura morfológica del FONDO (encoger r y volver a
    // crecer, quedándose solo con lo que sigue tocando la orilla) tapa esos
    // canales sin mover el contorno: lo que se recupera es fondo que ya era
    // fondo, nunca producto.
    const sellar = (MANUAL.sellar && MANUAL.sellar[f]) || 0;
    if (sellar) {
      const r = Math.max(1, Math.round((sellar * W) / 1000));
      // Distancia (Chebyshev) de cada píxel de fondo al no-fondo más cercano.
      const dst = new Int32Array(N).fill(1 << 29);
      for (let p = 0; p < N; p++) if (!fondo[p]) dst[p] = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (x > 0) dst[p] = Math.min(dst[p], dst[p - 1] + 1);
          if (y > 0) dst[p] = Math.min(dst[p], dst[p - W] + 1);
          if (x > 0 && y > 0) dst[p] = Math.min(dst[p], dst[p - W - 1] + 1);
          if (x < W - 1 && y > 0) dst[p] = Math.min(dst[p], dst[p - W + 1] + 1);
        }
      for (let y = H - 1; y >= 0; y--)
        for (let x = W - 1; x >= 0; x--) {
          const p = y * W + x;
          if (x < W - 1) dst[p] = Math.min(dst[p], dst[p + 1] + 1);
          if (y < H - 1) dst[p] = Math.min(dst[p], dst[p + W] + 1);
          if (x < W - 1 && y < H - 1) dst[p] = Math.min(dst[p], dst[p + W + 1] + 1);
          if (x > 0 && y < H - 1) dst[p] = Math.min(dst[p], dst[p + W - 1] + 1);
        }
      // Núcleo: fondo a más de r del producto, y que siga conectado a la orilla.
      const nucleo = new Uint8Array(N);
      const cola2 = new Int32Array(N);
      let i2 = 0,
        f2 = 0;
      const meter = (p) => {
        if (!nucleo[p] && dst[p] > r) {
          nucleo[p] = 1;
          cola2[f2++] = p;
        }
      };
      for (let x = 0; x < W; x++) {
        meter(x);
        meter((H - 1) * W + x);
      }
      for (let y = 0; y < H; y++) {
        meter(y * W);
        meter(y * W + W - 1);
      }
      while (i2 < f2) {
        const p = cola2[i2++],
          x = p % W,
          y = (p / W) | 0;
        if (x > 0) meter(p - 1);
        if (x < W - 1) meter(p + 1);
        if (y > 0) meter(p - W);
        if (y < H - 1) meter(p + W);
      }
      // Crecer el núcleo r px, sin salirse del fondo original.
      const dst2 = new Int32Array(N).fill(1 << 29);
      for (let p = 0; p < N; p++) if (nucleo[p]) dst2[p] = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (x > 0) dst2[p] = Math.min(dst2[p], dst2[p - 1] + 1);
          if (y > 0) dst2[p] = Math.min(dst2[p], dst2[p - W] + 1);
          if (x > 0 && y > 0) dst2[p] = Math.min(dst2[p], dst2[p - W - 1] + 1);
          if (x < W - 1 && y > 0) dst2[p] = Math.min(dst2[p], dst2[p - W + 1] + 1);
        }
      for (let y = H - 1; y >= 0; y--)
        for (let x = W - 1; x >= 0; x--) {
          const p = y * W + x;
          if (x < W - 1) dst2[p] = Math.min(dst2[p], dst2[p + 1] + 1);
          if (y < H - 1) dst2[p] = Math.min(dst2[p], dst2[p + W] + 1);
          if (x < W - 1 && y < H - 1) dst2[p] = Math.min(dst2[p], dst2[p + W + 1] + 1);
          if (x > 0 && y < H - 1) dst2[p] = Math.min(dst2[p], dst2[p + W - 1] + 1);
        }
      for (let p = 0; p < N; p++) if (fondo[p] && dst2[p] > r) fondo[p] = 0;
    }

    // 2. Distancia (en px) al fondo, hasta BANDA.
    const dist = new Uint8Array(N).fill(255);
    for (let p = 0; p < N; p++) if (fondo[p]) dist[p] = 0;
    for (let paso = 1; paso <= BANDA; paso++) {
      for (let p = 0; p < N; p++) {
        if (dist[p] !== 255) continue;
        const x = p % W,
          y = (p / W) | 0;
        if (
          (x > 0 && dist[p - 1] === paso - 1) ||
          (x < W - 1 && dist[p + 1] === paso - 1) ||
          (y > 0 && dist[p - W] === paso - 1) ||
          (y < H - 1 && dist[p + W] === paso - 1)
        )
          dist[p] = paso;
      }
    }

    // 3. Alfa: fondo = 0; franja = color a alfa respecto del blanco.
    let x0 = W,
      y0 = H,
      x1 = -1,
      y1 = -1;
    for (let p = 0; p < N; p++) {
      const i = p * 4;
      let a;
      if (fondo[p]) a = 0;
      else if (dist[p] <= BANDA) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        a = Math.max(255 - r, 255 - g, 255 - b) / (255 - 150);
        a = Math.min(1, a);
        if (a > 0)
          for (let c = 0; c < 3; c++)
            data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * 255) / a)));
        a = Math.round(a * 255);
      } else a = 255;
      data[i + 3] = a;
      if (a > 8) {
        const x = p % W,
          y = (p / W) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }

    // 4. Recorte a mano, si esta foto lo lleva. Las coordenadas vienen en un
    // lienzo de 1000 de ancho: acá se escalan al tamaño real, y el borde se
    // difumina 1.5 px para que no quede aserrado.
    const escala = W / 1000;
    const poli = MANUAL.poligono[f];
    // Rectángulos a borrar a mano (el agujero del colgador del CAK82, que es
    // fondo encerrado por el empaque y queda blanco).
    for (const [rx0, ry0, rx1, ry1] of (MANUAL.borrar && MANUAL.borrar[f]) || [])
      for (let y = Math.round(ry0 * (W / 1000)); y < Math.round(ry1 * (W / 1000)); y++)
        for (let x = Math.round(rx0 * (W / 1000)); x < Math.round(rx1 * (W / 1000)); x++)
          if (minc(y * W + x) >= 200) data[(y * W + x) * 4 + 3] = 0;
    const corte = MANUAL.corteAbajo[f];
    // Polígonos de fondo a borrar (165AS: la superficie y la sombra, trazadas
    // por debajo de las bocinas y de los cables, que se conservan enteros).
    const borrados = (MANUAL.borrarPoligono && MANUAL.borrarPoligono[f]) || [];
    if (poli || corte || borrados.length) {
      const dentroDe = (pol, x, y) => {
        let d = false;
        for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
          const [xi, yi] = pol[i],
            [xj, yj] = pol[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
        }
        return d;
      };
      const dentro = (x, y) => dentroDe(poli, x, y);
      const enBorrado = (x, y) => borrados.some((pol) => dentroDe(pol, x, y));
      const alturaCorte = (x) => {
        for (let i = 1; i < corte.length; i++) {
          const [xa, ya] = corte[i - 1],
            [xb, yb] = corte[i];
          if (x <= xb) return ya + ((yb - ya) * (x - xa)) / (xb - xa);
        }
        return corte[corte.length - 1][1];
      };
      for (let p = 0; p < N; p++) {
        if (data[p * 4 + 3] === 0) continue;
        const x = (p % W) / escala,
          y = ((p / W) | 0) / escala;
        let fuera = false;
        let borde = 99;
        if (poli) {
          fuera = !dentro(x, y);
          if (!fuera)
            for (const [dx, dy] of [
              [1.5, 0],
              [-1.5, 0],
              [0, 1.5],
              [0, -1.5],
            ])
              if (!dentro(x + dx / escala, y + dy / escala)) borde = 1;
        }
        if (corte) {
          const limite = alturaCorte(x);
          if (y > limite) fuera = true;
          else borde = Math.min(borde, (limite - y) * escala);
        }
        if (!fuera && borrados.length && enBorrado(x, y)) fuera = true;
        else if (!fuera && borrados.length) {
          for (const [dx, dy] of [
            [1.5, 0],
            [-1.5, 0],
            [0, 1.5],
            [0, -1.5],
          ])
            if (enBorrado(x + dx / escala, y + dy / escala)) borde = Math.min(borde, 1);
        }
        if (fuera) data[p * 4 + 3] = 0;
        else if (borde < 1.5)
          data[p * 4 + 3] = Math.round(data[p * 4 + 3] * Math.max(0, borde / 1.5));
      }
      // El recorte final se recalcula con el alfa ya enmascarado.
      x0 = W;
      y0 = H;
      x1 = -1;
      y1 = -1;
      for (let p = 0; p < N; p++) {
        if (data[p * 4 + 3] <= 8) continue;
        const x = p % W,
          y = (p / W) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }

    const nombre = f.replace(/\.(png|jpe?g)$/i, ".webp");
    await sharp(data, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toFile(path.join(DESTINO, nombre));
    const kb = Math.round(fs.statSync(path.join(DESTINO, nombre)).size / 1024);
    console.log(nombre.padEnd(46), `${x1 - x0 + 1}x${y1 - y0 + 1}`, kb + " KB");
  }
})();
