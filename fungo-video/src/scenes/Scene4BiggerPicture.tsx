import React from 'react';
import {AbsoluteFill, Easing, Img, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, HEADLINES, sceneFrames} from '../config';
import {mix, prog} from '../anim';
import {Headline} from '../components/Headline';
import {gridSize, TILE_ORDER, TileGrid} from '../components/TileGrid';

// ───────────────────────── 4a: LOOKING WRONG ─────────────────────────
const LookingWrong: React.FC = () => {
  const h = HEADLINES.lookingWrong;
  return (
    <AbsoluteFill>
      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 4b: FLOOD + LOCKUP ─────────────────────────
const LOGO_TILE = 92;
const MARK_SQUARE = 440; // the Z occupies ~50% of the brand-kit square
const Z_VISIBLE = MARK_SQUARE * 0.507;
const LOGO_GAP = 110;
const ROW_Y = 440;

export const Lockup: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const h = HEADLINES.logo;

  // flood: circle from the centre, punchy ease
  const flood = prog(frame, 0, 14, Easing.bezier(0.55, 0, 0.1, 1));
  const r = flood * Math.hypot(width, height) * 0.55;

  const logoW = gridSize(LOGO_TILE);
  const rowW = logoW + LOGO_GAP + Z_VISIBLE;
  const logoCx = width / 2 - rowW / 2 + logoW / 2;
  const zCx = width / 2 + rowW / 2 - Z_VISIBLE / 2;

  const tiles = (i: number) => {
    const start = 4 + Math.round(i * 1.5);
    const s = spring({frame: frame - start, fps, config: {damping: 17, stiffness: 120, mass: 0.8}, durationInFrames: 26});
    const [row, col] = TILE_ORDER[i];
    const ang = Math.atan2(row - 1, col - 1) + (random(`fa${i}`) - 0.5) * 0.5;
    const dist = 1150;
    return {
      dx: Math.cos(ang) * dist * (1 - s),
      dy: Math.sin(ang) * dist * (1 - s),
      rotate: (random(`fr${i}`) - 0.5) * 120 * (1 - s),
      scale: mix(1.4, 1, s),
    };
  };

  const m = prog(frame, 16, 16);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: COLORS.yellow, clipPath: `circle(${r}px at 50% 50%)`}} />
      {flood > 0.3 && (
        <>
          {/* official Zama mark (brand-kit file, its square is #FFD207 = the flood colour) */}
          <Img
            src={staticFile('zama-mark.svg')}
            style={{
              position: 'absolute',
              width: MARK_SQUARE,
              height: MARK_SQUARE,
              left: zCx - MARK_SQUARE / 2,
              top: ROW_Y - MARK_SQUARE / 2,
              opacity: m,
              transform: `translateX(${(1 - m) * 40}px) scale(${mix(0.92, 1, m)})`,
            }}
          />
          <TileGrid cx={logoCx} cy={ROW_Y} tile={LOGO_TILE} variant="solid" solidColor={COLORS.black} tiles={tiles} />
          <Headline
            text={h.text}
            inAt={h.in}
            outAt={h.out}
            size={h.size}
            y={h.y}
            color={COLORS.black}
            glow={false}
            letterSpacing="0.04em"
          />
        </>
      )}
    </AbsoluteFill>
  );
};

/** Scene 4 (15–20s): clear to black, then the yellow flood and the lockup. */
export const Scene4BiggerPicture: React.FC = () => {
  const a = sceneFrames('lookingWrong');
  const b = sceneFrames('logo');
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={a.duration + 14} layout="none">
        <LookingWrong />
      </Sequence>
      <Sequence from={b.from - a.from} durationInFrames={b.duration} layout="none">
        <Lockup />
      </Sequence>
    </AbsoluteFill>
  );
};

