import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {random, useCurrentFrame} from 'remotion';
import {BUBBLE, DOT, F, H, STAR_RGB, W, clamp01, easeInCubic, lerp, seg, smoothstep} from '../timeline';
import {
  armTheta,
  formation,
  formationDelay,
  formationDur,
  galaxyState,
  projectWorld,
  tiltPoint,
  viewProjFor,
} from './camera';
import {ARMS, SPIKE_STARS} from './galaxyData';
import {arrivalFrame} from './icons';
import {TYPED_W} from '../scenes/typing';

// Light-only effects drawn additively: shatter particles, core bloom, spike stars, pulses.
// Bloom here is restricted to stars, the core and glints.

const rgb = (c: readonly number[], a: number) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a.toFixed(4)})`;

type Particle = {
  x: number;
  y: number;
  delay: number;
  dur: number;
  swirl: number;
  size: number;
  text: boolean;
  col: readonly number[];
};

const PARTICLES = 3000;

const makeParticles = (): Particle[] => {
  const bw = TYPED_W + BUBBLE.padX * 2;
  const bh = BUBBLE.lineH + BUBBLE.padY * 2;
  const left = BUBBLE.right - bw;
  const top = BUBBLE.cy - bh / 2;
  const out: Particle[] = [];
  let k = 0;
  const r = () => random(`astra-shatter-${k++}`);
  while (out.length < PARTICLES) {
    const text = r() < 0.3;
    let x: number;
    let y: number;
    if (text) {
      x = left + BUBBLE.padX + r() * TYPED_W;
      y = BUBBLE.cy - 14 + r() * 28;
    } else {
      x = left + r() * bw;
      y = top + r() * bh;
      // inside the rounded rect
      const rx = Math.max(left + BUBBLE.radius - x, x - (left + bw - BUBBLE.radius), 0);
      const ry = Math.max(top + BUBBLE.radius - y, y - (top + bh - BUBBLE.radius), 0);
      if (rx * rx + ry * ry > BUBBLE.radius * BUBBLE.radius) continue;
    }
    const u = r();
    const col = u < 0.7 ? STAR_RGB.white : u < 0.9 ? STAR_RGB.blue : STAR_RGB.amber;
    // farther particles leave a touch earlier so they all land around the eruption
    const dist = Math.hypot(x - DOT.x, y - DOT.y);
    out.push({
      x,
      y,
      delay: 2 * r() - dist / 1200,
      dur: 8 + 3 * r(),
      swirl: (r() - 0.5) * 140,
      size: 1.1 + 1.6 * r(),
      text,
      col,
    });
  }
  return out;
};

const drawSpikeStar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  len: number,
  a: number,
) => {
  // soft bloom
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
  g.addColorStop(0, `rgba(255,255,255,${0.55 * a})`);
  g.addColorStop(0.35, `rgba(232,238,245,${0.18 * a})`);
  g.addColorStop(1, 'rgba(135,184,222,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, size * 3, 0, Math.PI * 2);
  ctx.fill();
  // disc
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  // thin four-point diffraction spikes (tapered)
  const spike = (dx: number, dy: number, l: number) => {
    const lg = ctx.createLinearGradient(x - dx * l, y - dy * l, x + dx * l, y + dy * l);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, `rgba(255,255,255,${0.95 * a})`);
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    const w = 1.1;
    ctx.beginPath();
    ctx.moveTo(x - dx * l, y - dy * l);
    ctx.lineTo(x + dy * w, y - dx * w);
    ctx.lineTo(x + dx * l, y + dy * l);
    ctx.lineTo(x - dy * w, y + dx * w);
    ctx.closePath();
    ctx.fill();
  };
  spike(1, 0, len);
  spike(0, 1, len * 1.12);
};

const glow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: Array<[number, string]>,
) => {
  if (radius <= 0.5) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

const SUB = 6; // sub-frame samples for the fast moments
const SHUTTER = 0.5;

export const FxLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const particles = useMemo(makeParticles, []);

  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const f = frame;

    // ---- shatter: UI dissolves into star particles pulled into the dot -------
    if (f >= F.burst && f < F.galaxy + 6) {
      for (let s = 0; s < SUB; s++) {
        const t0 = f - SHUTTER / 2 + (SHUTTER * s) / (SUB - 1);
        for (const p of particles) {
          const start = F.burst + p.delay + 1;
          const t = seg(t0, start, start + p.dur);
          if (t0 < F.burst || t >= 1) continue;
          const e = easeInCubic(t);
          const px = lerp(p.x, DOT.x, e);
          const py = lerp(p.y, DOT.y, e);
          // curved path: perpendicular swirl that vanishes at both ends
          const dx = DOT.x - p.x;
          const dy = DOT.y - p.y;
          const L = Math.hypot(dx, dy) || 1;
          const sw = Math.sin(Math.PI * e) * p.swirl;
          const x = px + (-dy / L) * sw;
          const y = py + (dx / L) * sw;
          // from UI tones to star colours within a few frames
          const toStar = smoothstep(0, 0.35, t);
          const base = p.text ? [1, 1, 1] : [0.36, 0.36, 0.36];
          const c = [0, 1, 2].map((k) => lerp(base[k], p.col[k], toStar));
          const a = (p.text ? 0.9 : lerp(0.5, 0.95, toStar)) / SUB;
          ctx.fillStyle = rgb(c, a);
          const sz = p.size * lerp(1, 0.7, e);
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
    }

    if (f < F.burst) return;
    const s = galaxyState(f);
    const vp = viewProjFor(s);
    const c0 = projectWorld(0, 0, 0, s, vp);

    // ---- eruption: the dot becomes the galaxy core --------------------------
    if (f >= F.galaxy - 4 && f < F.galaxy + 30) {
      const t = seg(f, F.galaxy - 4, F.galaxy + 30);
      const rad = lerp(30, 320, Math.pow(t, 0.6));
      const a = 0.85 * Math.pow(1 - t, 2);
      glow(ctx, c0.x, c0.y, rad, [
        [0, `rgba(255,255,255,${a})`],
        [0.3, `rgba(232,238,245,${a * 0.42})`],
        [0.6, `rgba(135,184,222,${a * 0.14})`],
        [1, 'rgba(135,184,222,0)'],
      ]);
    }

    if (f < F.galaxy) return;

    // ---- core bloom ---------------------------------------------------------
    const coreOn = smoothstep(0, 1, seg(f, F.galaxy, F.galaxy + 30));
    const k = Math.min(3, c0.scale);
    glow(ctx, c0.x, c0.y, 170 * k, [
      [0, `rgba(135,184,222,${0.2 * coreOn})`],
      [0.4, `rgba(135,184,222,${0.07 * coreOn})`],
      [1, 'rgba(135,184,222,0)'],
    ]);
    glow(ctx, c0.x, c0.y, 46 * k, [
      [0, `rgba(255,255,255,${0.6 * coreOn})`],
      [0.5, `rgba(232,238,245,${0.18 * coreOn})`],
      [1, 'rgba(232,238,245,0)'],
    ]);

    // ---- icon arrival pulses in the core ------------------------------------
    for (let i = 0; i < 6; i++) {
      const a0 = arrivalFrame(i);
      if (f < a0 - 1 || f > a0 + 24) continue;
      const t = clamp01((f - a0 + 1) / 25);
      const a = 0.75 * Math.exp(-t * 4.5);
      glow(ctx, c0.x, c0.y, lerp(24, 95, Math.sqrt(t)) * Math.min(1.2, k), [
        [0, `rgba(255,255,255,${a})`],
        [0.4, `rgba(232,238,245,${a * 0.3})`],
        [1, 'rgba(232,238,245,0)'],
      ]);
    }

    // ---- hero stars with diffraction spikes ---------------------------------
    for (const st of SPIKE_STARS) {
      const {p, e} = formation(f, formationDelay(st.r, 0.5), formationDur(0.5));
      if (p <= 0.4) continue;
      const r = st.r * e;
      const th = armTheta(ARMS[st.arm].phase, r) + s.rot;
      const [wx, wy, wz] = tiltPoint(r * Math.cos(th), r * Math.sin(th), 0, s.tilt);
      const q = projectWorld(wx, wy, wz, s, vp);
      const a =
        smoothstep(0.4, 1, p) *
        (0.85 + 0.15 * Math.sin(f * 0.07 + st.r * 31));
      const sc = Math.min(1.6, q.scale);
      drawSpikeStar(ctx, q.x, q.y, st.size * sc, st.len * sc, a);
    }
  }, [frame, particles]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{position: 'absolute', inset: 0, width: W, height: H}}
    />
  );
};
