import React from "react";
import { COLORS } from "../scenes";
import { Ink } from "../lib/ink";
import { add, arc, bbox, clamp, dir, ik, lerpPt, mul, norm, rot, sub, type Pt } from "../lib/util";
import { Erasable } from "./Erasable";
import { sharpD, SketchPath } from "./SketchPath";

export type Mouth = "smile" | "flat" | "o" | "sad" | "calmSmile";

/** 0 = intact, 0..1 = eraser sweeping, 1 = gone (ghost only) */
export type Erased = {
  smileCornerLeft: number;
  earRight: number;
  headOutlineSegments: [number, number, number, number];
  /** drawingHand: thumb, index, middle, ring, pinky */
  fingers: [number, number, number, number, number];
  palm: number;
};
/** 0 = not redrawn, 0..1 = draw-on progress, 1 = redrawn */
export type Redrawn = {
  smileCornerLeft: number;
  fingers: [number, number, number, number, number];
  palm: number;
};
export const INTACT: Erased = { smileCornerLeft: 0, earRight: 0, headOutlineSegments: [0, 0, 0, 0], fingers: [0, 0, 0, 0, 0], palm: 0 };
export const NOT_REDRAWN: Redrawn = { smileCornerLeft: 0, fingers: [0, 0, 0, 0, 0], palm: 0 };

export type BoyProps = {
  /** hip position (he is always seated) */
  x: number;
  y: number;
  id?: string;
  // expression
  eyeSize?: number;
  pupilSize?: number;
  pupilOffset?: { x: number; y: number };
  browAngle?: number;
  browRaise?: number;
  mouth?: Mouth;
  /** 0 upright → 1 hunched: lowers the head, rounds the shoulders */
  posture?: number;
  // body
  lean?: number;
  breath?: number;
  headTilt?: number;
  legDrop?: number;
  /** wrist targets in world coordinates */
  rightHand: Pt;
  leftHand: Pt;
  rightHandAngle?: number;
  leftHandAngle?: number;
  rightGrip?: number;
  leftGrip?: number;
  leftInFront?: boolean;
  // erasable / redrawn parts
  erased?: Erased;
  redrawn?: Redrawn;
  /** overall outline thickness 1.0 → 0.4 */
  lineWeight?: number;
  layer?: "all" | "legs" | "upper";
};

// ───────────────────────── rig ─────────────────────────
export const HEAD_R = 38;
const ARM = 42;

export const boyRig = (b: Pick<BoyProps, "x" | "y" | "posture" | "lean" | "breath" | "headTilt">) => {
  const p = b.posture ?? 0;
  const lean = b.lean ?? 0;
  const br = b.breath ?? 0;
  const T = (q: Pt): Pt => add([b.x, b.y], rot(q, lean));
  const head = T([11 + 26 * p, -112 + 26 * p - 2 * br]);
  const headAngle = lean * 0.6 + 18 * p + (b.headTilt ?? 0);
  return {
    T,
    p,
    br,
    head,
    headAngle,
    shoulderNear: T([3 + 13 * p, -57 + 10 * p - 3 * br]),
    shoulderFar: T([12 + 13 * p, -59 + 10 * p - 3 * br]),
    /** head-local point → world */
    headToWorld: (q: Pt): Pt => add(head, rot(q, headAngle)),
  };
};

// ───────────────────────── mouth ─────────────────────────
export const MOUTH_AT: Pt = [13, 21];
const M = (pts: Pt[]): Pt[] => pts.map((q) => add(mul(q, 1.15), MOUTH_AT));
const MOUTH_MAIN: Record<Mouth, Pt[]> = {
  smile: M([[-8, -1], [-4, 2.8], [1, 4.2], [5, 3.2]]),
  calmSmile: M([[-7, 0], [-3, 2], [1, 2.8], [5, 2.2]]),
  flat: M([[-6, 1.2], [-1, 1], [5, 1.2]]),
  sad: M([[-7, 3.6], [-3, 0.8], [1, 0.2], [5, 1.2]]),
  o: M(arc(0, 2, 3.4, 4.4, 20, 340, 9)),
};
const MOUTH_CORNER: Record<Mouth, Pt[]> = {
  smile: M([[5, 3.2], [8, 1.6], [10, -1.2], [10.6, -3.4]]),
  calmSmile: M([[5, 2.2], [8, 1], [10, -1]]),
  flat: M([[5, 1.2], [8, 1.1], [10.5, 1.3]]),
  sad: M([[5, 1.2], [8, 2.6], [10, 4.6]]),
  o: M(arc(0, 2, 3.4, 4.4, -20, 20, 3)),
};
/** the redrawn smile corner: not the one he had */
export const FRESH_CORNER: Pt[] = M([[4.2, 2.8], [8, 2.4], [11.2, 0], [12.6, -3.6]]);

