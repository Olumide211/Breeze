// Small image-processing toolbox used by the auto-painter: blurs, gradients,
// structure-tensor orientation, Canny edges and SSIM. All plain typed arrays.

function clampi(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** One box-blur pass (edge clamped) along x or y. */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, ch: number, r: number, horizontal: boolean): void {
  const win = 2 * r + 1;
  const inv = 1 / win;
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = (horizontal ? 1 : w) * ch;
  for (let line = 0; line < lines; line++) {
    const base = (horizontal ? line * w : line) * ch;
    for (let c = 0; c < ch; c++) {
      const b = base + c;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[b + clampi(k, 0, n - 1) * stride];
      for (let i = 0; i < n; i++) {
        dst[b + i * stride] = sum * inv;
        const add = i + r + 1;
        const sub = i - r;
        sum += src[b + (add < n ? add : n - 1) * stride] - src[b + (sub > 0 ? sub : 0) * stride];
      }
    }
  }
}

function kernelPass(src: Float32Array, dst: Float32Array, w: number, h: number, ch: number, k: Float32Array, horizontal: boolean): void {
  const r = (k.length - 1) >> 1;
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = (horizontal ? 1 : w) * ch;
  for (let line = 0; line < lines; line++) {
    const base = (horizontal ? line * w : line) * ch;
    for (let c = 0; c < ch; c++) {
      const b = base + c;
      for (let i = 0; i < n; i++) {
        let s = 0;
        if (i >= r && i < n - r) {
          const o = b + (i - r) * stride;
          for (let t = 0; t < k.length; t++) s += src[o + t * stride] * k[t];
        } else {
          for (let t = 0; t < k.length; t++) s += src[b + clampi(i + t - r, 0, n - 1) * stride] * k[t];
        }
        dst[b + i * stride] = s;
      }
    }
  }
}

/** Gaussian blur of an interleaved float image with `ch` channels. */
export function gaussBlur(src: Float32Array, w: number, h: number, ch: number, sigma: number): Float32Array {
  if (sigma < 0.3) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  if (sigma <= 2.5) {
    const r = Math.max(1, Math.ceil(sigma * 3));
    const k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) {
      k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma));
      sum += k[i + r];
    }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    kernelPass(src, tmp, w, h, ch, k, true);
    kernelPass(tmp, out, w, h, ch, k, false);
    return out;
  }
  // three box blurs approximate a gaussian
  const nBox = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / nBox + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - nBox * wl * wl - 4 * nBox * wl - 3 * nBox) / (-4 * wl - 4));
  let a = src;
  for (let i = 0; i < nBox; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) >> 1;
    boxPass(a, tmp, w, h, ch, r, true);
    boxPass(tmp, out, w, h, ch, r, false);
    a = out;
  }
  return out;
}

export function lumaOf(rgb: Float32Array, n: number): Float32Array {
  const L = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 3) L[i] = 0.299 * rgb[j] + 0.587 * rgb[j + 1] + 0.114 * rgb[j + 2];
  return L;
}

export function sobel(L: Float32Array, w: number, h: number): { gx: Float32Array; gy: Float32Array } {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ym = y > 0 ? y - 1 : 0;
    const yp = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < w - 1 ? x + 1 : w - 1;
      const a = L[ym * w + xm];
      const b = L[ym * w + x];
      const c = L[ym * w + xp];
      const d = L[y * w + xm];
      const f = L[y * w + xp];
      const g = L[yp * w + xm];
      const hh = L[yp * w + x];
      const k = L[yp * w + xp];
      gx[y * w + x] = (c + 2 * f + k - a - 2 * d - g) * 0.125;
      gy[y * w + x] = (g + 2 * hh + k - a - 2 * b - c) * 0.125;
    }
  }
  return { gx, gy };
}

export interface Field {
  /** unit tangent (direction along edges / isophotes) */
  tx: Float32Array;
  ty: Float32Array;
  /** 0..1, how strongly oriented the neighbourhood is */
  coh: Float32Array;
}

/** Structure-tensor orientation field. */
export function tangentField(L: Float32Array, w: number, h: number, sigmaD: number, sigmaI: number): Field {
  const n = w * h;
  const { gx, gy } = sobel(gaussBlur(L, w, h, 1, sigmaD), w, h);
  const J = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    J[i * 3] = gx[i] * gx[i];
    J[i * 3 + 1] = gx[i] * gy[i];
    J[i * 3 + 2] = gy[i] * gy[i];
  }
  const B = gaussBlur(J, w, h, 3, sigmaI);
  const tx = gx; // reuse buffers
  const ty = gy;
  const coh = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const xx = B[i * 3];
    const xy = B[i * 3 + 1];
    const yy = B[i * 3 + 2];
    const theta = 0.5 * Math.atan2(2 * xy, xx - yy); // dominant gradient direction
    tx[i] = -Math.sin(theta);
    ty[i] = Math.cos(theta);
    const d = xx - yy;
    coh[i] = Math.sqrt(d * d + 4 * xy * xy) / (xx + yy + 1e-3);
  }
  return { tx, ty, coh };
}

