import {random} from 'remotion';
import {F, FPS} from '../timeline';

export const TYPED = "why didn't they release you?";
// Measured width of TYPED in Inter Regular 40px (Chromium): 540.2px.
export const TYPED_W = 540;

// Humanised keystroke schedule (frame of each key press). 45–85ms per character,
// longer pauses after spaces, a 10-frame hesitation before "release". Seeded only.
export const KEY_FRAMES: number[] = (() => {
  const out: number[] = [F.typing];
  let t = F.typing;
  for (let i = 1; i < TYPED.length; i++) {
    let ms = 45 + 40 * random(`astra-key-${i}`);
    if (TYPED[i - 1] === ' ') ms += 40 + 40 * random(`astra-space-${i}`);
    let frames = (ms / 1000) * FPS;
    if (TYPED.slice(i).startsWith('release')) frames += 10;
    t += frames;
    out.push(t);
  }
  // leave a short beat before the send at f312
  const last = out[out.length - 1];
  const budget = F.send - 10 - F.typing;
  if (last - F.typing > budget) {
    const k = budget / (last - F.typing);
    return out.map((v) => F.typing + (v - F.typing) * k);
  }
  return out;
})();
