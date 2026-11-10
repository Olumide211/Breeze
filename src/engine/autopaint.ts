// Auto-paint planner. Looks at the reference photo and at what is currently
// on the canvas, and plans real brush strokes coarse-to-fine:
//   0 sketch  -> 1 block-in -> 2 refine -> 3 blend -> 4 detail
// It never writes pixels itself; it only emits strokes for the brush engine.

import { PAPER, type BrushParams, type Tool } from './brush';
import { cannyChains, detailMap, gaussBlur, lumaOf, tangentField, type Field } from './imgproc';

export type Detail = 'low' | 'med' | 'high';
export type Style = 'realistic' | 'painterly' | 'sketch';

export interface AutoOptions {
  detail: Detail;
  style: Style;
  seed: number;
}

export interface AutoStroke {
  params: BrushParams;
  /** x, y, pressure triples in document pixels */
  pts: Float32Array;
  /** true: stamp one dab per point (pixel-snapped pencil), no interpolation */
  snap: boolean;
  phase: number;
  label: string;
  /** share of total progress this stroke accounts for */
  cost: number;
}

export const PHASE_NAMES = ['Sketch', 'Block-in', 'Refine', 'Blend', 'Detail'];
const PHASE_SHARE = [0.1, 0.16, 0.36, 0.08, 0.3];

interface Pass {
  phase: number;
  weight: number;
  end: number;
  /** estimated strokes still to come after the batch just planned */
  est: number;
  plan(): AutoStroke[];
}

interface TraceCfg {
  step: number;
  maxLen: number;
  minLen: number;
  colorTol: number;
  fc: number;
  snap: boolean;
  /** accept only if the stroke reduces error along its path to below this ratio (0 = always) */
  accept: number;
  hertz: boolean;
  angle?: number;
  minPts: number;
}

interface ErrCfg {
  phase: number;
  label: string;
  weight: number;
  tool: Tool;
  size: number;
  flow: number;
  hardness: number;
  opacity: number;
  /** blur of the reference this pass compares against */
  sigma: number;
  field: 'coarse' | 'mid' | 'fine';
  grid: number;
  /** error thresholds (0..255 mean abs diff), processed in order */
  Ts: number[];
  maxLenR: number;
  minLenR: number;
  colorTol: number;
  fc: number;
  snap: boolean;
  accept: number;
  maxStrokes: number;
  maxIter: number;
  weightDetail?: boolean;
  minDetail?: number;
  jitter?: number;
  angle?: number;
  taper?: boolean;
  minPts?: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && r - g > 12;
}

export class AutoPainter {
  /** 0..1, advances as strokes are handed out */
  progress = 0;
  strokes = 0;
  phase = 0;

  private w: number;
  private h: number;
  private n: number;
  private s: number;
  private layer: Float32Array;
  private target: Float32Array;
  private luma: Float32Array;
  private detail: Float32Array;
  private err: Float32Array;
  private fields: Partial<Record<'coarse' | 'mid' | 'fine', Field>> = {};
  private passes: Pass[] = [];
  private pi = 0;
  private queue: AutoStroke[] = [];
  private qi = 0;
  private rnd: () => number;
  private opts: AutoOptions;

  constructor(refRGBA: Uint8ClampedArray, w: number, h: number, layer: Float32Array, opts: AutoOptions) {
    this.w = w;
    this.h = h;
    this.n = w * h;
    this.s = Math.max(0.5, Math.max(w, h) / 512);
    this.layer = layer;
    this.opts = opts;
    this.rnd = mulberry32(opts.seed || 1);
    const n = this.n;
    const t = new Float32Array(n * 3);
    if (opts.style === 'sketch') {
      for (let i = 0; i < n; i++) {
        const g = 0.299 * refRGBA[i * 4] + 0.587 * refRGBA[i * 4 + 1] + 0.114 * refRGBA[i * 4 + 2];
        const v = 0.06 + 0.94 * Math.pow(g / 255, 0.85);
        t[i * 3] = PAPER[0] * v;
        t[i * 3 + 1] = PAPER[1] * v;
        t[i * 3 + 2] = PAPER[2] * v;
      }
    } else {
      for (let i = 0; i < n; i++) {
        t[i * 3] = refRGBA[i * 4];
        t[i * 3 + 1] = refRGBA[i * 4 + 1];
        t[i * 3 + 2] = refRGBA[i * 4 + 2];
      }
    }
    this.target = t;
    this.luma = lumaOf(t, n);
    this.detail = detailMap(this.luma, w, h, 2.5 * this.s);
    this.err = new Float32Array(n);
    this.buildPasses();
  }

