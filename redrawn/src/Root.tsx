import React from "react";
import { Composition, Still } from "remotion";
import { Cast } from "./Cast";
import { Film } from "./Film";
import { VIDEO } from "./scenes";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still id="Cast" component={Cast} width={1400} height={900} />
      <Composition id="Redrawn" component={Film} durationInFrames={VIDEO.frames} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
    </>
  );
};
