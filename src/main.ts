import './styles.css';
import { PAPER, StrokeEngine, type BrushParams, type Tool } from './engine/brush';
import type { Detail, Style } from './engine/autopaint';
import type { AutoState, AutoUi, DirtyPatch, FromWorker, ToWorker } from './engine/protocol';
import { LOGO_PATH, svgIcon, TOOL_ICONS, TOOL_NAMES, TOOL_ORDER } from './ui/icons';
import { createRecorder, type Recorder } from './ui/recorder';
import { renderScene } from './ui/scene';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ------------------------------------------------------------------ state

interface ToolSettings {
  size: number;
  flow: number;
  hardness: number;
  opacity: number;
}

const settings: Record<Tool, ToolSettings> = {
  pencil: { size: 3, flow: 0.9, hardness: 0.9, opacity: 1 },
  brush: { size: 24, flow: 0.8, hardness: 0.7, opacity: 1 },
  airbrush: { size: 60, flow: 0.12, hardness: 0.1, opacity: 1 },
  soften: { size: 36, flow: 0.5, hardness: 0.2, opacity: 1 },
  eraser: { size: 28, flow: 1, hardness: 0.8, opacity: 1 },
  eyedropper: { size: 1, flow: 1, hardness: 1, opacity: 1 },
};
let tool: Tool = 'brush';
let color = { r: 222, g: 92, b: 52 };
let hsv = rgbToHsv(color.r, color.g, color.b);
let recents: string[] = [];
let docW = 0;
let docH = 0;
let hasRef = false;
const view = { zoom: 1, x: 0, y: 0 };
let autoFit = true;
let autoState: AutoState = 'idle';
let lastSsim: number | null = null;
/** what the auto-painter / replay is doing; overrides the displayed tool state */
let override: AutoUi | null = null;
let strokeCount = 0;
let hover: { x: number; y: number } | null = null;
let navDirty = true;
let previewKey = '';
let statusMsg = 'Ready';

interface ExportJob {
  rec: Recorder;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  paintFrames: number;
  holdFrames: number;
  cancelled: boolean;
  progress: number;
}
let exporting: ExportJob | null = null;
const exportResult: { kind: string; bytes: number; name: string } = { kind: '', bytes: 0, name: '' };

const MAX_SIDE = matchMedia('(pointer: coarse) and (max-width: 900px)').matches ? 768 : 1024;
const WATERMARK = 'Painted by Easel · BreezeOg';

// ------------------------------------------------------------------- dom

const viewport = $<HTMLDivElement>('viewport');
const docEl = $<HTMLDivElement>('doc');
const refCanvas = $<HTMLCanvasElement>('ref');
const paintCanvas = $<HTMLCanvasElement>('paint');
const pctx = paintCanvas.getContext('2d') as CanvasRenderingContext2D;
const cursorEl = $<HTMLDivElement>('cursor');
const svCanvas = $<HTMLCanvasElement>('sv');
const hueCanvas = $<HTMLCanvasElement>('hue');
const previewCanvas = $<HTMLCanvasElement>('preview');
const navCanvas = $<HTMLCanvasElement>('nav');
const hexInput = $<HTMLInputElement>('hex');
const fileInput = $<HTMLInputElement>('file');
const sliders = {
  size: $<HTMLInputElement>('s-size'),
  flow: $<HTMLInputElement>('s-flow'),
  hardness: $<HTMLInputElement>('s-hardness'),
  opacity: $<HTMLInputElement>('s-opacity'),
};

$('logo').innerHTML = svgIcon(LOGO_PATH, 22);
$('btn-undo').innerHTML = svgIcon('M3 7v6h6 M21 17a9 9 0 0 0-15-6.7L3 13', 17);
$('btn-redo').innerHTML = svgIcon('M21 7v6h-6 M3 17a9 9 0 0 1 15-6.7L21 13', 17);

const toolButtons = new Map<Tool, HTMLButtonElement>();
for (const t of TOOL_ORDER) {
  const b = document.createElement('button');
  b.className = 'tool';
  b.dataset.tool = t;
  b.title = `${TOOL_NAMES[t]} (${t === 'eyedropper' ? 'I' : t === 'soften' ? 'S' : TOOL_NAMES[t][0]})`;
  b.innerHTML = `${svgIcon(TOOL_ICONS[t], 21)}<span>${TOOL_NAMES[t]}</span>`;
  b.addEventListener('click', () => setTool(t));
  $('tools').appendChild(b);
  toolButtons.set(t, b);
}
const recentButtons: HTMLButtonElement[] = [];
for (let i = 0; i < 16; i++) {
  const b = document.createElement('button');
  b.disabled = true;
  b.setAttribute('aria-label', 'Recent color');
  b.addEventListener('click', () => {
    if (recents[i] && !isBusy()) setColorHex(recents[i]);
  });
  $('recents').appendChild(b);
  recentButtons.push(b);
}

