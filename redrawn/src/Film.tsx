import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ANIMATE_ON_TWOS, BUBBLES, COLORS, DOOR_MOUTH, VIDEO } from "./scenes";
import { FilmInk, sceneAt } from "./lib/ink";
import { easeIn, kf, type Pt } from "./lib/util";
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
  const f = sc.ones || !ANIMATE_ON_TWOS ? frame : frame - (frame % 2);
  return (
    <g>
      {BUBBLES.map((b) => {
        const first = b.keys[0][0];
        if (frame < first) return null;
        // accelerate into the hit
        const pos = (ff: number, i: 1 | 2 | 3) => kf(Math.min(ff, b.hit), b.keys.map((k) => [k[0], k[i]] as [number, number]), b.end === "fade" ? easeIn : undefined);
        const at = (i: 1 | 2 | 3) => pos(f, i);
        // stretch along the direction of travel, splat on impact
        const vx = pos(f, 1) - pos(f - 1, 1), vy = pos(f, 2) - pos(f - 1, 2);
        const speed = Math.hypot(vx, vy);
        const ang = (Math.atan2(vy, vx) * 180) / Math.PI;
        const since = frame - b.hit;
        const st = since >= 0 && b.end === "fade" ? 1 - 0.3 * Math.exp(-0.5 * since) : 1 + Math.min(0.45, speed * 0.02);
        const wrap = (el: React.ReactNode) => (
          <g key={b.id} transform={`translate(${at(1)} ${at(2)}) rotate(${ang}) scale(${st} ${1 / st}) rotate(${-ang}) translate(${-at(1)} ${-at(2)})`}>{el}</g>
        );
        // settled bubbles keep bobbing a little
        const bob: Pt = [Math.sin(f * 0.7 + first) * 3, Math.cos(f * 0.9 + first) * 3];
        const x = at(1) + bob[0], y = at(2) + bob[1], size = at(3);
        const t = frame - b.hit;
        if (t < 0) return wrap(<ScribbleBubble x={x} y={y} size={size} tail={DOOR_MOUTH} seed={b.id} />);
        if (b.end === "fade") {
          if (t >= 7) return null;
          return wrap(<ScribbleBubble x={x} y={y} size={size * (1 + t * 0.04)} tail={DOOR_MOUTH} seed={b.id} opacity={1 - t / 7} />);
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
            {s.parentHand ? <ParentHand {...s.parentHand} angle={62} /> : null}
          </Camera>
        </FilmInk>
      </svg>
    </AbsoluteFill>
  );
};