  /** Next stroke to paint, or null when the painting is finished. */
  next(): AutoStroke | null {
    while (this.qi >= this.queue.length) {
      if (this.pi >= this.passes.length) {
        this.progress = 1;
        return null;
      }
      const pass = this.passes[this.pi];
      this.phase = pass.phase;
      const batch = pass.plan();
      if (!batch.length) {
        this.progress = Math.max(this.progress, pass.end);
        this.pi++;
        continue;
      }
      const remain = Math.max(0, pass.end - this.progress);
      const per = remain / (batch.length + Math.max(0, pass.est));
      for (const b of batch) b.cost = per;
      this.queue = batch;
      this.qi = 0;
    }
    const st = this.queue[this.qi++];
    this.progress += st.cost;
    this.strokes++;
    return st;
  }

  // ---------------------------------------------------------------- passes

  private buildPasses(): void {
    const s = this.s;
    const d = this.opts.detail;
    const style = this.opts.style;
    const A = (this.w * this.h) / (512 * 512);
    const P: Pass[] = [];
    const px = (v: number, min = 1): number => Math.max(min, Math.round(v * s));
    const pick = <T>(lo: T, me: T, hi: T): T => (d === 'low' ? lo : d === 'med' ? me : hi);

    // 0 --- sketch
    P.push(this.sketchPass(Math.round(pick(140, 240, 360) * (style === 'sketch' ? 1.5 : 1)), style === 'sketch' ? 0.5 : 0.36, false));

    const base = { fc: 0.7, snap: false, maxIter: 3 };
    if (style === 'realistic') {
      // 1 --- block-in
      P.push(this.coverPass(px(72, 12), 'brush', 0.35, 1));
      P.push(
        this.errorPass({
          ...base, phase: 1, label: 'Block-in · mid masses', weight: 1.4, tool: 'brush', size: px(38, 8), flow: 0.9, hardness: 0.4, opacity: 1,
          sigma: 6 * s, field: 'coarse', grid: px(17, 4), Ts: [20], maxLenR: 5, minLenR: 1, colorTol: 50, accept: 0.9, maxStrokes: 3000, taper: true,
        }),
      );
      // 2 --- refine (airbrush, shrinking)
      const sizes = pick([26, 14], [26, 15, 8], [26, 16, 10, 6]);
      const Ts = pick([15, 13], [15, 13, 11], [15, 13, 11, 9.5]);
      sizes.forEach((sz, i) => {
        const size = px(sz, 3);
        P.push(
          this.errorPass({
            ...base, phase: 2, label: `Refine ${i + 1}/${sizes.length} · airbrush ${size}px`, weight: 1 + i * 0.8, tool: 'airbrush', size, flow: 0.8,
            hardness: 0.5, opacity: 1, sigma: Math.max(0.4, size / 6), field: size >= 20 * s ? 'coarse' : 'mid', grid: Math.max(2, Math.round(size * 0.45)),
            Ts: [Ts[i]], maxLenR: 6, minLenR: 0.8, colorTol: 36, accept: 0.85, maxStrokes: 40000,
          }),
        );
      });
      // 3 --- blend
      P.push(this.blendPass(px(22, 6), 1, pick(1, 1, 2)));
      if (d === 'high') P.push(this.blendPass(px(12, 4), 0.8, 1));
      // 4 --- detail
      const det = (size: number, Tl: number[], w: number, minPts: number): Pass =>
        this.errorPass({
          ...base, phase: 4, label: `Detail · pencil ${size}px`, weight: w, tool: 'pencil', size, flow: 1, hardness: 0.9, opacity: 1,
          sigma: size >= 3 ? 0.5 : 0, field: 'fine', grid: size, Ts: Tl, maxLenR: size === 1 ? 48 : 20, minLenR: 0, colorTol: 0, fc: 0.85, snap: true,
          accept: 0.8, maxStrokes: Math.round(90000 * A), maxIter: 3, weightDetail: true, minPts,
        });
      if (d === 'low') {
        P.push(det(3, [15], 1, 2), det(2, [12], 1.5, 2));
      } else if (d === 'med') {
        P.push(det(3, [14], 1, 2), det(2, [11], 1.5, 2), det(1, [14, 9], 3, 1));
      } else {
        P.push(det(3, [13], 1, 2), det(2, [10], 1.5, 2), det(1, [14, 9, 6], 4, 1));
      }
    } else if (style === 'painterly') {
      P.push(this.coverPass(px(84, 14), 'brush', 0.7, 1));
      P.push(
        this.errorPass({
          ...base, phase: 1, label: 'Block-in · mid masses', weight: 1.4, tool: 'brush', size: px(44, 8), flow: 1, hardness: 0.7, opacity: 0.95,
          sigma: 7 * s, field: 'coarse', grid: px(20, 4), Ts: [22], maxLenR: 6, minLenR: 1.5, colorTol: 55, accept: 0.9, maxStrokes: 3000, jitter: 5, taper: true,
        }),
      );
      const sizes = pick([30], [28, 16], [28, 16, 9]);
      sizes.forEach((sz, i) => {
        const size = px(sz, 3);
        P.push(
          this.errorPass({
            ...base, phase: 2, label: `Refine ${i + 1}/${sizes.length} · brush ${size}px`, weight: 1 + i, tool: 'brush', size, flow: 1, hardness: 0.75,
            opacity: 0.92, sigma: size / 4, field: size >= 20 * s ? 'coarse' : 'mid', grid: Math.max(2, Math.round(size * 0.5)), Ts: [17 - i],
            maxLenR: 9, minLenR: 2, colorTol: 42, fc: 0.8, accept: 0.88, maxStrokes: 20000, jitter: 6, taper: true, maxIter: 2,
          }),
        );
      });
      P.push(this.blendPass(px(16, 5), 0.6, 1));
      P.push(
        this.errorPass({
          ...base, phase: 4, label: 'Detail · pencil 3px', weight: 1, tool: 'pencil', size: 3, flow: 1, hardness: 0.85, opacity: 0.95, sigma: 0.6,
          field: 'fine', grid: 3, Ts: [22], maxLenR: 24, minLenR: 0, colorTol: 0, fc: 0.85, snap: true, accept: 0.8, maxStrokes: Math.round(12000 * A),
          weightDetail: true, minDetail: 0.5, minPts: 3, maxIter: 2,
        }),
      );
      if (d === 'high') {
        P.push(
          this.errorPass({
            ...base, phase: 4, label: 'Detail · pencil 2px', weight: 1, tool: 'pencil', size: 2, flow: 1, hardness: 0.85, opacity: 0.95, sigma: 0,
            field: 'fine', grid: 2, Ts: [22], maxLenR: 24, minLenR: 0, colorTol: 0, fc: 0.85, snap: true, accept: 0.8, maxStrokes: Math.round(12000 * A),
            weightDetail: true, minDetail: 0.7, minPts: 3, maxIter: 2,
          }),
        );
      }
    } else {
      // pencil sketch: tone built with soft graphite, then hatching
      P.push(
        this.errorPass({
          ...base, phase: 1, label: 'Block-in · graphite tone', weight: 1, tool: 'airbrush', size: px(56, 10), flow: 0.5, hardness: 0.2, opacity: 0.8,
          sigma: 9 * s, field: 'coarse', grid: px(22, 4), Ts: [12], maxLenR: 5, minLenR: 1.5, colorTol: 60, accept: 0.95, maxStrokes: 2500, maxIter: 2,
        }),
      );
      const sizes = pick([6], [6, 4], [6, 4, 3]);
      sizes.forEach((sz, i) => {
        const size = px(sz, 2);
        P.push(
          this.errorPass({
            ...base, phase: 2, label: `Refine ${i + 1}/${sizes.length} · hatching ${size}px`, weight: 1 + i, tool: 'pencil', size, flow: 0.7, hardness: 0.6,
            opacity: 0.8, sigma: size / 3, field: 'mid', grid: Math.max(2, size), Ts: [13 - i], maxLenR: 14, minLenR: 3, colorTol: 40, accept: 0.9,
            maxStrokes: 30000, angle: i % 2 ? (3 * Math.PI) / 4 : Math.PI / 4, taper: true, maxIter: 2,
          }),
        );
      });
      P.push(this.blendPass(px(20, 6), 0.8, 1));
      const detS = pick([2], [2, 1], [2, 1]);
      detS.forEach((size) => {
        P.push(
          this.errorPass({
            ...base, phase: 4, label: `Detail · pencil ${size}px`, weight: 1.5, tool: 'pencil', size, flow: 1, hardness: 0.9, opacity: 1, sigma: 0,
            field: 'fine', grid: size, Ts: d === 'high' ? [14, 10] : [14], maxLenR: 30, minLenR: 0, colorTol: 0, fc: 0.85, snap: true, accept: 0.8,
            maxStrokes: Math.round(60000 * A), weightDetail: true, minPts: 2,
          }),
        );
      });
      P.push(this.sketchPass(pick(80, 140, 200), 0.6, true));
    }

    // distribute progress shares
    const phaseW = [0, 0, 0, 0, 0];
    for (const p of P) phaseW[p.phase] += p.weight;
    let total = 0;
    for (let i = 0; i < 5; i++) if (phaseW[i] > 0) total += PHASE_SHARE[i];
    let acc = 0;
    for (const p of P) {
      acc += ((PHASE_SHARE[p.phase] / total) * p.weight) / phaseW[p.phase];
      p.end = acc;
    }
    P[P.length - 1].end = 1;
    this.passes = P;
  }