// ───────────────────────── hand ─────────────────────────
export const HS = 1.2;
const sc = (pts: Pt[]): Pt[] => pts.map((q) => mul(q, HS));
const FINGERS = [
  { b: [6, -4.2] as Pt, ang: -48, len: 11.5, w: 5.6, curve: 0.2, taper: 0.42 }, // thumb
  { b: [13.4, -4.9] as Pt, ang: -8, len: 13, w: 4.7, curve: -0.05, taper: 0.5 }, // index
  { b: [15, -1.6] as Pt, ang: -2, len: 14.6, w: 4.7, curve: 0, taper: 0.5 }, // middle
  { b: [15, 2] as Pt, ang: 4, len: 13.2, w: 4.5, curve: 0.04, taper: 0.5 }, // ring
  { b: [13.4, 5.3] as Pt, ang: 11, len: 10.4, w: 4.1, curve: 0.08, taper: 0.5 }, // pinky
];
/** how each redrawn finger differs from the original */
const FRESH_VARIANT = [
  { len: 1.2, ang: 12, w: 1.1 },
  { len: 0.82, ang: -9, w: 1.2 },
  { len: 1.14, ang: 7, w: 1.05 },
  { len: 0.84, ang: -8, w: 1.25 },
  { len: 1.3, ang: 12, w: 1.1 },
];
const finger = (i: number, grip: number, fresh: boolean): Pt[] => {
  const f = FINGERS[i];
  const v = fresh ? FRESH_VARIANT[i] : { len: 1, ang: 0, w: 1 };
  const ang = f.ang + v.ang + (i === 0 ? 38 : 52) * grip;
  const len = f.len * v.len * (1 - 0.4 * grip);
  const h = (f.w * v.w) / 2;
  const d = dir(ang);
  const n: Pt = [-d[1], d[0]];
  // one tapered, slightly curved leaf that starts inside the palm
  const at = (t: number, side: number): Pt => {
    const tt = Math.max(0, t);
    const bend = f.curve * len * tt * tt;
    return add(f.b, add(mul(d, len * t), mul(n, side * h * (1 - f.taper * Math.pow(tt, 1.4)) + bend)));
  };
  return sc([at(-0.3, -1), at(0.3, -1), at(0.72, -1), at(0.95, -0.7), at(1.02, 0), at(0.95, 0.7), at(0.72, 1), at(0.3, 1), at(-0.3, 1)]);
};
// the palm flows out of the wrist; its knuckle side is never inked, so palm and fingers read as one shape
const PALM_TOP: Pt[] = sc([[-1, -4.2], [5, -5.6], [10, -6.8], [13.6, -7]]);
const PALM_KNUCKLES: Pt[] = sc([[16, -2.4], [16.2, 2.6]]);
const PALM_BOTTOM: Pt[] = sc([[13.6, 7.3], [9, 7.2], [4, 6], [-1, 4.4]]);
const PALM: Pt[] = [...PALM_TOP, ...PALM_KNUCKLES, ...PALM_BOTTOM];
const FRESH_PALM: Pt[] = sc([[-0.6, -4], [5.4, -6.6], [11, -7.8], [15.6, -6.4], [17.2, 0.2], [15.4, 6.6], [10, 8.4], [3.6, 6.8], [-1.4, 4.8]]);

export const freshPalm = (): Pt[] => [...FRESH_PALM, FRESH_PALM[0]];
export const freshFinger = (i: number): Pt[] => finger(i, 0, true);
/** hand-local point → world, matching how the Boy places his hand */
export const handToWorld = (wrist: Pt, angle: number, q: Pt): Pt => add(wrist, rot(q, angle));

