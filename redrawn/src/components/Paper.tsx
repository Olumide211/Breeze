import React from "react";
import { COLORS } from "../scenes";
import { rnd } from "../lib/rand";
import { add, arc, clamp, lerpPt, mul, pointAt, sub, subdivide, type Pt } from "../lib/util";
import { SketchPath } from "./SketchPath";

/** Paper as it lies on the desk: back-left, back-right, front-right, front-left (world). */
export const PAPER_QUAD: [Pt, Pt, Pt, Pt] = [[626, 349], [702, 349], [687, 377], [611, 377]];
export const PAPER_CENTER: Pt = [656, 363];
const PW = 100;
const PH = 56;

/** Doodle strokes in paper space (100 × 56): a simple sun, a house, a small figure. */
export const DOODLE: { pts: Pt[]; closed?: boolean; smooth?: boolean }[] = [
  { pts: arc(17, 17, 7.5, 7.5, -90, 250, 10), closed: true, smooth: true }, // sun
  { pts: [[17, 6], [17, 2]] }, { pts: [[26, 10], [29, 7]] }, { pts: [[28, 18], [33, 18]] }, { pts: [[25, 26], [28, 30]] }, { pts: [[8, 10], [5, 7]] },
  { pts: [[41, 24], [41, 47], [63, 47], [63, 24]] }, // house
  { pts: [[37, 25], [52, 9], [67, 25]] },
  { pts: [[48, 47], [48, 36], [55, 36], [55, 47]] },
  { pts: arc(83, 22, 4.6, 4.6, -90, 250, 8), closed: true, smooth: true }, // small figure
  { pts: [[83, 27], [83, 40]] },
  { pts: [[75, 32], [91, 31]] },
  { pts: [[83, 40], [77, 50]] },
  { pts: [[83, 40], [89, 50]] },
];

/** paper space → world */
export const paperToWorld = (q: Pt, quad = PAPER_QUAD): Pt =>
  add(quad[0], add(mul(sub(quad[1], quad[0]), q[0] / PW), mul(sub(quad[3], quad[0]), q[1] / PH)));

/** Where the pencil tip is (world) when the doodle is `progress` done. */
export const doodleTip = (progress: number): Pt => {
  const n = DOODLE.length;
  const v = clamp(progress) * n;
  const i = Math.min(n - 1, Math.floor(v));
  const st = DOODLE[i];
  const pts = st.closed ? [...st.pts, st.pts[0]] : st.pts;
  return paperToWorld(pointAt(pts, clamp(v - i)));
};

/**
 * PAPER: a white sheet with the Boy's doodle. crumple 0→1 morphs it into a jagged ball around `ball`.
 */
export const Paper: React.FC<{ doodle: number; crumple?: number; ball?: Pt; id?: string }> = ({
  doodle, crumple = 0, ball = PAPER_CENTER, id = "paper",
}) => {
  const k = clamp(crumple);
  const [bl, br, fr, fl] = PAPER_QUAD;
  const flat = subdivide([bl, br, fr, fl], 1e9, true).flatMap((p, i, a) => {
    const nx = a[(i + 1) % a.length];
    return [0, 1, 2, 3].map((j) => lerpPt(p, nx, j / 4));
  });
  const R = 12.5;
  const pts = flat.map((p, i) => {
    const a = (-135 + (i / flat.length) * 360) * (Math.PI / 180);
    const r = R * (0.72 + 0.5 * rnd(77, i));
    const target: Pt = [ball[0] + Math.cos(a) * r, ball[1] + Math.sin(a) * r * 0.9];
    return lerpPt(p, target, k);
  });
  const m = [(br[0] - bl[0]) / PW, (br[1] - bl[1]) / PW, (fl[0] - bl[0]) / PH, (fl[1] - bl[1]) / PH, bl[0], bl[1]];
  const n = DOODLE.length;
  return (
    <g>
      <SketchPath pts={pts} closed smooth={false} step={k > 0.5 ? 100 : 26} seed={`${id}-edge`} fill={COLORS.white} width={2} />
      {k < 0.5 ? (
        <g transform={`matrix(${m.join(" ")})`} opacity={1 - k * 2}>
          {DOODLE.map((st, i) => (
            <SketchPath key={i} pts={st.pts} closed={st.closed} smooth={!!st.smooth} step={14} seed={`${id}-d${i}`} width={2.2} draw={clamp(doodle * n - i)} jitter={0.8} />
          ))}
        </g>
      ) : (
        <g opacity={(k - 0.5) * 2}>
          {[[2, 9, 13], [5, 11, 0], [7, 14, 3]].map((ix, i) => (
            <SketchPath key={i} pts={ix.map((j) => lerpPt(pts[j], ball, 0.25 + 0.2 * i))} smooth={false} step={100} seed={`${id}-c${i}`} width={1.5} />
          ))}
        </g>
      )}
    </g>
  );
};