  private field(kind: 'coarse' | 'mid' | 'fine'): Field {
    let f = this.fields[kind];
    if (!f) {
      const s = this.s;
      f =
        kind === 'coarse'
          ? tangentField(this.luma, this.w, this.h, 3 * s, 8 * s)
          : kind === 'mid'
            ? tangentField(this.luma, this.w, this.h, 1.5 * s, 4 * s)
            : tangentField(this.luma, this.w, this.h, 0.8, 2);
      this.fields[kind] = f;
    }
    return f;
  }

  private computeErr(level: Float32Array): void {
    const L = this.layer;
    const e = this.err;
    const p0 = PAPER[0];
    const p1 = PAPER[1];
    const p2 = PAPER[2];
    for (let i = 0, j = 0, k = 0; i < this.n; i++, j += 4, k += 3) {
      const ia = 1 - L[j + 3];
      const dr = L[j] + ia * p0 - level[k];
      const dg = L[j + 1] + ia * p1 - level[k + 1];
      const db = L[j + 2] + ia * p2 - level[k + 2];
      e[i] = ((dr < 0 ? -dr : dr) + (dg < 0 ? -dg : dg) + (db < 0 ? -db : db)) * 0.3333333;
    }
  }

  /** Pencil outlines from Canny edge chains. */
  private sketchPass(maxChains: number, flow: number, final: boolean): Pass {
    let done = false;
    const pass: Pass = {
      phase: final ? 4 : 0,
      weight: 1,
      end: 0,
      est: 0,
      plan: () => {
        if (done) return [];
        done = true;
        const s = this.s;
        const chains = cannyChains(this.luma, this.w, this.h, 1.4 * s, Math.round(12 * s)).slice(0, maxChains);
        const out: AutoStroke[] = [];
        const size = Math.max(1.3, (final ? 1.3 : 1.7) * s);
        const maxSeg = Math.round(100 * s);
        const g = final ? 44 : 64;
        for (const c of chains) {
          const np = c.length / 2;
          for (let a = 0; a < np; a += maxSeg) {
            const b = Math.min(np, a + maxSeg);
            if (b - a < 4) continue;
            const pts: number[] = [];
            for (let i = a; i < b; i += 3) {
              // light smoothing + hand jitter
              const i0 = Math.max(a, i - 2);
              const i1 = Math.min(b - 1, i + 2);
              const x = (c[i0 * 2] + c[i * 2] * 2 + c[i1 * 2]) / 4 + 0.5 + (this.rnd() - 0.5) * 0.9 * s;
              const y = (c[i0 * 2 + 1] + c[i * 2 + 1] * 2 + c[i1 * 2 + 1]) / 4 + 0.5 + (this.rnd() - 0.5) * 0.9 * s;
              const t = (i - a) / Math.max(1, b - a - 1);
              pts.push(x, y, 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
            }
            if (pts.length < 6) continue;
            out.push({
              params: { tool: 'pencil', size, flow, hardness: 0.8, opacity: final ? 0.85 : 0.7, r: g, g: g - 2, b: g + 4 },
              pts: new Float32Array(pts),
              snap: false,
              phase: pass.phase,
              label: final ? 'Detail · contour lines' : 'Sketch · pencil outlines',
              cost: 0,
            });
          }
        }
        return out;
      },
    };
    return pass;
  }

  /** First block-in: cover the whole canvas with big strokes of averaged colour. */
  private coverPass(size: number, tool: Tool, hardness: number, opacity: number): Pass {
    let done = false;
    const pass: Pass = {
      phase: 1,
      weight: 1,
      end: 0,
      est: 0,
      plan: () => {
        if (done) return [];
        done = true;
        const R = size / 2;
        const level = gaussBlur(this.target, this.w, this.h, 3, R * 0.4);
        const f = this.field('coarse');
        const g = R * 0.85;
        const items: { st: AutoStroke; key: number; pos: number }[] = [];
        const cfg: TraceCfg = { step: R * 0.5, maxLen: R * 3.5, minLen: R * 1.2, colorTol: 70, fc: 0.7, snap: false, accept: 0, hertz: false, minPts: 2 };
        for (let gy = g / 2; gy < this.h + g / 2; gy += g) {
          for (let gx = g / 2; gx < this.w + g / 2; gx += g) {
            const x = Math.min(this.w - 1, Math.max(0, gx + (this.rnd() - 0.5) * g * 0.5));
            const y = Math.min(this.h - 1, Math.max(0, gy + (this.rnd() - 0.5) * g * 0.5));
            const tr = this.trace(x, y, level, f, cfg);
            if (!tr) continue;
            const { r, g: gg, b } = tr;
            const mx = Math.max(r, gg, b);
            const mn = Math.min(r, gg, b);
            const lum = Math.floor((0.299 * r + 0.587 * gg + 0.114 * b) / 52);
            let hue = 6;
            if (mx - mn > 28) {
              const hh = mx === r ? ((gg - b) / (mx - mn) + 6) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
              hue = Math.floor(hh) % 6;
            }
            items.push({
              st: this.makeStroke(tr.pts, { tool, size, flow: 0.9, hardness, opacity, r, g: gg, b }, false, 1, 'Block-in · large masses', true),
              key: lum * 7 + hue,
              pos: Math.floor(y / (R * 3)) * 10000 + x,
            });
          }
        }
        // paint one colour family at a time, biggest masses first
        const counts = new Map<number, number>();
        for (const it of items) counts.set(it.key, (counts.get(it.key) || 0) + 1);
        items.sort((a, b) => (counts.get(b.key) as number) - (counts.get(a.key) as number) || a.key - b.key || a.pos - b.pos);
        return items.map((i) => i.st);
      },
    };
    return pass;
  }

  /** Error-driven pass: strokes go where the canvas differs most from the reference. */
  private errorPass(c: ErrCfg): Pass {
    let level: Float32Array | null = null;
    let ti = 0;
    let iters = 0;
    let total = 0;
    let firstCount = 0;
    let finished = false;
    const R = c.size / 2;
    const g = Math.max(1, Math.round(c.grid));
    const pass: Pass = {
      phase: c.phase,
      weight: c.weight,
      end: 0,
      est: 0,
      plan: () => {
        if (finished) {
          level = null;
          return [];
        }
        const w = this.w;
        const h = this.h;
        if (!level) level = c.sigma >= 0.3 ? gaussBlur(this.target, w, h, 3, c.sigma) : this.target;
        const f = this.field(c.field);
        const err = this.err;
        const gw = Math.ceil(w / g);
        const gh = Math.ceil(h / g);
        const nc = gw * gh;
        const mean = new Float32Array(nc);
        const arg = new Int32Array(nc);
        for (;;) {
          this.computeErr(level);
          // per-cell mean error and location of the worst pixel
          if (g === 1) {
            mean.set(err);
            for (let i = 0; i < nc; i++) arg[i] = i;
          } else {
            const mx = new Float32Array(nc);
            const cnt = new Uint16Array(nc);
            mean.fill(0);
            for (let y = 0; y < h; y++) {
              const cy = Math.floor(y / g) * gw;
              for (let x = 0; x < w; x++) {
                const ci = cy + Math.floor(x / g);
                const e = err[y * w + x];
                mean[ci] += e;
                cnt[ci]++;
                if (e > mx[ci]) {
                  mx[ci] = e;
                  arg[ci] = y * w + x;
                }
              }
            }
            for (let i = 0; i < nc; i++) mean[i] /= cnt[i] || 1;
          }
          const T = c.Ts[ti];
          const list: number[] = [];
          for (let i = 0; i < nc; i++) {
            if (mean[i] > T && (c.minDetail === undefined || this.detail[arg[i]] >= c.minDetail)) list.push(i);
          }
          let score = mean;
          if (c.weightDetail) {
            score = new Float32Array(nc);
            for (const i of list) score[i] = mean[i] * (0.6 + Math.min(2, this.detail[arg[i]]));
          }
          list.sort((a, b) => score[b] - score[a]);
          const batchMax = Math.min(c.maxStrokes - total, Math.max(80, Math.min(6000, Math.ceil(list.length * 0.5))));
          const claimed = new Uint8Array(nc);
          const out: AutoStroke[] = [];
          const scores: number[] = [];
          const cfg: TraceCfg = {
            step: c.snap ? 1 : Math.max(1, R * 0.5),
            maxLen: c.snap ? c.maxLenR : R * c.maxLenR,
            minLen: R * c.minLenR,
            colorTol: c.colorTol || T * 1.6,
            fc: c.fc,
            snap: c.snap,
            accept: c.accept,
            hertz: true,
            angle: c.angle,
            minPts: c.minPts ?? 2,
          };
          for (const ci of list) {
            if (out.length >= batchMax) break;
            if (claimed[ci]) continue;
            claimed[ci] = 1;
            const p = arg[ci];
            const tr = this.trace((p % w) + 0.5, Math.floor(p / w) + 0.5, level, f, cfg);
            if (!tr) continue;
            const pts = tr.pts;
            for (let k = 0; k < pts.length; k += 2) claimed[Math.floor(pts[k + 1] / g) * gw + Math.floor(pts[k] / g)] = 1;
            let { r, g: gg, b } = tr;
            if (c.jitter) {
              const j = (this.rnd() - 0.5) * 2 * c.jitter;
              r = Math.min(255, Math.max(0, r + j + (this.rnd() - 0.5) * c.jitter));
              gg = Math.min(255, Math.max(0, gg + j + (this.rnd() - 0.5) * c.jitter));
              b = Math.min(255, Math.max(0, b + j + (this.rnd() - 0.5) * c.jitter));
            }
            out.push(
              this.makeStroke(pts, { tool: c.tool, size: c.size, flow: c.flow, hardness: c.hardness, opacity: c.opacity, r, g: gg, b }, c.snap, c.phase, c.label, !!c.taper),
            );
            scores.push(score[ci]);
          }
          total += out.length;
          iters++;
          if (!firstCount) firstCount = out.length;
          const weak = out.length < Math.max(3, firstCount * 0.03);
          const levelsLeft = c.Ts.length - 1 - ti;
          if (weak || iters >= c.maxIter || total >= c.maxStrokes) {
            ti++;
            iters = 0;
            firstCount = 0;
            if (ti >= c.Ts.length || total >= c.maxStrokes) finished = true;
          }
          if (!out.length) {
            if (finished) {
              level = null;
              return [];
            }
            continue; // try the next (lower) threshold right away
          }
          pass.est = finished ? 0 : Math.max(0, list.length - out.length) * 0.35 + out.length * 0.6 * levelsLeft;
          return this.orderByRegion(out, scores);
        }
      },
    };
    return pass;
  }

  /** Soften strokes over smooth regions (skin, backgrounds) where brushwork left seams. */
  private blendPass(size: number, strength: number, iters: number): Pass {
    let iter = 0;
    let hfT: Float32Array | null = null;
    const pass: Pass = {
      phase: 3,
      weight: 1,
      end: 0,
      est: 0,
      plan: () => {
        if (iter >= iters) return [];
        iter++;
        const w = this.w;
        const h = this.h;
        const n = this.n;
        const R = size / 2;
        const sig = Math.max(1, R * 0.5);
        if (!hfT) {
          const bl = gaussBlur(this.luma, w, h, 1, sig);
          hfT = new Float32Array(n);
          for (let i = 0; i < n; i++) hfT[i] = Math.abs(this.luma[i] - bl[i]);
        }
        const L = this.layer;
        const cl = new Float32Array(n);
        for (let i = 0, j = 0; i < n; i++, j += 4) {
          const ia = 1 - L[j + 3];
          cl[i] = 0.299 * (L[j] + ia * PAPER[0]) + 0.587 * (L[j + 1] + ia * PAPER[1]) + 0.114 * (L[j + 2] + ia * PAPER[2]);
        }
        const cb = gaussBlur(cl, w, h, 1, sig);
        const g = Math.max(2, Math.round(R));
        const gw = Math.ceil(w / g);
        const gh = Math.ceil(h / g);
        const nc = gw * gh;
        const sc = new Float32Array(nc);
        const st = new Float32Array(nc);
        const sd = new Float32Array(nc);
        const cnt = new Uint16Array(nc);
        for (let y = 0; y < h; y++) {
          const cy = Math.floor(y / g) * gw;
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const ci = cy + Math.floor(x / g);
            sc[ci] += Math.abs(cl[i] - cb[i]);
            st[ci] += (hfT as Float32Array)[i];
            sd[ci] += this.detail[i];
            cnt[ci]++;
          }
        }
        const smooth = 0.3;
        const T = this.target;
        const list: number[] = [];
        const skinCell = new Uint8Array(nc);
        const score = new Float32Array(nc);
        for (let ci = 0; ci < nc; ci++) {
          const k = cnt[ci] || 1;
          const cx = Math.min(w - 1, (ci % gw) * g + (g >> 1));
          const cy = Math.min(h - 1, Math.floor(ci / gw) * g + (g >> 1));
          const p = (cy * w + cx) * 3;
          const skin = isSkin(T[p], T[p + 1], T[p + 2]);
          skinCell[ci] = skin ? 1 : 0;
          const lim = skin ? smooth * 1.6 : smooth;
          const excess = sc[ci] / k - (st[ci] / k) * 1.2 - 0.35;
          if (sd[ci] / k < lim && excess > 0) {
            score[ci] = excess;
            list.push(ci);
          }
        }
        list.sort((a, b) => score[b] - score[a]);
        const f = this.field('mid');
        const out: AutoStroke[] = [];
        const scores: number[] = [];
        const claimed = new Uint8Array(nc);
        const step = Math.max(1, R * 0.6);
        for (const ci of list) {
          if (out.length >= 2500) break;
          if (claimed[ci]) continue;
          claimed[ci] = 1;
          const lim = (skinCell[ci] ? smooth * 1.6 : smooth) * 1.5;
          let x = Math.min(w - 1, (ci % gw) * g + g * this.rnd());
          let y = Math.min(h - 1, Math.floor(ci / gw) * g + g * this.rnd());
          const i0 = Math.floor(y) * w + Math.floor(x);
          let dx: number;
          let dy: number;
          if (f.coh[i0] > 0.15) {
            dx = f.tx[i0];
            dy = f.ty[i0];
          } else {
            const a = this.rnd() * Math.PI * 2;
            dx = Math.cos(a);
            dy = Math.sin(a);
          }
          if (this.rnd() < 0.5) {
            dx = -dx;
            dy = -dy;
          }
          const pts: number[] = [x, y];
          const maxSteps = 4 + Math.floor(this.rnd() * 5);
          for (let k = 0; k < maxSteps; k++) {
            const nx = x + dx * step;
            const ny = y + dy * step;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
            const i = Math.floor(ny) * w + Math.floor(nx);
            if (this.detail[i] > lim) break;
            x = nx;
            y = ny;
            pts.push(x, y);
            claimed[Math.floor(y / g) * gw + Math.floor(x / g)] = 1;
            // gentle meander
            const a = (this.rnd() - 0.5) * 0.7;
            const ndx = dx * Math.cos(a) - dy * Math.sin(a);
            dy = dx * Math.sin(a) + dy * Math.cos(a);
            dx = ndx;
          }
          const j = i0 * 4;
          const ia = 1 - L[j + 3];
          out.push(
            this.makeStroke(
              pts,
              { tool: 'soften', size, flow: 0.55 * strength, hardness: 0, opacity: 1, r: L[j] + ia * PAPER[0], g: L[j + 1] + ia * PAPER[1], b: L[j + 2] + ia * PAPER[2] },
              false,
              3,
              skinCell[ci] ? 'Blend · soften skin' : 'Blend · soften background',
              false,
            ),
          );
          scores.push(score[ci]);
        }
        pass.est = iter < iters ? out.length * 0.5 : 0;
        return this.orderByRegion(out, scores);
      },
    };
    return pass;
  }

