import React from 'react';
import {Composition} from 'remotion';
import {FungoVideo} from './FungoVideo';
import {VIDEO} from './config';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="FungoVideo"
    component={FungoVideo}
    width={VIDEO.width}
    height={VIDEO.height}
    fps={VIDEO.fps}
    durationInFrames={Math.round(VIDEO.durationInSeconds * VIDEO.fps)}
  />
);
