import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONTS, HEADLINES, TRAITS, VIDEO} from '../config';
import {EASE_IN_OUT, prog} from '../anim';
import {NftStage} from '../components/NftStage';
import {TILE_ORDER} from '../components/TileGrid';
import {Headline} from '../components/Headline';
import {Sfx} from '../components/Sfx';

// timings (frames, scene-local)
const TILE_START = 6;
const TILE_STAGGER = 4;
const SCAN_START = 56;
const SCAN_DUR = 34;
const labelStart = (i: number) => SCAN_START + 6 + Math.floor(i / 2) * 10 + (i % 2) * 3;

/** Faint public metadata scrolling in the background: everything is out in the open. */
const MetadataStream: React.FC<{opacity: number}> = ({opacity}) => {
  const frame = useCurrentFrame();
  const lines: string[] = [];
  for (let k = 0; k < 6; k++) {
    lines.push('{', `  "token_id": ${217 + k * 31},`, `  "owner": "0x${(random(`o${k}`) * 1e16).toString(16).slice(0, 8)}…",`);
    TRAITS.forEach((t) => lines.push(`  "${t.name.toLowerCase()}": "${t.stat ?? t.value}",`));
    lines.push(`  "image": "ipfs://Qm${(random(`i${k}`) * 1e18).toString(36).slice(0, 10)}…"`, '},');
  }
  const col = (x: number, offset: number, speed: number) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: -((frame * speed + offset) % 600),
        fontFamily: FONTS.mono,
        fontSize: 17,
        lineHeight: 1.7,
        color: COLORS.white,
        whiteSpace: 'pre',
      }}
    >
      {[...lines, ...lines].join('\n')}
    </div>
  );
  return (
    <AbsoluteFill style={{opacity, overflow: 'hidden'}}>
      {col(70, 0, 0.9)}
      {col(VIDEO.width - 430, 220, 0.7)}
    </AbsoluteFill>
  );
};

/** Scene 1: tiles snap together, the scanner reads every trait out loud. */
export const Scene1OldWay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const h = HEADLINES.oldWay;

  const tiles = (i: number) => {
    const start = TILE_START + i * TILE_STAGGER;
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

  const scan = prog(frame, SCAN_START, SCAN_DUR, EASE_IN_OUT);
  const scanOpacity = interpolate(frame, [SCAN_START, SCAN_START + 4, SCAN_START + SCAN_DUR - 2, SCAN_START + SCAN_DUR + 6], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labels = (i: number) => {
    const start = labelStart(i);
    return {appear: prog(frame, start, 14), lock: 0, cipher: 0, redact: 0, count: prog(frame, start + 2, 22)};
  };

  const eyes = {open: spring({frame: frame - 52, fps, config: {damping: 12}, durationInFrames: 14}), opacity: prog(frame, 50, 6)};
  const meta = 0.06 * prog(frame, 70, 30) * (1 - prog(frame, 150, 15));

  return (
    <AbsoluteFill>
      <MetadataStream opacity={meta} />
      <NftStage
        tiles={tiles}
        eyes={eyes}
        labels={labels}
        haze={0.14 * prog(frame, 0, 50)}
        scan={frame >= SCAN_START ? scan : null}
        scanOpacity={scanOpacity}
      />
      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />

      {/* sound */}
      {TILE_ORDER.map((_, i) => (
        <Sfx key={`s${i}`} at={TILE_START + i * TILE_STAGGER + 12} name="snap" volume={0.75 + 0.25 * random(`sv${i}`)} />
      ))}
      <Sfx at={50} name="pop" volume={0.6} />
      <Sfx at={SCAN_START - 2} name="scan" />
      {TRAITS.map((_, i) => (
        <Sfx key={`p${i}`} at={labelStart(i)} name="pop" volume={0.8} />
      ))}
    </AbsoluteFill>
  );
};
