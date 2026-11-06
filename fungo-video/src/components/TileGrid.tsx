import React from 'react';
import {COLORS, FONTS} from '../config';
import {hexString} from '../anim';
import {ART_CELL, CharacterArt, Eyes} from './CharacterArt';

/**
 * The Fungo 8-tile grid: 3×3 rounded squares, centre empty.
 * Tile corner radius = 22% of tile width, gap = 8% of tile width.
 */
export const TILE_RADIUS = 0.22;
export const TILE_GAP = 0.08;

/** [row, col] — clockwise from top-left. Index order is used for staggering. */
export const TILE_ORDER: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0],
];

export const gridSize = (tile: number) => tile * 3 + tile * TILE_GAP * 2;

export type TileState = {
  dx?: number;
  dy?: number;
  rotate?: number;
  scale?: number;
  opacity?: number;
  /** 0 = art visible, 1 = sealed black block */
  seal?: number;
  /** thin yellow edge strength (0–1) */
  edge?: number;
  /** brief yellow flash overlay (0–1) */
  flash?: number;
};

type Props = {
  cx: number;
  cy: number;
  tile: number;
  variant?: 'art' | 'solid';
  solidColor?: string;
  tiles?: (i: number) => TileState;
  eyes?: {open: number; opacity: number};
  /** faint ciphertext inside sealed tiles */
  cipherTexture?: boolean;
};

export const TileGrid: React.FC<Props> = ({
  cx,
  cy,
  tile,
  variant = 'art',
  solidColor = COLORS.black,
  tiles,
  eyes,
  cipherTexture = true,
}) => {
  const gap = tile * TILE_GAP;
  const radius = tile * TILE_RADIUS;
  const total = gridSize(tile);
  const left = cx - total / 2;
  const top = cy - total / 2;

  return (
    <>
      {eyes && eyes.opacity > 0 && (
        <svg
          width={tile}
          height={tile}
          viewBox={`${ART_CELL} ${ART_CELL} 100 100`}
          style={{
            position: 'absolute',
            left: left + tile + gap,
            top: top + tile + gap,
            opacity: eyes.opacity,
            overflow: 'visible',
            filter: `drop-shadow(0 0 ${tile * 0.08}px ${COLORS.haze})`,
          }}
        >
          <Eyes open={eyes.open} />
        </svg>
      )}
      {TILE_ORDER.map(([row, col], i) => {
        const s = tiles?.(i) ?? {};
        const seal = s.seal ?? 0;
        const edge = s.edge ?? 0;
        const flash = s.flash ?? 0;
        const x = left + col * (tile + gap);
        const y = top + row * (tile + gap);
        const edgeW = Math.max(1.5, tile * 0.016);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: tile,
              height: tile,
              borderRadius: radius,
              overflow: 'hidden',
              opacity: s.opacity ?? 1,
              transform: `translate(${s.dx ?? 0}px, ${s.dy ?? 0}px) rotate(${s.rotate ?? 0}deg) scale(${s.scale ?? 1})`,
              background: variant === 'solid' ? solidColor : COLORS.black,
            }}
          >
            {variant === 'art' && seal < 1 && (
              <svg
                width={tile}
                height={tile}
                viewBox={`${col * ART_CELL} ${row * ART_CELL} 100 100`}
                style={{position: 'absolute', inset: 0, opacity: 1 - seal}}
              >
                <CharacterArt />
              </svg>
            )}
            {variant === 'art' && seal > 0 && (
              <div style={{position: 'absolute', inset: 0, background: COLORS.black, opacity: seal}}>
                {cipherTexture && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: tile * 0.12,
                      fontFamily: FONTS.mono,
                      fontSize: tile * 0.085,
                      lineHeight: 1.25,
                      color: COLORS.yellow,
                      opacity: 0.16,
                      wordBreak: 'break-all',
                      overflow: 'hidden',
                    }}
                  >
                    {hexString(`tile-${i}`, 48)}
                  </div>
                )}
              </div>
            )}
            {flash > 0 && (
              <div style={{position: 'absolute', inset: 0, background: COLORS.yellow, opacity: flash}} />
            )}
            {edge > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: radius,
                  boxShadow: `inset 0 0 0 ${edgeW}px rgba(255,210,7,${edge})`,
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
};
