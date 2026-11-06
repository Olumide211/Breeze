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
  durationInSeconds: 20,
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
  oldWay: {start: 0, end: 4}, // scene 1
  shift: {start: 4, end: 9}, // scene 2
  privateTraits: {start: 9, end: 12}, // scene 3a
  encryptedBids: {start: 12, end: 15}, // scene 3b
  lookingWrong: {start: 15, end: 17.5}, // scene 4a
  logo: {start: 17.5, end: 20}, // scene 4b (yellow flood + lockup)
} as const;

/**
 * On-screen copy. `in` / `out` are seconds relative to the START of the scene.
 * `out: null` = the line stays until the scene ends (or gets wiped).
 * Words animate in one by one; the line counts as readable once the last word lands.
 */
export const HEADLINES = {
  oldWay: {text: "WE'VE ALWAYS SEEN EVERYTHING.", in: 1.55, out: 3.7, size: 80, y: 930},
  shift: {text: 'BUT WHAT IF SOME THINGS STAYED HIDDEN?', in: 2.1, out: 4.75, size: 76, y: 930},
  privateTraits: {text: 'PRIVATE TRAITS.', in: 0.9, out: 2.7, size: 92, y: 930},
  encryptedBids: {text: 'ENCRYPTED BIDS.', in: 0.6, out: 2.55, size: 92, y: 930},
  lookingWrong: {text: "MAYBE WE'VE BEEN LOOKING AT NFTs ALL WRONG.", in: 0.05, out: null, size: 72, y: 540},
  logo: {text: 'FUNGO LABS × ZAMA', in: 0.55, out: null, size: 64, y: 800},
} as const;

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

/**
 * Optional soundtrack: drop assets/music.mp3 in and it is picked up automatically.
 * `hitAt` = time (s) INSIDE the track of its biggest hit. The track is shifted so that
 * hit lands exactly on the scene-4 yellow flood. Run `npm run find-hit` to detect it.
 */
export const MUSIC = {
  file: 'music.mp3',
  hitAt: null as number | null,
  volume: 0.9,
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
