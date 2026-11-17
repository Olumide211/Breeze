import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {useLayout} from '../layout';
import {F} from '../timeline';
import {galaxyState} from './camera';
import {ICON_FILES, arrivalFrame, iconStates} from './icons';

// White icons as camera-facing sprites. Only a soft white glow: no tiles, no outlines, no grey.
export const GalaxyIcons: React.FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  if (frame < F.icons || frame > arrivalFrame(5) + 1) return null;
  const icons = iconStates(frame, galaxyState(frame, L), L);
  return (
    <AbsoluteFill>
      {icons.map((ic) =>
        ic.visible ? (
          <Img
            key={ic.i}
            src={ICON_FILES[ic.i]}
            style={{
              position: 'absolute',
              left: ic.x - ic.size / 2,
              top: ic.y - ic.size / 2,
              width: ic.size,
              height: ic.size,
              opacity: ic.opacity,
              filter: `drop-shadow(0 0 ${(5 + 12 * ic.flare).toFixed(2)}px rgba(255,255,255,${(0.32 + 0.45 * ic.flare).toFixed(3)}))`,
            }}
          />
        ) : null,
      )}
    </AbsoluteFill>
  );
};