/** Local detail energy (blurred gradient magnitude), roughly 0..1+. */
export function detailMap(L: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const { gx, gy } = sobel(gaussBlur(L, w, h, 1, 0.8), w, h);
  const m = new Float32Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = Math.hypot(gx[i], gy[i]);
  const b = gaussBlur(m, w, h, 1, sigma);
  for (let i = 0; i < b.length; i++) b[i] = b[i] / 12;
  return b;
}

/**
 * Canny edge detector returning ordered pixel chains (x,y pairs), longest first.
 */
export function cannyChains(L: Float32Array, w: number, h: number, sigma: number, minLen: number): Float32Array[] {
  const n = w * h;
  const { gx, gy } = sobel(gaussBlur(L, w, h, 1, sigma), w, h);
  const mag = new Float32Array(n);
  for (let i = 0; i < n; i++) mag[i] = Math.hypot(gx[i], gy[i]);
  // non-maximum suppression
  const nms = new Float32Array(n);
  const vals: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < 0.5) continue;
      const ax = Math.abs(gx[i]);
      const ay = Math.abs(gy[i]);
      let d1: number;
      let d2: number;
      if (ax > 2.414 * ay) {
        d1 = 1;
        d2 = -1;
      } else if (ay > 2.414 * ax) {
        d1 = w;
        d2 = -w;
      } else if (gx[i] * gy[i] > 0) {
        d1 = w + 1;
        d2 = -w - 1;
      } else {
        d1 = w - 1;
        d2 = -w + 1;
      }
      if (m >= mag[i + d1] && m > mag[i + d2]) {
        nms[i] = m;
        vals.push(m);
      }
    }
  }
  if (vals.length < 10) return [];
  vals.sort((a, b) => a - b);
  const hi = Math.max(2, vals[Math.floor(vals.length * 0.72)]);
  const lo = hi * 0.4;
  // hysteresis
  const edge = new Uint8Array(n);
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (nms[i] >= hi && !edge[i]) {
      edge[i] = 1;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop() as number;
        const jx = j % w;
        const jy = (j - jx) / w;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = jx + ox;
            const ny = jy + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const k = ny * w + nx;
            if (!edge[k] && nms[k] >= lo) {
              edge[k] = 1;
              stack.push(k);
            }
          }
        }
      }
    }
  }
  // chain tracing
  const used = new Uint8Array(n);
  const chains: Float32Array[] = [];
  const walk = (start: number, out: number[]): void => {
    let cur = start;
    let pdx = 0;
    let pdy = 0;
    for (;;) {
      const cx = cur % w;
      const cy = (cur - cx) / w;
      let best = -1;
      let bestScore = -1e9;
      let bdx = 0;
      let bdy = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (!edge[k] || used[k]) continue;
          const score = ox * pdx + oy * pdy - (ox && oy ? 0.2 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = k;
            bdx = ox;
            bdy = oy;
          }
        }
      }
      if (best < 0) break;
      used[best] = 1;
      out.push(best);
      pdx = bdx;
      pdy = bdy;
      cur = best;
    }
  };
  for (let i = 0; i < n; i++) {
    if (!edge[i] || used[i]) continue;
    used[i] = 1;
    const fwd: number[] = [];
    walk(i, fwd);
    const back: number[] = [];
    walk(i, back);
    const total = fwd.length + back.length + 1;
    if (total < minLen) continue;
    const c = new Float32Array(total * 2);
    let o = 0;
    for (let k = back.length - 1; k >= 0; k--) {
      c[o++] = back[k] % w;
      c[o++] = Math.floor(back[k] / w);
    }
    c[o++] = i % w;
    c[o++] = Math.floor(i / w);
    for (let k = 0; k < fwd.length; k++) {
      c[o++] = fwd[k] % w;
      c[o++] = Math.floor(fwd[k] / w);
    }
    chains.push(c);
  }
  chains.sort((a, b) => b.length - a.length);
  return chains;
}

/** Mean SSIM (gaussian window, sigma 1.5) between two luma images in 0..255. */
export function ssim(a: Float32Array, b: Float32Array, w: number, h: number): number {
  const n = w * h;
  const s = 1.5;
  const mua = gaussBlur(a, w, h, 1, s);
  const mub = gaussBlur(b, w, h, 1, s);
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) t[i] = a[i] * a[i];
  const saa = gaussBlur(t, w, h, 1, s);
  for (let i = 0; i < n; i++) t[i] = b[i] * b[i];
  const sbb = gaussBlur(t, w, h, 1, s);
  for (let i = 0; i < n; i++) t[i] = a[i] * b[i];
  const sab = gaussBlur(t, w, h, 1, s);
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const ma = mua[i];
    const mb = mub[i];
    const va = saa[i] - ma * ma;
    const vb = sbb[i] - mb * mb;
    const cab = sab[i] - ma * mb;
    sum += ((2 * ma * mb + C1) * (2 * cab + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
  }
  return sum / n;
}

/** SSIM between two RGBA8 images (computed on luma). */
export function ssimRGBA(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number): number {
  const n = w * h;
  const la = new Float32Array(n);
  const lb = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    la[i] = 0.299 * a[j] + 0.587 * a[j + 1] + 0.114 * a[j + 2];
    lb[i] = 0.299 * b[j] + 0.587 * b[j + 1] + 0.114 * b[j + 2];
  }
  return ssim(la, lb, w, h);
}
