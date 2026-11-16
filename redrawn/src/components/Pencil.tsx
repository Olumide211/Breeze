import React from "react";
import { COLORS } from "../scenes";
import { SketchPath } from "./SketchPath";

/** A simple pencil. `tip` is the point, `angle` the direction from tip to eraser end, `roll` spins the facet line. */
export const Pencil: React.FC<{ tip: [number, number]; angle: number; roll?: number; length?: number }> = ({
  tip, angle, roll = 0, length = 36,
}) => {
  const h = 3;
  const facet = Math.sin(roll) * h * 0.8;
  return (
    <g transform={`translate(${tip[0]} ${tip[1]}) rotate(${angle})`}>
      <SketchPath pts={[[6, -h], [length, -h], [length, h], [6, h]]} closed smooth={false} step={12} seed="pencil-body" fill={COLORS.bg} width={1.6} />
      <SketchPath pts={[[6, -h], [0, 0], [6, h]]} smooth={false} step={12} seed="pencil-tip" fill={COLORS.bg} width={1.6} />
      <SketchPath pts={[[2.2, -0.9], [0, 0], [2.2, 0.9]]} smooth={false} seed="pencil-lead" fill={COLORS.ink} width={1.2} />
      <SketchPath pts={[[6, facet], [length - 5, facet]]} smooth={false} step={12} seed="pencil-facet" width={1.1} />
      <SketchPath pts={[[length - 5, -h], [length - 5, h]]} smooth={false} seed="pencil-band" width={1.6} />
    </g>
  );
};
