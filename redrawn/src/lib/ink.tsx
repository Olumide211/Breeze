import React, { createContext, useContext } from "react";
import { BOIL_BLEND_FRAMES, BOIL_LEVELS, COLORS, SCENES, VIDEO, type Scene } from "../scenes";
import { ease, lerp } from "./util";

export const sceneAt = (frame: number): Scene =>
  SCENES.find((s) => frame >= s.start && frame < s.end) ?? SCENES[SCENES.length - 1];

/** Global boil value for a frame, eased inside each scene and blended across mismatched cuts. */
export const boilAt = (frame: number): number => {
  const i = Math.max(0, SCENES.indexOf(sceneAt(frame)));
  const s = SCENES[i];
  const t = (frame - s.start) / Math.max(1, s.end - s.start - 1);
  let v = lerp(s.boil[0], s.boil[1], ease(t));
  const prev = SCENES[i - 1];
  if (prev && prev.boil[1] !== s.boil[0] && frame - s.start < BOIL_BLEND_FRAMES) {
    v = lerp(prev.boil[1], v, ease((frame - s.start + 1) / BOIL_BLEND_FRAMES));
  }
  return v;
};

const interp = (boil: number, key: "jitter" | "hold") => {
  const L = BOIL_LEVELS;
  if (boil <= L[0].boil) return L[0][key];
  for (let i = 1; i < L.length; i++) {
    if (boil <= L[i].boil) {
      return lerp(L[i - 1][key], L[i][key], (boil - L[i - 1].boil) / (L[i].boil - L[i - 1].boil));
    }
  }
  return L[L.length - 1][key];
};
/** ± jitter in screen px */
export const jitterFor = (boil: number) => interp(boil, "jitter");
/** frames between re-seeds */
export const holdFor = (boil: number) => Math.max(1, interp(boil, "hold"));

/** Re-seed counter per frame: advances by 1/hold each frame, so changing boil never causes extra flicker. */
export const TICKS: number[] = (() => {
  const out: number[] = [];
  let phase = 0;
  for (let f = 0; f < VIDEO.frames; f++) {
    out.push(Math.floor(phase + 1e-6));
    phase += 1 / holdFor(boilAt(f));
  }
  return out;
})();

export type InkState = {
  /** jitter amplitude in screen px */
  amp: number;
  /** re-seed counter */
  tick: number;
  /** camera zoom, so jitter and stroke width stay readable in close-ups */
  zoom: number;
  /** line weight multiplier (Boy lineWeight) */
  weight: number;
  /** render as erased ghost marks */
  ghost: boolean;
  color: string;
  frame: number;
};
const Ctx = createContext<InkState>({ amp: 0.6, tick: 0, zoom: 1, weight: 1, ghost: false, color: COLORS.ink, frame: 0 });
export const useInk = () => useContext(Ctx);

export const Ink: React.FC<Partial<InkState> & { children: React.ReactNode }> = ({ children, ...over }) => {
  const parent = useInk();
  return <Ctx.Provider value={{ ...parent, ...over }}>{children}</Ctx.Provider>;
};

/** Provide ink state for a frame of the film. */
export const FilmInk: React.FC<{ frame: number; children: React.ReactNode }> = ({ frame, children }) => {
  const f = Math.max(0, Math.min(VIDEO.frames - 1, frame));
  return (
    <Ink amp={jitterFor(boilAt(f))} tick={TICKS[f]} frame={frame}>
      {children}
    </Ink>
  );
};
/** Provide ink state for a fixed boil value (cast sheet, tests). */
export const BoilInk: React.FC<{ boil: number; frame: number; children: React.ReactNode }> = ({ boil, frame, children }) => (
  <Ink amp={jitterFor(boil)} tick={Math.floor(frame / holdFor(boil))} frame={frame}>
    {children}
  </Ink>
);
