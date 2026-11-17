// Title constants live in ./title.ts (TITLE_LEFT / TITLE_RIGHT).
export {TITLE_LEFT, TITLE_RIGHT} from './title';
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import './fonts';
import {F} from './timeline';
import {Blossom} from './scenes/Blossom';
import {MessageBox} from './scenes/MessageBox';
import {Bubble, ResponseDot} from './scenes/Bubble';
import {Titles} from './scenes/Titles';
import {Grain, SpaceBackground, StarField, Vignette} from './scenes/Space';
import {GalaxyPoints} from './galaxy/GalaxyPoints';
import {GalaxyIcons} from './galaxy/GalaxyIcons';
import {FxLayer} from './galaxy/FxLayer';
import {arrivalFrame} from './galaxy/icons';

export const AstraReveal: React.FC = () => {
  const f = useCurrentFrame();
  const galaxyOn = f >= F.galaxy - 2;
  // motion blur only during the collapse (the burst has its own sample-based blur)
  const fastIcons = f >= F.collapse && f <= arrivalFrame(5) + 1;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <SpaceBackground />
      <StarField />
      {galaxyOn ? <GalaxyPoints /> : null}
      <FxLayer />
      {fastIcons ? (
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <GalaxyIcons />
        </CameraMotionBlur>
      ) : (
        <GalaxyIcons />
      )}
      <Vignette />
      {/* crisp UI and type: never bloomed */}
      <Blossom />
      <MessageBox />
      <Bubble />
      <ResponseDot />
      <Titles />
      <Grain />
    </AbsoluteFill>
  );
};
