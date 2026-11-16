import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "./scenes";
import { BoilInk, Ink } from "./lib/ink";
import { Boy, type BoyProps, type Erased, type Redrawn } from "./components/Boy";
import { ScribbleBubble, BubbleCrumble } from "./components/ScribbleBubble";
import { ParentHand } from "./components/Parent";
import { Pencil } from "./components/Pencil";
import { SketchPath } from "./components/SketchPath";

const ERASED: Erased = { smileCornerLeft: 1, earRight: 1, headOutlineSegments: [0, 1, 0, 1], fingers: [1, 1, 1, 0.5, 1], palm: 0 };
const ALL_GONE: Erased = { ...ERASED, fingers: [1, 1, 1, 1, 1], palm: 1 };
const REDRAWN: Redrawn = { smileCornerLeft: 1, fingers: [1, 1, 1, 1, 1], palm: 1 };

const Slot: React.FC<{ i: number; label: string; boil: number; boy: Partial<BoyProps> }> = ({ i, label, boil, boy }) => (
  <g transform={`translate(${50 + i * 340} 110)`}>
    <text x={0} y={-22} fontFamily="monospace" fontSize={18} fill="#666">{label}</text>
    <g transform="scale(1.9)">
      <BoilInk boil={boil} frame={0}>
        <Ink zoom={1.9}>
          <SketchPath pts={[[18, 150], [70, 150]]} smooth={false} seed={`stool${i}`} />
          <Boy id={`cast${i}`} x={40} y={148} legDrop={70} rightHand={[84, 118]} leftHand={[80, 140]} rightHandAngle={-10} {...boy} />
        </Ink>
      </BoilInk>
    </g>
  </g>
);

export const Cast: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <svg width={1400} height={900} viewBox="0 0 1400 900">
      <Slot i={0} label="boil 0.2 (calm)" boil={0.2} boy={{}} />
      <Slot i={1} label="boil 1.0 (anxious)" boil={1} boy={{ mouth: "sad", browAngle: 14, posture: 0.6 }} />
      <Slot i={2} label="erased (lineWeight 0.7)" boil={0.5} boy={{ erased: ERASED, mouth: "o", lineWeight: 0.7, browRaise: 3 }} />
      <Slot i={3} label="redrawn" boil={0.1} boy={{ erased: ALL_GONE, redrawn: REDRAWN, mouth: "calmSmile" }} />
      <g transform="translate(0 560)">
        <text x={60} y={0} fontFamily="monospace" fontSize={18} fill="#666">scribble bubble / crumble t=3, t=9 / parent hand open, closed / pencil / lineWeight 0.4</text>
        <BoilInk boil={0.5} frame={3}>
          <ScribbleBubble x={130} y={120} size={70} tail={[-100, 200]} seed="castb" />
          <BubbleCrumble x={330} y={90} size={60} seed="castc" t={3} floorY={230} />
          <BubbleCrumble x={500} y={90} size={60} seed="castc" t={9} floorY={230} />
          <ParentHand x={700} y={110} angle={20} close={0} scale={0.8} />
          <ParentHand x={900} y={110} angle={20} close={1} scale={0.8} />
          <g transform="translate(1010 200) scale(3)"><Ink zoom={3}><Pencil tip={[0, 0]} angle={-20} /></Ink></g>
          <g transform="translate(1130 60) scale(1.3)">
            <Boy id="castfaint" x={40} y={120} legDrop={70} rightHand={[78, 108]} leftHand={[82, 106]} posture={1} lean={10} mouth="sad" lineWeight={0.4} erased={ALL_GONE} />
          </g>
        </BoilInk>
      </g>
    </svg>
  </AbsoluteFill>
);