const Hand: React.FC<{
  id: string;
  wrist: Pt;
  angle: number;
  grip: number;
  erased?: Erased;
  redrawn?: Redrawn;
}> = ({ id, wrist, angle, grip, erased, redrawn }) => {
  const e = erased ?? INTACT;
  const r = redrawn ?? NOT_REDRAWN;
  const one = (i: number) => {
    const pts = finger(i, grip, false);
    return (
      <Erasable key={i} id={`${id}-f${i}`} e={e.fingers[i]} box={bbox(pts, 1.2)}>
        {() => <SketchPath pts={pts} seed={`${id}-f${i}`} fill={COLORS.bg} width={W * 0.95} />}
      </Erasable>
    );
  };
  return (
    <g transform={`translate(${wrist[0]} ${wrist[1]}) rotate(${angle})`}>
      {[4, 3, 2, 1].map(one)}
      <Erasable id={`${id}-palm`} e={e.palm} box={bbox(PALM, 1.5)}>
        {(ghost) => (
          <>
            {ghost ? null : <path d={sharpD(PALM, true)} fill={COLORS.bg} />}
            <SketchPath pts={PALM_TOP} seed={`${id}-palmT`} width={W} />
            <SketchPath pts={PALM_BOTTOM} seed={`${id}-palmB`} width={W} />
          </>
        )}
      </Erasable>
      {one(0)}
      {/* REDRAWN: new-line style, each finger a little different from the one he lost */}
      {[4, 3, 2, 1].map((i) => (
        <SketchPath key={i} pts={finger(i, grip, true)} fresh seed={`${id}-newf${i}`} fill={COLORS.bg} width={W * 0.95} draw={r.fingers[i]} />
      ))}
      <SketchPath pts={FRESH_PALM} closed fresh seed={`${id}-newpalm`} fill={COLORS.bg} width={W} draw={r.palm} />
      <SketchPath pts={finger(0, grip, true)} fresh seed={`${id}-newf0`} fill={COLORS.bg} width={W * 0.95} draw={r.fingers[0]} />
    </g>
  );
};

// ───────────────────────── boy ─────────────────────────
const W = 2.1; // base line width
const SEG_ARCS: [number, number][] = [[-92, 2], [-2, 92], [88, 182], [178, 272]];

/** A soft limb: offsets a centre line into one continuous outline, open at the root so it merges into the body. */
const tube = (c: Pt[], w0: number, w1: number): Pt[] => {
  const n = c.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(n - 1, i + 1)];
    const t = norm(sub(b, a));
    const nr: Pt = [-t[1], t[0]];
    const h = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    left.push(add(c[i], mul(nr, -h)));
    right.push(add(c[i], mul(nr, h)));
  }
  return [...left, ...right.reverse()];
};
/** shoulder → elbow → wrist as a gently rounded centre line */
const limbLine = (a: Pt, b: Pt, c: Pt): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const soft = lerpPt(lerpPt(a, b, t), lerpPt(b, c, t), t); // quadratic through the joint region
    const hard = t < 0.5 ? lerpPt(a, b, t * 2) : lerpPt(b, c, t * 2 - 1);
    out.push(lerpPt(hard, soft, 0.45));
  }
  return out;
};

