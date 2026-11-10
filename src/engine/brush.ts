// Software brush engine. Every pixel on the paint layer is produced by dabs
// stamped along a stroke path. Runs in the worker (painting) and on the main
// thread (brush preview only).

export type Tool = 'pencil' | 'brush' | 'airbrush' | 'soften' | 'eraser' | 'eyedropper';

export interface BrushParams {
  tool: Tool;
  /** diameter in document pixels */
  size: number;
  /** paint laid down per dab, 0..1 */
  flow: number;
  /** 0 = fully feathered edge, 1 = hard edge */
  hardness: number;
  /** per-stroke opacity cap, 0..1 */
  opacity: number;
  r: number;
  g: number;
  b: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number; // exclusive
}

/** Paper colour shown under the (transparent) paint layer. */
export const PAPER: readonly [number, number, number] = [250, 248, 243];

const SPACING: Record<Tool, number> = {
  pencil: 0.15,
  brush: 0.1,
  airbrush: 0.08,
  soften: 0.25,
  eraser: 0.1,
  eyedropper: 1,
};

export class StrokeEngine {
  readonly w: number;
  readonly h: number;
  /** premultiplied RGBA, rgb in 0..255 (times alpha), alpha in 0..1 */
  readonly data: Float32Array;
  /** per-stroke accumulated coverage, used for the opacity cap */
  private cov: Float32Array;
  private p: BrushParams = { tool: 'brush', size: 10, flow: 1, hardness: 1, opacity: 1, r: 0, g: 0, b: 0 };
  private first = true;
  private lx = 0;
  private ly = 0;
  private lp = 1;
  private residual = 0;
  private tmpA = new Float32Array(0);
  private tmpB = new Float32Array(0);

