import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {HEADLINES} from '../config';
import {EASE_IN_OUT, prog} from '../anim';
import {NftStage} from '../components/NftStage';
import {TILE_ORDER} from '../components/TileGrid';
import {Headline} from '../components/Headline';

/** Scene 1 (0–4s): tiles snap together, scanner reads every trait out loud. */
export const Scene1OldWay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const h = HEADLINES.oldWay;

  const tiles = (i: number) => {
    const start = 3 + i * 3;
    const s = spring({frame: frame - start, fps, config: {damping: 15, stiffness: 150, mass: 0.7}, durationInFrames: 26});
    const [row, col] = TILE_ORDER[i];
    const ang = Math.atan2(row - 1, col - 1) + (random(`a${i}`) - 0.5) * 0.6;
    const dist = 360 + random(`d${i}`) * 160;
    const land = start + 14;
    return {
      dx: Math.cos(ang) * dist * (1 - s),
      dy: Math.sin(ang) * dist * (1 - s),
      rotate: (random(`r${i}`) - 0.5) * 80 * (1 - s),
      scale: interpolate(s, [0, 1], [0.55, 1]),
      opacity: Math.min(1, s * 2.5),
      flash: interpolate(frame, [land - 2, land, land + 9], [0, 0.45, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    };
  };

  const scanStart = 38;
  const scanDur = 26;
  const scan = prog(frame, scanStart, scanDur, EASE_IN_OUT);
  const scanOpacity = interpolate(frame, [scanStart, scanStart + 4, scanStart + scanDur - 2, scanStart + scanDur + 6], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labels = (i: number) => {
    const row = Math.floor(i / 2);
    const start = scanStart + 6 + row * 8 + (i % 2) * 2;
    return {appear: prog(frame, start, 14), lock: 0, cipher: 0, redact: 0, count: prog(frame, start + 2, 20)};
  };

  const eyes = {open: spring({frame: frame - 36, fps, config: {damping: 12}, durationInFrames: 14}), opacity: prog(frame, 34, 6)};

  return (
    <AbsoluteFill>
      <NftStage
        tiles={tiles}
        eyes={eyes}
        labels={labels}
        haze={0.14 * prog(frame, 0, 36)}
        scan={frame >= scanStart ? scan : null}
        scanOpacity={scanOpacity}
      />
      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />
    </AbsoluteFill>
  );
};
