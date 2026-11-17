import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, DURATION, F, FPS, H, STAR_RGB, W, seg, smoothstep} from '../timeline';

// Deep-space field: arrives with the burst. Before that the frame is pure black.
const spaceIn = (f: number) => smoothstep(0, 1, seg(f, F.burst, F.burst + 30));

export const SpaceBackground: React.FC = () => {
  const f = useCurrentFrame();
  const a = spaceIn(f);
  return (
    <AbsoluteFill style={{background: COLORS.black}}>
      {a > 0 ? (
        <AbsoluteFill
          style={{
            opacity: a,
            // centre #05090d -> edges #0c1620 -> corners #070e15 (farthest-corner ellipse:
            // edge midpoints sit at ~71%, corners at 100%)
            background: `radial-gradient(ellipse farthest-corner at 50% 50%, ${COLORS.spaceCentre} 0%, #08101a 40%, ${COLORS.spaceEdge} 71%, ${COLORS.spaceCorner} 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

type Star = {x: number; y: number; d: number; size: number; period: number; phase: number; col: readonly number[]; halo: boolean};

const STARS = 1600;

export const StarField: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const stars = useMemo<Star[]>(() => {
    const out: Star[] = [];
    for (let i = 0; i < STARS; i++) {
      const r = (k: string) => random(`astra-field-${i}-${k}`);
      const u = r('c');
      const size = 0.6 + 1.2 * Math.pow(r('s'), 2.2);
      out.push({
        x: r('x') * (W + 20) - 10,
        y: r('y') * (H + 20) - 10,
        d: 0.35 + 0.65 * r('d'),
        size,
        period: 3 + 4 * r('p'),
        phase: r('ph') * Math.PI * 2,
        col: u < 0.7 ? STAR_RGB.white : u < 0.9 ? STAR_RGB.blue : STAR_RGB.amber,
        halo: size > 1.5 && r('h') < 0.5,
      });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const a = spaceIn(f);
    if (a <= 0) return;
    const drift = (8 * f) / DURATION; // very slow parallax drift over the film
    for (const s of stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((2 * Math.PI * f) / (s.period * FPS) + s.phase));
      const x = s.x - drift * s.d;
      const y = s.y - drift * 0.35 * s.d;
      const alpha = tw * a * (0.55 + 0.45 * s.d);
      const c = s.col.map((v) => Math.round(v * 255));
      if (s.halo) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, s.size * 3);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.22 * alpha})`);
        g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - s.size * 3, y - s.size * 3, s.size * 6, s.size * 6);
      }
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, s.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [f, stars]);

  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};

export const Vignette: React.FC = () => {
  const f = useCurrentFrame();
  const a = spaceIn(f);
  if (a <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        opacity: a,
        background: 'radial-gradient(ellipse farthest-corner at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.08) 100%)',
      }}
    />
  );
};

// 1.5% monochrome grain, new pattern every frame (seeded per frame).
export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const d = img.data;
    let s = Math.floor(random(`astra-grain-${f}`) * 0xffffffff) | 1;
    const next = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    };
    for (let i = 0; i < d.length; i += 4) {
      // roughly gaussian (sum of two uniforms), centred on 0
      const n = next() + next() - 1;
      const v = n > 0 ? 255 : 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = Math.abs(n) * 0.015 * 2 * 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [f]);
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
