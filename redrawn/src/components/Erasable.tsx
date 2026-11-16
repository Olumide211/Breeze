import React from "react";
import { COLORS, GHOST_OPACITY } from "../scenes";
import { Ink, useInk } from "../lib/ink";
import { seedOf, srnd } from "../lib/rand";
import type { Pt } from "../lib/util";
import { sharpD } from "./SketchPath";

/**
 * Erases its children with an SVG mask: an eraser-shaped zigzag stroke sweeps across `box`
 * as `e` goes 0→1. Wherever it has passed, the ink is gone and a faint ghost smudge is left.
 * children(ghost) is called twice: once for the ink, once for the ghost.
 */
export const Erasable: React.FC<{
  id: string;
  e: number;
  box: [number, number, number, number];
  children: (ghost: boolean) => React.ReactNode;
}> = ({ id, e, box, children }) => {
  const ink = useInk();
  if (e <= 0) return <>{children(false)}</>;
  const [x, y, w, h] = box;
  const s = seedOf(id);
  const passes = 3;
  const pts: Pt[] = [];
  for (let k = 0; k <= passes * 2; k++) {
    const yy = y + (h * k) / (passes * 2);
    const left = k % 2 === 0;
    pts.push([(left ? x - w * 0.08 : x + w * 1.08) + srnd(s, k) * w * 0.06, yy + srnd(s, k, 1) * h * 0.04]);
  }
  const d = sharpD(pts, false);
  const sw = (h / passes) * 1.25;
  const pad = Math.max(w, h) * 0.6 + 6;
  const region = { x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2 };
  const sweep = {
    d,
    fill: "none",
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    pathLength: 1,
    strokeDasharray: "1 1",
    strokeDashoffset: 1 - Math.min(1, e),
  };
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <g>
      <defs>
        <mask id={`ink-${safe}`} maskUnits="userSpaceOnUse" {...region}>
          <rect {...region} fill="white" />
          <path {...sweep} stroke="black" />
        </mask>
        <mask id={`ghost-${safe}`} maskUnits="userSpaceOnUse" {...region}>
          <rect {...region} fill="black" />
          <path {...sweep} stroke="white" />
        </mask>
      </defs>
      <g mask={`url(#ghost-${safe})`} opacity={GHOST_OPACITY}>
        {/* ghost of the lines, each with a soft smudge halo (see SketchPath) */}
        <Ink ghost>{children(true)}</Ink>
      </g>
      {e < 1 ? <g mask={`url(#ink-${safe})`}>{children(false)}</g> : null}
      {e < 1 ? (
        // the eraser itself, a small rubber block at the head of the sweep (only while erasing)
        <EraserTip pts={pts} e={e} size={sw} zoom={ink.zoom} />
      ) : null}
    </g>
  );
};

const EraserTip: React.FC<{ pts: Pt[]; e: number; size: number; zoom: number }> = ({ pts, e, size, zoom }) => {
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let t = e * total;
  let p = pts[pts.length - 1];
  for (let i = 0; i < lens.length; i++) {
    if (t <= lens[i]) {
      const k = t / lens[i];
      p = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
      break;
    }
    t -= lens[i];
  }
  const r = size * 0.55;
  return (
    <rect
      x={p[0] - r}
      y={p[1] - r * 0.7}
      width={r * 2}
      height={r * 1.4}
      rx={r * 0.3}
      fill={COLORS.bg}
      stroke={COLORS.ghost}
      strokeWidth={1.4 / Math.pow(zoom, 0.6)}
      transform={`rotate(-18 ${p[0]} ${p[1]})`}
    />
  );
};
