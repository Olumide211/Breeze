import {Easing, interpolate, random} from 'remotion';

/** Premium "expo-out" style ease used for most motion. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 progress between two frames, eased and clamped. */
export const prog = (
  frame: number,
  start: number,
  duration: number,
  easing: (t: number) => number = EASE_OUT
) =>
  interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const HEX = '0123456789ABCDEF';
const GLYPHS = '0123456789ABCDEF#$%&*+=/<>?';

/**
 * Scramble text `from` into `to`. Each character goes original → noise → final,
 * sweeping left to right as `p` goes 0→1. Deterministic per frame.
 */
export const scramble = (from: string, to: string, p: number, frame: number, seed: string) => {
  if (p <= 0) return from;
  if (p >= 1) return to;
  const len = Math.max(from.length, to.length);
  let out = '';
  for (let i = 0; i < len; i++) {
    const t0 = (i / len) * 0.55;
    if (p < t0) out += from[i] ?? '';
    else if (p < t0 + 0.4) {
      const r = random(`${seed}-${i}-${Math.floor(frame / 2)}`);
      out += GLYPHS[Math.floor(r * GLYPHS.length)];
    } else out += to[i] ?? '';
  }
  return out;
};

/** Deterministic random hex string (used for faint ciphertext textures). */
export const hexString = (seed: string, n: number) => {
  let s = '';
  for (let i = 0; i < n; i++) s += HEX[Math.floor(random(`${seed}-${i}`) * 16)];
  return s;
};
