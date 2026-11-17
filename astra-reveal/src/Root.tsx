import React from 'react';
import {Composition} from 'remotion';
import {AstraReveal} from './AstraReveal';
import {DURATION, FPS, H, W} from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="AstraReveal" component={AstraReveal} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
);
