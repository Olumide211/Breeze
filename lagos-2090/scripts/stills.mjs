// Render one representative frame per shot (plus the title card) from a running dev/preview server.
import { chromium } from 'playwright';
import fs from 'node:fs';
const port = process.env.PORT || 5173; const out = process.argv[2] || 'stills';
fs.mkdirSync(out, { recursive: true });
const frames = process.argv[3] ? process.argv[3].split(',').map(Number) : [50, 134, 218, 302, 386, 470, 554, 640, 715];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 800)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__err); if (err) console.log('ERR', err.slice(0, 2000));
for (const f of frames) { const t = Date.now(); await page.evaluate((f) => window.__render(f), f); await page.screenshot({ path: `${out}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 }); console.log('frame', f, Date.now() - t, 'ms'); }
await browser.close();
