import {random} from 'remotion';
import {STAR_RGB} from '../timeline';
import {formationDelay, formationDur} from './camera';

// 60,000 seeded stars, modelled on reference/hero-gpt-6-astra-16x9.png:
//   15% gaussian bulge, 50% gaussian arms (width 4% -> 12% of R), 35% diffuse disc.
//   sizes: 85% 0.5–1.3px, 13% 1.5–2.5px, 2% bright with spikes.
// All randomness comes from remotion's random(seed).
export const GALAXY_COUNT = 60000;

export const ARMS = [
  {phase: 0.35, rMax: 1.0},
  {phase: 0.35 + Math.PI, rMax: 0.88},
];

let seedCounter = 0;
const rnd = () => random(`astra-g2-${seedCounter++}`);
const gauss = () => {
  const u = Math.max(1e-6, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pickColour = () => {
  const u = rnd();
  return u < 0.7 ? STAR_RGB.white : u < 0.9 ? STAR_RGB.blue : STAR_RGB.amber;
};

export type GalaxyBuffers = {
  r: Float32Array;
  theta: Float32Array;
  z: Float32Array;
  arm: Float32Array; // arm phase, or -100 for bulge/disc stars
  delay: Float32Array;
  dur: Float32Array;
  size: Float32Array; // px diameter of the disc at the reference distance
  bright: Float32Array;
  spike: Float32Array; // 0..1 diffraction-spike strength
  tw: Float32Array;
  color: Float32Array;
};

let cached: GalaxyBuffers | null = null;

export const getGalaxy = (): GalaxyBuffers => {
  if (cached) return cached;
  seedCounter = 0;
  const n = GALAXY_COUNT;
  const b: GalaxyBuffers = {
    r: new Float32Array(n),
    theta: new Float32Array(n),
    z: new Float32Array(n),
    arm: new Float32Array(n),
    delay: new Float32Array(n),
    dur: new Float32Array(n),
    size: new Float32Array(n),
    bright: new Float32Array(n),
    spike: new Float32Array(n),
    tw: new Float32Array(n),
    color: new Float32Array(n * 3),
  };

  const nBulge = Math.round(n * 0.15);
  const nArm = Math.round(n * 0.5);

  for (let i = 0; i < n; i++) {
    let r: number;
    let theta: number;
    let z: number;
    let arm = -100;

    if (i < nBulge) {
      // gaussian bulge
      const x = gauss() * 0.075;
      const y = gauss() * 0.075;
      r = Math.hypot(x, y);
      theta = Math.atan2(y, x);
      z = gauss() * 0.04;
    } else if (i < nBulge + nArm) {
      // gaussian arm, width grows from 4% to 12% of R
      const a = ARMS[rnd() < 0.55 ? 0 : 1];
      const rBase = 0.05 + (a.rMax - 0.05) * rnd();
      const w = 0.04 + 0.08 * (rBase / a.rMax);
      const dr = gauss() * w * 0.7;
      const dt = gauss() * w * 0.7;
      r = Math.max(0.01, rBase + dr);
      theta = dt / Math.max(rBase, 0.08);
      arm = a.phase;
      z = gauss() * (0.008 + 0.012 * rBase);
    } else {
      // diffuse disc between the arms (exponential falloff)
      r = Math.min(1.15, 0.04 - Math.log(1 - 0.97 * rnd()) * 0.32);
      theta = rnd() * Math.PI * 2;
      z = gauss() * 0.02;
    }

    // size classes
    const sc = rnd();
    let size: number;
    let bright: number;
    let spike = 0;
    if (sc < 0.85) {
      size = 0.5 + 0.8 * rnd();
      bright = 0.55 + 0.45 * rnd();
    } else if (sc < 0.98) {
      size = 1.5 + 1.0 * rnd();
      bright = 0.75 + 0.25 * rnd();
    } else {
      size = 2.8 + 1.4 * rnd();
      bright = 1;
      spike = 0.35 + 0.45 * rnd();
    }
    // the disc between the arms is fainter than the arms
    if (i >= nBulge + nArm) bright *= 0.55;

    const col = pickColour();
    const jitter = rnd();
    b.r[i] = r;
    b.theta[i] = theta;
    b.z[i] = z;
    b.arm[i] = arm;
    b.delay[i] = formationDelay(Math.min(r, 1), jitter);
    b.dur[i] = formationDur(rnd());
    b.size[i] = size;
    b.bright[i] = bright;
    b.spike[i] = spike;
    b.tw[i] = rnd();
    b.color[i * 3] = col[0];
    b.color[i * 3 + 1] = col[1];
    b.color[i * 3 + 2] = col[2];
  }
  cached = b;
  return b;
};

// The few hero stars with long four-point spikes (drawn on the FX canvas).
export const SPIKE_STARS = [
  {arm: 0, r: 0.93, len: 70, size: 7},
  {arm: 1, r: 0.66, len: 62, size: 6.5},
  {arm: 0, r: 0.52, len: 56, size: 6},
  {arm: 1, r: 0.36, len: 36, size: 4.5},
  {arm: 0, r: 0.74, len: 44, size: 5},
  {arm: 1, r: 0.82, len: 34, size: 4.5},
  {arm: 0, r: 0.3, len: 28, size: 4},
];