  // --------------------------------------------------------------- helpers

  private makeStroke(xy: number[], params: BrushParams, snap: boolean, phase: number, label: string, taper: boolean): AutoStroke {
    const np = xy.length / 2;
    const pts = new Float32Array(np * 3);
    for (let i = 0; i < np; i++) {
      pts[i * 3] = xy[i * 2];
      pts[i * 3 + 1] = xy[i * 2 + 1];
      pts[i * 3 + 2] = taper && np > 2 ? 0.7 + 0.3 * Math.sin((Math.PI * i) / (np - 1)) : 1;
    }
    params.r = Math.round(params.r);
    params.g = Math.round(params.g);
    params.b = Math.round(params.b);
    return { params, pts, snap, phase, label, cost: 0 };
  }

  /** Keep the hand in one area at a time: worst region first, then its neighbours. */
  private orderByRegion(strokes: AutoStroke[], scores: number[]): AutoStroke[] {
    const tile = Math.max(24, Math.round(96 * this.s));
    const tw = Math.ceil(this.w / tile);
    const groups = new Map<number, AutoStroke[]>();
    const idx = strokes.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
    for (const i of idx) {
      const st = strokes[i];
      const m = Math.floor(st.pts.length / 6) * 3;
      const key = Math.floor(st.pts[m + 1] / tile) * tw + Math.floor(st.pts[m] / tile);
      let gr = groups.get(key);
      if (!gr) {
        gr = [];
        groups.set(key, gr);
      }
      gr.push(st);
    }
    const out: AutoStroke[] = [];
    for (const gr of groups.values()) for (const st of gr) out.push(st);
    return out;
  }

