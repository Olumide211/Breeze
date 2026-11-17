import {random} from 'remotion';
import {STAR_RGB} from '../timeline';
import {formationDelay, formationDur} from './camera';

// 60,000 seeded stars. All randomness comes from remotion's random(seed).
export const GALAXY_COUNT = 60000;

// Arm A is the long outer arm, arm B the shorter one (as in the hero).
export const ARMS = [
  {phase: 0.35, rMax: 1.0},
  {phase: 0.35 + Math.PI, rMax: 0.84},
];

let seedCounter = 0;
const rnd = () => random(`astra-g-${seedCounter++}`);
const gauss = () => {
  const u = Math.max(1e-6, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const pickStarColour = (u: number) =>
  u < 0.7 ? STAR_RGB.white : u < 0.9 ? STAR_RGB.blue : STAR_RGB.amber;

export type GalaxyBuffers = {
  r: Float32Array;
  theta: Float32Array;
  z: Float32Array;
  arm: Float32Array; // arm phase, or -100 for non-arm stars
  delay: Float32Array;
  dur: Float32Array;
  size: Float32Array; // px diameter of the disc at REF_DIST
  bright: Float32Array;
  halo: Float32Array;
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
    halo: new Float32Array(n),
    tw: new Float32Array(n),
    color: new Float32Array(n * 3),
  };

  // population budget
  const groups: Array<[string, number]> = [
    ['armStar', 2700],
    ['armDust', 28700],
    ['core', 3600],
    ['coreHaze', 9000],
    ['disk', 16000],
  ];

  let i = 0;
  for (const [kind, count] of groups) {
    for (let k = 0; k < count; k++, i++) {
      let r = 0;
      let theta = 0;
      let z = 0;
      let arm = -100;
      let size = 1;
      let bright = 1;
      let halo = 0;
      let col: readonly number[] = STAR_RGB.white;

      if (kind === 'armStar' || kind === 'armDust') {
        const a = ARMS[rnd() < 0.56 ? 0 : 1];
        const u = rnd();
        const rBase = 0.06 + (a.rMax - 0.06) * Math.pow(u, 1.05);
        // arms loosen and scatter outward
        const loose = kind === 'armStar' ? 0.026 + 0.05 * rBase : 0.03 + 0.065 * rBase;
        const stray = rnd() < 0.07 ? 3.2 : 1;
        r = Math.max(0.02, rBase + gauss() * loose * stray);
        theta = gauss() * (kind === 'armStar' ? 0.05 : 0.08); // along-arm jitter
        arm = a.phase;
        z = gauss() * (0.006 + 0.012 * r);
        if (kind === 'armStar') {
          const big = rnd();
          size = big < 0.07 ? 6.5 + 2.5 * rnd() : big < 0.4 ? 4.2 + 2 * rnd() : 2.6 + 1.4 * rnd();
          bright = 0.6 + 0.4 * rnd();
          halo = size > 5 ? 0.5 : 0.18;
          col = pickStarColour(rnd());
        } else {
          size = 1.0 + 0.9 * rnd();
          bright = 0.02 + 0.05 * rnd();
          col = rnd() < 0.55 ? STAR_RGB.blue : STAR_RGB.white;
        }
      } else if (kind === 'core') {
        r = Math.abs(gauss()) * 0.026 + Math.abs(gauss()) * 0.01;
        theta = rnd() * Math.PI * 2;
        z = gauss() * 0.012;
        size = 2.6 + 3.2 * rnd();
        bright = 0.75 + 0.25 * rnd();
        halo = 0.3;
        col = rnd() < 0.85 ? STAR_RGB.white : STAR_RGB.blue;
      } else if (kind === 'coreHaze') {
        r = Math.abs(gauss()) * 0.085;
        theta = rnd() * Math.PI * 2;
        z = gauss() * 0.02;
        size = 1.3 + 1.4 * rnd();
        bright = 0.07 + 0.13 * rnd();
        col = rnd() < 0.7 ? STAR_RGB.blue : STAR_RGB.white;
      } else {
        // faint inter-arm disk
        r = 0.08 + 0.95 * Math.sqrt(rnd());
        theta = rnd() * Math.PI * 2;
        z = gauss() * 0.02;
        size = 1.0 + 1.0 * rnd();
        bright = 0.03 + 0.08 * rnd();
        col = rnd() < 0.5 ? STAR_RGB.blue : STAR_RGB.white;
        if (rnd() < 0.05) {
          // a few loose brighter field stars inside the disk
          size = 2 + 1.5 * rnd();
          bright = 0.45 + 0.3 * rnd();
          col = pickStarColour(rnd());
        }
      }

      const jitter = rnd();
      b.r[i] = r;
      b.theta[i] = theta;
      b.z[i] = z;
      b.arm[i] = arm;
      b.delay[i] = formationDelay(Math.min(r, 1), jitter);
      b.dur[i] = formationDur(rnd());
      b.size[i] = size;
      b.bright[i] = bright;
      b.halo[i] = halo;
      b.tw[i] = rnd();
      b.color[i * 3] = col[0];
      b.color[i * 3 + 1] = col[1];
      b.color[i * 3 + 2] = col[2];
    }
  }
  cached = b;
  return b;
};

// 7 hero stars with four-point diffraction spikes, placed on the arms.
export const SPIKE_STARS = [
  {arm: 0, r: 0.93, len: 70, size: 8},
  {arm: 1, r: 0.66, len: 62, size: 7.5},
  {arm: 0, r: 0.52, len: 56, size: 7},
  {arm: 1, r: 0.36, len: 36, size: 5},
  {arm: 0, r: 0.74, len: 44, size: 6},
  {arm: 1, r: 0.82, len: 34, size: 5},
  {arm: 0, r: 0.3, len: 28, size: 4.5},
];
