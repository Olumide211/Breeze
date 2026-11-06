import React from 'react';
import {COLORS, FONTS} from '../config';

/**
 * Odometer-style number: every digit is a rolling column,
 * with vertical motion blur proportional to its speed.
 */
export const RollingNumber: React.FC<{
  value: number;
  prev: number;
  target: number;
  decimals?: number;
  size: number;
  color?: string;
}> = ({value, prev, target, decimals = 0, size, color = COLORS.white}) => {
  const intDigits = Math.max(1, Math.floor(Math.log10(Math.max(1, target))) + 1);
  const places: (number | ',' | '.')[] = [];
  for (let k = intDigits - 1; k >= 0; k--) {
    places.push(10 ** k);
    if (k > 0 && k % 3 === 0) places.push(',');
  }
  if (decimals > 0) {
    places.push('.');
    for (let k = 1; k <= decimals; k++) places.push(10 ** -k);
  }
  const lh = size * 1.15;
  const charW = size * 0.6;

  return (
    <div style={{display: 'flex', fontFamily: FONTS.mono, fontWeight: 500, fontSize: size, color, height: lh, lineHeight: `${lh}px`}}>
      {places.map((p, idx) => {
        if (p === ',' || p === '.') {
          const show = p === '.' || value >= 1000;
          return (
            <span key={idx} style={{width: charW * 0.6, textAlign: 'center', opacity: show ? 1 : 0}}>
              {p}
            </span>
          );
        }
        // continuous digit position: the column spins smoothly between digits
        const d = (value / p) % 10;
        const speed = Math.abs(value - prev) / p; // digits per frame
        const blur = Math.min(size * 0.12, speed * size * 0.05);
        const hidden = p > 1 && value < p;
        return (
          <span key={idx} style={{position: 'relative', width: charW, height: lh, overflow: 'hidden', opacity: hidden ? 0 : 1}}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                transform: `translateY(${-d * lh}px)`,
                filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => (
                <span key={i} style={{height: lh, width: charW, textAlign: 'center'}}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
};
