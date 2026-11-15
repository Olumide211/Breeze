import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto(`http://localhost:5173/?sheet=9`);
await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 120000 });
for (const n of process.argv.slice(2)) { const d = await page.evaluate((n) => window.__describe(n), n); console.log(n, JSON.stringify(d.box), '\n  ' + d.colors.map((c) => c.join(' x')).join('\n  ')); }
await browser.close();
