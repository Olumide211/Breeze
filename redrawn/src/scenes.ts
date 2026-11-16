/**
 * REDRAWN — single source of truth for timing and line boil.
 * Everything here is in frames at 12 fps unless noted.
 * Tweak values here; the fine choreography that reads them lives in direction.ts.
 */
import type { Pt } from "./lib/util";

export const VIDEO = { width: 1024, height: 576, fps: 12, frames: 504 };

export const COLORS = {
  bg: "#FBFBF8",
  ink: "#111111",
  grey: "#A0A0A0", // shadows, parent hand
  ghost: "#C8C8C8", // erased ghost marks
  white: "#FFFFFF",
};
export const GHOST_OPACITY = 0.35;

/** LINE BOIL = EMOTION. boil → jitter (± screen px) and hold (frames between re-seeds). Interpolated between rows. */
export const BOIL_LEVELS = [
  { boil: 0.05, jitter: 0.3, hold: 8 }, // peace
  { boil: 0.2, jitter: 0.6, hold: 4 }, // calm
  { boil: 0.5, jitter: 1.5, hold: 2 }, // uneasy
  { boil: 1.0, jitter: 3.0, hold: 1 }, // anxious
];
/** When a scene starts at a different boil than the previous one ended, blend over this many frames. */
export const BOIL_BLEND_FRAMES = 6;

export type SceneId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8" | "S9" | "S10" | "S11" | "S12";
export type Scene = { id: SceneId; start: number; end: number; boil: [number, number]; ones?: boolean; note: string };

/** boil: [value at scene start, value at scene end], eased across the scene. ones: animate on ones (default is twos). */
export const SCENES: Scene[] = [
  { id: "S1", start: 0, end: 48, boil: [0.2, 0.2], note: "Wide. Drawing at the desk, calm." },
  { id: "S2", start: 48, end: 84, boil: [0.2, 0.5], note: "Door opens, shadow, first bubble." },
  { id: "S3", start: 84, end: 120, boil: [0.5, 0.5], note: "Close-up. Smile corner erased." },
  { id: "S4", start: 120, end: 180, boil: [0.5, 0.8], note: "Montage. Ear, head arcs, line weight." },
  { id: "S5", start: 180, end: 216, boil: [0.8, 0.8], note: "Parent hand crumples the paper. Pencil lost." },
  { id: "S6", start: 216, end: 264, boil: [1.0, 1.0], ones: true, note: "Close-up. Drawing hand erased." },
  { id: "S7", start: 264, end: 300, boil: [1.0, 1.0], note: "Wide. Faint outline on the bed, bubbles pile up." },
  { id: "S8", start: 300, end: 336, boil: [1.0, 0.5], note: "Turning point. Exhale. Bubbles crumble." },
  { id: "S9", start: 336, end: 372, boil: [0.5, 0.3], note: "Pencil rolls back. Left hand picks it up." },
  { id: "S10", start: 372, end: 432, boil: [0.3, 0.1], note: "Redraws hand, then smile corner." },
  { id: "S11", start: 432, end: 468, boil: [0.05, 0.05], note: "Wide. Back at the desk. Peace." },
  { id: "S12", start: 468, end: 504, boil: [0.2, 0.2], note: "End card: BREEZE." },
];

/** Camera shots: zoom + the world point at screen centre. */
export const CAM = {
  wide: { zoom: 1.5, x: 468, y: 348 },
  faceDesk: { zoom: 3.5, x: 572, y: 316 }, // S3
  mediumDesk: { zoom: 2.4, x: 566, y: 336 }, // S4 medium
  desk: { zoom: 2.4, x: 606, y: 340 }, // S5
  deskFloor: { zoom: 2.4, x: 636, y: 418 }, // S5 pan target (follows pencil)
  hand: { zoom: 7.5, x: 626, y: 372 }, // S6
  mediumBed: { zoom: 2, x: 425, y: 372 }, // S8
  floor: { zoom: 2.1, x: 468, y: 400 }, // S9
  handRedraw: { zoom: 6.5, x: 466, y: 384 }, // S10a
  faceBed: { zoom: 4, x: 434, y: 318 }, // S10b
};

