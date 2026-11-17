// Shared timing, easing and palette. Every value is a pure function of the frame,
// so each render is frame-identical.

export const W = 1080;
export const H = 1920;
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
export const easeInQuart = (t: number) => t * t * t * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---- Layout (px) --------------------------------------------------------
export const BOX = {
  w: 877,
  h: 144,
  cy: 1420,
  left: (W - 877) / 2,
  plusX: 44,
  textX: 150,
  micCx: 652,
  btnCx: 795,
  btn: 94,
};

// Typed text clips before the mic so it never runs under it (single-line input).
export const TEXT_CLIP_RIGHT = 612; // from box left edge
export const TEXT_CLIP_W = TEXT_CLIP_RIGHT - BOX.textX;

export const BUBBLE = {
  right: 990,
  padX: 34,
  padY: 24,
  lineH: 52,
  radius: 36,
  cy: BOX.cy - 220,
};

export const DOT = {x: 99, y: 1314, size: 18};

// Title layout. The spec asked for cap top 300 / baseline 1520, which would push the
// end-card blossom (40px above the caps) and the tagline out of the 260–1560 safe area,
// so both words move in by the same amount and stay symmetric around the galaxy (y 900).
export const TITLE = {
  size: 150,
  leftX: 90,
  capTop: 360,
  rightX: 990,
  baseline: 1460,
  // Inter Display SemiBold metrics at 150px (measured): ascent 145, descent 36, cap 111.
  baselineInLineBox: 129.5,
  capHeight: 111,
};

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
