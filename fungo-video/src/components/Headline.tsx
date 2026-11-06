import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, HEADLINE_STYLE, sec} from '../config';
import {EASE_OUT, prog} from '../anim';
import {Sfx} from './Sfx';

type Props = {
  text: string;
  /** seconds, relative to the parent Sequence */
  inAt: number;
  outAt?: number | null;
  y?: number;
  size?: number;
  color?: string;
  glow?: boolean;
  letterSpacing?: string;
  /** soft whoosh under the entrance */
  sound?: boolean;
};

const SLATS = 11;

/**
 * One line of text. Each word resolves out of a heavy blur + scale,
 * over a soft yellow haze sliced into vertical "reeded glass" slats
 * that refract and then settle.
 */
export const Headline: React.FC<Props> = ({
  text,
  inAt,
  outAt = null,
  y = 900,
  size = HEADLINE_STYLE.size,
  color = COLORS.white,
  glow = true,
  letterSpacing = '-0.01em',
  sound = true,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  const start = sec(inAt);
  const stagger = sec(HEADLINE_STYLE.wordStagger);
  const dur = sec(HEADLINE_STYLE.wordDuration);

  const exit = outAt == null ? 1 : 1 - prog(frame, sec(outAt), 10);
  const exitBlur = (1 - exit) * 14;
  const total = stagger * (words.length - 1) + dur;
  const overall = prog(frame, start, total, (t) => t);
  const settle = prog(frame, start, total + 12);

  const whoosh = sound ? <Sfx at={start - 6} name="whoosh" volume={0.5} /> : null;
  if (frame < start || exit <= 0) return whoosh;

  return (
    <>
    {whoosh}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        transform: `translateY(-50%) scale(${interpolate(exit, [0, 1], [0.97, 1])})`,
        display: 'flex',
        justifyContent: 'center',
        opacity: exit,
        filter: exitBlur > 0.1 ? `blur(${exitBlur}px)` : undefined,
      }}
    >
      <div style={{position: 'relative'}}>
        {glow && (
          <div
            style={{
              position: 'absolute',
              left: '-10%',
              right: '-10%',
              top: '-85%',
              bottom: '-85%',
              display: 'flex',
              opacity: 0.3 * overall,
              filter: 'blur(14px)',
              pointerEvents: 'none',
            }}
          >
            {new Array(SLATS).fill(0).map((_, i) => {
              const k = Math.sin(i * 1.7 + 0.6);
              const shift = k * 26 * (1 - settle) + k * 6;
              return (
                <div key={i} style={{flex: 1, position: 'relative', overflow: 'hidden'}}>
                  <div
                    style={{
                      position: 'absolute',
                      top: shift,
                      height: '100%',
                      width: `${SLATS * 100}%`,
                      left: `${-i * 100}%`,
                      background: `radial-gradient(ellipse 50% 50% at center, ${COLORS.haze} 0%, rgba(255,231,131,0.45) 38%, rgba(255,231,131,0) 75%)`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div
          style={{
            position: 'relative',
            fontFamily: FONTS.headline,
            fontWeight: 700,
            fontSize: size,
            letterSpacing,
            lineHeight: 1,
            color,
            whiteSpace: 'nowrap',
            display: 'flex',
            gap: size * 0.26,
          }}
        >
          {words.map((w, i) => {
            const p = prog(frame, start + i * stagger, dur, EASE_OUT);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: Math.min(1, p * 1.6),
                  transform: `translateY(${(1 - p) * 10}px) scale(${1 + (1 - p) * 0.22})`,
                  transformOrigin: '50% 60%',
                  filter: p < 0.99 ? `blur(${(1 - p) * 18}px)` : undefined,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
};
