import React from 'react';
import {useCurrentFrame} from 'remotion';
import {useLayout} from '../layout';
import {BOX, COLORS, F, TEXT_MAX_W, easeInOutCubic, lerp, seg, smoothstep} from '../timeline';
import {wrapRanges} from './text';
import {KEY_FRAMES, TYPED} from './typing';

export const charProgress = (f: number, i: number) => seg(f, KEY_FRAMES[i], KEY_FRAMES[i] + 3);

export const UI_FONT: React.CSSProperties = {
  fontFamily: 'Inter',
  fontWeight: 400,
  fontSize: 40,
  lineHeight: '48px',
  whiteSpace: 'pre',
};

// Lines of the typed text inside the box (never clips or scrolls: wraps instead).
export const boxLines = () => wrapRanges(TYPED, TEXT_MAX_W);

// Extra box height: each wrap grows the box upward by one row (bottom edge fixed).
const extraHeight = (f: number) => {
  const lines = boxLines();
  let h = 0;
  for (let k = 1; k < lines.length; k++) {
    h += BOX.rowH * easeInOutCubic(seg(f, KEY_FRAMES[lines[k][0]], KEY_FRAMES[lines[k][0]] + 6));
  }
  return h;
};

const Plus: React.FC = () => (
  <svg width={54} height={54} viewBox="0 0 54 54">
    <path d="M27 3 V51 M3 27 H51" stroke="#fff" strokeWidth={4.2} strokeLinecap="round" />
  </svg>
);

const Mic: React.FC = () => (
  <svg width={52} height={70} viewBox="0 0 52 70" fill="none">
    <rect x={14} y={3} width={24} height={40} rx={12} stroke="#fff" strokeWidth={4.2} />
    <path d="M5 33 C5 46 14 55 26 55 C38 55 47 46 47 33" stroke="#fff" strokeWidth={4.2} strokeLinecap="round" />
    <path d="M26 55 V67" stroke="#fff" strokeWidth={4.2} strokeLinecap="round" />
  </svg>
);

const Wave: React.FC<{opacity: number}> = ({opacity}) => (
  <svg width={48} height={40} viewBox="0 0 48 40" style={{position: 'absolute', opacity}}>
    {[16, 34, 24, 13].map((h, i) => (
      <rect key={i} x={5 + i * 11} y={20 - h / 2} width={5.5} height={h} rx={2.75} fill="#fff" />
    ))}
  </svg>
);

const Arrow: React.FC<{opacity: number}> = ({opacity}) => (
  <svg width={44} height={44} viewBox="0 0 44 44" style={{position: 'absolute', opacity}}>
    <path d="M22 37 V8 M10 19 L22 7 L34 19" stroke="#fff" strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const Cursor: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <span style={{position: 'absolute', width: 3, height: 44, borderRadius: 1.5, background: '#fff', ...style}} />
);

