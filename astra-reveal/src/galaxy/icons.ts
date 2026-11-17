import {staticFile} from 'remotion';
import {F, easeInCubic, easeOutCubic, lerp, seg, smoothstep} from '../timeline';
import {GalaxyState, projectWorld, tiltPoint, viewProjFor} from './camera';

export const ICON_FILES = [
  '01-chatgpt',
  '02-codex',
  '03-sora',
  '04-image',
  '05-voice',
  '06-agent',
].map((n) => staticFile(`icons-line/${n}.png`));

const DEG = Math.PI / 180;
export const RING_SPEED = 3 * DEG; // per frame, clockwise
export const FIRST_FRONT = 452; // chatgpt passes the front here; then every 20 frames
export const RING_R = 0.66;
export const COLLAPSE_GAP = 4;
export const COLLAPSE_DUR = 14;

export const collapseStart = (i: number) => F.collapse + COLLAPSE_GAP * i;
export const arrivalFrame = (i: number) => collapseStart(i) + COLLAPSE_DUR;
export const frontFrame = (i: number) => FIRST_FRONT + (60 * i) / 3;

export type IconState = {
  i: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  flare: number;
  front: number;
  visible: boolean;
};

export const iconStates = (f: number, s: GalaxyState): IconState[] => {
  const vp = viewProjFor(s);
  const out: IconState[] = [];
  for (let i = 0; i < 6; i++) {
    // clockwise ring: icon i reaches the front (-90deg) at frontFrame(i)
    let a = -90 * DEG + i * 60 * DEG - RING_SPEED * (f - FIRST_FRONT);
    // emerge from the arms (mid-disk) and drift out to the ring
    const em = easeOutCubic(seg(f, F.icons + 4 * i, F.icons + 36 + 4 * i));
    let r = lerp(0.3, RING_R, em);
    let opacity = smoothstep(0, 1, seg(f, F.icons + 4 * i, F.icons + 22 + 4 * i));
    // collapse: spiral into the core, accelerating
    const c = easeInCubic(seg(f, collapseStart(i), arrivalFrame(i)));
    r *= 1 - c;
    a -= 3.4 * c;
    if (f >= arrivalFrame(i)) opacity = 0;

    const [wx, wy, wz] = tiltPoint(r * Math.cos(a), r * Math.sin(a), 0, s.tilt);
    const p = projectWorld(wx, wy, wz, s, vp);
    const front = -Math.sin(a); // 1 = nearest the camera
    const depthMix = (front + 1) / 2;
    const flare = smoothstep(0.82, 1, front) * (1 - c);
    let size = lerp(72, 150, depthMix) * (1 + 0.15 * flare);
    size *= lerp(1, 0.25, c);
    out.push({
      i,
      x: p.x,
      y: p.y,
      size,
      opacity: opacity * lerp(0.6, 1, depthMix) * (c > 0 ? lerp(1, 0.9, c) : 1),
      flare: Math.max(flare, c * 0.8),
      front,
      visible: opacity > 0.001,
    });
  }
  return out.sort((p, q) => p.front - q.front);
};
