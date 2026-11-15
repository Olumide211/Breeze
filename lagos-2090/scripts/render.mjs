// Deterministic offline render: build -> preview server -> Playwright steps every frame -> PNG -> ffmpeg (H.264, yuv420p).
// Usage: node scripts/render.mjs [--from N] [--to N] [--workers N] [--no-build] [--no-encode] [--resume]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes('--' + n);
const TOTAL = 720, FPS = 24, PORT = 4173;
const from = parseInt(arg('from', '0'), 10), to = parseInt(arg('to', String(TOTAL - 1)), 10), workers = parseInt(arg('workers', '4'), 10);
const framesDir = path.resolve('frames'); fs.mkdirSync(framesDir, { recursive: true }); fs.mkdirSync('output', { recursive: true });

if (!has('no-build')) { const b = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' }); if (b.status !== 0) process.exit(1); }
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }

const list = []; for (let f = from; f <= to; f++) list.push(f);
let done = 0; const t0 = Date.now();
// contiguous chunks keep each worker inside one or two shots (fewer shader/texture switches)
list.sort((a, b) => a - b);
const chunk = Math.ceil(list.length / workers); const chunks = []; for (let i = 0; i < workers; i++) chunks.push(list.slice(i * chunk, (i + 1) * chunk));
list.length = 0;
await Promise.all(chunks.map(async (c, id) => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log(`[w${id} pageerror]`, e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  for (const f of c) {
    const file = path.join(framesDir, `f${String(f).padStart(4, '0')}.png`);
    if (has('resume') && fs.existsSync(file)) { done++; continue; }
    for (let attempt = 0; ; attempt++) {
      try { await page.evaluate((f) => window.__render(f), f); await page.screenshot({ path: file, type: 'png', timeout: 240000 }); break; }
      catch (e) { if (attempt >= 3) throw e; console.log(`[w${id}] retry frame ${f}: ${String(e.message).split('\n')[0]}`); }
    }
    const e2 = await page.evaluate(() => window.__err); if (e2) throw new Error(e2);
    done++; if (done % 24 === 0) console.log(`${done}/${to - from + 1} frames, ${((Date.now() - t0) / done / 1000).toFixed(2)} s/frame (wall)`);
  }
  await browser.close();
}));
stop();
console.log(`rendered ${done} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

if (!has('no-encode')) {
  const missing = []; for (let f = 0; f < TOTAL; f++) if (!fs.existsSync(path.join(framesDir, `f${String(f).padStart(4, '0')}.png`))) missing.push(f);
  if (missing.length) { console.error('missing frames:', missing.slice(0, 20).join(','), '…'); process.exit(1); }
  const out = path.resolve('output/lagos-2090.mp4');
  const e = spawnSync(ffmpeg, ['-y', '-framerate', String(FPS), '-i', path.join(framesDir, 'f%04d.png'), '-frames:v', String(TOTAL), '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-b:v', '20M', '-maxrate', '26M', '-bufsize', '40M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (e.status !== 0) process.exit(1);
  console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
}
process.exit(0);
