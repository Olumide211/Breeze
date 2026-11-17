import React from 'react';
import {useCurrentFrame} from 'remotion';
import {
  BOX,
  COLORS,
  F,
  H,
  TEXT_CLIP_W,
  W,
  easeInOutCubic,
  lerp,
  seg,
  smoothstep,
} from '../timeline';
import {KEY_FRAMES, TYPED} from './typing';

// ---- text measurement (Inter is loaded before the first frame renders) -----
let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
export const measureUi = (s: string) => {
  const hit = widthCache.get(s);
  if (hit !== undefined) return hit;
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')!;
  }
  measureCtx.font = '400 40px Inter';
  const w = measureCtx.measureText(s).width;
  widthCache.set(s, w);
  return w;
};

export const charProgress = (f: number, i: number) => seg(f, KEY_FRAMES[i], KEY_FRAMES[i] + 3);

// Horizontal scroll of the single-line field once text reaches the mic.
export const textScroll = (f: number) => {
  let w = 0;
  for (let i = 0; i < TYPED.length; i++) {
    const p = charProgress(f, i);
    if (p <= 0) break;
    w = measureUi(TYPED.slice(0, i)) + (measureUi(TYPED.slice(0, i + 1)) - measureUi(TYPED.slice(0, i))) * p;
  }
  return Math.max(0, w - (TEXT_CLIP_W - 10));
};

const UI_FONT: React.CSSProperties = {
  fontFamily: 'Inter',
  fontWeight: 400,
  fontSize: 40,
  lineHeight: '48px',
  whiteSpace: 'pre',
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

const Wave: React.FC<{opacity: number}> = ({opacity}) => {
  const bars = [16, 34, 24, 13];
  return (
    <svg width={48} height={40} viewBox="0 0 48 40" style={{position: 'absolute', opacity}}>
      {bars.map((h, i) => (
        <rect key={i} x={5 + i * 11} y={20 - h / 2} width={5.5} height={h} rx={2.75} fill="#fff" />
      ))}
    </svg>
  );
};

const Arrow: React.FC<{opacity: number}> = ({opacity}) => (
  <svg width={44} height={44} viewBox="0 0 44 44" style={{position: 'absolute', opacity}}>
    <path
      d="M22 37 V8 M10 19 L22 7 L34 19"
      stroke="#fff"
      strokeWidth={4.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const MessageBox: React.FC = () => {
  const f = useCurrentFrame();
  if (f < F.toLine || f >= 343) return null;

  // ---- line grows out of the blossom's centre and settles to the box line ----
  const grow = easeInOutCubic(seg(f, F.toLine, F.boxOpen));
  const lineW = lerp(0, 920, grow);
  const lineY = lerp(H / 2, BOX.cy, easeInOutCubic(seg(f, F.toLine + 4, F.boxOpen)));

  // ---- line opens vertically into the pill ----
  const open = easeInOutCubic(seg(f, F.boxOpen, 150));
  const boxH = lerp(4, BOX.h, open);
  const boxW = lerp(920, BOX.w, open);
  const borderMix = smoothstep(0, 1, seg(f, F.boxOpen, 142));
  const bc = Math.round(lerp(255, 0x4f, borderMix));
  const boxOpacity = 1 - easeInOutCubic(seg(f, 326, 342));

  const item = (start: number) => smoothstep(0, 1, seg(f, start, start + 7));

  // ---- typing state ----
  const typing = f >= F.typing;
  const placeholderOpacity = item(F.contents + 3) * (1 - seg(f, F.typing, F.typing + 2));
  const sent = f >= F.lift;
  const scroll = textScroll(Math.min(f, F.lift - 1));
  const fadeL = Math.min(1, scroll / 36);

  // cursor: blinks twice (8 on / 4 off) then rides the end of the typed text
  let cursorOn = false;
  if (f >= F.cursor && f < F.typing) {
    const c = f - F.cursor;
    cursorOn = c < 8 || (c >= 12 && c < 20);
  } else if (typing && f < F.send) {
    cursorOn = true;
  }

  const wave2arrow = seg(f, F.typing, F.typing + 8) * (1 - seg(f, F.lift, F.lift + 8));
  const press = f >= F.send && f < F.lift ? 1 - 0.06 * Math.sin((Math.PI * (f - F.send)) / 6) : 1;

  const left = W / 2 - boxW / 2;
  const top = BOX.cy - boxH / 2;

  return (
    <>
      {f < F.boxOpen + 2 ? (
        <div
          style={{
            position: 'absolute',
            left: W / 2 - lineW / 2,
            top: lineY - 1,
            width: lineW,
            height: 2,
            borderRadius: 1,
            background: '#fff',
          }}
        />
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
            borderRadius: boxH / 2,
            border: `2px solid rgb(${bc},${bc},${bc})`,
            background: `rgba(48,48,48,${open})`,
            opacity: boxOpacity,
          }}
        >
          {f >= F.contents ? (
            <div style={{position: 'absolute', left: -2, top: -2, width: BOX.w, height: BOX.h}}>
              <div style={{position: 'absolute', left: BOX.plusX, top: BOX.h / 2 - 27, opacity: item(F.contents)}}>
                <Plus />
              </div>
              <div
                style={{
                  ...UI_FONT,
                  position: 'absolute',
                  left: BOX.textX,
                  top: BOX.h / 2 - 24,
                  color: COLORS.uiPlaceholder,
                  opacity: placeholderOpacity,
                }}
              >
                Ask ChatGPT
              </div>
              {/* typed line: single row, scrolls instead of wrapping */}
              {typing && !sent ? (
                <div
                  style={{
                    position: 'absolute',
                    left: BOX.textX,
                    top: BOX.h / 2 - 24,
                    width: TEXT_CLIP_W,
                    height: 48,
                    overflow: 'hidden',
                    WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,${1 - fadeL}) 0px, rgba(0,0,0,${1 - fadeL}) 14px, #000 64px)`,
                  }}
                >
                  <div style={{...UI_FONT, color: '#fff', transform: `translateX(${-scroll}px)`}}>
                    {TYPED.split('').map((ch, i) => {
                      const p = charProgress(f, i);
                      if (p <= 0) return null;
                      return (
                        <span key={i} style={{opacity: p, position: 'relative', top: 1 - p}}>
                          {ch}
                        </span>
                      );
                    })}
                    {cursorOn ? (
                      <span style={{display: 'inline-block', width: 0, position: 'relative'}}>
                        <span
                          style={{
                            position: 'absolute',
                            left: 2,
                            top: 3,
                            width: 3,
                            height: 44,
                            borderRadius: 1.5,
                            background: '#fff',
                          }}
                        />
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {cursorOn && !typing ? (
                <div
                  style={{
                    position: 'absolute',
                    left: BOX.textX - 2,
                    top: BOX.h / 2 - 22,
                    width: 3,
                    height: 44,
                    borderRadius: 1.5,
                    background: '#fff',
                  }}
                />
              ) : null}
              <div style={{position: 'absolute', left: BOX.micCx - 26, top: BOX.h / 2 - 36, opacity: item(F.contents + 6)}}>
                <Mic />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: BOX.btnCx - BOX.btn / 2,
                  top: BOX.h / 2 - BOX.btn / 2,
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

export {UI_FONT};
