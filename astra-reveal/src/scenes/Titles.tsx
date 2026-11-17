import React from 'react';
import {Img, useCurrentFrame} from 'remotion';
import {TAGLINE, TITLE_LEFT, TITLE_RIGHT} from '../title';
import {displayMetrics, interMetrics, useLayout} from '../layout';
import {F, easeInOutCubic, easeOutQuart, seg, smoothstep} from '../timeline';
import {BLOSSOM_SRC} from './Blossom';

const titleFont = (size: number): React.CSSProperties => ({
  fontFamily: 'Inter Display',
  fontWeight: 600,
  fontSize: size,
  lineHeight: `${size}px`,
  letterSpacing: '-0.02em',
  color: '#ffffff',
  whiteSpace: 'pre',
  position: 'absolute',
});

// soft bottom-to-top mask wipe + 8px upward settle (no glow on the type)
const reveal = (f: number, start: number): React.CSSProperties => {
  const p = easeInOutCubic(seg(f, start, start + 24));
  const settle = easeOutQuart(seg(f, start, start + 30));
  const edge = p * 140 - 20;
  const mask = `linear-gradient(to top, #000 ${edge}%, transparent ${edge + 20}%)`;
  return {WebkitMaskImage: mask, maskImage: mask, transform: `translateY(${8 * (1 - settle)}px)`, opacity: p > 0 ? 1 : 0};
};

export const Titles: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < F.title) return null;

  const tl = L.titleLeft;
  const tr = L.titleRight;
  const ml = displayMetrics(tl.size);
  const mr = displayMetrics(tr.size);
  const leftTop = tl.capTop! - (ml.baselineInLineBox - ml.cap);
  const leftBaseline = tl.capTop! + ml.cap;
  const rightTop = tr.baseline! - mr.baselineInLineBox;
  // optical side-bearing correction at this size (G's left bearing; trailing tracking)
  const bearingL = tl.size * 0.04;
  const trailR = tr.size * 0.02;

  const blossomA = smoothstep(0, 1, seg(f, F.endCard, F.endCard + 24));
  const blossomY = 4 * (1 - easeOutQuart(seg(f, F.endCard, F.endCard + 30)));
  const tagA = smoothstep(0, 1, seg(f, F.tagline, F.tagline + 24));
  const tagLH = Math.round(L.tagline.size * 1.2);
  const tm = interMetrics(L.tagline.size, tagLH);
  const tagBase = L.tagline.anchor === 'underLeft' ? leftBaseline : tr.baseline!;
  const tagTop = tagBase + L.tagline.gap - tm.capTopInLineBox;

  return (
    <>
      <div style={{...titleFont(tl.size), left: tl.x - bearingL, top: leftTop, ...reveal(f, F.title)}}>{TITLE_LEFT}</div>
      <div style={{...titleFont(tr.size), right: L.W - tr.x - trailR, top: rightTop, textAlign: 'right', ...reveal(f, F.title + 8)}}>
        {TITLE_RIGHT}
      </div>
      {blossomA > 0 ? (
        <Img
          src={BLOSSOM_SRC}
          style={{
            position: 'absolute',
            left: L.endBlossom.x,
            top: L.endBlossom.y + blossomY,
            width: L.endBlossom.size,
            height: L.endBlossom.size,
            opacity: blossomA,
          }}
        />
      ) : null}
      {tagA > 0 ? (
        <div
          style={{
            position: 'absolute',
            ...(L.tagline.anchor === 'underLeft' ? {left: tl.x} : {right: L.W - tr.x}),
            top: tagTop,
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: L.tagline.size,
            lineHeight: `${tagLH}px`,
            color: `rgba(255,255,255,${0.7 * tagA})`,
            whiteSpace: 'pre',
          }}
        >
          {TAGLINE}
        </div>
      ) : null}
    </>
  );
};
