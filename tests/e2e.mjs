// End-to-end check with Playwright (Chromium).
//   npm run build && npx vite preview --port 4173 &   then   node tests/e2e.mjs
// Outputs screenshots, the saved painting, the reference and the timelapse to test-output/.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.env.EASEL_URL || 'http://localhost:4173/';
const PHOTO = process.env.EASEL_PHOTO || 'tests/fixtures/portrait.jpg';
const OUT = process.env.EASEL_OUT || 'test-output';
const LEN = process.env.EASEL_LEN || '30';
const RES = process.env.EASEL_RES || '1080x1080';
mkdirSync(OUT, { recursive: true });

const errors = [];
const watch = (page, tag) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${tag}] console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
};
const state = (page) => page.evaluate(() => ({ a: window.__easel.autoState, s: window.__easel.strokes, ssim: window.__easel.ssim, doc: window.__easel.docSize }));
const fps = (page, ms = 2000) =>
  page.evaluate(
    (ms) =>
      new Promise((res) => {
        let n = 0;
        let worst = 0;
        let last = performance.now();
        const t0 = last;
        const f = (t) => {
          n++;
          worst = Math.max(worst, t - last);
          last = t;
          if (t - t0 < ms) requestAnimationFrame(f);
          else res({ fps: Math.round((n * 1000) / (t - t0)), worstFrameMs: Math.round(worst) });
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
const paintedPixels = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('paint');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
const setRange = (page, id, v) =>
  page.evaluate(([id, v]) => {
    const el = document.getElementById(id);
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [id, v]);
const ONLY = process.env.EASEL_ONLY || '';
const report = {};

const browser = await chromium.launch();

// ---------------------------------------------------------------- desktop
if (ONLY !== 'mobile') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(URL);
  await page.waitForFunction(() => window.__easel && window.__easel.docSize[0] > 0);
  await page.screenshot({ path: `${OUT}/01-desktop-empty.png` });

  // manual painting with the mouse, each tool
  const vp = await page.locator('#viewport').boundingBox();
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;
  const drag = async (dy) => {
    await page.mouse.move(cx - 220, cy + dy);
    await page.mouse.down();
    for (let i = 0; i <= 20; i++) await page.mouse.move(cx - 220 + i * 22, cy + dy + Math.sin(i / 3) * 30);
    await page.mouse.up();
  };
  const tools = ['pencil', 'brush', 'airbrush'];
  for (let i = 0; i < tools.length; i++) {
    await page.click(`.tool[data-tool="${tools[i]}"]`);
    await drag(-160 + i * 90);
  }
  await page.waitForTimeout(200);
  const afterPaint = await paintedPixels(page);
  await page.click('.tool[data-tool="soften"]');
  await drag(-70);
  await page.click('.tool[data-tool="eraser"]');
  await drag(-40);
  await page.waitForTimeout(200);
  const afterErase = await paintedPixels(page);
  // eyedropper picks the brush stroke colour
  await page.click('.tool[data-tool="eyedropper"]');
  await page.mouse.click(cx - 220 + 5 * 22, cy - 70 + Math.sin(5 / 3) * 30 - 0);
  await page.waitForTimeout(100);
  const picked = await page.inputValue('#hex');
  await page.screenshot({ path: `${OUT}/02-desktop-manual.png` });
  // zoom with the wheel and pan with space-drag
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(100);
  const zoomed = await page.textContent('#zoom-label');
  await page.keyboard.press('0');
  // undo everything, redo one
  for (let i = 0; i < 5; i++) await page.click('#btn-undo');
  await page.waitForTimeout(200);
  const afterUndo = await paintedPixels(page);
  await page.click('#btn-redo');
  await page.waitForTimeout(200);
  const afterRedo = await paintedPixels(page);
  report.manual = { afterPaint, afterErase, afterUndo, afterRedo, picked, zoomed, recents: await page.locator('#recents button:not([disabled])').count() };

  // open the photo, auto-paint at High / Realistic / 50x
  await page.setInputFiles('#file', PHOTO);
  await page.waitForFunction(() => document.getElementById('hint').hidden);
  report.refHiddenByDefault = await page.evaluate(() => getComputedStyle(document.getElementById('ref')).visibility === 'hidden');
  writeFileSync(`${OUT}/reference.png`, Buffer.from((await page.evaluate(() => document.getElementById('ref').toDataURL('image/png'))).split(',')[1], 'base64'));
  await setRange(page, 's-speed', 50);
  await page.click('#seg-detail button[data-v="high"]');
  await page.click('#seg-style button[data-v="realistic"]');
  const t0 = Date.now();
  await page.click('#btn-start');
  const seen = new Set();
  let shot = 0;
  let pauseTested = false;
  const fpsSamples = [];
  for (;;) {
    const s = await state(page);
    if (s.a === 'done') break;
    const ui = await page.evaluate(() => ({
      tool: document.querySelector('.tool.on')?.dataset.tool,
      size: document.getElementById('o-size').textContent,
      hex: document.getElementById('hex').value,
      status: document.getElementById('status-text').textContent,
      cursor: document.getElementById('cursor').style.display,
      recents: document.querySelectorAll('#recents button:not([disabled])').length,
    }));
    seen.add(`${ui.tool} ${ui.size}`);
    if (shot < 6 && Date.now() - t0 > shot * 4000 + 1500) {
      await page.screenshot({ path: `${OUT}/03-desktop-auto-${++shot}.png` });
      report[`autoUi${shot}`] = ui;
      fpsSamples.push(await fps(page, 1000));
    }
    if (!pauseTested && s.s > 3000) {
      pauseTested = true;
      await page.click('#btn-pause');
      await page.waitForTimeout(300);
      const a = await state(page);
      await page.waitForTimeout(500);
      const b = await state(page);
      report.pause = { state: a.a, strokesHeld: a.s === b.s };
      await page.click('#btn-pause');
    }
    if (Date.now() - t0 > 600000) throw new Error('auto-paint timed out');
    await page.waitForTimeout(250);
  }
  const fin = await state(page);
  report.auto = { seconds: (Date.now() - t0) / 1000, strokes: fin.s, ssimInApp: fin.ssim, doc: fin.doc, toolStatesSeen: [...seen], fpsWhilePainting: fpsSamples };
  await page.screenshot({ path: `${OUT}/04-desktop-done.png` });

  // save PNG
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-save')]);
  await dl.saveAs(`${OUT}/final.png`);

  // export timelapse
  await page.click(`#seg-res button[data-v="${RES}"]`);
  await page.click(`#seg-len button[data-v="${LEN}"]`);
  const t1 = Date.now();
  const [vid] = await Promise.all([page.waitForEvent('download', { timeout: 900000 }), page.click('#btn-export')]);
  const name = vid.suggestedFilename();
  await vid.saveAs(`${OUT}/${name}`);
  report.timelapse = { file: name, seconds: (Date.now() - t1) / 1000, ...(await page.evaluate(() => window.__easel.exportResult)) };
  // the painting must be intact after the replay
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btn-save')]);
  await dl2.saveAs(`${OUT}/final-after-export.png`);
  await page.screenshot({ path: `${OUT}/05-desktop-exported.png` });
  await ctx.close();
}

// ----------------------------------------------------------------- mobile
if (ONLY !== 'desktop') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  await page.goto(URL);
  await page.waitForFunction(() => window.__easel && window.__easel.docSize[0] > 0);
  // touch stroke through CDP
  const vp = await page.locator('#viewport').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const x0 = vp.x + 60;
  const y0 = vp.y + vp.height / 2;
  await touch('touchStart', [[x0, y0]]);
  for (let i = 1; i <= 15; i++) await touch('touchMove', [[x0 + i * 18, y0 + Math.sin(i / 2) * 40]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const touchPainted = await paintedPixels(page);
  // pinch zoom
  const z0 = await page.textContent('#zoom-label');
  await touch('touchStart', [[150, y0], [240, y0]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[150 - i * 8, y0], [240 + i * 8, y0]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(150);
  const z1 = await page.textContent('#zoom-label');
  await page.screenshot({ path: `${OUT}/06-mobile-manual.png` });
  await page.click('#btn-fit');
  await page.tap('#btn-panel');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/07-mobile-panel.png` });
  await page.setInputFiles('#file', PHOTO);
  await page.waitForFunction(() => document.getElementById('hint').hidden);
  await setRange(page, 's-speed', 50);
  await page.evaluate(() => document.querySelector('#seg-detail button[data-v="med"]').click());
  await page.evaluate(() => document.getElementById('btn-start').click());
  await page.waitForTimeout(2500);
  const panelClosed = await page.evaluate(() => !document.getElementById('app').classList.contains('panel-open'));
  const f = await fps(page, 2000);
  await page.screenshot({ path: `${OUT}/08-mobile-auto.png` });
  await page.waitForFunction(() => window.__easel.autoState === 'done', null, { timeout: 600000 });
  const fin = await state(page);
  await page.screenshot({ path: `${OUT}/09-mobile-done.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  report.mobile = { touchPainted, panelClosed, pinch: `${z0} -> ${z1}`, fpsWhilePainting: f, strokes: fin.s, ssimInApp: fin.ssim, horizontalOverflow: overflow };
  await ctx.close();
}

await browser.close();
report.errors = errors;
writeFileSync(`${OUT}/report${ONLY ? '-' + ONLY : ''}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
