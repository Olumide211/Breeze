/**
 * ─────────────────────────────────────────────────────────────
 *  FUNGO LABS × ZAMA — single place to tweak the video
 *  Durations are in SECONDS. Colors, copy and data all live here.
 * ─────────────────────────────────────────────────────────────
 */

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInSeconds: 30,
} as const;

export const COLORS = {
  bg: '#0B0B10', // background
  yellow: '#FFD207', // brand yellow, main accent (flat)
  black: '#0A0A0A', // sealed tiles, logo tiles, final text
  white: '#FFFFFF', // text
  haze: '#FFE783', // soft yellow glow, haze only
  panel: '#111118', // auction card surface
  line: 'rgba(255,255,255,0.10)', // hairlines / borders
  muted: 'rgba(255,255,255,0.55)', // secondary labels
} as const;

export const FONTS = {
  headline: 'Space Grotesk',
  mono: 'JetBrains Mono',
} as const;

/** Scene windows (seconds from the start of the video). */
export const SCENES = {
  oldWay: {start: 0, end: 5.5}, // 1 · the old way
  shift: {start: 5.5, end: 11.5}, // 2 · the shift
  compute: {start: 11.5, end: 16.5}, // 2b · FHE: computed on encrypted data
  privateTraits: {start: 16.5, end: 20}, // 3a · reveal the look, essence stays locked
  encryptedBids: {start: 20, end: 24}, // 3b · sealed auction
  lookingWrong: {start: 24, end: 27}, // 4a · clear to black
  logo: {start: 27, end: 30}, // 4b · yellow flood + lockup (last 0.5s held)
} as const;

/**
 * On-screen copy. `in` / `out` are seconds relative to the START of the scene.
 * `out: null` = the line stays until the scene ends (or gets wiped).
 * Words animate in one by one; the line counts as readable once the last word lands.
 */
export const HEADLINES = {
  oldWay: {text: "WE'VE ALWAYS SEEN EVERYTHING.", in: 2.75, out: 5.2, size: 80, y: 930},
  shift: {text: 'BUT WHAT IF SOME THINGS STAYED HIDDEN?', in: 2.7, out: 5.7, size: 76, y: 930},
  compute: {text: 'COMPUTED. NEVER REVEALED.', in: 1.9, out: 4.4, size: 84, y: 930},
  privateTraits: {text: 'PRIVATE TRAITS.', in: 1.2, out: 3.2, size: 92, y: 930},
  encryptedBids: {text: 'ENCRYPTED BIDS.', in: 0.8, out: 3.5, size: 92, y: 930},
  lookingWrong: {text: "MAYBE WE'VE BEEN LOOKING AT NFTs ALL WRONG.", in: 0.15, out: null, size: 72, y: 540},
  logo: {text: 'FUNGO LABS × ZAMA', in: 0.7, out: null, size: 64, y: 800},
} as const;

/** Small signature on the final frame. `in` = seconds after the yellow flood. */
export const CREDIT = {text: 'MADE BY TIFE', in: 1.0};

/** Slow cinematic push-in across scenes 1–3 (1 = none). */
export const CAMERA = {pushIn: 1.04};

/** Word-by-word animation timing (seconds). */
export const HEADLINE_STYLE = {
  wordStagger: 0.09,
  wordDuration: 0.42,
  size: 80,
} as const;

/** The NFT "essence": class + 4 stats + element. */
export type Trait = {
  name: string;
  value: string;
  /** 0–100 for stats (draws a bar); undefined for text traits */
  stat?: number;
  /** ciphertext shown once encrypted */
  cipher: string;
  side: 'left' | 'right';
};

export const TRAITS: Trait[] = [
  {name: 'CLASS', value: 'ORACLE', cipher: '0x7E3A9F1C', side: 'left'},
  {name: 'ELEMENT', value: 'AETHER', cipher: '0xC41B08D2', side: 'right'},
  {name: 'SECRECY', value: '87', stat: 87, cipher: '0x9F2DA6', side: 'left'},
  {name: 'INTUITION', value: '72', stat: 72, cipher: '0x18EB7C', side: 'right'},
  {name: 'WILL', value: '64', stat: 64, cipher: '0xA5F03E', side: 'left'},
  {name: 'ENERGY', value: '91', stat: 91, cipher: '0x3D7C91', side: 'right'},
];

export const NFT = {
  name: 'FUNGO #0217',
  toggleLabel: 'PUBLISH LOOK',
} as const;

export const AUCTION = {
  lotLabel: 'LIVE AUCTION',
  priceLabel: 'BID PRICE',
  qtyLabel: 'QUANTITY',
  price: 1250, // counts up to this
  qty: 3,
  token: 'cZAMA',
  button: 'PLACE BID',
  buttonDone: 'BID SEALED',
  listLabel: 'SEALED BIDS',
  otherBidders: ['0x91c4…a7e2', '0x3b07…f19d', '0xe25a…0c4b'],
} as const;

/** FHE compute beat (scene 2b) */
export const COMPUTE = {
  op: 'FHE.gt(will_a, will_b)',
  node: 'FHE',
  inputLabel: 'WILL',
  outputLabel: 'RESULT',
} as const;

/**
 * Sound effects (synthesized: `npm run sfx` regenerates assets/sfx/*.wav).
 * `volume` is the master level; tweak single sounds in `levels`.
 */
export const SFX = {
  enabled: true,
  volume: 0.8,
  levels: {
    snap: 0.55, land: 0.6, tick: 0.35, pop: 0.3, scan: 0.45, seal: 0.55, scramble: 0.28,
    lock: 0.45, whoosh: 0.45, toggle: 0.55, shimmer: 0.4, pulse: 0.3, hum: 0.35,
    odometer: 0.45, press: 0.55, glitch: 0.35, riser: 0.6, impact: 1, chime: 0.45,
  } as Record<string, number>,
};

/**
 * Optional soundtrack: drop assets/music.mp3 in and it is picked up automatically.
 * `hitAt` = time (s) INSIDE the track of its biggest hit. The track is shifted so that
 * hit lands exactly on the scene-4 yellow flood. Run `npm run find-hit` to detect it.
 */
export const MUSIC = {
  file: 'music.mp3',
  hitAt: null as number | null,
  volume: 0.7, // sits under the SFX
  fadeOutSeconds: 0.6,
};

/** Ambient particles */
export const PARTICLES = {
  count: 46,
  opacity: 1, // global multiplier
} as const;

// ───────── helpers ─────────
export const sec = (s: number) => Math.round(s * VIDEO.fps);
export const sceneFrames = (k: keyof typeof SCENES) => ({
  from: sec(SCENES[k].start),
  duration: sec(SCENES[k].end) - sec(SCENES[k].start),
});
