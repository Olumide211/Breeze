import React from 'react';
import {useCurrentFrame} from 'remotion';
import {BOX, BUBBLE, COLORS, DOT, F, easeInOutCubic, lerp, seg, smoothstep} from '../timeline';
import {UI_FONT, textScroll} from './MessageBox';
import {TYPED, TYPED_W} from './typing';

// Typed text lifts into a right-aligned user bubble; then the response dot pulses and sparks.
export const Bubble: React.FC = () => {
  const f = useCurrentFrame();
  if (f < F.lift || f >= F.burst) return null;

  const t = easeInOutCubic(seg(f, F.lift, 342));
  const scroll = textScroll(F.lift - 1);
  const x0 = BOX.left + BOX.textX - scroll;
  const x1 = BUBBLE.right - BUBBLE.padX - TYPED_W;
  const tx = lerp(x0, x1, t);
  const ty = lerp(BOX.cy, BUBBLE.cy, t);

  // the clipped start of the line is revealed as it leaves the field
  const reveal = smoothstep(0, 1, seg(f, F.lift, F.lift + 9));
  const hidden = scroll * (1 - reveal);
  const fade = 40 * (1 - reveal);

  const bg = smoothstep(0, 1, seg(f, F.lift + 3, 340));
  const padX = lerp(0, BUBBLE.padX, bg);
  const padY = lerp(0, BUBBLE.padY, bg);
  const bh = BUBBLE.lineH + padY * 2;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: tx - padX,
          top: ty - bh / 2,
          width: TYPED_W + padX * 2,
          height: bh,
          borderRadius: BUBBLE.radius,
          background: `rgba(48,48,48,${bg})`,
        }}
      />
      <div
        style={{
          ...UI_FONT,
          lineHeight: `${BUBBLE.lineH}px`,
          position: 'absolute',
          left: tx,
          top: ty - BUBBLE.lineH / 2,
          color: COLORS.white,
          WebkitMaskImage:
            hidden > 0.5 || fade > 0.5
              ? `linear-gradient(to right, transparent ${hidden - fade}px, #000 ${hidden}px)`
              : undefined,
        }}
      >
        {TYPED}
      </div>
    </>
  );
};

const pulse = (f: number, peak: number) => {
  const d = Math.abs(f - peak);
  return d < 8 ? Math.pow(Math.cos((Math.PI * d) / 16), 2) : 0;
};

export const ResponseDot: React.FC = () => {
  const f = useCurrentFrame();
  if (f < F.dot || f > F.galaxy + 6) return null;

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
  const s = DOT.size * scale;

  return (
    <>
      {glowR > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: DOT.x - glowR,
            top: DOT.y - glowR,
            width: glowR * 2,
            height: glowR * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,${glowA}) 0%, rgba(232,238,245,${glowA * 0.35}) 30%, rgba(135,184,222,0) 70%)`,
          }}
        />
      ) : null}
      {spikeA > 0 ? (
        <svg
          width={200}
          height={200}
          viewBox="-100 -100 200 200"
          style={{position: 'absolute', left: DOT.x - 100, top: DOT.y - 100, opacity: spikeA, overflow: 'visible'}}
        >
          <path d={`M ${-spikeL} 0 L 0 -1 L ${spikeL} 0 L 0 1 Z`} fill="#fff" />
          <path d={`M 0 ${-spikeL * 1.1} L 1 0 L 0 ${spikeL * 1.1} L -1 0 Z`} fill="#fff" />
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: DOT.x - s / 2,
          top: DOT.y - s / 2,
          width: s,
          height: s,
          borderRadius: '50%',
          background: '#ffffff',
          opacity: dotA,
        }}
      />
    </>
  );
};
