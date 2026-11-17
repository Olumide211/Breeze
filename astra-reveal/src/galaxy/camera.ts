import {Matrix4, PerspectiveCamera, Vector4} from 'three';
import type {Layout} from '../layout';
import {F, easeInOutCubic, easeOutCubic, lerp, seg} from '../timeline';

// The galaxy lives in its own XY plane (radius ~1). It is spun about its normal,
// tilted about X (top edge away from camera), then projected by a fixed-FOV camera
// on the +Z axis. A screen-space offset places the centre anywhere in frame.
// The same maths drives the WebGL points (as uniforms) and the DOM/canvas layers.

export const FOV = 30;
const focalPx = (L: Layout) => L.H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
// distance that gives a face-on diameter of `d` px (galaxy radius = 1)
const distFor = (L: Layout, d: number) => (2 * focalPx(L)) / d;
export const refDist = (L: Layout) => distFor(L, L.galaxy.diamHero);
// star sizes are authored in px for an 860px galaxy; scale for smaller cuts
export const sizeMul = (L: Layout) => L.galaxy.diamHero / 860;

// Log-spiral arms: theta = phase - ln(r / R0) / B
export const R0 = 0.05;
export const B = 0.27;

const DEG = Math.PI / 180;

// Clockwise spin rate (radians/frame): constant, then slows to a crawl for the hero.
const OMEGA = 0.2 * DEG;
const OMEGA_CRAWL = 0.035 * DEG;
const omegaAt = (f: number) => lerp(OMEGA, OMEGA_CRAWL, easeInOutCubic(seg(f, F.settle, 620)));

const spinCache: number[] = [];
export const spinAt = (f: number) => {
  if (f <= F.galaxy) return 0;
  if (spinCache.length === 0) {
    let acc = 0;
    for (let k = 0; k <= 800; k++) {
      spinCache.push(acc);
      if (k >= F.galaxy) acc += omegaAt(k);
    }
  }
  const whole = Math.floor(f);
  return spinCache[whole] + (f - whole) * omegaAt(whole);
};

export type GalaxyState = {
  dist: number;
  tilt: number; // radians from face-on
  rot: number; // radians added to every star angle (decreasing = clockwise on screen)
  cx: number;
  cy: number;
};

export const galaxyState = (f: number, L: Layout): GalaxyState => {
  const wide = distFor(L, L.galaxy.diamWide);
  const pull = easeOutCubic(seg(f, F.galaxy, 486));
  let dist = lerp(wide * 0.3, wide, pull); // dolly back from close to the core
  dist = lerp(dist, refDist(L), easeInOutCubic(seg(f, F.settle, 620)));

  const tilt = lerp(58, 25, easeInOutCubic(seg(f, F.settle, 620))) * DEG;

  const settle = easeInOutCubic(seg(f, F.settle, 620));
  const cx = lerp(L.galaxy.form.x, L.galaxy.hero.x, settle);
  const cy = lerp(L.galaxy.form.y, L.galaxy.hero.y, settle);

  // stars arrive with extra angular momentum that bleeds off (swirl in)
  const swirl = 1.5 * (1 - easeOutCubic(seg(f, F.galaxy, 500)));
  return {dist, tilt, rot: -spinAt(f) + swirl, cx, cy};
};

const cams = new Map<string, PerspectiveCamera>();
export const viewProjFor = (s: GalaxyState, L: Layout) => {
  let cam = cams.get(L.id);
  if (!cam) {
    cam = new PerspectiveCamera(FOV, L.W / L.H, 0.02, 100);
    cams.set(L.id, cam);
  }
  cam.position.set(0, 0, s.dist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
};

export const offsetNdc = (s: GalaxyState, L: Layout): [number, number] => [
  (s.cx - L.W / 2) / (L.W / 2),
  -(s.cy - L.H / 2) / (L.H / 2),
];

export const tiltPoint = (x: number, y: number, z: number, tilt: number) => {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return [x, y * c + z * s, -y * s + z * c] as const;
};

const v4 = new Vector4();
export const projectWorld = (
  wx: number,
  wy: number,
  wz: number,
  s: GalaxyState,
  vp: Matrix4,
  L: Layout,
) => {
  v4.set(wx, wy, wz, 1).applyMatrix4(vp);
  const [ox, oy] = offsetNdc(s, L);
  const ndcX = v4.x / v4.w + ox;
  const ndcY = v4.y / v4.w + oy;
  return {
    x: ((ndcX + 1) / 2) * L.W,
    y: ((1 - ndcY) / 2) * L.H,
    depth: v4.w,
    scale: refDist(L) / v4.w,
  };
};

export const formation = (f: number, delay: number, dur: number) => {
  const p = Math.min(1, Math.max(0, (f - F.galaxy - delay) / dur));
  return {p, e: 1 - Math.pow(1 - p, 3)};
};

export const armTheta = (phase: number, r: number) => phase - Math.log(Math.max(r, R0) / R0) / B;

export const formationDelay = (r: number, jitter: number) => 34 * Math.pow(r, 0.9) + 4 * jitter;
export const formationDur = (jitter: number) => 30 + 12 * jitter;