/** Story beats. at = start frame, dur = length in frames. */
export const T = {
  doorOpen: { at: 48, dur: 8 },
  doorClose: { at: 344, dur: 8 },
  floorShadowIn: { at: 52, dur: 28 },
  wallShadowIn: { at: 256, dur: 14 },
  shadowsOut: { at: 336, dur: 12 },

  // S3
  eraseSmile: { at: 90, dur: 6 },
  touchMouth: { at: 100, dur: 8 },

  // S4 (montage cut length, and what each bubble hit erases)
  montageCut: 12,
  eraseEar: { at: 133, dur: 5 },
  eraseHeadA: { at: 157, dur: 5, seg: 3 }, // head arcs: 0 top-front, 1 chin-front, 2 chin-back, 3 top-back
  eraseHeadB: { at: 162, dur: 5, seg: 1 },
  thinLines: { at: 170, dur: 6 },

  // S5
  parentHandIn: { at: 180, dur: 8 },
  crumple: { at: 188, dur: 8 },
  parentHandOut: { at: 198, dur: 8 },
  pencilDrop: 192,
  pencilFall: { at: 200, dur: 5 },
  pencilRollAway: { at: 205, dur: 11 },
  deskPan: { at: 198, dur: 10 },

  // S6: fingers are 0 thumb, 1 index, 2 middle, 3 ring, 4 pinky
  eraseFingers: { at: 216, every: 6, dur: 5, order: [4, 3, 2, 1, 0] },
  erasePalm: { at: 246, dur: 6 },

  // S7 / S8
  pileStart: 262,
  liftHead: { at: 302, dur: 12 },
  exhale: { at: 312, dur: 16 },
  crumble1: 316,
  crumble2: 323,
  crumbleAll: 328,

  // S9
  pencilReturn: { at: 338, dur: 16 },
  floorCut: 354,
  reach: { at: 356, dur: 8 },
  grab: 365,

  // S10
  redrawPalm: { at: 374, dur: 7 },
  redrawFingers: { at: 381, every: 5, dur: 5, order: [0, 1, 2, 3, 4] },
  faceCut: 408,
  redrawSmile: { at: 412, dur: 8 },
  calmSmile: 422,

  // S11
  freshDoodle: { at: 432, dur: 20 },
};

/** Overall outline thickness of the Boy over time: [frame, lineWeight]. */
export const LINE_WEIGHT_KEYS: [number, number][] = [
  [0, 1],
  [T.thinLines.at, 1],
  [T.thinLines.at + T.thinLines.dur, 0.7],
  [252, 0.7],
  [264, 0.4],
  [314, 0.4],
  [332, 0.75],
  [372, 0.85],
  [432, 1],
];

/** Posture over the montage (0 upright → hunched). */
export const MONTAGE_POSTURE: [number, number][] = [
  [120, 0.1],
  [180, 0.8],
];

export const DOOR_MOUTH: Pt = [204, 296];

export type BubbleDef = {
  id: string;
  /** [frame, x, y, size] keyframes */
  keys: [number, number, number, number][];
  /** frame at which it hits / ends */
  hit: number;
  end: "fade" | "crumble";
};

const pile = (i: number, x: number, y: number, size: number): BubbleDef => ({
  id: `pile${i}`,
  keys: [
    [T.pileStart + i * 4, DOOR_MOUTH[0], DOOR_MOUTH[1], 6],
    [T.pileStart + i * 4 + 14, x, y, size],
  ],
  hit: T.crumbleAll,
  end: "crumble",
});

export const BUBBLES: BubbleDef[] = [
  // S2–S3: the first one. Erases the smile corner.
  { id: "b1", keys: [[56, 204, 296, 6], [84, 452, 300, 44], [90, 561, 318, 44]], hit: T.eraseSmile.at, end: "fade" },
  // S4: ear, two head arcs, then the big one that thins every line.
  { id: "b2", keys: [[118, 204, 296, 6], [133, 519, 312, 36]], hit: T.eraseEar.at, end: "fade" },
  { id: "b3", keys: [[138, 204, 296, 6], [157, 543, 286, 34]], hit: T.eraseHeadA.at, end: "fade" },
  { id: "b4", keys: [[144, 204, 296, 6], [162, 593, 340, 32]], hit: T.eraseHeadB.at, end: "fade" },
  { id: "b5", keys: [[150, 204, 296, 6], [169, 548, 362, 62]], hit: T.thinLines.at - 1, end: "fade" },
  // S7: the pile-up around the bed.
  pile(0, 318, 304, 46),
  pile(1, 492, 262, 40),
  pile(2, 398, 232, 50),
  pile(3, 524, 338, 36),
  pile(4, 292, 380, 38),
  // S8: the two that crumble against him.
  { id: "c1", keys: [[300, 215, 300, 30], [316, 372, 322, 40]], hit: T.crumble1, end: "crumble" },
  { id: "c2", keys: [[309, 215, 262, 28], [323, 384, 296, 38]], hit: T.crumble2, end: "crumble" },
];
