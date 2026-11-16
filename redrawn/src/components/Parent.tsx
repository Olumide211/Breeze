import React from "react";
import { COLORS } from "../scenes";
import { add, mul, rot, type Pt } from "../lib/util";
import { SketchPath } from "./SketchPath";

const grey = { fill: COLORS.grey, stroke: COLORS.grey, width: 1.5 };

/** Tall flat silhouette cast through the doorway across the floor. k = how far it has stretched (0..1). Never a face. */
export const ParentFloorShadow: React.FC<{ k: number; from: Pt }> = ({ k, from }) => {
  if (k <= 0.01) return null;
  const L = 385 * k;
  const W = 30;
  const along: Pt = [Math.cos(0.2), Math.sin(0.2)];
  const across: Pt = [0.24, 0.97];
  // figure in (u along, v across) space: feet at the door, head towards the boy
  const fig: Pt[] = [
    [0, -0.5], [0.24, -0.5], [0.46, -0.52], [0.52, -0.86], [0.7, -0.9], [0.745, -0.36], [0.79, -0.5], [0.9, -0.56], [0.985, -0.3],
    [1, 0], [0.985, 0.3], [0.9, 0.56], [0.79, 0.5], [0.745, 0.36], [0.7, 0.9], [0.52, 0.86], [0.46, 0.52], [0.24, 0.5], [0, 0.5],
  ];
  const pts = fig.map(([u, v]) => add(from, add(mul(along, u * L), mul(across, v * W))));
  return <SketchPath pts={pts} closed seed="parent-floor" {...grey} />;
};

/** The same silhouette looming on the wall beside the door. */
export const ParentWallShadow: React.FC<{ k: number; from: Pt }> = ({ k, from }) => {
  if (k <= 0.01) return null;
  const fig: Pt[] = [
    [8, 0], [14, -80], [20, -150], [40, -186], [66, -198], [62, -226], [68, -262], [94, -282], [120, -264], [128, -228],
    [122, -200], [152, -188], [176, -152], [184, -80], [188, 0],
  ];
  const pts = fig.map(([x, y]) => add(from, [x * k + -y * 0.08 * k, y * k] as Pt));
  return <SketchPath pts={pts} closed seed="parent-wall" {...grey} />;
};

/**
 * Large flat hand silhouette reaching into frame. (x, y) = palm centre, fingers point along `angle`.
 * close 0 = open, 1 = fist (crumpling).
 */
export const ParentHand: React.FC<{ x: number; y: number; angle?: number; close?: number; scale?: number }> = ({
  x, y, angle = 35, close = 0, scale = 1,
}) => {
  const c = close;
  const place = (q: Pt): Pt => add([x, y], rot(mul(q, scale), angle));
  const arm: Pt[] = [
    [-560, -24], [-70, -25], [-44, -34], [-10, -42], [34, -40], [40, 0], [34, 40], [-10, 42], [-44, 34], [-70, 25], [-560, 28],
  ];
  const digit = (b: Pt, ang: number, len: number, w: number, k: string) => {
    const a = ang + 55 * c;
    const l = len * (1 - 0.45 * c);
    const d = rot([1, 0], a);
    const n: Pt = [-d[1], d[0]];
    const at = (along: number, side: number): Pt => add(b, add(mul(d, along), mul(n, side)));
    const h = w / 2;
    const pts = [at(-14, -h), at(l * 0.55, -h), at(l - h * 0.6, -h * 0.9), at(l, 0), at(l - h * 0.6, h * 0.9), at(l * 0.55, h), at(-14, h)];
    return <SketchPath key={k} pts={pts.map(place)} closed seed={`parent-${k}`} {...grey} />;
  };
  return (
    <g>
      <SketchPath pts={arm.map(place)} closed seed="parent-arm" {...grey} />
      {digit([30, -30], -13, 62, 19, "f1")}
      {digit([36, -10], -4, 72, 20, "f2")}
      {digit([36, 11], 5, 68, 19, "f3")}
      {digit([30, 31], 15, 54, 17, "f4")}
      {digit([-14, 36], 62 - 30 * c, 58, 23, "thumb")}
    </g>
  );
};
