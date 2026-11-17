import React from 'react';
import {Img, useCurrentFrame} from 'remotion';
import {TITLE_LEFT, TITLE_RIGHT} from '../title';
import {F, TITLE, W, easeInOutCubic, easeOutQuart, seg, smoothstep} from '../timeline';
import {BLOSSOM_SRC} from './Blossom';

const TITLE_FONT: React.CSSProperties = {
  fontFamily: 'Inter Display',
  fontWeight: 600,
  fontSize: TITLE.size,
  lineHeight: `${TITLE.size}px`,
  letterSpacing: '-0.02em',
  color: '#ffffff',
  whiteSpace: 'pre',
  position: 'absolute',
};

// soft bottom-to-top mask wipe + 8px upward settle
const reveal = (f: number, start: number): React.CSSProperties => {
  const p = easeInOutCubic(seg(f, start, start + 24));
  const settle = easeOutQuart(seg(f, start, start + 30));
  const edge = p * 140 - 20; // % from the bottom
  const mask = `linear-gradient(to top, #000 ${edge}%, transparent ${edge + 20}%)`;
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
    transform: `translateY(${8 * (1 - settle)}px)`,
    opacity: p > 0 ? 1 : 0,
  };
};

export const Titles: React.FC = () => {
  const f = useCurrentFrame();
  if (f < F.title) return null;

  const leftTop = TITLE.capTop - (TITLE.baselineInLineBox - TITLE.capHeight);
  const rightTop = TITLE.baseline - TITLE.baselineInLineBox;

  // end card
  const blossomA = smoothstep(0, 1, seg(f, F.endCard, F.endCard + 24));
  const blossomY = 4 * (1 - easeOutQuart(seg(f, F.endCard, F.endCard + 30)));
  const tagA = smoothstep(0, 1, seg(f, F.tagline, F.tagline + 24));
  const BL = 56;

  return (
    <>
      <div style={{...TITLE_FONT, left: TITLE.leftX - 6, top: leftTop, ...reveal(f, F.title)}}>
        {TITLE_LEFT}
      </div>
      <div
        style={{
          ...TITLE_FONT,
          right: W - TITLE.rightX - 3, // the trailing -2% tracking would otherwise pull the ink in
          top: rightTop,
          textAlign: 'right',
          ...reveal(f, F.title + 8),
        }}
      >
        {TITLE_RIGHT}
      </div>
      {blossomA > 0 ? (
        <Img
          src={BLOSSOM_SRC}
          style={{
            position: 'absolute',
            left: TITLE.leftX,
            top: TITLE.capTop - 40 - BL + blossomY,
            width: BL,
            height: BL,
            opacity: blossomA,
          }}
        />
      ) : null}
      {tagA > 0 ? (
        <div
          style={{
            position: 'absolute',
            right: W - TITLE.rightX,
            top: TITLE.baseline + 30,
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: 30,
            lineHeight: '36px',
            color: `rgba(255,255,255,${0.7 * tagA})`,
            whiteSpace: 'pre',
          }}
        >
          the one they didn’t ship.
        </div>
      ) : null}
    </>
  );
};
