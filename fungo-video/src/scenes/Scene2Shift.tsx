import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import {HEADLINES} from '../config';
import {EASE_IN_OUT, mix, prog} from '../anim';
import {NftStage} from '../components/NftStage';
import {Headline} from '../components/Headline';

/** Scene 2 (4–9s): tiles dim one by one into sealed blocks; values become ciphertext. */
export const Scene2Shift: React.FC = () => {
  const frame = useCurrentFrame();
  const h = HEADLINES.shift;

  const tiles = (i: number) => {
    const p = prog(frame, 10 + i * 7, 22, EASE_IN_OUT);
    return {seal: p, edge: p * 0.8 + Math.sin(Math.PI * p) * 0.35};
  };

  const labels = (j: number) => {
    const start = 22 + j * 7;
    return {
      appear: 1,
      count: 1,
      cipher: prog(frame, start, 26, (t) => t),
      lock: prog(frame, start + 22, 14, Easing.out(Easing.back(2.2))),
      redact: 0,
    };
  };

  const close = prog(frame, 70, 12, EASE_IN_OUT);
  const eyes = {open: 1 - close, opacity: 1 - prog(frame, 78, 8)};

  return (
    <AbsoluteFill>
      <NftStage tiles={tiles} eyes={eyes} labels={labels} haze={mix(0.14, 0.07, prog(frame, 10, 70))} />
      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />
    </AbsoluteFill>
  );
};
