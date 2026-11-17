import {Matrix4, PerspectiveCamera, Vector4} from 'three';
import {
  DOT,
  F,
  H,
  W,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  seg,
} from '../timeline';

// The galaxy lives in its own XY plane (radius ~1). It is spun about its normal,
// tilted about X (top edge away from camera), then projected by a fixed-FOV camera
// on the +Z axis. A screen-space offset places the centre anywhere in frame.
// The same maths drives the WebGL points (as uniforms) and the DOM/canvas layers.

export const FOV = 30;
export const FOCAL_PX = H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
// Distances giving ~900px and ~860px face-on diameter.
export const DIST_WIDE = (2 * FOCAL_PX) / 900;
export const DIST_HERO = (2 * FOCAL_PX) / 860;
export const DIST_CLOSE = 2.4;
export const REF_DIST = DIST_HERO; // point sizes are authored in px at this distance

// Log-spiral arms: theta = phase - ln(r / R0) / B
export const R0 = 0.05;
export const B = 0.27;

const DEG = Math.PI / 180;

// Clockwise spin rate (radians/frame): constant, then slows to a crawl for the hero.
const OMEGA = 0.2 * DEG;
const OMEGA_CRAWL = 0.035 * DEG;
const omegaAt = (f: number) =>
  lerp(OMEGA, OMEGA_CRAWL, easeInOutCubic(seg(f, F.settle, 620)));

const spinCache: number[] = [];
export const spinAt = (f: number) => {
  // integral of omega from formation start to f (frame-exact, cached)
  if (f <= F.galaxy) return 0;
  const whole = Math.floor(f);
  if (spinCache.length === 0) {
    let acc = 0;
    for (let k = 0; k <= 800; k++) {
      spinCache.push(acc);
      if (k >= F.galaxy) acc += omegaAt(k);
    }
  }
  const frac = f - whole;
  return spinCache[whole] + frac * omegaAt(whole);
};

export type GalaxyState = {
  dist: number;
  tilt: number; // radians from face-on
  rot: number; // radians, applied to galaxy angle (negative = clockwise on screen)
  cx: number; // screen centre px
  cy: number;
};

export const galaxyState = (f: number): GalaxyState => {
  const pull = easeOutCubic(seg(f, F.galaxy, 486));
  let dist = lerp(DIST_CLOSE, DIST_WIDE, pull);
  dist = lerp(dist, DIST_HERO, easeInOutCubic(seg(f, F.settle, 620)));

  const tilt = lerp(58, 25, easeInOutCubic(seg(f, F.settle, 620))) * DEG;

  const move = easeInOutCubic(seg(f, F.galaxy, 470));
  let cx = lerp(DOT.x, W / 2, move);
  let cy = lerp(DOT.y, H / 2, move);
  cy = lerp(cy, 900, easeInOutCubic(seg(f, F.settle, 620)));

  // the stars arrive with extra angular momentum that bleeds off (swirl in)
  const swirl = 1.5 * (1 - easeOutCubic(seg(f, F.galaxy, 500)));
  const rot = -spinAt(f) + swirl;
  return {dist, tilt, rot, cx, cy};
};

const cam = new PerspectiveCamera(FOV, W / H, 0.05, 100);
export const viewProjFor = (s: GalaxyState) => {
  cam.position.set(0, 0, s.dist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
};

export const offsetNdc = (s: GalaxyState): [number, number] => [
  (s.cx - W / 2) / (W / 2),
  -(s.cy - H / 2) / (H / 2),
];

// Tilt a point already in the (spun) galaxy plane.
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
) => {
  v4.set(wx, wy, wz, 1).applyMatrix4(vp);
  const [ox, oy] = offsetNdc(s);
  const ndcX = v4.x / v4.w + ox;
  const ndcY = v4.y / v4.w + oy;
  return {
    x: ((ndcX + 1) / 2) * W,
    y: ((1 - ndcY) / 2) * H,
    depth: v4.w,
    scale: REF_DIST / v4.w,
  };
};

// Position of a point that sits on arm `phase` at final radius r, honouring the
// unwinding formation (same formula as the vertex shader).
export const formation = (f: number, delay: number, dur: number) => {
  const p = Math.min(1, Math.max(0, (f - F.galaxy - delay) / dur));
  return {p, e: 1 - Math.pow(1 - p, 3)};
};

export const armTheta = (phase: number, r: number) =>
  phase - Math.log(Math.max(r, R0) / R0) / B;

export const formationDelay = (r: number, jitter: number) =>
  34 * Math.pow(r, 0.9) + 4 * jitter;
export const formationDur = (jitter: number) => 30 + 12 * jitter;