// ---------------------------------------------------------------- worker

const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
function send(m: ToWorker, transfer?: Transferable[]): void {
  worker.postMessage(m, transfer || []);
}

worker.onmessage = (ev: MessageEvent<FromWorker>) => {
  const m = ev.data;
  switch (m.type) {
    case 'doc': {
      docW = m.w;
      docH = m.h;
      for (const c of [paintCanvas, refCanvas]) {
        c.width = m.w;
        c.height = m.h;
      }
      docEl.style.width = `${m.w}px`;
      docEl.style.height = `${m.h}px`;
      hasRef = !!m.ref;
      if (m.ref) (refCanvas.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(m.ref), m.w, m.h), 0, 0);
      $('hint').hidden = hasRef;
      strokeCount = 0;
      lastSsim = null;
      override = null;
      autoFit = true;
      fitView();
      statusMsg = hasRef ? `Photo loaded as hidden reference · ${m.w}×${m.h}` : 'Ready';
      setInfo('auto-info', hasRef ? 'Reference ready. Press <b>Start</b>.' : 'Open a photo to use auto-paint.');
      invalidate();
      break;
    }
    case 'update':
      applyPatch(m.patch);
      if (m.needAck) send({ type: 'ack' });
      if (m.ui) setOverride(m.ui);
      $<HTMLButtonElement>('btn-undo').disabled = !m.canUndo;
      $<HTMLButtonElement>('btn-redo').disabled = !m.canRedo;
      strokeCount = m.strokes;
      invalidate();
      break;
    case 'autoState':
      autoState = m.state;
      strokeCount = m.strokes;
      if (m.state === 'done' || m.state === 'idle') {
        override = null;
        if (m.state === 'done') {
          lastSsim = m.ssim;
          statusMsg = `Auto-paint finished · ${fmt(m.strokes)} strokes`;
          setInfo('auto-info', `Done · <b>${fmt(m.strokes)}</b> strokes${m.ssim !== null ? ` · SSIM <b>${m.ssim.toFixed(3)}</b> vs reference` : ''}`);
        } else if (hasRef) {
          if (m.strokes) statusMsg = 'Auto-paint stopped';
          setInfo('auto-info', 'Reference ready. Press <b>Start</b>.');
        }
      } else if (m.state === 'running') {
        setInfo('auto-info', 'Painting…');
      } else {
        setInfo('auto-info', 'Paused.');
      }
      invalidate();
      break;
    case 'picked':
      setColor(m.r, m.g, m.b);
      break;
    case 'replayFrame':
      void onReplayFrame(m.index, m.total, m.patch, m.ui);
      break;
    case 'replayDone':
      void onReplayDone(m.ok, m.patch);
      break;
    case 'snapshot': {
      const c = document.createElement('canvas');
      c.width = m.w;
      c.height = m.h;
      (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(m.buf), m.w, m.h), 0, 0);
      c.toBlob((b) => {
        if (b) download(b, 'easel-painting.png');
      }, 'image/png');
      break;
    }
  }
};

function applyPatch(p: DirtyPatch | null): void {
  if (!p) return;
  pctx.putImageData(new ImageData(new Uint8ClampedArray(p.buf), p.w, p.h), p.x, p.y);
  navDirty = true;
}

function setOverride(ui: AutoUi): void {
  override = ui;
  const top = recents[0] ? hexToRgb(recents[0]) : null;
  if (ui.tool !== 'soften' && (!top || Math.abs(top.r - ui.r) + Math.abs(top.g - ui.g) + Math.abs(top.b - ui.b) > 36)) pushRecent(rgbToHex(ui.r, ui.g, ui.b));
}

// --------------------------------------------------------------- helpers

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
function setInfo(id: string, html: string): void {
  $(id).innerHTML = html;
}
function isBusy(): boolean {
  return autoState === 'running' || autoState === 'paused' || !!exporting;
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: v >> 16, g: (v >> 8) & 255, b: v & 255 };
}
function rgbToHsv(r: number, g: number, b: number, keepHue = 0): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = keepHue;
  if (d > 0.5) {
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return { r: f(5), g: f(3), b: f(1) };
}
function download(blob: Blob, name: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
}

function setTool(t: Tool): void {
  if (isBusy()) return;
  tool = t;
  invalidate();
}
function setColor(r: number, g: number, b: number): void {
  color = { r, g, b };
  hsv = rgbToHsv(r, g, b, hsv[0]);
  invalidate();
}
function setColorHex(hex: string): void {
  const c = hexToRgb(hex);
  if (c) setColor(c.r, c.g, c.b);
}
function pushRecent(hex: string): void {
  const i = recents.indexOf(hex);
  if (i >= 0) recents.splice(i, 1);
  recents.unshift(hex);
  if (recents.length > 16) recents.length = 16;
}

