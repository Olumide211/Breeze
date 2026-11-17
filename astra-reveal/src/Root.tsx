import React from 'react';
import {Composition} from 'remotion';
import {AstraReveal, AstraSquare} from './AstraReveal';
import {SQUARE, VERTICAL} from './layout';
import {DURATION, FPS} from './timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="AstraReveal" component={AstraReveal} durationInFrames={DURATION} fps={FPS} width={VERTICAL.W} height={VERTICAL.H} />
    <Composition id="AstraSquare" component={AstraSquare} durationInFrames={DURATION} fps={FPS} width={SQUARE.W} height={SQUARE.H} />
  </>
);
