import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONTS, Trait, TRAITS} from '../config';
import {mix, scramble} from '../anim';
import {gridSize, TileGrid, TileState} from './TileGrid';
import {Lock, Redacted} from './Bits';
import {Haze} from './Particles';

/** Shared layout for scenes 1, 2, 3a, so cuts between them are seamless. */
export const STAGE = {cx: 960, cy: 455, tile: 128};
const LABEL_W = 290;
const LABEL_GAP = 78; // grid edge → label box
const ROW_Y = [-130, 0, 130];

export type LabelState = {
  appear: number; // 0–1 pop in
  lock: number; // 0–1 lock settles
  /** 0 = plain value, 0–1 scramble into ciphertext */
  cipher: number;
  /** 0–1 ciphertext → ▒▒▒ redaction */
  redact: number;
  /** 0–1 count-up of stat values when they appear */
  count: number;
};

type Props = {
  tiles?: (i: number) => TileState;
  eyes?: {open: number; opacity: number};
  labels?: (i: number) => LabelState;
  labelsOpacity?: number;
  haze?: number;
  /** 0–1 scanning line position, null = hidden */
  scan?: number | null;
  scanOpacity?: number;
  grid?: {cx: number; cy: number; tile: number};
};

const TraitLabel: React.FC<{trait: Trait; index: number; s: LabelState; gridHalf: number; cx: number; cy: number}> = ({
  trait,
  index,
  s,
  gridHalf,
  cx,
  cy,
}) => {
  const frame = useCurrentFrame();
  const left = trait.side === 'left';
  const row = Math.floor(index / 2);
  const y = cy + ROW_Y[row];
  const edgeX = left ? cx - gridHalf : cx + gridHalf;
  const boxX = left ? edgeX - LABEL_GAP - LABEL_W : edgeX + LABEL_GAP;
  const dir = left ? -1 : 1;
  const a = s.appear;
  if (a <= 0) return null;

  // value text
  let valueText = trait.value;
  if (trait.stat != null && s.cipher <= 0) {
    valueText = String(Math.round(trait.stat * s.count));
  }
  if (s.cipher > 0) valueText = scramble(trait.value, trait.cipher, s.cipher, frame, `t${index}`);

  const barW = 110;
  const lockW = 26 * Math.min(1, s.lock * 1.4);

  return (
    <>
      {/* connector line + node on the grid edge */}
      <div
        style={{
          position: 'absolute',
          top: y,
          left: left ? boxX + LABEL_W + 14 : edgeX + 10,
          width: LABEL_GAP - 24,
          height: 1.5,
          background: s.lock > 0.5 ? COLORS.yellow : 'rgba(255,255,255,0.35)',
          opacity: a,
          transform: `scaleX(${a})`,
          transformOrigin: left ? 'right center' : 'left center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: y - 4,
          left: edgeX - 4 + dir * 6,
          width: 8,
          height: 8,
          borderRadius: 2,
          background: COLORS.yellow,
          opacity: a,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: y,
          left: boxX,
          width: LABEL_W,
          transform: `translateY(-50%) translateX(${dir * (1 - a) * 26}px) scale(${mix(0.9, 1, a)})`,
          transformOrigin: left ? 'right center' : 'left center',
          opacity: a,
          filter: a < 0.98 ? `blur(${(1 - a) * 6}px)` : undefined,
          display: 'flex',
          flexDirection: 'column',
          alignItems: left ? 'flex-end' : 'flex-start',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: left ? 'row-reverse' : 'row',
            fontFamily: FONTS.mono,
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '0.24em',
            color: COLORS.muted,
          }}
        >
          <span style={{marginRight: left ? '-0.24em' : 0}}>{trait.name}</span>
          <div
            style={{
              width: lockW,
              overflow: 'visible',
              display: 'flex',
              justifyContent: 'center',
              opacity: Math.min(1, s.lock * 2),
              transform: `translateY(${(1 - s.lock) * -16}px) scale(${mix(0.4, 1, s.lock)})`,
            }}
          >
            {s.lock > 0 && <Lock size={17} />}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexDirection: left ? 'row-reverse' : 'row',
            height: 38,
          }}
        >
          {s.redact < 1 && (
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 32,
                fontWeight: 500,
                color: s.cipher >= 1 ? COLORS.yellow : COLORS.white,
                letterSpacing: '0.02em',
                opacity: 1 - s.redact,
                position: s.redact > 0 ? 'absolute' : 'relative',
                filter: s.redact > 0 ? `blur(${s.redact * 8}px)` : undefined,
              }}
            >
              {valueText}
            </div>
          )}
          {s.redact > 0 && (
            <div style={{opacity: s.redact, transform: `scaleX(${mix(0.6, 1, s.redact)})`, transformOrigin: left ? 'right' : 'left'}}>
              <Redacted count={3} height={30} dither id={`trait-${index}`} />
            </div>
          )}
          {trait.stat != null && (
            <div
              style={{
                position: 'relative',
                width: barW,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.12)',
                overflow: 'hidden',
                opacity: 1 - Math.max(s.cipher, s.redact),
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  [left ? 'right' : 'left']: 0,
                  width: barW * (trait.stat / 100) * s.count * (1 - Math.max(s.cipher, s.redact)),
                  background: COLORS.yellow,
                  borderRadius: 3,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export const NftStage: React.FC<Props> = ({
  tiles,
  eyes,
  labels,
  labelsOpacity = 1,
  haze = 0.12,
  scan = null,
  scanOpacity = 1,
  grid = STAGE,
}) => {
  const total = gridSize(grid.tile);
  const half = total / 2;
  return (
    <>
      <Haze x={grid.cx} y={grid.cy} size={total * 2.1} opacity={haze} />
      <TileGrid cx={grid.cx} cy={grid.cy} tile={grid.tile} tiles={tiles} eyes={eyes} />
      {scan != null && scanOpacity > 0 && (
        <>
          {/* trailing band */}
          <div
            style={{
              position: 'absolute',
              left: grid.cx - half - 40,
              width: total + 80,
              top: grid.cy - half - 20 + scan * (total + 40) - 70,
              height: 70,
              background: 'linear-gradient(to bottom, rgba(255,231,131,0), rgba(255,231,131,0.16))',
              opacity: scanOpacity,
              filter: 'blur(6px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: grid.cx - half - 40,
              width: total + 80,
              top: grid.cy - half - 20 + scan * (total + 40) - 1.5,
              height: 3,
              background: COLORS.yellow,
              boxShadow: `0 0 18px 3px ${COLORS.haze}, 0 0 50px 8px rgba(255,210,7,0.45)`,
              borderRadius: 2,
              opacity: scanOpacity,
            }}
          />
        </>
      )}
      {labels && labelsOpacity > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: labelsOpacity}}>
          {TRAITS.map((t, i) => (
            <TraitLabel key={t.name} trait={t} index={i} s={labels(i)} gridHalf={half} cx={grid.cx} cy={grid.cy} />
          ))}
        </div>
      )}
    </>
  );
};