/** Tool state as displayed: the auto-painter's while it works, else the user's. */
function shown(): BrushParams {
  if (override) {
    const o = override;
    return { tool: o.tool, size: o.size, flow: o.flow, hardness: o.hardness, opacity: o.opacity, r: o.r, g: o.g, b: o.b };
  }
  return { tool, ...settings[tool], ...color };
}

// ------------------------------------------------------------------ view

function applyView(): void {
  docEl.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  docEl.classList.toggle('pixel', view.zoom >= 4);
  $('zoom-label').textContent = `${Math.round(view.zoom * 100)}%`;
  navDirty = true;
  invalidate();
}
function fitView(): void {
  if (!docW) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const margin = vw < 600 ? 12 : 28;
  view.zoom = Math.max(0.02, Math.min((vw - margin * 2) / docW, (vh - margin * 2) / docH, 4));
  view.x = (vw - docW * view.zoom) / 2;
  view.y = (vh - docH * view.zoom) / 2;
  applyView();
}
function zoomAt(cx: number, cy: number, factor: number): void {
  const nz = Math.min(32, Math.max(0.05, view.zoom * factor));
  view.x = cx - ((cx - view.x) * nz) / view.zoom;
  view.y = cy - ((cy - view.y) * nz) / view.zoom;
  view.zoom = nz;
  autoFit = false;
  applyView();
}
new ResizeObserver(() => {
  if (autoFit) fitView();
  else applyView();
}).observe(viewport);

// --------------------------------------------------------------- refresh

let raf = 0;
function invalidate(): void {
  if (!raf) raf = requestAnimationFrame(refresh);
}

function setSlider(el: HTMLInputElement, v: number, out: string, text: string, disabled: boolean): void {
  if (document.activeElement !== el || disabled) el.value = String(v);
  const min = +el.min;
  const max = +el.max;
  el.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
  el.disabled = disabled;
  $(out).textContent = text;
}

function drawPicker(h: number, s: number, v: number, rgb: { r: number; g: number; b: number }): void {
  const c = svCanvas.getContext('2d') as CanvasRenderingContext2D;
  const w = svCanvas.width;
  const hh = svCanvas.height;
  c.fillStyle = `hsl(${h},100%,50%)`;
  c.fillRect(0, 0, w, hh);
  let g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, hh);
  g = c.createLinearGradient(0, 0, 0, hh);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, '#000');
  c.fillStyle = g;
  c.fillRect(0, 0, w, hh);
  const mx = Math.min(w - 7, Math.max(7, s * w));
  const my = Math.min(hh - 7, Math.max(7, (1 - v) * hh));
  c.beginPath();
  c.arc(mx, my, 6, 0, Math.PI * 2);
  c.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = '#fff';
  c.stroke();
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(0,0,0,.5)';
  c.beginPath();
  c.arc(mx, my, 7.5, 0, Math.PI * 2);
  c.stroke();

  const hc = hueCanvas.getContext('2d') as CanvasRenderingContext2D;
  const hw = hueCanvas.width;
  const hgt = hueCanvas.height;
  g = hc.createLinearGradient(0, 0, hw, 0);
  for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
  hc.fillStyle = g;
  hc.fillRect(0, 0, hw, hgt);
  const hx = Math.min(hw - 4, Math.max(4, (h / 360) * hw));
  hc.fillStyle = '#fff';
  hc.fillRect(hx - 2.5, 0, 5, hgt);
  hc.strokeStyle = 'rgba(0,0,0,.6)';
  hc.lineWidth = 1;
  hc.strokeRect(hx - 2.5, 0.5, 5, hgt - 1);
}

function renderPreview(p: BrushParams): void {
  const key = `${p.tool}|${p.size}|${p.flow}|${p.hardness}|${p.opacity}|${p.r}|${p.g}|${p.b}`;
  if (key === previewKey) return;
  previewKey = key;
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  const eng = new StrokeEngine(w, h);
  const size = Math.min(46, p.size);
  const curve = (pp: BrushParams): void => {
    eng.begin(pp);
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      eng.point(26 + t * (w - 52), h / 2 - Math.sin(t * Math.PI * 2) * (h * 0.22), 0.25 + 0.75 * Math.sin(t * Math.PI));
    }
    eng.end();
  };
  if (p.tool === 'eraser' || p.tool === 'soften') {
    // something to erase / soften
    for (let x = 0; x < w; x++) {
      const dark = p.tool === 'soften' ? Math.floor(x / 8) % 2 === 0 : true;
      for (let y = 10; y < h - 10; y++) {
        const j = (y * w + x) * 4;
        const v = dark ? 96 : 190;
        eng.data[j] = v;
        eng.data[j + 1] = v;
        eng.data[j + 2] = v + 8;
        eng.data[j + 3] = 1;
      }
    }
  }
  curve({ ...p, tool: p.tool === 'eyedropper' ? 'pencil' : p.tool, size: p.tool === 'eyedropper' ? 2 : size });
  (previewCanvas.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(eng.compositeRGBA8(), w, h), 0, 0);
}