export const Boy: React.FC<BoyProps> = (props) => {
  const {
    id = "boy", eyeSize = 10.5, pupilSize = 2.3, pupilOffset = { x: 0.4, y: 0.3 }, browAngle = 0, browRaise = 0, mouth = "smile",
    legDrop = 88, rightHand, leftHand, rightGrip = 0, leftGrip = 0.2, leftInFront = false, lineWeight = 1, layer = "all",
  } = props;
  const erased = props.erased ?? INTACT;
  const redrawn = props.redrawn ?? NOT_REDRAWN;
  const rig = boyRig(props);
  const { T, p, br } = rig;
  const hip: Pt = [props.x, props.y];

  // legs (seated, facing right): soft tubes with a rounded foot
  const leg = (ox: number, oy: number, k: string) => {
    const a: Pt = add(hip, [-2 + ox, -5 + oy]);
    const knee: Pt = add(hip, [44 + ox, -6 + oy]);
    const ankle: Pt = add(hip, [45 + ox * 1.2, legDrop - 6]);
    const foot: Pt[] = [[-5.5, -2], [2, -5], [13, -4.5], [20, 0], [19, 5], [-5.5, 5]].map((q) => add(ankle, q as Pt));
    return (
      <g key={k}>
        <SketchPath pts={tube(limbLine(a, knee, ankle), 15, 10.5)} seed={`${id}-leg${k}`} width={W} fill={COLORS.bg} double />
        <SketchPath pts={foot} closed seed={`${id}-shoe${k}`} fill={COLORS.bg} width={W} />
      </g>
    );
  };

  // body: one soft silhouette with sloping shoulders
  const torso: Pt[] = [
    [-15, 5], [-18 - 5 * p, -30], [-15 + 9 * p, -56 + 9 * p - 3 * br], [-4 + 12 * p, -68 + 9 * p - 3 * br],
    [6 + 13 * p, -70 + 10 * p - 3 * br], [17 + 13 * p + 2 * br, -62 + 10 * p - 3 * br], [22 + 8 * p + 4 * br, -36], [19, 5],
  ].map((q) => T(q as Pt));
  const neck = (dx: number, k: string) => {
    const a = T([1 + dx + 12.5 * p, -67 + 9.5 * p - 3 * br]);
    const b = add(rig.head, rot([-9 + dx, HEAD_R - 3], rig.headAngle));
    return <SketchPath key={k} pts={[a, lerpPt(a, b, 0.5), b]} seed={`${id}-neck${k}`} width={W} />;
  };

  // arms: soft tubes ending in a hand
  const arm = (shoulder: Pt, target: Pt, k: string, cuff: boolean) => {
    const { elbow, hand } = ik(shoulder, target, ARM, ARM, 1);
    const line = limbLine(shoulder, elbow, hand);
    const cl = pointAtIdx(line, 3);
    const u = norm(sub(line[4], line[2]));
    const nr: Pt = [-u[1], u[0]];
    return {
      elbow,
      hand,
      el: (
        <g>
          <SketchPath pts={tube(line, 13.5, 9.5)} seed={`${id}-arm${k}`} width={W} fill={COLORS.bg} double />
          {cuff ? <SketchPath pts={[add(cl, mul(nr, -7.4)), add(cl, mul(u, 1.5)), add(cl, mul(nr, 7.4))]} seed={`${id}-cuff${k}`} width={W * 0.9} /> : null}
        </g>
      ),
    };
  };
  const near = arm(rig.shoulderNear, rightHand, "R", true);
  const far = arm(rig.shoulderFar, leftHand, "L", false);
  const angOf = (a: Pt, b: Pt) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const rAngle = props.rightHandAngle ?? angOf(near.elbow, near.hand);
  const lAngle = props.leftHandAngle ?? angOf(far.elbow, far.hand);

  const farArm = (
    <g key="far">
      {far.el}
      <Hand id={`${id}-L`} wrist={far.hand} angle={lAngle} grip={leftGrip} />
    </g>
  );

  // head (local coords, origin at centre): big, round, mostly eyes
  const R = HEAD_R;
  const eyes: { c: Pt; r: number }[] = [{ c: [-3.5, -3], r: eyeSize }, { c: [22.5, -3], r: eyeSize * 0.9 }];
  const po: Pt = [clamp(pupilOffset.x, -1, 1), clamp(pupilOffset.y, -1, 1)];
  const ps = pupilSize / 2.3;
  const earPts = arc(-R - 1, 6, 6.5, 9.5, 55, 305, 8);
  const head = (
    <g transform={`translate(${rig.head[0]} ${rig.head[1]}) rotate(${rig.headAngle})`}>
      <circle r={R - 0.5} fill={COLORS.bg} />
      <Erasable id={`${id}-ear`} e={erased.earRight} box={bbox(earPts, 2)}>
        {() => (
          <>
            <SketchPath pts={earPts} seed={`${id}-ear`} fill={COLORS.bg} width={W} />
            <SketchPath pts={arc(-R - 1, 6, 2.8, 4.6, 80, 280, 4)} seed={`${id}-ear2`} width={W * 0.7} />
          </>
        )}
      </Erasable>
      {SEG_ARCS.map(([a0, a1], i) => {
        const pts = arc(0, 0, R, R * 0.98, a0, a1, 8);
        return (
          <Erasable key={i} id={`${id}-seg${i}`} e={erased.headOutlineSegments[i]} box={bbox(pts, 3)}>
            {() => <SketchPath pts={pts} seed={`${id}-seg${i}`} width={W * 1.15} double />}
          </Erasable>
        );
      })}
      {/* a small tuft so he reads as a kid */}
      <SketchPath pts={[[-6, -R + 1], [-5, -R - 8], [1, -R - 11]]} seed={`${id}-h1`} width={W * 0.9} />
      <SketchPath pts={[[1, -R + 0.5], [5, -R - 6], [11, -R - 6]]} seed={`${id}-h2`} width={W * 0.9} />
      {/* eyes: big circles, tall dark pupils, thin worried-or-not brows */}
      {eyes.map((e, i) => {
        const inner = i === 0 ? 1 : -1;
        const bc: Pt = add(e.c, [0, -e.r - 5 - browRaise]);
        const bd = mul(dir(-browAngle * inner), e.r * 0.62);
        const prx = 2.7 * ps * (i ? 0.9 : 1);
        const pry = 4.7 * ps * (i ? 0.9 : 1);
        const reachX = Math.max(0, e.r - prx - 2);
        const reachY = Math.max(0, e.r - pry - 1.5);
        const pc: Pt = [e.c[0] + po[0] * reachX, e.c[1] + po[1] * reachY];
        return (
          <g key={i}>
            <SketchPath pts={arc(e.c[0], e.c[1], e.r, e.r, -80, 250, 10)} closed seed={`${id}-eye${i}`} fill={COLORS.white} width={W * 0.95} double />
            <SketchPath pts={arc(pc[0], pc[1], prx, pry, 0, 320, 8)} closed seed={`${id}-pupil${i}`} fill={COLORS.ink} width={1} jitter={0.35} />
            <circle cx={pc[0] - prx * 0.3} cy={pc[1] - pry * 0.45} r={0.9 * ps} fill={COLORS.white} />
            <SketchPath pts={[sub(bc, mul(bd, inner)), add(bc, [0, -1.2]), add(bc, mul(bd, inner))]} seed={`${id}-brow${i}`} width={W} />
          </g>
        );
      })}
      {/* mouth: main stroke + the erasable left corner */}
      <SketchPath pts={MOUTH_MAIN[mouth]} seed={`${id}-mouth`} width={W * 1.05} />
      <Erasable id={`${id}-corner`} e={erased.smileCornerLeft} box={bbox(MOUTH_CORNER.smile, 2.5)}>
        {(ghost) => <SketchPath pts={ghost ? MOUTH_CORNER.smile : MOUTH_CORNER[mouth]} seed={`${id}-corner`} width={W * 1.05} />}
      </Erasable>
      <SketchPath pts={FRESH_CORNER} fresh seed={`${id}-newcorner`} width={W * 1.05} draw={redrawn.smileCornerLeft} />
    </g>
  );

  return (
    <Ink weight={lineWeight}>
      {layer !== "upper" ? (
        <g>
          {leg(7, -3, "F")}
          {leg(0, 0, "N")}
        </g>
      ) : null}
      {layer !== "legs" ? (
        <g>
          {leftInFront ? null : farArm}
          {neck(0, "a")}
          {neck(11, "b")}
          <SketchPath pts={torso} closed seed={`${id}-torso`} fill={COLORS.bg} width={W * 1.1} double />
          {head}
          {near.el}
          <Hand id={`${id}-R`} wrist={near.hand} angle={rAngle} grip={rightGrip} erased={erased} redrawn={redrawn} />
          {leftInFront ? farArm : null}
        </g>
      ) : null}
    </Ink>
  );
};
const pointAtIdx = (pts: Pt[], i: number): Pt => pts[Math.min(pts.length - 1, i)];
