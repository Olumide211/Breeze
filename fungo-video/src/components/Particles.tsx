import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, PARTICLES, VIDEO} from '../config';

/** Subtle drifting yellow particles. Deterministic. */
export const Particles: React.FC<{intensity?: number}> = ({intensity = 1}) => {
  const frame = useCurrentFrame();
  const t = frame / VIDEO.fps;
  const items = new Array(PARTICLES.count).fill(0).map((_, i) => {
    const r = (k: string) => random(`p-${i}-${k}`);
    const speed = 6 + r('s') * 22; // px per second, upward
    const size = 1.4 + r('z') * 2.6;
    const H = VIDEO.height + 40;
    const y = (((r('y') * H - speed * t) % H) + H) % H - 20;
    const x = r('x') * VIDEO.width + Math.sin(t * (0.3 + r('w')) + r('p') * 6) * 14;
    const tw = 0.55 + 0.45 * Math.sin(t * (1 + r('f') * 2) + r('ph') * 6.28);
    const base = 0.12 + r('o') * 0.4;
    const color = r('c') > 0.7 ? COLORS.yellow : COLORS.haze;
    return {x, y, size, opacity: base * tw * intensity * PARTICLES.opacity, color};
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {items.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Soft yellow haze blob (for glow behind focal elements). */
export const Haze: React.FC<{x: number; y: number; size: number; opacity: number}> = ({x, y, size, opacity}) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle at center, ${COLORS.haze} 0%, rgba(255,231,131,0.4) 28%, rgba(255,231,131,0) 68%)`,
      opacity,
      filter: 'blur(30px)',
      pointerEvents: 'none',
    }}
  />
);