function navLayout(): { s: number; ox: number; oy: number } {
  const s = Math.min(navCanvas.width / docW, navCanvas.height / docH);
  return { s, ox: (navCanvas.width - docW * s) / 2, oy: (navCanvas.height - docH * s) / 2 };
}
function renderNav(): void {
  if (!docW) return;
  navDirty = false;
  const c = navCanvas.getContext('2d') as CanvasRenderingContext2D;
  const { s, ox, oy } = navLayout();
  c.clearRect(0, 0, navCanvas.width, navCanvas.height);
  c.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
  c.fillRect(ox, oy, docW * s, docH * s);
  c.imageSmoothingQuality = 'high';
  if (hasRef && $<HTMLInputElement>('vis-ref').checked) {
    c.globalAlpha = +$<HTMLInputElement>('ref-opacity').value / 100;
    c.drawImage(refCanvas, ox, oy, docW * s, docH * s);
    c.globalAlpha = 1;
  }
  if ($<HTMLInputElement>('vis-paint').checked) c.drawImage(paintCanvas, ox, oy, docW * s, docH * s);
  const x0 = Math.max(0, -view.x / view.zoom);
  const y0 = Math.max(0, -view.y / view.zoom);
  const x1 = Math.min(docW, (viewport.clientWidth - view.x) / view.zoom);
  const y1 = Math.min(docH, (viewport.clientHeight - view.y) / view.zoom);
  if (x1 > x0 && y1 > y0) {
    c.lineWidth = 2;
    c.strokeStyle = '#f2a23a';
    c.strokeRect(ox + x0 * s + 1, oy + y0 * s + 1, Math.max(2, (x1 - x0) * s - 2), Math.max(2, (y1 - y0) * s - 2));
  }
}

