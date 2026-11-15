// Debug helper: node scripts/shot.mjs "<query>" out.png   (expects a dev/preview server on PORT, default 5173)
import { chromium } from 'playwright';
const [query, out] = process.argv.slice(2);
const port = process.env.PORT || 5173;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 1500)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/?${query}`);
await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__err);
if (err) console.log('ERR', err.slice(0, 3000));
const t1 = Date.now();
if (process.env.TIME) { const f = parseInt(process.env.TIME, 10); const a = Date.now(); for (let i = 0; i < 3; i++) await page.evaluate((f) => window.__render(f), f + i); console.log('ms/frame', (Date.now() - a) / 3); }
await page.waitForTimeout(300);
await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', quality: out.endsWith('.jpg') ? 85 : undefined });
console.log('load ms', t1 - t0, JSON.stringify(await page.evaluate(() => window.__info())));
await browser.close();
