import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, Sequence, useCurrentFrame} from 'remotion';
import {AUCTION, COLORS, FONTS, HEADLINES, NFT, sceneFrames} from '../config';
import {EASE_IN_OUT, mix, prog} from '../anim';
import {NftStage, STAGE} from '../components/NftStage';
import {Headline} from '../components/Headline';
import {Lock, Redacted, Toggle} from '../components/Bits';
import {RollingNumber} from '../components/RollingNumber';

// ───────────────────────── 3a: PRIVATE TRAITS ─────────────────────────
const PrivateTraits: React.FC = () => {
  const frame = useCurrentFrame();
  const h = HEADLINES.privateTraits;
  const out = 1 - prog(frame, 76, 14, EASE_IN_OUT); // hand-off to the auction

  const tiles = (i: number) => {
    const p = prog(frame, 26 + i * 3, 14, EASE_IN_OUT);
    return {seal: 1 - p, edge: 0.8 * (1 - p), flash: Math.sin(Math.PI * p) * 0.5};
  };
  const labels = () => ({appear: 1, count: 1, cipher: 1, lock: 1, redact: prog(frame, 2, 14)});
  const eyes = {open: prog(frame, 54, 10, Easing.out(Easing.back(1.6))), opacity: prog(frame, 50, 6)};

  const tIn = prog(frame, 2, 14);
  const on = prog(frame, 18, 9, EASE_IN_OUT);

  return (
    <AbsoluteFill>
      <NftStage tiles={tiles} eyes={eyes} labels={labels} labelsOpacity={out} haze={mix(0.07, 0.15, prog(frame, 26, 30))} />
      <div
        style={{
          position: 'absolute',
          top: 742,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: tIn * out,
          transform: `translateY(${(1 - tIn) * 16}px)`,
          filter: tIn < 0.98 ? `blur(${(1 - tIn) * 6}px)` : undefined,
        }}
      >
        <Toggle on={on} label={NFT.toggleLabel} />
      </div>
      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 3b: ENCRYPTED BIDS ─────────────────────────
const CARD = {x: 300, y: 160, w: 1320, h: 580};
const AUCTION_GRID = {cx: CARD.x + 250, cy: CARD.y + CARD.h / 2, tile: 104};

const Field: React.FC<{label: string; flex: number; children: React.ReactNode}> = ({label, flex, children}) => (
  <div
    style={{
      flex,
      height: 112,
      borderRadius: 18,
      boxShadow: `inset 0 0 0 1.5px ${COLORS.line}`,
      background: 'rgba(255,255,255,0.02)',
      padding: '18px 24px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}
  >
    <div style={{fontFamily: FONTS.mono, fontSize: 15, letterSpacing: '0.22em', color: COLORS.muted}}>{label}</div>
    <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 50, position: 'relative'}}>{children}</div>
  </div>
);

/** Number → glitch → solid redaction. */
const GlitchValue: React.FC<{
  frame: number;
  g0: number;
  value: number;
  prev: number;
  target: number;
  decimals: number;
  blocks: number;
  seed: string;
}> = ({frame, g0, value, prev, target, decimals, blocks, seed}) => {
  const G = 9;
  if (frame < g0) return <RollingNumber value={value} prev={prev} target={target} decimals={decimals} size={42} />;
  if (frame < g0 + G) {
    const slices = 6;
    return (
      <div style={{position: 'relative'}}>
        {new Array(slices).fill(0).map((_, i) => {
          const r = random(`${seed}-${i}-${Math.floor(frame / 1)}`);
          const dx = (r - 0.5) * 34;
          const top = (i / slices) * 100;
          const bottom = 100 - ((i + 1) / slices) * 100;
          const asBlock = random(`${seed}-b-${i}-${frame}`) < (frame - g0) / G;
          return (
            <div
              key={i}
              style={{
                position: i === 0 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                clipPath: `inset(${top}% 0 ${bottom}% 0)`,
                transform: `translateX(${dx}px)`,
                color: r > 0.6 ? COLORS.yellow : COLORS.white,
              }}
            >
              {asBlock ? (
                <div>
                  <Redacted count={blocks} height={34} id={`${seed}-g${i}`} />
                </div>
              ) : (
                <RollingNumber value={target} prev={target} target={target} decimals={decimals} size={42} color="currentColor" />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <Redacted count={blocks} height={34} id={`${seed}-final`} />
    </div>
  );
};

const EncryptedBids: React.FC = () => {
  const frame = useCurrentFrame();
  const h = HEADLINES.encryptedBids;

  const move = prog(frame, 0, 22, EASE_IN_OUT);
  const grid = {
    cx: mix(STAGE.cx, AUCTION_GRID.cx, move),
    cy: mix(STAGE.cy, AUCTION_GRID.cy, move),
    tile: mix(STAGE.tile, AUCTION_GRID.tile, move),
  };
  const cardIn = prog(frame, 6, 20);
  const fadeAll = 1 - prog(frame, 78, 12, EASE_IN_OUT);

  // count-up
  const cStart = 18;
  const cDur = 26;
  const priceAt = (f: number) => AUCTION.price * prog(f, cStart, cDur, Easing.out(Easing.cubic));
  const qtyAt = (f: number) => AUCTION.qty * prog(f, cStart, cDur - 6, Easing.out(Easing.cubic));
  const pressAt = 44;
  const glitchAt = 47;
  const press = interpolate(frame, [pressAt, pressAt + 3, pressAt + 8], [1, 0.96, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const sealed = frame >= glitchAt + 6;

  const rowIn = (k: number) => prog(frame, 54 + k * 6, 16);

  return (
    <AbsoluteFill style={{opacity: fadeAll}}>
      {/* card */}
      <div
        style={{
          position: 'absolute',
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          borderRadius: 32,
          background: COLORS.panel,
          boxShadow: `inset 0 0 0 1.5px ${COLORS.line}, 0 40px 120px rgba(0,0,0,0.5)`,
          opacity: cardIn,
          transform: `scale(${mix(0.96, 1, cardIn)})`,
          filter: cardIn < 0.98 ? `blur(${(1 - cardIn) * 10}px)` : undefined,
        }}
      />
      <NftStage grid={grid} eyes={{open: 1, opacity: 1}} haze={mix(0.15, 0.1, move)} />

      {/* right panel */}
      <div
        style={{
          position: 'absolute',
          left: 800,
          top: CARD.y + 36,
          width: 770,
          display: 'flex',
          flexDirection: 'column',
          opacity: prog(frame, 12, 16),
          transform: `translateX(${(1 - prog(frame, 12, 18)) * 30}px)`,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontFamily: FONTS.headline, fontWeight: 700, fontSize: 38, color: COLORS.white, letterSpacing: '-0.01em'}}>
            {NFT.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 100,
              boxShadow: `inset 0 0 0 1.5px rgba(255,210,7,0.5)`,
              fontFamily: FONTS.mono,
              fontSize: 15,
              letterSpacing: '0.2em',
              color: COLORS.yellow,
            }}
          >
            <div style={{width: 8, height: 8, borderRadius: 4, background: COLORS.yellow, opacity: 0.5 + 0.5 * Math.sin(frame / 4)}} />
            {AUCTION.lotLabel}
          </div>
        </div>

        <div style={{display: 'flex', gap: 20, marginTop: 30}}>
          <Field label={AUCTION.priceLabel} flex={1.65}>
            <GlitchValue
              frame={frame}
              g0={glitchAt}
              value={priceAt(frame)}
              prev={priceAt(frame - 1)}
              target={AUCTION.price}
              decimals={2}
              blocks={5}
              seed="price"
            />
            <div style={{fontFamily: FONTS.mono, fontSize: 22, color: COLORS.muted, marginLeft: 6}}>{AUCTION.token}</div>
          </Field>
          <Field label={AUCTION.qtyLabel} flex={1}>
            <GlitchValue
              frame={frame}
              g0={glitchAt + 2}
              value={qtyAt(frame)}
              prev={qtyAt(frame - 1)}
              target={AUCTION.qty}
              decimals={0}
              blocks={1}
              seed="qty"
            />
          </Field>
        </div>

        <div
          style={{
            marginTop: 20,
            height: 64,
            borderRadius: 16,
            background: sealed ? 'rgba(255,210,7,0.08)' : COLORS.yellow,
            boxShadow: sealed ? `inset 0 0 0 1.5px ${COLORS.yellow}` : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            transform: `scale(${press})`,
            fontFamily: FONTS.headline,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '0.14em',
            color: sealed ? COLORS.yellow : COLORS.black,
          }}
        >
          {sealed && <Lock size={20} />}
          {sealed ? AUCTION.buttonDone : AUCTION.button}
        </div>

        <div style={{marginTop: 30, fontFamily: FONTS.mono, fontSize: 15, letterSpacing: '0.22em', color: COLORS.muted}}>
          {AUCTION.listLabel}
        </div>
        <div style={{marginTop: 10, display: 'flex', flexDirection: 'column'}}>
          {AUCTION.otherBidders.map((addr, k) => {
            const p = rowIn(k);
            return (
              <div
                key={addr}
                style={{
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  borderTop: `1px solid ${COLORS.line}`,
                  opacity: p,
                  transform: `translateX(${(1 - p) * 80}px)`,
                  filter: p < 0.98 ? `blur(${(1 - p) * 10}px)` : undefined,
                  gap: 18,
                }}
              >
                <div style={{fontFamily: FONTS.mono, fontSize: 19, color: 'rgba(255,255,255,0.7)', width: 200}}>{addr}</div>
                <Redacted count={5} height={20} id={`row-${k}`} />
                <div style={{fontFamily: FONTS.mono, fontSize: 18, color: COLORS.muted}}>{AUCTION.token}</div>
                <div style={{flex: 1}} />
                <div style={{fontFamily: FONTS.mono, fontSize: 18, color: COLORS.muted}}>×</div>
                <Redacted count={1} height={20} id={`rowq-${k}`} />
                <div style={{marginLeft: 14}}>
                  <Lock size={18} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Headline text={h.text} inAt={h.in} outAt={h.out} size={h.size} y={h.y} />
    </AbsoluteFill>
  );
};

/** Scene 3 (9–15s): the look can be published, the essence never; bids sealed too. */
export const Scene3Beyond: React.FC = () => {
  const a = sceneFrames('privateTraits');
  const b = sceneFrames('encryptedBids');
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={a.duration} layout="none">
        <PrivateTraits />
      </Sequence>
      <Sequence from={b.from - a.from} durationInFrames={b.duration} layout="none">
        <EncryptedBids />
      </Sequence>
    </AbsoluteFill>
  );
};

