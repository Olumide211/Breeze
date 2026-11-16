import React from "react";
import { COLORS } from "../scenes";
import { useInk } from "../lib/ink";
import { rnd, seedOf, srnd } from "../lib/rand";
import { clamp, norm, type Pt } from "../lib/util";
import { smoothD } from "./SketchPath";

const f1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The nagging: a dense tangle of 15–25 looping strokes packed inside an ellipse, with a small tail.
 * No text. Re-randomised every frame, whatever the boil.
 */
export const ScribbleBubble: React.FC<{
  x: number;
  y: number;
  size: number;
  /** where the tail points back to */
  tail: Pt;
  seed: string | number;
  opacity?: number;
}> = ({ x, y, size, tail, seed, opacity = 1 }) => {
  const ink = useInk();
  const s = seedOf(seed);
  const fr = ink.frame;
  const rx = size;
  const ry = size * 0.72;
  const zs = Math.pow(ink.zoom, 0.6);
  const count = 15 + Math.floor(rnd(s, 3) * 11); // 15–25
  const paths: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const n = 6 + Math.floor(rnd(s + i, fr, 1) * 4);
    const pts: Pt[] = [];
    for (let j = 0; j < n; j++) {
      const a = rnd(s + i, fr, j * 2 + 10) * Math.PI * 2;
      const r = Math.sqrt(rnd(s + i, fr, j * 2 + 11));
      pts.push([x + Math.cos(a) * r * rx, y + Math.sin(a) * r * ry]);
    }
    paths.push(<path key={i} d={smoothD(pts, true)} strokeWidth={f1((1.5 + rnd(s + i, fr, 2) * 1.1) / zs)} />);
  }
  // tail: a little scribbled wedge pointing back at where it came from
  const d = norm([tail[0] - x, tail[1] - y]);
  const nrm: Pt = [-d[1], d[0]];
  const edge = 1 / Math.hypot(d[0] / rx, d[1] / ry);
  const tailPts: Pt[] = [];
  for (let k = 0; k <= 7; k++) {
    const t = k / 7;
    const along = edge * 0.8 + t * size * 0.75;
    const side = (k % 2 ? 1 : -1) * (1 - t) * size * 0.26 + srnd(s, fr, 90 + k) * 1.5;
    tailPts.push([x + d[0] * along + nrm[0] * side, y + d[1] * along + nrm[1] * side]);
  }
  return (
    <g fill="none" stroke={COLORS.ink} strokeLinecap="round" opacity={clamp(opacity)}>
      {paths}
      <path d={smoothD(tailPts, false)} strokeWidth={f1(2 / zs)} />
    </g>
  );
};

/**
 * CRUMBLE: the bubble breaks into 20–30 fragments that fall with gravity, spin a little,
 * and fade to dust on the floor over 10 frames. t = frames since it broke.
 */
export const BubbleCrumble: React.FC<{
  x: number;
  y: number;
  size: number;
  seed: string | number;
  t: number;
  floorY: number;
}> = ({ x, y, size, seed, t, floorY }) => {
  const ink = useInk();
  const s = seedOf(seed);
  const zs = Math.pow(ink.zoom, 0.6);
  const count = 20 + Math.floor(rnd(s, 4) * 11); // 20–30
  const G = 2.6;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd(s, i, 1) * Math.PI * 2;
    const r = Math.sqrt(rnd(s, i, 2));
    const x0 = x + Math.cos(a) * r * size;
    const y0 = y + Math.sin(a) * r * size * 0.72;
    const vx = srnd(s, i, 3) * 2.6 + Math.cos(a) * 1.5;
    const vy = -rnd(s, i, 4) * 5;
    const floor = floorY + rnd(s, i, 5) * 34;
    // time to land: y0 + vy t + G/2 t² = floor
    const land = (-vy + Math.sqrt(vy * vy + 2 * G * Math.max(1, floor - y0))) / G;
    const tt = Math.min(t, land);
    const px = x0 + vx * tt;
    const py = Math.min(floor, y0 + vy * tt + 0.5 * G * tt * tt);
    const dust = clamp((t - land) / 10); // 0 falling → 1 dust
    if (dust >= 1 && rnd(s, i, 6) < 0.35) continue;
    const scale = 1 - 0.78 * dust;
    const spin = srnd(s, i, 7) * 14 * tt;
    const L = size * (0.12 + 0.16 * rnd(s, i, 8)) * scale;
    const pts: Pt[] = [
      [-L, srnd(s, i, 9) * L * 0.6],
      [-L * 0.3, srnd(s, i, 10) * L * 0.9],
      [L * 0.35, srnd(s, i, 11) * L * 0.9],
      [L, srnd(s, i, 12) * L * 0.6],
    ];
    out.push(
      <path
        key={i}
        d={smoothD(pts, false)}
        transform={`translate(${f1(px)} ${f1(py)}) rotate(${f1(spin)})`}
        stroke={dust > 0.5 ? COLORS.ghost : COLORS.ink}
        strokeWidth={f1((2 - 0.6 * dust) / zs)}
        opacity={1 - 0.45 * dust}
      />,
    );
  }
  return (
    <g fill="none" strokeLinecap="round">
      {out}
    </g>
  );
};
