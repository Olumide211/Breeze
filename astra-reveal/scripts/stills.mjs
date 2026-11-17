// Render QA stills with one bundle + one browser: node scripts/stills.mjs 0 60 96 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'node:path';

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
const chromiumOptions = {gl: process.env.REMOTION_GL || 'swangle'};
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const composition = await selectComposition({serveUrl, id: 'AstraReveal', puppeteerInstance: browser, chromiumOptions});
for (const frame of frames) {
  const output = `out/stills/f${String(frame).padStart(4, '0')}.png`;
  await renderStill({composition, serveUrl, frame, output, puppeteerInstance: browser, chromiumOptions, overwrite: true});
  console.log('wrote', output);
}
await browser.close({silent: true});
