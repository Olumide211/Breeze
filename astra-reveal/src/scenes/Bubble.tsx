import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Layout, useLayout} from '../layout';
import {BOX, BUBBLE, COLORS, DOT_SIZE, F, easeInOutCubic, lerp, seg, smoothstep} from '../timeline';
import {UI_FONT, boxLines, boxTextOrigin} from './MessageBox';
import {measureUi, wrapRanges} from './text';
import {TYPED} from './typing';

// Final bubble geometry (right-aligned like ChatGPT).
export const bubbleGeom = (L: Layout) => {
  const lines = wrapRanges(TYPED, L.bubble.maxW - BUBBLE.padX * 2);
  const textW = Math.max(...lines.map(([a, b]) => measureUi(TYPED.slice(a, b).trimEnd())));
  const w = textW + BUBBLE.padX * 2;
  const h = lines.length * BUBBLE.lineH + BUBBLE.padY * 2;
  return {lines, textW, w, h, left: L.bubble.right - w, top: L.bubble.cy - h / 2};
};

// The thinking dot: appears below the bubble on the left, then glides to the birth point.
export const dotPos = (f: number, L: Layout) => {
  const t = easeInOutCubic(seg(f, F.dotGlide, F.dotGlideEnd));
  return {x: lerp(L.dot.x0, L.dot.x1, t), y: lerp(L.dot.y0, L.dot.y1, t)};
};

export const Bubble: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < F.lift || f >= F.burst) return null;

  const g = bubbleGeom(L);
  const from = boxTextOrigin(L);
  const fromLines = boxLines();
  const t = easeInOutCubic(seg(f, F.lift, 342));
  const tx = lerp(from.x, g.left + BUBBLE.padX, t);
  const tTop = lerp(from.top, g.top + BUBBLE.padY + (BUBBLE.lineH - 48) / 2, t);

  const bg = smoothstep(0, 1, seg(f, F.lift + 3, 340));
  const padX = lerp(0, BUBBLE.padX, bg);
  const padY = lerp(0, BUBBLE.padY, bg);
  const textH = g.lines.length * BUBBLE.lineH;
  const lines = t < 0.5 && fromLines.length !== g.lines.length ? fromLines : g.lines;
  const lineStep = lerp(BOX.rowH, BUBBLE.lineH, t);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: tx - padX,
          top: tTop - (BUBBLE.lineH - 48) / 2 - padY,
          width: g.textW + padX * 2,
          height: textH + padY * 2,
          borderRadius: BUBBLE.radius,
          background: `rgba(48,48,48,${bg})`,
        }}
      />
      {lines.map(([a, b], li) => (
        <div key={li} style={{...UI_FONT, position: 'absolute', left: tx, top: tTop + li * lineStep, color: COLORS.white}}>
          {TYPED.slice(a, b)}
        </div>
      ))}
    </>
  );
};

const pulse = (f: number, peak: number) => {
  const d = Math.abs(f - peak);
  return d < 8 ? Math.pow(Math.cos((Math.PI * d) / 16), 2) : 0;
};

export const ResponseDot: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < F.dot || f > F.galaxy + 6) return null;

  const {x, y} = dotPos(f, L);
  const appear = smoothstep(0, 1, seg(f, F.dot, F.dot + 6));
  const scale = 1 + 0.25 * (pulse(f, 354) + pulse(f, 368));
  // spark: brightens to pure white with a bloom flare and one faint four-point spike
  const spark = smoothstep(0, 1, seg(f, F.spark, F.burst));
  const charge = smoothstep(0, 1, seg(f, F.burst, F.galaxy));
  const out = 1 - seg(f, F.galaxy, F.galaxy + 6);
  const dotA = lerp(0.86, 1, spark) * appear * out;
  const glowR = lerp(0, 70, spark) + 50 * charge;
  const glowA = (0.45 * spark + 0.25 * charge) * out;
  const spikeL = lerp(0, 64, spark) + 30 * charge;
  const spikeA = 0.32 * spark * out;
  const s = DOT_SIZE * scale;

  return (
    <>
      {glowR > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: x - glowR,
            top: y - glowR,
            width: glowR * 2,
            height: glowR * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,${glowA}) 0%, rgba(232,238,245,${glowA * 0.35}) 30%, rgba(135,184,222,0) 70%)`,
          }}
        />
      ) : null}
      {spikeA > 0 ? (
        <svg width={200} height={200} viewBox="-100 -100 200 200" style={{position: 'absolute', left: x - 100, top: y - 100, opacity: spikeA, overflow: 'visible'}}>
          <path d={`M ${-spikeL} 0 L 0 -1 L ${spikeL} 0 L 0 1 Z`} fill="#fff" />
          <path d={`M 0 ${-spikeL * 1.1} L 1 0 L 0 ${spikeL * 1.1} L -1 0 Z`} fill="#fff" />
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: '50%', background: '#ffffff', opacity: dotA}} />
    </>
  );
};
