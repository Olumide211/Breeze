import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {BLOSSOM_DATA_URI} from '../blossomSvg';
import {F, H, W, easeInOutCubic, easeOutQuart, lerp, seg, smoothstep} from '../timeline';

export const BLOSSOM_SRC = staticFile('astra-assets/logos/openai-blossom-white.svg');

const SIZE = 220;

// The official mark, untouched: it only scales uniformly, fades, and is masked by light.
export const Blossom: React.FC = () => {
  const f = useCurrentFrame();
  if (f < F.blossomIn || f > F.boxOpen) return null;

  const inT = easeOutQuart(seg(f, F.blossomIn, 60));
  let scale = lerp(0.94, 1, inT);
  scale *= lerp(1, 1.01, seg(f, 78, F.toLine));
  const outT = easeInOutCubic(seg(f, F.toLine, F.boxOpen));
  scale *= lerp(1, 0.6, outT);
  const opacity = inT * (1 - outT);

  // light pass: a diagonal band (top-left -> bottom-right) clipped to the mark
  const g = seg(f, F.glint, 78);
  const pass = easeInOutCubic(g);
  const bandPos = lerp(-25, 125, pass); // % along the 135deg gradient
  const passAlpha = Math.sin(Math.PI * g);
  const band = `linear-gradient(135deg, rgba(255,255,255,0) ${bandPos - 16}%, rgba(255,255,255,1) ${bandPos}%, rgba(255,255,255,0) ${bandPos + 16}%)`;

  // the four-point glint rides the same diagonal
  const gx = lerp(-0.12, 1.12, pass) * SIZE;
  const gy = lerp(-0.12, 1.12, pass) * SIZE;
  const glintA = smoothstep(0, 0.25, g) * (1 - smoothstep(0.75, 1, g));

  const mask: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    WebkitMaskImage: `url("${BLOSSOM_DATA_URI}")`,
    maskImage: `url("${BLOSSOM_DATA_URI}")`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    background: band,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: W / 2 - SIZE / 2,
        top: H / 2 - SIZE / 2,
        width: SIZE,
        height: SIZE,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {/* base mark sits at 84% so the masked light pass reads as light, then settles to full white */}
      <Img
        src={BLOSSOM_SRC}
        style={{position: 'absolute', inset: 0, width: SIZE, height: SIZE, opacity: lerp(0.84, 1, smoothstep(0, 1, seg(f, 64, 90)))}}
      />
      {g > 0 && g < 1 ? (
        <>
          <div style={{...mask, opacity: passAlpha}} />
          {/* soft bloom of the light pass (blur applied after the mask) */}
          <div style={{position: 'absolute', inset: 0, filter: 'blur(9px)', opacity: 0.55 * passAlpha}}>
            <div style={mask} />
          </div>
          <svg
            width={120}
            height={120}
            viewBox="-60 -60 120 120"
            style={{position: 'absolute', left: gx - 60, top: gy - 60, opacity: glintA, overflow: 'visible'}}
          >
            <defs>
              <radialGradient id="glintCore">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="glintH" x1="-1" x2="1" y1="0" y2="0" gradientUnits="objectBoundingBox">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle r={14} fill="url(#glintCore)" />
            <path d="M -56 0 L 0 -1.1 L 56 0 L 0 1.1 Z" fill="#fff" opacity={0.85} />
            <path d="M 0 -60 L 1.1 0 L 0 60 L -1.1 0 Z" fill="#fff" opacity={0.85} />
            <circle r={2.2} fill="#fff" />
          </svg>
        </>
      ) : null}
    </div>
  );
};
