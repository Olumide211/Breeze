import React from 'react';
import {AbsoluteFill, Easing, Img, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, CREDIT, FONTS, HEADLINES, sceneFrames, sec} from '../config';
import {TILE_RADIUS} from '../components/TileGrid';
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

  // flood: one giant rounded tile that spins open from the centre (the 9th tile)
  const flood = prog(frame, 0, 16, Easing.bezier(0.55, 0, 0.1, 1));
  const floodSize = mix(0, 3000, flood);
  const floodRot = mix(45, 0, flood);
  const credit = prog(frame, sec(CREDIT.in), 14);

  const logoW = gridSize(LOGO_TILE);
  const rowW = logoW + LOGO_GAP + Z_VISIBLE;
  const logoCx = width / 2 - rowW / 2 + logoW / 2;
  const zCx = width / 2 + rowW / 2 - Z_VISIBLE / 2;

  const tiles = (i: number) => {
    const start = 3 + i;
    const s = spring({frame: frame - start, fps, config: {damping: 18, stiffness: 140, mass: 0.7}, durationInFrames: 20});
    const [row, col] = TILE_ORDER[i];
    // right-hand tiles arrive steeply from above/below so they never cross the Zama mark
    const base = col === 2 ? (row === 2 ? 1 : -1) * (Math.PI * 0.42) : Math.atan2(row - 1, col - 1);
    const ang = base + (random(`fa${i}`) - 0.5) * (col === 2 ? 0.15 : 0.5);
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
      <div
        style={{
          position: 'absolute',
          left: width / 2 - floodSize / 2,
          top: height / 2 - floodSize / 2,
          width: floodSize,
          height: floodSize,
          borderRadius: floodSize * TILE_RADIUS,
          background: COLORS.yellow,
          transform: `rotate(${floodRot}deg)`,
          boxShadow: flood < 1 ? `0 0 ${80 * (1 - flood)}px rgba(255,231,131,${0.6 * (1 - flood)})` : undefined,
        }}
      />
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
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 64,
              textAlign: 'center',
              fontFamily: FONTS.mono,
              fontWeight: 500,
              fontSize: 20,
              letterSpacing: '0.32em',
              color: COLORS.black,
              opacity: 0.75 * credit,
              transform: `translateY(${(1 - credit) * 8}px)`,
            }}
          >
            {CREDIT.text}
          </div>
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

