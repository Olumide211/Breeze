// Headless harness: runs the auto-painter on a raw RGBA file and reports SSIM.
// usage: tsx scripts/tune.ts in.rgba W H out.rgba [detail] [style] [snapEvery]
import { readFileSync, writeFileSync } from 'node:fs';
import { StrokeEngine } from '../src/engine/brush';
import { AutoPainter, PHASE_NAMES, type Detail, type Style } from '../src/engine/autopaint';
import { ssimRGBA } from '../src/engine/imgproc';

const [inp, ws, hs, out, detail = 'high', style = 'realistic'] = process.argv.slice(2);
const w = +ws;
const h = +hs;
const ref = new Uint8ClampedArray(readFileSync(inp));
const eng = new StrokeEngine(w, h);
const t0 = Date.now();
const painter = new AutoPainter(ref, w, h, eng.data, { detail: detail as Detail, style: style as Style, seed: 7 });
const counts: Record<string, number> = {};
let lastLabel = '';
let st;
while ((st = painter.next())) {
  const lab = st.label.replace(/ (skin|background)$/, "");
  if (lab !== lastLabel) {
    if (lastLabel) console.log(`  ${lastLabel.padEnd(34)} ${String(counts[lastLabel]).padStart(6)} strokes  ssim=${ssimRGBA(eng.compositeRGBA8(), ref, w, h).toFixed(4)}  prog=${painter.progress.toFixed(3)}`);
    lastLabel = lab;
    if (process.env.SNAP) writeFileSync(`${out}.${PHASE_NAMES[st.phase]}.rgba`, eng.compositeRGBA8());
  }
  counts[lab] = (counts[lab] || 0) + 1;
  eng.begin(st.params);
  const p = st.pts;
  if (st.snap) for (let i = 0; i < p.length; i += 3) eng.dab(p[i], p[i + 1], p[i + 2]);
  else for (let i = 0; i < p.length; i += 3) eng.point(p[i], p[i + 1], p[i + 2]);
  eng.end();
}
const fin = eng.compositeRGBA8();
console.log(`  ${lastLabel.padEnd(34)} ${String(counts[lastLabel]).padStart(6)} strokes  ssim=${ssimRGBA(fin, ref, w, h).toFixed(4)}`);
console.log(`TOTAL ${painter.strokes} strokes in ${((Date.now() - t0) / 1000).toFixed(1)}s  SSIM=${ssimRGBA(fin, ref, w, h).toFixed(4)}`);
writeFileSync(out, fin);
