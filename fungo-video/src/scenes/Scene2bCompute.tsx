import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, COMPUTE, FONTS, HEADLINES} from '../config';
import {EASE_IN_OUT, mix, prog} from '../anim';
import {NftStage, STAGE} from '../components/NftStage';
import {gridSize, TILE_RADIUS, TileGrid} from '../components/TileGrid';
import {Headline} from '../components/Headline';
import {Lock, Redacted} from '../components/Bits';
import {Haze} from '../components/Particles';
import {Sfx} from '../components/Sfx';

const SMALL = 92;
const ROW_Y = 410;
const LEFT = {cx: 500, cy: ROW_Y, tile: SMALL};
const RIGHT_CX = 1420;
const NODE = 150;
const HALF = gridSize(SMALL) / 2;

const PACKET_START = 50;
const PACKET_GAP = 8;
const PACKET_DUR = 16;
const OUT_START = 98;
const EXIT = 122;

const Chip: React.FC<{label: string; x: number; y: number; p: number; accent?: boolean}> = ({label, x, y, p, accent}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) translateY(${(1 - p) * 14}px)`,
      opacity: p,
      filter: p < 0.98 ? `blur(${(1 - p) * 6}px)` : undefined,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 20px',
      borderRadius: 14,
      background: accent ? 'rgba(255,210,7,0.08)' : 'rgba(255,255,255,0.03)',
      boxShadow: `inset 0 0 0 1.5px ${accent ? 'rgba(255,210,7,0.7)' : COLORS.line}`,
    }}
  >
    <Lock size={18} />
    <div style={{fontFamily: FONTS.mono, fontSize: 17, letterSpacing: '0.22em', color: accent ? COLORS.yellow : COLORS.muted}}>
      {label}
    </div>
    <Redacted count={3} height={22} dither id={`chip-${label}-${x}`} />
  </div>
);

/** Scene 2b: Zama FHE computes on encrypted traits. The answer stays encrypted too. */
export const Scene2bCompute: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const h = HEADLINES.compute;

  const exit = prog(frame, EXIT, 26, EASE_IN_OUT);
  const fadeOthers = 1 - prog(frame, EXIT, 16);
  const go = prog(frame, 6, 26, EASE_IN_OUT) * (1 - exit);
  const grid = {
    cx: mix(STAGE.cx, LEFT.cx, go),
    cy: mix(STAGE.cy, LEFT.cy, go),
    tile: mix(STAGE.tile, LEFT.tile, go),
  };
  const sealed = () => ({seal: 1, edge: 0.8});

  const rIn = prog(frame, 14, 22);
  const nodeS = spring({frame: frame - 30, fps, config: {damping: 13, stiffness: 140}, durationInFrames: 22});
  const lineP = prog(frame, 36, 14);
  const chipP = prog(frame, 32, 14);
  const ring = prog(frame, 72, 26, EASE_IN_OUT);
  const pulse = 1 + 0.035 * Math.sin(Math.max(0, frame - 72) * 0.5) * (frame > 72 && frame < 100 ? 1 : 0);
  const outLine = prog(frame, OUT_START, 10);
  const resultP = prog(frame, OUT_START + 10, 14);

  const nodeX = 960;
  const lEdge = LEFT.cx + HALF + 18;
  const rEdge = RIGHT_CX - HALF - 18;
  const nL = nodeX - NODE / 2 - 18;
  const nR = nodeX + NODE / 2 + 18;

  const packets: React.ReactNode[] = [];
  for (let k = 0; k < 3; k++) {
    const p = prog(frame, PACKET_START + k * PACKET_GAP, PACKET_DUR, EASE_IN_OUT);
    if (p <= 0 || p >= 1) continue;
    const o = Math.min(1, p * 5, (1 - p) * 5);
    [
      [mix(lEdge, nL, p), ROW_Y],
      [mix(rEdge, nR, p), ROW_Y],
    ].forEach(([x, y], s) =>
      packets.push(
        <div
          key={`${k}-${s}`}
          style={{
            position: 'absolute',
            left: x - 8,
            top: y - 8,
            width: 16,
            height: 16,
            borderRadius: 16 * TILE_RADIUS,
            background: COLORS.yellow,
            opacity: o,
            boxShadow: `0 0 16px 3px rgba(255,231,131,0.6)`,
          }}
        />
      )
    );
  }
  const outPacket = prog(frame, OUT_START, 12, EASE_IN_OUT);
  const outY = mix(ROW_Y + NODE / 2 + 14, 640 - 34, outPacket);

  return (
    <AbsoluteFill>
      {/* left NFT (carried over from scene 2), labels fade away */}
      <NftStage
        grid={grid}
        tiles={sealed}
        haze={0.07}
        labels={() => ({appear: 1, count: 1, cipher: 1, lock: 1, redact: 0})}
        labelsOpacity={1 - prog(frame, 0, 12)}
      />

      <div style={{position: 'absolute', inset: 0, opacity: fadeOthers}}>
        {/* second sealed NFT */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: rIn,
            transform: `translateX(${(1 - rIn) * 120}px)`,
            filter: rIn < 0.98 ? `blur(${(1 - rIn) * 8}px)` : undefined,
          }}
        >
          <TileGrid cx={RIGHT_CX} cy={ROW_Y} tile={SMALL} tiles={sealed} />
        </div>

        {/* lines */}
        {[
          {x: lEdge, w: nL - lEdge, origin: 'left'},
          {x: nR, w: rEdge - nR, origin: 'right'},
        ].map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: l.x,
              top: ROW_Y - 1,
              width: l.w,
              height: 2,
              background: 'rgba(255,210,7,0.35)',
              transform: `scaleX(${lineP})`,
              transformOrigin: l.origin,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: nodeX - 1,
            top: ROW_Y + NODE / 2 + 14,
            width: 2,
            height: 640 - 34 - (ROW_Y + NODE / 2 + 14),
            background: 'rgba(255,210,7,0.35)',
            transform: `scaleY(${outLine})`,
            transformOrigin: 'top',
          }}
        />
        {packets}
        {outPacket > 0 && outPacket < 1 && (
          <div
            style={{
              position: 'absolute',
              left: nodeX - 8,
              top: outY - 8,
              width: 16,
              height: 16,
              borderRadius: 16 * TILE_RADIUS,
              background: COLORS.yellow,
              boxShadow: `0 0 16px 3px rgba(255,231,131,0.6)`,
            }}
          />
        )}

        {/* FHE node */}
        <Haze x={nodeX} y={ROW_Y} size={420} opacity={0.18 * nodeS + 0.12 * Math.sin(Math.PI * ring)} />
        <div
          style={{
            position: 'absolute',
            left: nodeX - NODE / 2,
            top: ROW_Y - NODE / 2,
            width: NODE,
            height: NODE,
            borderRadius: NODE * TILE_RADIUS,
            background: COLORS.yellow,
            transform: `scale(${nodeS * pulse})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONTS.headline,
            fontWeight: 700,
            fontSize: 46,
            letterSpacing: '0.02em',
            color: COLORS.black,
          }}
        >
          {COMPUTE.node}
        </div>
        {/* processing ring */}
        {ring > 0 && (
          <svg
            width={NODE + 28}
            height={NODE + 28}
            style={{position: 'absolute', left: nodeX - NODE / 2 - 14, top: ROW_Y - NODE / 2 - 14, opacity: 1 - prog(frame, 98, 10)}}
          >
            <rect
              x={2}
              y={2}
              width={NODE + 24}
              height={NODE + 24}
              rx={(NODE + 24) * TILE_RADIUS}
              fill="none"
              stroke={COLORS.yellow}
              strokeWidth={2.5}
              pathLength={1}
              strokeDasharray={`${ring} 1`}
            />
          </svg>
        )}
        {/* operation */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: ROW_Y - NODE / 2 - 52,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 20,
            color: COLORS.yellow,
            opacity: prog(frame, 40, 14) * 0.85,
          }}
        >
          {COMPUTE.op}
        </div>

        <Chip label={`${COMPUTE.inputLabel} A`} x={LEFT.cx} y={ROW_Y + HALF + 52} p={chipP} />
        <Chip label={`${COMPUTE.inputLabel} B`} x={RIGHT_CX} y={ROW_Y + HALF + 52} p={chipP * rIn} />
        <Chip label={COMPUTE.outputLabel} x={nodeX} y={640} p={resultP} accent />
      </div>

      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />

      {/* sound */}
      <Sfx at={4} name="whoosh" volume={0.8} />
      <Sfx at={14} name="whoosh" volume={0.6} />
      <Sfx at={30} name="pop" />
      <Sfx at={38} name="tick" />
      <Sfx at={44} name="tick" volume={0.7} />
      {[0, 1, 2].map((k) => (
        <Sfx key={k} at={PACKET_START + k * PACKET_GAP + PACKET_DUR - 2} name="pulse" volume={1 - k * 0.1} />
      ))}
      <Sfx at={70} name="hum" />
      <Sfx at={OUT_START + 8} name="pulse" volume={1.1} />
      <Sfx at={OUT_START + 12} name="lock" />
      <Sfx at={EXIT} name="whoosh" volume={0.7} />
    </AbsoluteFill>
  );
};

