import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {SFX} from '../config';

/** One sound effect cue, placed on the same frame as the motion it belongs to. */
export const Sfx: React.FC<{at: number; name: string; volume?: number}> = ({at, name, volume = 1}) => {
  if (!SFX.enabled) return null;
  const v = SFX.volume * (SFX.levels[name] ?? 0.5) * volume;
  return (
    <Sequence from={Math.max(0, Math.round(at))} layout="none" name={`sfx · ${name}`}>
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={v} />
    </Sequence>
  );
};
