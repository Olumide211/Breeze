export type Pt = [number, number];

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const ease = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** 0→1 with an overshoot and settle */
export const spring = (t: number) => {
  const c = clamp(t);
  return c >= 1 ? 1 : 1 - Math.exp(-5.5 * c) * Math.cos(9 * c);
};
export const easeIn = (t: number) => Math.pow(clamp(t), 1.8);
export const linear = (t: number) => clamp(t);

/** Keyframe interpolation: keys = [[frame, value], ...] */
export const kf = (f: number, keys: [number, number][], fn: (t: number) => number = ease): number => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, v0] = keys[i - 1];
      const [f1, v1] = keys[i];
      return lerp(v0, v1, fn((f - f0) / (f1 - f0)));
    }
  }
  return keys[keys.length - 1][1];
};
export const kfPt = (f: number, keys: [number, number, number][], fn: (t: number) => number = ease): Pt => [
  kf(f, keys.map((k) => [k[0], k[1]] as [number, number]), fn),
  kf(f, keys.map((k) => [k[0], k[2]] as [number, number]), fn),
];
/** 0→1→0 bump starting at `at`, lasting `dur` frames */
export const bump = (f: number, at: number, dur: number) => {
  const t = (f - at) / dur;
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
};
/** progress 0..1 of an event */
export const prog = (f: number, at: number, dur: number) => clamp((f - at) / dur);

export const rad = (d: number) => (d * Math.PI) / 180;
export const rot = (p: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const dir = (deg: number): Pt => [Math.cos(rad(deg)), Math.sin(rad(deg))];
export const norm = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(lerp(a0, a1, i / n));
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
};

/** Point along a polyline at progress 0..1 (by length) */
export const pointAt = (pts: Pt[], p: number): Pt => {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    lens.push(l);
    total += l;
  }
  let target = clamp(p) * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i]) return lerpPt(pts[i], pts[i + 1], lens[i] ? target / lens[i] : 0);
    target -= lens[i];
  }
  return pts[pts.length - 1];
};

export const subdivide = (pts: Pt[], step: number, closed = false): Pt[] => {
  const out: Pt[] = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const k = Math.max(1, Math.round(dist(a, b) / step));
    for (let j = 0; j < k; j++) out.push(lerpPt(a, b, j / k));
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
};

export const bbox = (pts: Pt[], pad = 0): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
};

/** Two-bone IK. bend=+1 puts the elbow clockwise (screen) from the shoulder→target line. */
export const ik = (s: Pt, t: Pt, a: number, b: number, bend: 1 | -1, stretch = 1.2): { elbow: Pt; hand: Pt } => {
  let d = dist(s, t);
  let target = t;
  const max = (a + b) * stretch;
  if (d > max) {
    target = add(s, mul(sub(t, s), max / d));
    d = max;
  }
  let la = a, lb = b;
  if (d > a + b - 0.01) {
    const k = d / (a + b - 0.01);
    la = a * k; lb = b * k;
  }
  // foreshorten when the target is close, so the elbow doesn't jut out
  if (d < (la + lb) * 0.7) {
    const k = Math.max(0.35, d / ((la + lb) * 0.7));
    la *= k; lb *= k;
  }
  d = Math.max(d, Math.abs(la - lb) + 0.01);
  const cosA = clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1);
  const base = Math.atan2(target[1] - s[1], target[0] - s[0]);
  const ang = base + bend * Math.acos(cosA);
  return { elbow: [s[0] + la * Math.cos(ang), s[1] + la * Math.sin(ang)], hand: target };
};