export const MessageBox: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < F.toLine || f >= 343) return null;

  // ---- line grows out of the blossom's centre; the box opens right there ----
  const grow = easeInOutCubic(seg(f, F.toLine, F.boxOpen));
  const lineW = lerp(0, L.line.w, grow);
  const lineY = lerp(L.line.startY, L.box.cy, easeInOutCubic(seg(f, F.toLine + 4, F.boxOpen)));

  const open = easeInOutCubic(seg(f, F.boxOpen, 150));
  const extra = extraHeight(Math.min(f, F.lift - 1));
  const boxH = lerp(4, BOX.h, open) + extra;
  const boxW = lerp(L.line.w, BOX.w, open);
  const bottom = L.box.cy + lerp(2, BOX.h / 2, open);
  const top = bottom - boxH;
  const left = L.W / 2 - boxW / 2;
  const borderMix = smoothstep(0, 1, seg(f, F.boxOpen, 142));
  const bc = Math.round(lerp(255, 0x4f, borderMix));
  const boxOpacity = 1 - easeInOutCubic(seg(f, 326, 342));

  const item = (start: number) => smoothstep(0, 1, seg(f, start, start + 7));

  const typing = f >= F.typing;
  const sent = f >= F.lift;
  const placeholderOpacity = item(F.contents + 3) * (1 - seg(f, F.typing, F.typing + 2));

  // cursor: blinks twice (8 on / 4 off), then rides the end of the typed text
  let cursorOn = false;
  if (f >= F.cursor && f < F.typing) {
    const c = f - F.cursor;
    cursorOn = c < 8 || (c >= 12 && c < 20);
  } else if (typing && f < F.send) {
    cursorOn = true;
  }
  let lastTyped = -1;
  for (let i = 0; i < TYPED.length; i++) if (charProgress(f, i) > 0) lastTyped = i;

  const wave2arrow = seg(f, F.typing, F.typing + 8) * (1 - seg(f, F.lift, F.lift + 8));
  const press = f >= F.send && f < F.lift ? 1 - 0.06 * Math.sin((Math.PI * (f - F.send)) / 6) : 1;

  // controls sit on the bottom row (like the app when the field grows)
  const rowCy = boxH - BOX.h / 2;
  const lines = boxLines();

  return (
    <>
      {f < F.boxOpen + 2 ? (
        <div style={{position: 'absolute', left: L.W / 2 - lineW / 2, top: lineY - 1, width: lineW, height: 2, borderRadius: 1, background: '#fff'}} />
      ) : null}
      {f >= F.boxOpen ? (
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width: boxW,
            height: boxH,
            boxSizing: 'border-box',
            borderRadius: Math.min(BOX.h / 2, boxH / 2),
            border: `2px solid rgb(${bc},${bc},${bc})`,
            background: `rgba(48,48,48,${open})`,
            opacity: boxOpacity,
          }}
        >
          {f >= F.contents ? (
            <div style={{position: 'absolute', left: -2, top: -2, width: BOX.w, height: boxH}}>
              <div style={{position: 'absolute', left: BOX.plusX, top: rowCy - 27, opacity: item(F.contents)}}>
                <Plus />
              </div>
              <div style={{...UI_FONT, position: 'absolute', left: BOX.textX, top: rowCy - 24, color: COLORS.uiPlaceholder, opacity: placeholderOpacity}}>
                Ask ChatGPT
              </div>
              {typing && !sent
                ? lines.map(([a, b], li) => (
                    <div key={li} style={{...UI_FONT, position: 'absolute', left: BOX.textX, top: (BOX.h - 48) / 2 + li * BOX.rowH, color: '#fff'}}>
                      {TYPED.slice(a, b)
                        .split('')
                        .map((ch, k) => {
                          const i = a + k;
                          const p = charProgress(f, i);
                          return (
                            <span key={k} style={{opacity: p, position: 'relative', top: 1 - p}}>
                              {ch}
                              {cursorOn && i === lastTyped ? (
                                <span style={{position: 'relative', display: 'inline-block', width: 0}}>
                                  <Cursor style={{left: 2, top: -36}} />
                                </span>
                              ) : null}
                            </span>
                          );
                        })}
                    </div>
                  ))
                : null}
              {cursorOn && lastTyped < 0 ? <Cursor style={{left: BOX.textX - 2, top: rowCy - 22}} /> : null}
              <div style={{position: 'absolute', left: BOX.micCx - 26, top: rowCy - 36, opacity: item(F.contents + 6)}}>
                <Mic />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: BOX.btnCx - BOX.btn / 2,
                  top: rowCy - BOX.btn / 2,
                  width: BOX.btn,
                  height: BOX.btn,
                  borderRadius: BOX.btn / 2,
                  background: COLORS.chatBlue,
                  opacity: item(F.contents + 9),
                  transform: `scale(${press})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wave opacity={1 - wave2arrow} />
                <Arrow opacity={wave2arrow} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

// Where the typed block sits when the user hits send (absolute px).
export const boxTextOrigin = (L: {W: number; box: {cy: number}}) => {
  const lines = boxLines();
  const h = BOX.h + (lines.length - 1) * BOX.rowH;
  const top = L.box.cy + BOX.h / 2 - h;
  return {x: L.W / 2 - BOX.w / 2 + BOX.textX, top: top + (BOX.h - 48) / 2};
};