function refresh(): void {
  raf = 0;
  const p = shown();
  const busy = isBusy();
  setSlider(sliders.size, Math.round((Math.log(Math.max(1, p.size)) / Math.log(300)) * 1000), 'o-size', `${p.size < 10 ? Math.round(p.size * 10) / 10 : Math.round(p.size)} px`, busy);
  setSlider(sliders.flow, Math.round(p.flow * 100), 'o-flow', `${Math.round(p.flow * 100)}%`, busy);
  setSlider(sliders.hardness, Math.round(p.hardness * 100), 'o-hardness', `${Math.round(p.hardness * 100)}%`, busy);
  setSlider(sliders.opacity, Math.round(p.opacity * 100), 'o-opacity', `${Math.round(p.opacity * 100)}%`, busy);
  const speed = $<HTMLInputElement>('s-speed');
  speed.style.setProperty('--p', `${((+speed.value - 1) / 49) * 100}%`);
  for (const [t, b] of toolButtons) b.classList.toggle('on', t === p.tool);

  const hs = override ? rgbToHsv(p.r, p.g, p.b, hsv[0]) : hsv;
  if (override) hsv[0] = hs[0];
  drawPicker(hs[0], hs[1], hs[2], p);
  const hex = rgbToHex(p.r, p.g, p.b);
  $('swatch').style.background = hex;
  if (document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
  recentButtons.forEach((b, i) => {
    b.style.background = recents[i] || '';
    b.disabled = !recents[i];
    b.title = recents[i] ? recents[i].toUpperCase() : '';
  });
  renderPreview(p);
  if (navDirty) renderNav();

  // cursor ring
  const cur = override ? { x: view.x + override.x * view.zoom, y: view.y + override.y * view.zoom } : hover;
  if (cur && (override || tool !== 'eyedropper')) {
    const d = Math.max(6, p.size * view.zoom);
    cursorEl.style.display = 'block';
    cursorEl.style.width = cursorEl.style.height = `${d}px`;
    cursorEl.style.transform = `translate(${cur.x - d / 2}px, ${cur.y - d / 2}px)`;
  } else cursorEl.style.display = 'none';
  viewport.classList.toggle('busy', busy);

  // status + buttons
  let label = statusMsg;
  let prog = 0;
  if (exporting) {
    label = `Exporting timelapse · ${override ? override.label : 'encoding'}`;
    prog = exporting.progress;
  } else if (override) {
    label = override.label;
    prog = override.progress;
  } else if (autoState === 'done') prog = 1;
  $('status-text').textContent = label;
  $('status-bar').style.width = `${Math.min(100, prog * 100)}%`;
  const nStrokes = override ? override.strokes : strokeCount;
  $('status-right').textContent = `${fmt(nStrokes)} stroke${nStrokes === 1 ? '' : 's'}${docW ? ` · ${docW}×${docH}` : ''}`;

  const running = autoState === 'running' || autoState === 'paused';
  $<HTMLButtonElement>('btn-start').disabled = !hasRef || running || !!exporting;
  $<HTMLButtonElement>('btn-start').textContent = autoState === 'done' ? 'Repaint' : 'Start';
  $<HTMLButtonElement>('btn-pause').disabled = !running;
  $<HTMLButtonElement>('btn-pause').textContent = autoState === 'paused' ? 'Resume' : 'Pause';
  $<HTMLButtonElement>('btn-stop').disabled = !running;
  $<HTMLButtonElement>('btn-export').disabled = busy || strokeCount === 0;
  $<HTMLButtonElement>('btn-export-cancel').hidden = !exporting;
  $<HTMLButtonElement>('btn-save').disabled = !docW || !!exporting;
  if (!exporting && !exportResult.name) setInfo('tl-info', strokeCount ? 'Replays every stroke into a video of the whole app.' : 'Paint something (or run auto-paint) first.');
}

// ------------------------------------------------------------- top bar ui

function bindSlider(el: HTMLInputElement, key: keyof ToolSettings): void {
  el.addEventListener('input', () => {
    if (isBusy()) return;
    const v = +el.value;
    settings[tool][key] = key === 'size' ? Math.max(1, Math.round(Math.pow(300, v / 1000))) : v / 100;
    invalidate();
  });
}
bindSlider(sliders.size, 'size');
bindSlider(sliders.flow, 'flow');
bindSlider(sliders.hardness, 'hardness');
bindSlider(sliders.opacity, 'opacity');

$('btn-open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files && fileInput.files[0];
  if (f) void openImage(f);
  fileInput.value = '';
});
$('btn-save').addEventListener('click', () => send({ type: 'snapshot' }));
$('btn-undo').addEventListener('click', () => send({ type: 'undo' }));
$('btn-redo').addEventListener('click', () => send({ type: 'redo' }));
$('btn-zoom-in').addEventListener('click', () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.25));
$('btn-zoom-out').addEventListener('click', () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 0.8));
$('btn-fit').addEventListener('click', () => {
  autoFit = true;
  fitView();
});
$('btn-panel').addEventListener('click', () => $('app').classList.toggle('panel-open'));
viewport.addEventListener('pointerdown', () => $('app').classList.remove('panel-open'), true);

async function openImage(file: Blob): Promise<void> {
  if (exporting) return;
  try {
    const bitmap = await createImageBitmap(file);
    send({ type: 'loadImage', bitmap, maxSide: MAX_SIDE }, [bitmap]);
    exportResult.name = '';
    $('tl-link').hidden = true;
  } catch {
    statusMsg = 'Could not read that file as an image.';
    invalidate();
  }
}

// drag & drop
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  viewport.classList.add('dragging');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    viewport.classList.remove('dragging');
  }
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  viewport.classList.remove('dragging');
  const f = e.dataTransfer && Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'));
  if (f) void openImage(f);
});

// ----------------------------------------------------------- color picker

