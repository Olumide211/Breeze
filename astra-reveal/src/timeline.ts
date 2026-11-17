// Shared timing, easing and palette. Every value is a pure function of the frame,
// so each render is frame-identical. Per-format positions live in layout.ts.

export const FPS = 60;
export const DURATION = 720;

export const COLORS = {
  black: '#000000',
  white: '#ffffff',
  spaceCentre: '#05090d',
  spaceEdge: '#0c1620',
  spaceCorner: '#070e15',
  starWhite: '#e8eef5',
  starBlue: '#87b8de',
  starAmber: '#e28f50',
  uiFill: '#303030',
  uiBorder: '#4f4f4f',
  uiPlaceholder: '#c6c6c6',
  chatBlue: '#3068f0',
};

export const STAR_RGB = {
  white: [0xe8 / 255, 0xee / 255, 0xf5 / 255] as const,
  blue: [0x87 / 255, 0xb8 / 255, 0xde / 255] as const,
  amber: [0xe2 / 255, 0x8f / 255, 0x50 / 255] as const,
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const seg = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---- ChatGPT message box (px, measured from the mobile app; same in both cuts) ----
export const BOX = {
  w: 877,
  h: 144,
  rowH: 48, // extra height per wrapped line
  plusX: 44,
  textX: 150,
  micCx: 652,
  btnCx: 795,
  btn: 94,
};
// Text may run up to here (box-relative) before it wraps: clear of the mic.
export const TEXT_MAX_W = 612 - BOX.textX;

export const BUBBLE = {padX: 34, padY: 24, lineH: 52, radius: 36};
export const DOT_SIZE = 18;

// ---- Scene markers -------------------------------------------------------
export const F = {
  blossomIn: 12,
  glint: 48,
  toLine: 96,
  boxOpen: 120,
  contents: 140,
  cursor: 156,
  typing: 180,
  send: 312,
  lift: 318,
  dot: 342,
  dotGlide: 356, // the thinking dot glides to the birth point …
  dotGlideEnd: 380, // … and arrives just before the burst
  spark: 372,
  burst: 384,
  galaxy: 396, // star formation start (dot erupts)
  icons: 440,
  collapse: 540,
  settle: 560,
  title: 590,
  endCard: 648,
  tagline: 660,
};
