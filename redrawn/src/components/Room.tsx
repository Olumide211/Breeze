import React from "react";
import { COLORS } from "../scenes";
import { arc, type Pt } from "../lib/util";
import { SketchPath } from "./SketchPath";

/** Set layout (world px). The wide shot shows the whole 1024×576 world. */
export const ROOM = {
  wallY: 440, // where wall meets floor
  floorY: 500, // where furniture and feet stand
  door: { x: 150, w: 92, top: 178 },
  deskSeat: [548, 412] as Pt, // Boy's hip when at the desk
  bedSeat: [405, 416] as Pt, // Boy's hip on the edge of the bed
  deskBlock: { x0: 700, x1: 780 }, // the pencil hides behind this
};

const L: React.FC<{ pts: Pt[]; seed: string; closed?: boolean; fill?: string; double?: boolean; width?: number; step?: number }> = (p) => (
  <SketchPath smooth={false} step={p.step ?? 28} {...p} width={(p.width ?? 2.5) * 0.72} />
);

/** Wall line + door. open: 0 closed → 1 open. */
export const RoomBack: React.FC<{ open: number }> = ({ open }) => {
  const { wallY, door } = ROOM;
  const x0 = door.x, x1 = door.x + door.w, top = door.top;
  const free = x0 + 6 + (door.w - 12) * (1 - 0.82 * open);
  return (
    <g>
      <L pts={[[-100, wallY], [x0, wallY]]} seed="wall-a" />
      <L pts={[[x1, wallY], [1100, wallY]]} seed="wall-b" double />
      <L pts={[[x0, wallY], [x0, top], [x1, top], [x1, wallY]]} seed="door-frame" width={3} double />
      {open > 0.02 ? <L pts={[[x0 + 6, wallY], [x1 - 6, wallY]]} seed="door-sill" width={1.6} /> : null}
      {/* door leaf, hinged on the left, swinging into the room */}
      <L pts={[[x0 + 6, top + 6], [free, top + 6 - 16 * open], [free, wallY + 24 * open], [x0 + 6, wallY]]} closed seed="door-leaf" fill={COLORS.bg} width={2.4} />
      <SketchPath pts={arc(free - 9 + 4 * open, 322, 3.2 - open, 3.2, 0, 320, 6)} closed seed="door-knob" width={1.8} />
    </g>
  );
};

export const Bed: React.FC = () => {
  const f = ROOM.floorY;
  return (
    <g>
      <L pts={[[258, f], [258, 372], [271, 372], [271, f]]} seed="bed-head" fill={COLORS.bg} double />
      <L pts={[[271, 418], [420, 418], [420, 452], [271, 452]]} closed seed="bed-mattress" fill={COLORS.bg} double />
      <SketchPath pts={[[278, 416], [280, 401], [304, 397], [328, 402], [330, 416]]} seed="bed-pillow" fill={COLORS.bg} width={2.2} />
      <SketchPath pts={[[340, 418], [362, 428], [392, 425], [420, 432]]} seed="bed-blanket" width={1.8} />
      <L pts={[[414, 452], [414, f]]} seed="bed-leg" double />
    </g>
  );
};

export const Chair: React.FC = () => {
  const f = ROOM.floorY;
  return (
    <g>
      <L pts={[[525, 414], [519, 338]]} seed="chair-back" width={3} double />
      <L pts={[[512, 340], [527, 337]]} seed="chair-top" width={3} />
      <L pts={[[521, 413], [573, 413], [573, 420], [521, 420]]} closed seed="chair-seat" fill={COLORS.bg} />
      <L pts={[[526, 420], [524, f]]} seed="chair-leg1" double />
      <L pts={[[567, 420], [569, f]]} seed="chair-leg2" double />
    </g>
  );
};

export const Desk: React.FC = () => {
  const f = ROOM.floorY;
  const { x0, x1 } = ROOM.deskBlock;
  return (
    <g>
      <L pts={[[786, 388], [786, f - 14]]} seed="desk-leg-back" width={2} />
      <L pts={[[x0, 388], [x1, 388], [x1, f], [x0, f]]} closed seed="desk-block" fill={COLORS.bg} double />
      <L pts={[[x0 + 8, 424], [x1 - 8, 424]]} seed="desk-drawer1" width={1.8} />
      <L pts={[[x0 + 8, 462], [x1 - 8, 462]]} seed="desk-drawer2" width={1.8} />
      <L pts={[[x0 + 36, 406], [x0 + 52, 406]]} seed="desk-knob1" width={2.6} />
      <L pts={[[x0 + 36, 443], [x0 + 52, 443]]} seed="desk-knob2" width={2.6} />
      <L pts={[[574, 388], [574, f]]} seed="desk-leg" double />
      <L pts={[[566, 380], [770, 380], [770, 388], [566, 388]]} closed seed="desk-front" fill={COLORS.bg} />
      <L pts={[[566, 380], [590, 334], [794, 334], [770, 380]]} closed seed="desk-top" fill={COLORS.bg} width={2.8} double />
    </g>
  );
};
