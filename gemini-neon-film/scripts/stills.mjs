// usage: node scripts/stills.mjs [vertical|square|both] [frames comma list] [outdir]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'path';
const which = process.argv[2] ?? 'both';
const frames = (process.argv[3] ?? '0,50,110,140,260,330,380,420,470,500,540,600,719').split(',').map(Number);
const outDir = process.argv[4] ?? 'stills';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'swangle'}});
const ids = which === 'both' ? ['NeonVertical', 'NeonSquare'] : [which === 'square' ? 'NeonSquare' : 'NeonVertical'];
for (const id of ids) {
  const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}});
  for (const frame of frames) {
    const t = Date.now();
    const output = `${outDir}/${id === 'NeonSquare' ? 'sq' : 'v'}-${String(frame).padStart(3, '0')}.png`;
    await renderStill({composition, serveUrl, output, frame, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}, overwrite: true});
    console.log(output, Date.now() - t, 'ms');
  }
}
await browser.close({silent: true});