function dragOn(el: HTMLElement, fn: (fx: number, fy: number) => void): void {
  const handle = (e: PointerEvent): void => {
    const r = el.getBoundingClientRect();
    fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  el.addEventListener('pointerdown', (e) => {
    if (isBusy()) return;
    el.setPointerCapture(e.pointerId);
    handle(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (el.hasPointerCapture(e.pointerId) && !isBusy()) handle(e);
  });
}
dragOn(svCanvas, (fx, fy) => {
  hsv = [hsv[0], fx, 1 - fy];
  color = hsvToRgb(hsv[0], hsv[1], hsv[2]);
  invalidate();
});
dragOn(hueCanvas, (fx) => {
  hsv = [Math.min(359.9, fx * 360), hsv[1], hsv[2]];
  color = hsvToRgb(hsv[0], hsv[1], hsv[2]);
  invalidate();
});
hexInput.addEventListener('change', () => {
  if (!isBusy()) setColorHex(hexInput.value);
  hexInput.blur();
});

// navigator: click / drag to move the view
dragOn(navCanvas, (fx, fy) => {
  const { s, ox, oy } = navLayout();
  const dx = (fx * navCanvas.width - ox) / s;
  const dy = (fy * navCanvas.height - oy) / s;
  view.x = viewport.clientWidth / 2 - dx * view.zoom;
  view.y = viewport.clientHeight / 2 - dy * view.zoom;
  autoFit = false;
  applyView();
});

// layers
function applyLayers(): void {
  paintCanvas.style.visibility = $<HTMLInputElement>('vis-paint').checked ? 'visible' : 'hidden';
  refCanvas.style.visibility = $<HTMLInputElement>('vis-ref').checked ? 'visible' : 'hidden';
  refCanvas.style.opacity = String(+$<HTMLInputElement>('ref-opacity').value / 100);
  const ro = $<HTMLInputElement>('ref-opacity');
  ro.style.setProperty('--p', `${((+ro.value - 10) / 90) * 100}%`);
  navDirty = true;
  invalidate();
}
for (const id of ['vis-paint', 'vis-ref', 'ref-opacity']) $(id).addEventListener('input', applyLayers);

// segmented controls
const segValue: Record<string, string> = {};
for (const seg of Array.from(document.querySelectorAll<HTMLElement>('.seg'))) {
  const buttons = Array.from(seg.querySelectorAll<HTMLButtonElement>('button'));
  segValue[seg.id] = (buttons.find((b) => b.classList.contains('on')) || buttons[0]).dataset.v as string;
  for (const b of buttons) {
    b.addEventListener('click', () => {
      if (isBusy()) return;
      buttons.forEach((x) => x.classList.toggle('on', x === b));
      segValue[seg.id] = b.dataset.v as string;
    });
  }
}

// ------------------------------------------------------------- auto-paint

const speedEl = $<HTMLInputElement>('s-speed');
speedEl.addEventListener('input', () => {
  $('o-speed').textContent = `${speedEl.value}x`;
  send({ type: 'setSpeed', speed: +speedEl.value });
  invalidate();
});
$('btn-start').addEventListener('click', () => {
  if (!hasRef || isBusy()) return;
  recents = [];
  exportResult.name = '';
  $('tl-link').hidden = true;
  $('app').classList.remove('panel-open');
  send({ type: 'autoStart', detail: segValue['seg-detail'] as Detail, style: segValue['seg-style'] as Style, speed: +speedEl.value, seed: 7 });
});
$('btn-pause').addEventListener('click', () => send({ type: 'autoPause', paused: autoState === 'running' }));
$('btn-stop').addEventListener('click', () => send({ type: 'autoStop' }));

// -------------------------------------------------------------- timelapse

function sceneState(cursor: { x: number; y: number } | null, label: string, progress: number, strokes: number) {
  const p = shown();
  renderPreview(p);
  return {
    ...p,
    hsv: rgbToHsv(p.r, p.g, p.b, hsv[0]),
    recents,
    paint: paintCanvas,
    preview: previewCanvas,
    docW,
    docH,
    cursor,
    label,
    progress,
    strokes,
    watermark: WATERMARK,
  };
}

async function startExport(): Promise<void> {
  if (isBusy() || !strokeCount) return;
  const [w, h] = segValue['seg-res'].split('x').map(Number);
  const seconds = +segValue['seg-len'];
  const fps = 30;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
  ctx.fillStyle = '#101114';
  ctx.fillRect(0, 0, w, h);
  setInfo('tl-info', 'Preparing encoder…');
  $('tl-link').hidden = true;
  $<HTMLButtonElement>('btn-export').disabled = true;
  let rec: Recorder;
  try {
    rec = await createRecorder(canvas, w, h, fps);
  } catch (e) {
    setInfo('tl-info', (e as Error).message);
    invalidate();
    return;
  }
  const holdFrames = 2 * fps;
  exporting = { rec, canvas, ctx, w, h, paintFrames: seconds * fps - holdFrames, holdFrames, cancelled: false, progress: 0 };
  exportResult.name = '';
  recents = [];
  setInfo('tl-info', `Encoding ${rec.kind}…`);
  send({ type: 'replayStart', frames: exporting.paintFrames });
  invalidate();
}

async function onReplayFrame(index: number, total: number, patch: DirtyPatch | null, ui: AutoUi | null): Promise<void> {
  const job = exporting;
  applyPatch(patch);
  if (!job) return;
  if (ui) setOverride(ui);
  const frames = job.paintFrames + job.holdFrames;
  job.progress = index / frames;
  renderScene(job.ctx, job.w, job.h, sceneState(ui ? { x: ui.x, y: ui.y } : null, ui ? ui.label : 'Blank canvas', (index - 1) / Math.max(1, total - 1), ui ? ui.strokes : 0));
  try {
    await job.rec.addFrame(index - 1);
  } catch (e) {
    failExport(e as Error);
    return;
  }
  if (job.cancelled || exporting !== job) return;
  setInfo('tl-info', `Encoding ${job.rec.kind}… <b>${Math.round(job.progress * 100)}%</b>`);
  invalidate();
  send({ type: 'replayAck' });
}

async function onReplayDone(ok: boolean, patch: DirtyPatch | null): Promise<void> {
  applyPatch(patch);
  override = null;
  const job = exporting;
  if (!job) {
    invalidate();
    return;
  }
  if (!ok || job.cancelled) {
    job.rec.abort();
    exporting = null;
    setInfo('tl-info', ok ? 'Export cancelled.' : 'Nothing to export yet.');
    invalidate();
    return;
  }
  try {
    const frames = job.paintFrames + job.holdFrames;
    const st = sceneState(null, `Finished · ${fmt(strokeCount)} strokes`, 1, strokeCount);
    renderScene(job.ctx, job.w, job.h, st);
    for (let i = 0; i < job.holdFrames; i++) {
      await job.rec.addFrame(job.paintFrames + i);
      if (job.cancelled) throw new Error('cancelled');
      if (i % 10 === 0) {
        job.progress = (job.paintFrames + i) / frames;
        setInfo('tl-info', `Encoding ${job.rec.kind}… <b>${Math.round(job.progress * 100)}%</b>`);
        invalidate();
      }
    }
    const blob = await job.rec.finish();
    const name = `easel-timelapse-${job.w}x${job.h}-${frames / 30}s.${job.rec.ext}`;
    const url = download(blob, name);
    const link = $<HTMLAnchorElement>('tl-link');
    link.href = url;
    link.download = name;
    link.hidden = false;
    exportResult.kind = job.rec.kind;
    exportResult.bytes = blob.size;
    exportResult.name = name;
    setInfo('tl-info', `Saved <b>${name}</b> · ${(blob.size / 1e6).toFixed(1)} MB · ${job.rec.kind}`);
    statusMsg = 'Timelapse exported';
  } catch (e) {
    job.rec.abort();
    setInfo('tl-info', (e as Error).message === 'cancelled' ? 'Export cancelled.' : `Export failed: ${(e as Error).message}`);
  }
  exporting = null;
  invalidate();
}

function failExport(e: Error): void {
  const job = exporting;
  if (!job) return;
  job.cancelled = true;
  setInfo('tl-info', `Export failed: ${e.message}`);
  send({ type: 'replayCancel' });
}

$('btn-export').addEventListener('click', () => void startExport());
$('btn-export-cancel').addEventListener('click', () => {
  if (exporting) {
    exporting.cancelled = true;
    send({ type: 'replayCancel' });
  }
});

// ---------------------------------------------------------------- pointer

const pointers = new Map<number, { x: number; y: number }>();
let mode: 'none' | 'draw' | 'pan' | 'pinch' | 'pick' = 'none';
let vpRect = viewport.getBoundingClientRect();
let panStart = { x: 0, y: 0, vx: 0, vy: 0 };
let pinchStart = { d: 1, zoom: 1, mx: 0, my: 0, vx: 0, vy: 0 };
let spaceDown = false;
let strokeStartTime = 0;
let strokePts = 0;

function toDoc(e: { clientX: number; clientY: number }): { x: number; y: number } {
  return { x: (e.clientX - vpRect.left - view.x) / view.zoom, y: (e.clientY - vpRect.top - view.y) / view.zoom };
}
function pressureOf(e: PointerEvent): number {
  return e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 1;
}
function sendPoints(e: PointerEvent): void {
  const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs : [e];
  const pts = new Float32Array(list.length * 3);
  list.forEach((ev, i) => {
    const d = toDoc(ev);
    pts[i * 3] = d.x;
    pts[i * 3 + 1] = d.y;
    pts[i * 3 + 2] = pressureOf(ev);
  });
  strokePts += list.length;
  send({ type: 'strokePoints', pts }, [pts.buffer]);
}
function endStroke(): void {
  if (mode === 'draw') send({ type: 'strokeEnd' });
  mode = 'none';
}

viewport.addEventListener('pointerdown', (e) => {
  vpRect = viewport.getBoundingClientRect();
  try {
    viewport.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic events have no active pointer */
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    // second finger: this is a pinch, not a stroke
    if (mode === 'draw') {
      const accidental = performance.now() - strokeStartTime < 250 && strokePts < 12;
      endStroke();
      if (accidental) send({ type: 'undo' });
    }
    const [a, b] = Array.from(pointers.values());
    pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom, mx: (a.x + b.x) / 2 - vpRect.left, my: (a.y + b.y) / 2 - vpRect.top, vx: view.x, vy: view.y };
    mode = 'pinch';
    return;
  }
  if (pointers.size > 2) return;
  if (e.button === 1 || e.button === 2 || spaceDown || isBusy()) {
    mode = 'pan';
    panStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    viewport.classList.add('pan');
    return;
  }
  if (tool === 'eyedropper') {
    mode = 'pick';
    const d = toDoc(e);
    send({ type: 'pick', x: d.x, y: d.y, withRef: $<HTMLInputElement>('vis-ref').checked });
    return;
  }
  mode = 'draw';
  strokeStartTime = performance.now();
  strokePts = 0;
  const p = shown();
  if (tool === 'pencil' || tool === 'brush' || tool === 'airbrush') pushRecent(rgbToHex(p.r, p.g, p.b));
  send({ type: 'strokeBegin', params: p });
  sendPoints(e);
  invalidate();
});

viewport.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') {
    hover = { x: e.clientX - vpRect.left, y: e.clientY - vpRect.top };
    invalidate();
  }
  if (!pointers.has(e.pointerId)) {
    vpRect = viewport.getBoundingClientRect();
    return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (mode === 'draw') sendPoints(e);
  else if (mode === 'pick') {
    const d = toDoc(e);
    send({ type: 'pick', x: d.x, y: d.y, withRef: $<HTMLInputElement>('vis-ref').checked });
  } else if (mode === 'pan') {
    view.x = panStart.vx + e.clientX - panStart.x;
    view.y = panStart.vy + e.clientY - panStart.y;
    autoFit = false;
    applyView();
  } else if (mode === 'pinch' && pointers.size >= 2) {
    const [a, b] = Array.from(pointers.values());
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2 - vpRect.left;
    const my = (a.y + b.y) / 2 - vpRect.top;
    const nz = Math.min(32, Math.max(0.05, (pinchStart.zoom * d) / pinchStart.d));
    view.x = mx - ((pinchStart.mx - pinchStart.vx) * nz) / pinchStart.zoom;
    view.y = my - ((pinchStart.my - pinchStart.vy) * nz) / pinchStart.zoom;
    view.zoom = nz;
    autoFit = false;
    applyView();
  }
});

