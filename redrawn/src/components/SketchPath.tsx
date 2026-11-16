import React from "react";
import { COLORS } from "../scenes";
import { useInk } from "../lib/ink";
import { rnd, seedOf, srnd } from "../lib/rand";
import { add, mul, norm, sub, subdivide, type Pt } from "../lib/util";

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

/**
 * The pencil line. Every stroke in the film goes through here:
 * points get seeded random jitter whose size and re-seed rate come from the global boil.
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
  const baked = fresh && !ink.ghost ? 1.1 / zs : 0; // permanent wobble of a redrawn line

  let base = smooth ? pts : subdivide(pts, step / Math.sqrt(ink.zoom), closed);
  let isClosed = closed;
  if (fresh && !ink.ghost) {
    // overshoot both ends; closed shapes become an open loop whose ends cross
    if (closed) {
      base = [...base, base[0]];
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

  const jit = (k: number): Pt[] =>
    base.map((p, i) => [
      p[0] + srnd(s + k, tick, i * 2) * amp + srnd(s, 777, i * 2) * baked,
      p[1] + srnd(s + k, tick, i * 2 + 1) * amp + srnd(s, 777, i * 2 + 1) * baked,
    ]);
  const toD = (p: Pt[]) => (smooth ? smoothD(p, isClosed) : sharpD(p, isClosed));

  const col = ink.ghost ? COLORS.ghost : (stroke ?? ink.color);
  const w =
    (width * (0.9 + 0.2 * rnd(s, tick, 991)) * (ink.ghost ? 1.15 : ink.weight) * (fresh && !ink.ghost ? 1.4 : 1)) / zs;
  const drawing = draw !== undefined && draw < 1;
  const dash: React.SVGProps<SVGPathElement> = drawing
    ? { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - (draw as number) }
    : ink.weight < 0.55 && !ink.ghost
      ? {
          // faint, broken outline
          strokeDasharray: [0, 1, 2, 3, 4, 5].map((i) => f1(((i % 2 ? 3 + 5 * rnd(s, i) : 9 + 22 * rnd(s, i)) / zs))).join(" "),
          strokeDashoffset: f1(rnd(s, 5) * 40),
        }
      : {};
  const f = ink.ghost || drawing ? "none" : fill;
  return (
    <g opacity={opacity}>
      {ink.ghost ? (
        // eraser smudge: a soft wide halo under the ghost line
        <path d={toD(jit(0))} stroke={col} strokeWidth={f1(w * 4.5)} fill="none" opacity={0.5} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      <path d={toD(jit(0))} stroke={col} strokeWidth={f1(w)} fill={f} strokeLinecap="round" strokeLinejoin="round" {...dash} />
      {double && !ink.ghost ? (
        <path
          d={toD(jit(7919))}
          transform={`translate(${f1(0.8 / zs)} ${f1(0.6 / zs)})`}
          stroke={col}
          strokeWidth={f1(w * 0.75)}
          fill="none"
          opacity={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...dash}
        />
      ) : null}
    </g>
  );
};