  // dirty rect for display (accumulates until taken)
  private dx0 = 1e9;
  private dy0 = 1e9;
  private dx1 = -1;
  private dy1 = -1;
  // rect touched by the current stroke
  private sx0 = 1e9;
  private sy0 = 1e9;
  private sx1 = -1;
  private sy1 = -1;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Float32Array(w * h * 4);
    this.cov = new Float32Array(w * h);
  }

  begin(p: BrushParams): void {
    this.p = p;
    this.first = true;
    this.residual = 0;
    this.sx0 = 1e9;
    this.sy0 = 1e9;
    this.sx1 = -1;
    this.sy1 = -1;
  }

  /** Add a path point; dabs are interpolated from the previous point. */
  point(x: number, y: number, pr: number): void {
    if (this.first) {
      this.first = false;
      this.dab(x, y, pr);
      this.residual = this.step();
    } else {
      const dx = x - this.lx;
      const dy = y - this.ly;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        const step = this.step();
        let pos = this.residual;
        while (pos <= d) {
          const f = pos / d;
          this.dab(this.lx + dx * f, this.ly + dy * f, this.lp + (pr - this.lp) * f);
          pos += step;
        }
        this.residual = pos - d;
      }
    }
    this.lx = x;
    this.ly = y;
    this.lp = pr;
  }

  /** Finish the stroke. Returns the rect it touched (or null). */
  end(): Rect | null {
    if (this.sx1 < 0) return null;
    const { sx0, sy0, sx1, sy1, w, cov } = this;
    for (let y = sy0; y < sy1; y++) cov.fill(0, y * w + sx0, y * w + sx1);
    return { x0: sx0, y0: sy0, x1: sx1, y1: sy1 };
  }

  private step(): number {
    return Math.max(0.5, this.p.size * SPACING[this.p.tool]);
  }

  private touch(x0: number, y0: number, x1: number, y1: number): void {
    if (x0 < this.dx0) this.dx0 = x0;
    if (y0 < this.dy0) this.dy0 = y0;
    if (x1 > this.dx1) this.dx1 = x1;
    if (y1 > this.dy1) this.dy1 = y1;
    if (x0 < this.sx0) this.sx0 = x0;
    if (y0 < this.sy0) this.sy0 = y0;
    if (x1 > this.sx1) this.sx1 = x1;
    if (y1 > this.sy1) this.sy1 = y1;
  }

  /** Stamp a single dab centred at (x, y) in document coordinates. */
  dab(x: number, y: number, pr: number): void {
    const P = this.p;
    const tool = P.tool;
    let r = P.size * 0.5;
    let flow = P.flow;
    if (pr < 1) {
      if (tool === 'airbrush' || tool === 'soften') flow *= pr;
      else {
        r *= 0.3 + 0.7 * pr;
        flow *= 0.5 + 0.5 * pr;
      }
    }
    if (r < 0.5) r = 0.5;
    if (tool === 'soften') {
      this.softenDab(x, y, r, flow * P.opacity);
      return;
    }
    const w = this.w;
    const h = this.h;
    const ext = r + 0.5;
    const x0 = Math.max(0, Math.floor(x - ext));
    const y0 = Math.max(0, Math.floor(y - ext));
    const x1 = Math.min(w, Math.ceil(x + ext));
    const y1 = Math.min(h, Math.ceil(y + ext));
    if (x0 >= x1 || y0 >= y1) return;
    this.touch(x0, y0, x1, y1);

    const D = this.data;
    const cov = this.cov;
    const inner = Math.min(1, Math.max(0, P.hardness)) * r;
    const denom = Math.max(r - inner, 1e-3);
    const O = P.opacity;
    const erase = tool === 'eraser';
    const air = tool === 'airbrush';
    const cr = P.r;
    const cg = P.g;
    const cb = P.b;
    const ext2 = ext * ext;
    for (let py = y0; py < y1; py++) {
      const dy = py + 0.5 - y;
      const dy2 = dy * dy;
      let i = py * w + x0;
      for (let px = x0; px < x1; px++, i++) {
        const dx = px + 0.5 - x;
        const d2 = dx * dx + dy2;
        if (d2 >= ext2) continue;
        const d = Math.sqrt(d2);
        let m: number;
        if (d <= inner) m = 1;
        else {
          const t = (r - d) / denom;
          m = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
          if (air) m *= m;
        }
        const aa = r - d + 0.5;
        if (aa < 1) m *= aa > 0 ? aa : 0;
        m *= flow;
        if (m < 0.0005) continue;
        const c0 = cov[i];
        const c1 = c0 + (1 - c0) * m;
        cov[i] = c1;
        const den = 1 - c0 * O;
        if (den < 1e-4) continue;
        const k = (1 - c1 * O) / den;
        const j = i * 4;
        if (erase) {
          D[j] *= k;
          D[j + 1] *= k;
          D[j + 2] *= k;
          D[j + 3] *= k;
        } else {
          const q = 1 - k;
          D[j] = D[j] * k + cr * q;
          D[j + 1] = D[j + 1] * k + cg * q;
          D[j + 2] = D[j + 2] * k + cb * q;
          D[j + 3] = D[j + 3] * k + q;
        }
      }
    }
  }

  /** Soften/blur dab: mixes pixels under the brush with a local box blur. */
  private softenDab(x: number, y: number, r: number, strength: number): void {
    const w = this.w;
    const h = this.h;
    const ext = r + 0.5;
    const x0 = Math.max(0, Math.floor(x - ext));
    const y0 = Math.max(0, Math.floor(y - ext));
    const x1 = Math.min(w, Math.ceil(x + ext));
    const y1 = Math.min(h, Math.ceil(y + ext));
    if (x0 >= x1 || y0 >= y1) return;
    this.touch(x0, y0, x1, y1);
    const br = Math.max(1, Math.round(r * 0.35));
    const pw = x1 - x0;
    const ph = y1 - y0;
    const ew = pw + 2 * br;
    const eh = ph + 2 * br;
    if (this.tmpA.length < ew * eh * 4) this.tmpA = new Float32Array(ew * eh * 4);
    if (this.tmpB.length < pw * eh * 4) this.tmpB = new Float32Array(pw * eh * 4);
    const A = this.tmpA;
    const B = this.tmpB;
    const D = this.data;
    // copy the (edge-clamped) neighbourhood
    for (let ey = 0; ey < eh; ey++) {
      const sy = Math.min(h - 1, Math.max(0, y0 - br + ey));
      for (let ex = 0; ex < ew; ex++) {
        const sx = Math.min(w - 1, Math.max(0, x0 - br + ex));
        const s = (sy * w + sx) * 4;
        const t = (ey * ew + ex) * 4;
        A[t] = D[s];
        A[t + 1] = D[s + 1];
        A[t + 2] = D[s + 2];
        A[t + 3] = D[s + 3];
      }
    }
    const win = 2 * br + 1;
    const inv = 1 / win;
    // horizontal box blur: A (ew x eh) -> B (pw x eh)
    for (let ey = 0; ey < eh; ey++) {
      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      const row = ey * ew * 4;
      for (let k = 0; k < win; k++) {
        s0 += A[row + k * 4];
        s1 += A[row + k * 4 + 1];
        s2 += A[row + k * 4 + 2];
        s3 += A[row + k * 4 + 3];
      }
      for (let px = 0; px < pw; px++) {
        const t = (ey * pw + px) * 4;
        B[t] = s0 * inv;
        B[t + 1] = s1 * inv;
        B[t + 2] = s2 * inv;
        B[t + 3] = s3 * inv;
        if (px + 1 < pw) {
          const a = row + px * 4;
          const b = row + (px + win) * 4;
          s0 += A[b] - A[a];
          s1 += A[b + 1] - A[a + 1];
          s2 += A[b + 2] - A[a + 2];
          s3 += A[b + 3] - A[a + 3];
        }
      }
    }
    // vertical box blur B -> blend into layer
    const ext2 = ext * ext;
    for (let px = 0; px < pw; px++) {
      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      for (let k = 0; k < win; k++) {
        const t = (k * pw + px) * 4;
        s0 += B[t];
        s1 += B[t + 1];
        s2 += B[t + 2];
        s3 += B[t + 3];
      }
      const dx = x0 + px + 0.5 - x;
      for (let py = 0; py < ph; py++) {
        const dy = y0 + py + 0.5 - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < ext2) {
          const t = 1 - Math.sqrt(d2) / ext;
          const m = t * t * (3 - 2 * t) * strength;
          const j = ((y0 + py) * w + x0 + px) * 4;
          D[j] += (s0 * inv - D[j]) * m;
          D[j + 1] += (s1 * inv - D[j + 1]) * m;
          D[j + 2] += (s2 * inv - D[j + 2]) * m;
          D[j + 3] += (s3 * inv - D[j + 3]) * m;
        }
        if (py + 1 < ph) {
          const a = (py * pw + px) * 4;
          const b = ((py + win) * pw + px) * 4;
          s0 += B[b] - B[a];
          s1 += B[b + 1] - B[a + 1];
          s2 += B[b + 2] - B[a + 2];
          s3 += B[b + 3] - B[a + 3];
        }
      }
    }
  }

  markDirty(r: Rect): void {
    if (r.x0 < this.dx0) this.dx0 = r.x0;
    if (r.y0 < this.dy0) this.dy0 = r.y0;
    if (r.x1 > this.dx1) this.dx1 = r.x1;
    if (r.y1 > this.dy1) this.dy1 = r.y1;
  }

  markAllDirty(): void {
    this.markDirty({ x0: 0, y0: 0, x1: this.w, y1: this.h });
  }

  /** Take (and reset) the accumulated display-dirty rect. */
  takeDirty(): Rect | null {
    if (this.dx1 < 0) return null;
    const r = { x0: this.dx0, y0: this.dy0, x1: this.dx1, y1: this.dy1 };
    this.dx0 = 1e9;
    this.dy0 = 1e9;
    this.dx1 = -1;
    this.dy1 = -1;
    return r;
  }

  /** Straight-alpha RGBA8 for a rect of the paint layer. */
  toRGBA8(r: Rect): Uint8ClampedArray<ArrayBuffer> {
    const rw = r.x1 - r.x0;
    const rh = r.y1 - r.y0;
    const out = new Uint8ClampedArray(rw * rh * 4);
    const D = this.data;
    let o = 0;
    for (let y = r.y0; y < r.y1; y++) {
      let j = (y * this.w + r.x0) * 4;
      for (let x = 0; x < rw; x++, j += 4, o += 4) {
        const a = D[j + 3];
        if (a > 0.002) {
          const ia = 1 / a;
          out[o] = D[j] * ia + 0.5;
          out[o + 1] = D[j + 1] * ia + 0.5;
          out[o + 2] = D[j + 2] * ia + 0.5;
          out[o + 3] = a * 255 + 0.5;
        }
      }
    }
    return out;
  }

  /** Opaque RGBA8 of the whole layer composited over paper. */
  compositeRGBA8(): Uint8ClampedArray<ArrayBuffer> {
    const n = this.w * this.h;
    const out = new Uint8ClampedArray(n * 4);
    const D = this.data;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const ia = 1 - D[j + 3];
      out[j] = D[j] + ia * PAPER[0] + 0.5;
      out[j + 1] = D[j + 1] + ia * PAPER[1] + 0.5;
      out[j + 2] = D[j + 2] + ia * PAPER[2] + 0.5;
      out[j + 3] = 255;
    }
    return out;
  }
}
