// Finds the loudest ~100ms moment in assets/music.mp3 (its biggest hit).
// Put the printed value into MUSIC.hitAt in src/config.ts.
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../assets/music.mp3');
const SR = 8000;
const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {maxBuffer: 1 << 30});
if (r.status !== 0) {
  console.error(r.stderr?.toString() || 'ffmpeg failed: is assets/music.mp3 present?');
  process.exit(1);
}
const pcm = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 2);
const win = SR / 10;
let best = 0, bestAt = 0, prev = 0;
for (let i = 0; i + win < pcm.length; i += win / 2) {
  let e = 0;
  for (let j = i; j < i + win; j++) e += pcm[j] * pcm[j];
  e = Math.sqrt(e / win);
  const jump = e - prev * 0.6; // favour sudden onsets over sustained loudness
  if (jump > best) { best = jump; bestAt = i / SR; }
  prev = e;
}
console.log(`Biggest hit ≈ ${bestAt.toFixed(2)}s → set MUSIC.hitAt = ${bestAt.toFixed(2)} in src/config.ts`);