function pointerEnd(e: PointerEvent): void {
  if (!pointers.delete(e.pointerId)) return;
  if (mode === 'draw') endStroke();
  else if (mode === 'pinch') {
    if (pointers.size < 2) mode = 'none';
  } else mode = 'none';
  viewport.classList.remove('pan');
}
viewport.addEventListener('pointerup', pointerEnd);
viewport.addEventListener('pointercancel', pointerEnd);
viewport.addEventListener('pointerleave', () => {
  hover = null;
  invalidate();
});
viewport.addEventListener('contextmenu', (e) => e.preventDefault());
viewport.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    vpRect = viewport.getBoundingClientRect();
    zoomAt(e.clientX - vpRect.left, e.clientY - vpRect.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  },
  { passive: false },
);

// --------------------------------------------------------------- keyboard

const KEY_TOOLS: Record<string, Tool> = { p: 'pencil', b: 'brush', a: 'airbrush', s: 'soften', e: 'eraser', i: 'eyedropper' };
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLInputElement && t.type === 'text') return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) {
    if (k === 'z') {
      e.preventDefault();
      send({ type: e.shiftKey ? 'redo' : 'undo' });
    } else if (k === 'y') {
      e.preventDefault();
      send({ type: 'redo' });
    } else if (k === 's') {
      e.preventDefault();
      send({ type: 'snapshot' });
    }
    return;
  }
  if (k === ' ') {
    spaceDown = true;
    viewport.classList.add('pan');
    e.preventDefault();
  } else if (KEY_TOOLS[k]) setTool(KEY_TOOLS[k]);
  else if (k === 'o') fileInput.click();
  else if (k === '0') {
    autoFit = true;
    fitView();
  } else if (k === '=' || k === '+') zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.25);
  else if (k === '-') zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 0.8);
  else if ((k === '[' || k === ']') && !isBusy()) {
    const s = settings[tool];
    s.size = Math.min(300, Math.max(1, Math.round(s.size * (k === ']' ? 1.15 : 1 / 1.15) + (k === ']' ? 0.5 : -0.5))));
    invalidate();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    spaceDown = false;
    if (mode !== 'pan') viewport.classList.remove('pan');
  }
});

// ------------------------------------------------------------------ boot

// Small read-only handle for automated tests.
(window as unknown as { __easel: unknown }).__easel = {
  get autoState() {
    return autoState;
  },
  get ssim() {
    return lastSsim;
  },
  get strokes() {
    return strokeCount;
  },
  get exporting() {
    return !!exporting;
  },
  get exportProgress() {
    return exporting ? exporting.progress : 0;
  },
  get exportResult() {
    return { ...exportResult };
  },
  get docSize() {
    return [docW, docH];
  },
};

applyLayers();
const portrait = window.innerHeight > window.innerWidth;
send({ type: 'newDoc', w: portrait ? 768 : 1024, h: portrait ? 1024 : 768 });
invalidate();
