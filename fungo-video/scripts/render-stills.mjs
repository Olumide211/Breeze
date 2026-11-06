// Renders one still from the middle of each scene (+ the final frame) to out/stills/.
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const browserExecutable =
  process.env.REMOTION_BROWSER ??
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

const STILLS = [
  ['scene1-old-way', 2.0],
  ['scene2-shift', 7.6],
  ['scene3a-private-traits', 11.0],
  ['scene3b-encrypted-bids', 14.2],
  ['scene4a-looking-wrong', 16.6],
  ['scene4b-final-frame', 19.97],
];
const only = process.argv.length > 2 ? process.argv.slice(2).map(Number) : null;

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'assets')});
const composition = await selectComposition({serveUrl, id: 'FungoVideo', browserExecutable});
const list = only != null ? only.map((f) => [`frame-${f}`, f / composition.fps]) : STILLS;
for (const [name, t] of list) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps));
  const output = path.join(root, 'out/stills', `${name}.png`);
  await renderStill({serveUrl, composition, frame, output, browserExecutable});
  console.log(`✓ ${name} (frame ${frame}) → ${path.relative(root, output)}`);
}