  /**
   * Trace a stroke path through (x0, y0) following the orientation field in
   * both directions. Stops when the reference colour drifts away from the
   * stroke colour, or when the canvas there is already closer to the
   * reference than this stroke would make it.
   */
  private trace(x0: number, y0: number, level: Float32Array, f: Field, c: TraceCfg): { pts: number[]; r: number; g: number; b: number } | null {
    const w = this.w;
    const h = this.h;
    const L = this.layer;
    const i0 = Math.floor(y0) * w + Math.floor(x0);
    const cr = level[i0 * 3];
    const cg = level[i0 * 3 + 1];
    const cb = level[i0 * 3 + 2];
    let dx0: number;
    let dy0: number;
    if (c.angle !== undefined) {
      const a = c.angle + (this.rnd() - 0.5) * 0.35;
      dx0 = Math.cos(a);
      dy0 = Math.sin(a);
    } else if (f.coh[i0] > 0.04) {
      dx0 = f.tx[i0];
      dy0 = f.ty[i0];
    } else {
      const a = this.rnd() * Math.PI;
      dx0 = Math.cos(a);
      dy0 = Math.sin(a);
    }
    const half = c.maxLen / 2;
    const minHalf = c.minLen / 2;
    const walk = (dx: number, dy: number): number[] => {
      const out: number[] = [];
      let x = x0;
      let y = y0;
      let len = 0;
      let lpx = Math.floor(x0);
      let lpy = Math.floor(y0);
      while (len < half) {
        const nx = x + dx * c.step;
        const ny = y + dy * c.step;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
        const px = Math.floor(nx);
        const py = Math.floor(ny);
        const i = py * w + px;
        const k = i * 3;
        const lr = level[k];
        const lg = level[k + 1];
        const lb = level[k + 2];
        const dCol = (Math.abs(lr - cr) + Math.abs(lg - cg) + Math.abs(lb - cb)) / 3;
        if (dCol > c.colorTol) break;
        if (c.hertz && len >= minHalf) {
          const j = i * 4;
          const ia = 1 - L[j + 3];
          const dCan = (Math.abs(lr - L[j] - ia * PAPER[0]) + Math.abs(lg - L[j + 1] - ia * PAPER[1]) + Math.abs(lb - L[j + 2] - ia * PAPER[2])) / 3;
          if (dCan < dCol) break;
        }
        x = nx;
        y = ny;
        len += c.step;
        if (c.snap) {
          if (px !== lpx || py !== lpy) {
            out.push(px + 0.5, py + 0.5);
            lpx = px;
            lpy = py;
          }
        } else out.push(x, y);
        if (c.angle === undefined && f.coh[i] > 0.04) {
          let tx = f.tx[i];
          let ty = f.ty[i];
          if (tx * dx + ty * dy < 0) {
            tx = -tx;
            ty = -ty;
          }
          dx = c.fc * tx + (1 - c.fc) * dx;
          dy = c.fc * ty + (1 - c.fc) * dy;
          const m = Math.hypot(dx, dy) || 1;
          dx /= m;
          dy /= m;
        }
      }
      return out;
    };
    const fwd = walk(dx0, dy0);
    const back = walk(-dx0, -dy0);
    const pts: number[] = [];
    for (let k = back.length - 2; k >= 0; k -= 2) pts.push(back[k], back[k + 1]);
    if (c.snap) pts.push(Math.floor(x0) + 0.5, Math.floor(y0) + 0.5);
    else pts.push(x0, y0);
    for (let k = 0; k < fwd.length; k++) pts.push(fwd[k]);
    const np = pts.length / 2;
    if (np < c.minPts) return null;
    // stroke colour = mean reference colour along the path
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let k = 0; k < pts.length; k += 2) {
      const q = (Math.floor(pts[k + 1]) * w + Math.floor(pts[k])) * 3;
      sr += level[q];
      sg += level[q + 1];
      sb += level[q + 2];
    }
    sr /= np;
    sg /= np;
    sb /= np;
    if (c.accept > 0) {
      let before = 0;
      let after = 0;
      for (let k = 0; k < pts.length; k += 2) {
        const i = Math.floor(pts[k + 1]) * w + Math.floor(pts[k]);
        const q = i * 3;
        const j = i * 4;
        const ia = 1 - L[j + 3];
        before += Math.abs(level[q] - L[j] - ia * PAPER[0]) + Math.abs(level[q + 1] - L[j + 1] - ia * PAPER[1]) + Math.abs(level[q + 2] - L[j + 2] - ia * PAPER[2]);
        after += Math.abs(level[q] - sr) + Math.abs(level[q + 1] - sg) + Math.abs(level[q + 2] - sb);
      }
      if (after >= before * c.accept) return null;
    }
    return { pts, r: sr, g: sg, b: sb };
  }
}
