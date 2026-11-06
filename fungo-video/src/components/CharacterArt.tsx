import React from 'react';
import {COLORS} from '../config';

/**
 * Original Genesis character: "the Oracle". A hooded figure drawn across the
 * 8-tile grid. Its face IS the empty centre tile, so the void reads as the
 * hood's shadow, and two eyes float inside it (rendered separately by TileGrid).
 *
 * Coordinate space: 316 × 316 = 3 tiles of 100 + 2 gaps of 8 (gap = 8% of tile).
 * Cells: 0–100, 108–208, 216–316.
 */
export const ART_SIZE = 316;
export const ART_CELL = 108;

const INK = '#0A0A0A';
const SHADE = '#22222B';

export const CharacterArt: React.FC = () => (
  <g>
    {/* sky */}
    <rect x={0} y={0} width={316} height={316} fill={COLORS.yellow} />

    {/* sparkles in the sky corners */}
    <path d="M30 26 l4 11 l11 4 l-11 4 l-4 11 l-4 -11 l-11 -4 l11 -4 z" fill={INK} />
    <path d="M283 60 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={INK} />
    <circle cx={60} cy={78} r={3.5} fill={INK} />
    <circle cx={300} cy={140} r={3} fill={INK} />
    <circle cx={14} cy={150} r={3} fill={INK} />

    {/* hood + cloak silhouette */}
    <path
      d="M158 8
         C 210 26, 262 84, 274 164
         C 280 206, 290 236, 316 250
         L 316 316 L 0 316 L 0 250
         C 26 236, 36 206, 42 164
         C 54 84, 106 26, 158 8 Z"
      fill={INK}
    />

    {/* hood fold lines */}
    <path d="M158 8 C 150 40, 132 60, 110 72" stroke={SHADE} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M240 112 C 252 150, 254 190, 246 228" stroke={SHADE} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M76 112 C 64 150, 62 190, 70 228" stroke={SHADE} strokeWidth={5} fill="none" strokeLinecap="round" />

    {/* face opening: deep shadow + white trim. Its centre is the empty tile. */}
    <path
      d="M86 226 C 78 150, 104 78, 158 70 C 212 78, 238 150, 230 226 Z"
      fill={COLORS.bg}
      stroke={COLORS.white}
      strokeWidth={6}
      strokeLinejoin="round"
    />

    {/* sprouting mushroom on the hood: the "fungo" */}
    <rect x={180} y={30} width={7} height={22} rx={3} fill={COLORS.white} transform="rotate(18 183 41)" />
    <path d="M168 34 C 170 16, 200 12, 208 28 C 198 32, 180 34, 168 34 Z" fill={COLORS.white} />
    <circle cx={186} cy={24} r={2.6} fill={INK} />
    <circle cx={197} cy={27} r={2} fill={INK} />

    {/* cloak folds */}
    <path d="M58 316 C 64 290, 70 270, 80 252" stroke={SHADE} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M258 316 C 252 290, 246 270, 236 252" stroke={SHADE} strokeWidth={5} fill="none" strokeLinecap="round" />

    {/* collar clasp: a tiny 8-tile ring */}
    {[
      [0, 0], [1, 0], [2, 0],
      [0, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ].map(([c, r]) => (
      <rect
        key={`${c}-${r}`}
        x={158 - 17 + c * 12}
        y={258 - 17 + r * 12}
        width={10}
        height={10}
        rx={2.2}
        fill={COLORS.yellow}
      />
    ))}
  </g>
);

/** The eyes that float in the empty centre (centre-cell coords 108–208). */
export const Eyes: React.FC<{open: number; color?: string}> = ({open, color = COLORS.yellow}) => (
  <g>
    <ellipse cx={138} cy={162} rx={9} ry={14 * Math.max(0.06, open)} fill={color} />
    <ellipse cx={178} cy={162} rx={9} ry={14 * Math.max(0.06, open)} fill={color} />
  </g>
);
