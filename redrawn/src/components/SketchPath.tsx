import React from "react";
import { COLORS } from "../scenes";
import { useInk } from "../lib/ink";
import { rnd, seedOf, srnd } from "../lib/rand";
import { add, mul, norm, sub, type Pt } from "../lib/util";

const f1 = (n: number) => Math.round(n * 100) / 100;

export const smoothD = (p: Pt[], closed: boolean): string => {
  const n = p.length;
  if (n < 2) return "";
  const at = (i: number): Pt => (closed ? p[((i % n) + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(
      p2[1] - (p3[1] - p1[1]) / 6,
    )} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return closed ? d + "Z" : d;
};
export const sharpD = (p: Pt[], closed: boolean): string =>
  p.map((q, i) => `${i ? "L" : "M"}${f1(q[0])} ${f1(q[1])}`).join("") + (closed ? "Z" : "");

export type SketchProps = {
  pts: Pt[];
  seed: string | number;
  closed?: boolean;
  /** smooth curve through the points (default) or wobbly straight segments */
  smooth?: boolean;
  width?: number;
  stroke?: string;
  fill?: string;
  /** draw the stroke twice with a small offset */
  double?: boolean;
  /** 0..1 stroke-dashoffset draw-on */
  draw?: number;
  /** REDRAWN "new line" style: thicker, shakier, overshooting ends */
  fresh?: boolean;
  /** jitter multiplier */
  jitter?: number;
  /** spacing of jitter points on straight segments (world px) */
  step?: number;
  opacity?: number;
};


/** Dense samples along the (Catmull-Rom) curve through `p`. */
const sampleCurve = (p: Pt[], closed: boolean, spacing: number): Pt[] => {
  const n = p.length;
  const at = (i: number): Pt => (closed ? p[((i % n) + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const k = Math.max(2, Math.min(24, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / spacing)));
    for (let j = 0; j < k; j++) {
      const t = j / k, u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  out.push(closed ? out[0] : p[n - 1]);
  return out;
};

/** A brush stroke: a filled ribbon that is thin at the ends and swells in the middle, like ink from a pressure pen. */
const ribbon = (pts: Pt[], w: number, s: number, taperEnds: boolean): string => {
  const n = pts.length;
  if (n < 2) return "";
  const left: string[] = [];
  const right: string[] = [];
  const ph = rnd(s, 41) * 6.28;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1);
    const press = taperEnds ? 0.22 + 0.78 * Math.pow(Math.min(1, t / 0.22, (1 - t) / 0.22), 0.75) : 1;
    const h = (w / 2) * press * (1 + 0.22 * Math.sin(t * 7 + ph) + 0.1 * Math.sin(t * 19 + ph * 2));
    const nx = (-dy / l) * h, ny = (dx / l) * h;
    left.push(`${f1(pts[i][0] + nx)} ${f1(pts[i][1] + ny)}`);
    right.push(`${f1(pts[i][0] - nx)} ${f1(pts[i][1] - ny)}`);
  }
  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
};

/**
 * The pencil line. Every stroke in the film goes through here:
 * points get seeded random jitter whose size and re-seed rate come from the global boil,
 * then the line is inked as a tapered brush ribbon.
 */
export const SketchPath: React.FC<SketchProps> = ({
  pts, seed, closed = false, smooth = true, width = 2.5, stroke, fill = "none", double, draw, fresh, jitter = 1, step = 16, opacity,
}) => {
  const ink = useInk();
  if (pts.length < 2) return null;
  if (draw !== undefined && draw <= 0) return null;
  const s = seedOf(seed);
  const zs = Math.pow(ink.zoom, 0.6);
  const tick = ink.ghost ? 0 : ink.tick;
  const amp = ((ink.ghost ? 0.25 : ink.amp) / ink.zoom) * jitter * (fresh ? 1.3 : 1);
  const baked = fresh && !ink.ghost ? 0.7 / zs : 0; // permanent wobble of a redrawn line

  // control points (+ which of them are hard corners)
  let base: Pt[] = pts;
  let corner: boolean[] = pts.map(() => false);
  if (!smooth) {
    base = [];
    corner = [];
    const n = pts.length;
    const last = closed ? n : n - 1;
    const st = (step * 1.6) / Math.sqrt(ink.zoom);
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / st));
      for (let j = 0; j < k; j++) {
        base.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
        corner.push(j === 0);
      }
    }
    if (!closed) {
      base.push(pts[n - 1]);
      corner.push(true);
    }
  }
  let isClosed = closed;
  if (fresh && !ink.ghost) {
    // overshoot both ends; closed shapes become an open loop whose ends cross
    if (closed) {
      base = [...base, base[0]];
      corner = [...corner, corner[0]];
      isClosed = false;
    }
    const n = base.length;
    const o0 = (2.5 + 2.5 * rnd(s, 11)) / zs;
    const o1 = (2.5 + 3 * rnd(s, 12)) / zs;
    base = [
      add(base[0], mul(norm(sub(base[0], base[1])), o0)),
      ...base.slice(1, n - 1),
      add(base[n - 1], mul(norm(sub(base[n - 1], base[n - 2])), o1)),
    ];
  }

  // jitter that varies smoothly along the line (so boil wobbles the line instead of shredding it)
  const lens: number[] = [0];
  for (let i = 1; i < base.length; i++) lens.push(lens[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
  const wave = 26 / Math.sqrt(ink.zoom);
  const noise = (k: number, tk: number, at: number, axis: number) => {
    const u = at / wave;
    const i0 = Math.floor(u);
    const fr = u - i0;
    const sm = fr * fr * (3 - 2 * fr);
    return srnd(k, tk, i0 * 2 + axis) * (1 - sm) + srnd(k, tk, (i0 + 1) * 2 + axis) * sm;
  };
  const jit = (k: number): Pt[] => {
    const out: Pt[] = [];
    base.forEach((p, i) => {
      const q: Pt = [
        p[0] + noise(s + k, tick, lens[i], 0) * amp * 1.5 + srnd(s, 777, i * 2) * baked,
        p[1] + noise(s + k, tick, lens[i], 1) * amp * 1.5 + srnd(s, 777, i * 2 + 1) * baked,
      ];
      out.push(q);
      if (!smooth && corner[i] && (isClosed || (i > 0 && i < base.length - 1))) out.push(q); // doubled point = crisp corner
    });
    return out;
  };

  const col = ink.ghost ? COLORS.ghost : (stroke ?? ink.color);
  const w =
    (width * (0.9 + 0.2 * rnd(s, tick, 991)) * (ink.ghost ? 1.15 : ink.weight) * (fresh && !ink.ghost ? 1.25 : 1)) / zs;
  const ctrl = jit(0);

  if (ink.ghost) {
    const d = smoothD(ctrl, isClosed);
    return (
      <g opacity={opacity} fill="none" stroke={col} strokeLinecap="round" strokeLinejoin="round">
        {/* eraser smudge: a soft wide halo under the ghost line */}
        <path d={d} strokeWidth={f1(w * 4.5)} opacity={0.5} />
        <path d={d} strokeWidth={f1(w)} />
      </g>
    );
  }

  const drawing = draw !== undefined && draw < 1;
  const spacing = 3 / Math.sqrt(ink.zoom);
  let dense = sampleCurve(ctrl, isClosed, spacing);
  if (drawing) dense = dense.slice(0, Math.max(2, Math.ceil(dense.length * (draw as number))));
  const inkW = w * 1.3;
  const strokes: string[] = [];
  if (ink.weight < 0.55) {
    // faint, broken outline: short separate dabs with gaps
    let i = 0, k = 0;
    while (i < dense.length - 2) {
      const run = Math.round((7 + 16 * rnd(s, k, 61)) / (spacing * zs));
      const gap = Math.round((3 + 5 * rnd(s, k, 62)) / (spacing * zs));
      strokes.push(ribbon(dense.slice(i, i + Math.max(3, run)), inkW, s + k, true));
      i += Math.max(3, run) + Math.max(1, gap);
      k++;
    }
  } else {
    strokes.push(ribbon(dense, inkW, s, !isClosed || drawing));
  }
  return (
    <g opacity={opacity}>
      {fill !== "none" && !drawing ? <path d={smoothD(ctrl, isClosed)} fill={fill} stroke="none" /> : null}
      <path d={strokes.join("")} fill={col} stroke="none" />
      {double ? (
        // a faint second pass, like the construction line under the ink
        <path
          d={smoothD(jit(7919), isClosed)}
          transform={`translate(${f1(1.1 / zs)} ${f1(0.8 / zs)})`}
          stroke={col}
          strokeWidth={f1(Math.max(0.35, w * 0.3))}
          fill="none"
          opacity={0.45}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
};
