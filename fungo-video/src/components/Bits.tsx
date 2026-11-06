import React from 'react';
import {COLORS, FONTS} from '../config';

/** Small yellow padlock. */
export const Lock: React.FC<{size?: number; color?: string}> = ({size = 18, color = COLORS.yellow}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block'}}>
    <path d="M7 10.5V7.5a5 5 0 0 1 10 0v3" stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    <rect x={4} y={10} width={16} height={12} rx={3.2} fill={color} />
    <rect x={11} y={14} width={2.2} height={4.2} rx={1.1} fill={COLORS.black} />
  </svg>
);

/**
 * Redaction blocks drawn as shapes (crisper than font glyphs).
 * `dither` = ▒ (checker pattern), solid = █.
 */
export const Redacted: React.FC<{
  count: number;
  height: number;
  dither?: boolean;
  color?: string;
  id: string;
}> = ({count, height, dither = false, color = COLORS.yellow, id}) => {
  const w = height * 0.62;
  const gap = dither ? height * 0.08 : 0;
  const total = count * w + (count - 1) * gap;
  const pid = `dither-${id}`;
  return (
    <svg width={total} height={height} style={{display: 'block'}}>
      {dither && (
        <defs>
          <pattern id={pid} width={4} height={4} patternUnits="userSpaceOnUse">
            <rect width={4} height={4} fill={color} opacity={0.22} />
            <rect width={2} height={2} fill={color} />
            <rect x={2} y={2} width={2} height={2} fill={color} />
          </pattern>
        </defs>
      )}
      {!dither && <rect x={0} y={0} width={total} height={height} fill={color} />}
      {dither && new Array(count).fill(0).map((_, i) => (
        <rect
          key={i}
          x={i * (w + gap)}
          y={0}
          width={w}
          height={height}
          fill={`url(#${pid})`}
          rx={1.5}
        />
      ))}
    </svg>
  );
};

/** Minimal yellow on/off toggle. */
export const Toggle: React.FC<{on: number; label: string; scale?: number}> = ({on, label, scale = 1}) => {
  const W = 92 * scale;
  const H = 48 * scale;
  const k = H - 10 * scale;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 18 * scale}}>
      <div
        style={{
          position: 'relative',
          width: W,
          height: H,
          borderRadius: H / 2,
          background: `rgba(255,210,7,${on})`,
          boxShadow: `inset 0 0 0 ${2 * scale}px rgba(255,255,255,${0.28 * (1 - on)}), 0 0 ${30 * on}px rgba(255,231,131,${0.35 * on})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 5 * scale,
            left: 5 * scale + on * (W - k - 10 * scale),
            width: k,
            height: k,
            borderRadius: '50%',
            background: on > 0.5 ? COLORS.black : 'rgba(255,255,255,0.75)',
          }}
        />
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontWeight: 500,
          fontSize: 20 * scale,
          letterSpacing: '0.2em',
          color: on > 0.5 ? COLORS.yellow : COLORS.muted,
        }}
      >
        {label}
      </div>
    </div>
  );
};
