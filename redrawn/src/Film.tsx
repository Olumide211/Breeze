import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BUBBLES, COLORS, DOOR_MOUTH, VIDEO } from "./scenes";
import { FilmInk, sceneAt } from "./lib/ink";
import { kf, type Pt } from "./lib/util";
import { direct, END_CARD_START } from "./direction";
import { Boy } from "./components/Boy";
import { Camera } from "./components/Camera";
import { Paper } from "./components/Paper";
import { ParentFloorShadow, ParentHand, ParentWallShadow } from "./components/Parent";
import { Pencil } from "./components/Pencil";
import { Bed, Chair, Desk, ROOM, RoomBack } from "./components/Room";
import { BubbleCrumble, ScribbleBubble } from "./components/ScribbleBubble";
import { EndCard } from "./EndCard";

const Bubbles: React.FC<{ frame: number }> = ({ frame }) => {
  const sc = sceneAt(frame);
  const f = sc.ones ? frame : frame - (frame % 2);
  return (
    <g>
      {BUBBLES.map((b) => {
        const first = b.keys[0][0];
        if (frame < first) return null;
        const at = (i: 1 | 2 | 3) => kf(Math.min(f, b.hit), b.keys.map((k) => [k[0], k[i]] as [number, number]));
        // settled bubbles keep bobbing a little
        const bob: Pt = [Math.sin(f * 0.7 + first) * 3, Math.cos(f * 0.9 + first) * 3];
        const x = at(1) + bob[0], y = at(2) + bob[1], size = at(3);
        const t = frame - b.hit;
        if (t < 0) return <ScribbleBubble key={b.id} x={x} y={y} size={size} tail={DOOR_MOUTH} seed={b.id} />;
        if (b.end === "fade") {
          if (t >= 7) return null;
          return <ScribbleBubble key={b.id} x={x} y={y} size={size * (1 + t * 0.04)} tail={DOOR_MOUTH} seed={b.id} opacity={1 - t / 7} />;
        }
        if (t > 60) return null;
        return <g key={b.id} opacity={kf(t, [[40, 1], [60, 0]])}><BubbleCrumble x={x} y={y} size={size} seed={b.id} t={t} floorY={ROOM.floorY - 2} /></g>;
      })}
    </g>
  );
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= END_CARD_START) return <EndCard />;
  const s = direct(frame);
  const desk = s.seat === "desk";
  const pencil = s.pencil ? <Pencil tip={s.pencil.tip} angle={s.pencil.angle} roll={s.pencil.roll} /> : null;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <svg width={VIDEO.width} height={VIDEO.height} viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}>
        <FilmInk frame={frame}>
          <Camera {...s.cam}>
            <ParentWallShadow k={s.wallShadow} from={[ROOM.door.x + ROOM.door.w + 6, ROOM.wallY]} />
            <ParentFloorShadow k={s.floorShadow} from={[ROOM.door.x + ROOM.door.w / 2, ROOM.wallY + 6]} />
            <RoomBack open={s.door} />
            <Bed />
            {s.hideChair ? null : <Chair />}
            {desk ? <Boy {...s.boy} layer="legs" /> : null}
            {s.pencil?.where === "floor" ? pencil : null}
            {s.ball && s.ball[1] > 400 ? <Paper id="ball" doodle={0} crumple={1} ball={s.ball} /> : null}
            <Desk />
            {s.paper ? <Paper doodle={s.paper.doodle} crumple={s.paper.crumple} ball={s.paper.ball} /> : null}
            {s.ball && s.ball[1] <= 400 ? <Paper id="ball" doodle={0} crumple={1} ball={s.ball} /> : null}
            <Boy {...s.boy} layer={desk ? "upper" : "all"} />
            {s.pencil?.where === "hand" ? pencil : null}
            <Bubbles frame={frame} />
            {s.parentHand ? <ParentHand {...s.parentHand} /> : null}
          </Camera>
        </FilmInk>
      </svg>
    </AbsoluteFill>
  );
};
