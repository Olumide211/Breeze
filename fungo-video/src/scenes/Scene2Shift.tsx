import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import {HEADLINES, TRAITS} from '../config';
import {EASE_IN_OUT, mix, prog} from '../anim';
import {NftStage} from '../components/NftStage';
import {Headline} from '../components/Headline';
import {TILE_ORDER} from '../components/TileGrid';
import {Sfx} from '../components/Sfx';

const SEAL_START = 14;
const SEAL_STAGGER = 8;
const SEAL_DUR = 24;
const cipherStart = (j: number) => 26 + j * 8;
const CIPHER_DUR = 28;
const lockAt = (j: number) => cipherStart(j) + 26;

/** Scene 2: tiles dim one by one into sealed blocks; values become ciphertext. */
export const Scene2Shift: React.FC = () => {
  const frame = useCurrentFrame();
  const h = HEADLINES.shift;

  const tiles = (i: number) => {
    const p = prog(frame, SEAL_START + i * SEAL_STAGGER, SEAL_DUR, EASE_IN_OUT);
    return {seal: p, edge: p * 0.8 + Math.sin(Math.PI * p) * 0.35};
  };

  const labels = (j: number) => ({
    appear: 1,
    count: 1,
    cipher: prog(frame, cipherStart(j), CIPHER_DUR, (t) => t),
    lock: prog(frame, lockAt(j), 14, Easing.out(Easing.back(2.2))),
    redact: 0,
  });

  const close = prog(frame, 94, 12, EASE_IN_OUT);
  const eyes = {open: 1 - close, opacity: 1 - prog(frame, 102, 8)};

  return (
    <AbsoluteFill>
      <NftStage tiles={tiles} eyes={eyes} labels={labels} haze={mix(0.14, 0.07, prog(frame, 14, 90))} />
      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />

      {/* sound */}
      {TILE_ORDER.map((_, i) => (
        <Sfx key={`s${i}`} at={SEAL_START + i * SEAL_STAGGER + 8} name="seal" volume={0.7 + i * 0.04} />
      ))}
      {TRAITS.map((_, j) => (
        <React.Fragment key={j}>
          <Sfx at={cipherStart(j)} name="scramble" volume={0.8} />
          <Sfx at={lockAt(j) + 4} name="lock" />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
