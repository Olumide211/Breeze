import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, VIDEO } from "./scenes";
import { FilmInk, Ink } from "./lib/ink";
import { srnd } from "./lib/rand";
import type { Pt } from "./lib/util";
import { SketchPath } from "./components/SketchPath";

type Stroke = { pts: Pt[]; smooth?: boolean };
const E: Stroke[] = [{ pts: [[46, 6], [9, 5], [8, 46], [9, 88], [48, 87]] }, { pts: [[9, 46], [39, 45]] }];
const LETTERS: Stroke[][] = [
  [{ pts: [[9, 3], [8, 89]] }, { pts: [[6, 6], [32, 5], [45, 14], [45, 32], [32, 43], [9, 45]], smooth: true }, { pts: [[9, 45], [36, 46], [50, 58], [49, 76], [34, 88], [6, 88]], smooth: true }],
  [{ pts: [[9, 89], [8, 3]] }, { pts: [[6, 6], [34, 5], [47, 15], [46, 34], [30, 45], [9, 46]], smooth: true }, { pts: [[26, 46], [50, 89]] }],
  E,
  E,
  [{ pts: [[7, 6], [49, 5], [9, 88], [52, 87]] }],
  E,
];

/** BREEZE, hand-lettered in scratchy white strokes: each stroke laid down three times, gently boiling. */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = 1.55;
  const pitch = 66;
  const total = pitch * (LETTERS.length - 1) + 54;
  const ox = (VIDEO.width - total * scale) / 2;
  const oy = (VIDEO.height - 92 * scale) / 2;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <svg width={VIDEO.width} height={VIDEO.height} viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}>
        <FilmInk frame={frame}>
          <Ink color={COLORS.white} zoom={scale}>
            <g transform={`translate(${ox} ${oy}) scale(${scale})`}>
              {LETTERS.map((letter, li) => (
                <g key={li} transform={`translate(${li * pitch} ${srnd(li, 5) * 7}) rotate(${srnd(li, 6) * 7} 28 46) scale(${1 + srnd(li, 7) * 0.12} ${1 + srnd(li, 8) * 0.16})`}>
                  {letter.map((st, si) =>
                    [0, 1, 2, 3].map((pass) => (
                      <g key={`${si}-${pass}`} transform={`translate(${srnd(li * 31 + si, pass, 1) * 3} ${srnd(li * 31 + si, pass, 2) * 3})`}>
                        <SketchPath
                          pts={st.pts}
                          fresh={pass > 0}
                          smooth={!!st.smooth}
                          step={11}
                          seed={`bz-${li}-${si}-${pass}`}
                          width={pass === 0 ? 3.2 : 1.3}
                          jitter={pass === 0 ? 1.6 : 2.6}
                          opacity={pass === 0 ? 1 : 0.75}
                        />
                      </g>
                    )),
                  )}
                </g>
              ))}
            </g>
          </Ink>
        </FilmInk>
      </svg>
    </AbsoluteFill>
  );
};
