// Draws one timelapse frame: the whole app (tools, top bar, panels, canvas,
// cursor) rendered onto a canvas at video resolution, from the same state
// that drives the DOM. The DOM itself cannot be captured into a video frame,
// so the UI is mirrored here.

import { PAPER, type Tool } from '../engine/brush';
import { LOGO_PATH, TOOL_ICONS, TOOL_NAMES, TOOL_ORDER } from './icons';

export interface SceneState {
  tool: Tool;
  size: number;
  flow: number;
  hardness: number;
  opacity: number;
  r: number;
  g: number;
  b: number;
  /** hue 0..360, saturation and value 0..1 */
  hsv: [number, number, number];
  recents: string[];
  paint: HTMLCanvasElement;
  preview: HTMLCanvasElement;
  docW: number;
  docH: number;
  cursor: { x: number; y: number } | null;
  label: string;
  progress: number;
  strokes: number;
  watermark: string;
}

const C = {
  bg: '#101114',
  panel: '#191b20',
  raised: '#23262d',
  line: '#2c3038',
  text: '#ece9e3',
  muted: '#8d919b',
  accent: '#f2a23a',
  accentInk: '#1b1408',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const iconCache = new Map<string, Path2D>();

function icon(ctx: CanvasRenderingContext2D, d: string, x: number, y: number, size: number, color: string): void {
  let p = iconCache.get(d);
  if (!p) {
    p = new Path2D(d);
    iconCache.set(d, p);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.restore();
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, color: string, weight = 500, align: CanvasTextAlign = 'left'): void {
  ctx.font = `${weight} ${px}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function renderScene(ctx: CanvasRenderingContext2D, W: number, H: number, s: SceneState): void {
  const wide = W >= 1600;
  const top = 88;
  const left = wide ? 100 : 82;
  const side = wide ? 384 : 296;
  const statusH = 54;
  const pad = wide ? 24 : 18;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ---- top bar
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, W, top);
  ctx.fillStyle = C.line;
  ctx.fillRect(0, top - 1, W, 1);
  icon(ctx, LOGO_PATH, pad, top / 2 - 17, 34, C.accent);
  text(ctx, 'Easel', pad + 44, top / 2 - (wide ? 0 : 10), 28, C.text, 700);
  if (wide) text(ctx, 'by BreezeOg', pad + 126, top / 2 + 2, 19, C.muted, 500);
  else text(ctx, 'by BreezeOg', pad + 45, top / 2 + 17, 15, C.muted, 500);

  const sx0 = wide ? 330 : 200;
  const sx1 = W - pad;
  const gap = wide ? 34 : 18;
  const sw = (sx1 - sx0 - gap * 3) / 4;
  const sliders: [string, number, string][] = [
    ['Size', Math.log(Math.max(1, s.size)) / Math.log(300), `${s.size < 10 ? Math.round(s.size * 10) / 10 : Math.round(s.size)} px`],
    ['Flow', s.flow, `${Math.round(s.flow * 100)}%`],
    ['Hardness', s.hardness, `${Math.round(s.hardness * 100)}%`],
    ['Opacity', s.opacity, `${Math.round(s.opacity * 100)}%`],
  ];
  sliders.forEach(([name, v, val], i) => {
    const x = sx0 + i * (sw + gap);
    text(ctx, name, x, top / 2 - 15, 17, C.muted, 600);
    text(ctx, val, x + sw, top / 2 - 15, 17, C.text, 600, 'right');
    const ty = top / 2 + 13;
    ctx.fillStyle = C.raised;
    rr(ctx, x, ty - 3, sw, 6, 3);
    ctx.fill();
    const t = Math.min(1, Math.max(0, v));
    ctx.fillStyle = C.accent;
    rr(ctx, x, ty - 3, Math.max(6, sw * t), 6, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + sw * t, ty, 9, 0, Math.PI * 2);
    ctx.fillStyle = C.text;
    ctx.fill();
  });

  // ---- tools
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, top, left, H - top);
  ctx.fillStyle = C.line;
  ctx.fillRect(left - 1, top, 1, H - top);
  const tb = left - 28;
  TOOL_ORDER.forEach((t, i) => {
    const x = 14;
    const y = top + 18 + i * (tb + 26);
    const active = t === s.tool;
    ctx.fillStyle = active ? C.accent : C.raised;
    rr(ctx, x, y, tb, tb, 14);
    ctx.fill();
    const is = tb * 0.5;
    icon(ctx, TOOL_ICONS[t], x + (tb - is) / 2, y + (tb - is) / 2, is, active ? C.accentInk : C.text);
    text(ctx, TOOL_NAMES[t], x + tb / 2, y + tb + 12, 12.5, active ? C.accent : C.muted, 600, 'center');
  });

  // ---- side panel
  const px = W - side;
  ctx.fillStyle = C.panel;
  ctx.fillRect(px, top, side, H - top);
  ctx.fillStyle = C.line;
  ctx.fillRect(px, top, 1, H - top);
  const ix = px + pad;
  const iw = side - pad * 2;
  let y = top + 22;
  const heading = (t: string): void => {
    text(ctx, t.toUpperCase(), ix, y + 8, 13.5, C.muted, 700);
    y += 28;
  };

  heading('Color');
  const svH = wide ? 200 : 160;
  const hue = s.hsv[0];
  ctx.save();
  rr(ctx, ix, y, iw, svH, 10);
  ctx.clip();
  ctx.fillStyle = `hsl(${hue},100%,50%)`;
  ctx.fillRect(ix, y, iw, svH);
  let gr = ctx.createLinearGradient(ix, 0, ix + iw, 0);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(ix, y, iw, svH);
  gr = ctx.createLinearGradient(0, y, 0, y + svH);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, '#000');
  ctx.fillStyle = gr;
  ctx.fillRect(ix, y, iw, svH);
  ctx.restore();
  const mx = ix + s.hsv[1] * iw;
  const my = y + (1 - s.hsv[2]) * svH;
  ctx.beginPath();
  ctx.arc(mx, my, 9, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${s.r},${s.g},${s.b})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.arc(mx, my, 11, 0, Math.PI * 2);
  ctx.stroke();
  y += svH + 12;
  gr = ctx.createLinearGradient(ix, 0, ix + iw, 0);
  for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
  ctx.fillStyle = gr;
  rr(ctx, ix, y, iw, 14, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + (hue / 360) * iw, y + 7, 10, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${hue},100%,50%)`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  y += 28;
  ctx.fillStyle = `rgb(${s.r},${s.g},${s.b})`;
  rr(ctx, ix, y, 54, 40, 9);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.line;
  ctx.stroke();
  const hex = '#' + [s.r, s.g, s.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  ctx.fillStyle = C.raised;
  rr(ctx, ix + 66, y, iw - 66, 40, 9);
  ctx.fill();
  text(ctx, hex.toUpperCase(), ix + 82, y + 21, 18, C.text, 600);
  y += 62;

  heading('Recent colors');
  const cols = 8;
  const cg = 7;
  const cs = (iw - cg * (cols - 1)) / cols;
  for (let i = 0; i < 16; i++) {
    const cx = ix + (i % cols) * (cs + cg);
    const cy = y + Math.floor(i / cols) * (cs + cg);
    rr(ctx, cx, cy, cs, cs, 6);
    if (s.recents[i]) {
      ctx.fillStyle = s.recents[i];
      ctx.fill();
      if (i === 0) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C.text;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = C.raised;
      ctx.fill();
    }
  }
  y += cs * 2 + cg + 24;

  heading('Brush preview');
  const ph = Math.round((iw * s.preview.height) / s.preview.width);
  ctx.save();
  rr(ctx, ix, y, iw, ph, 10);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.preview, ix, y, iw, ph);
  ctx.restore();
  y += ph + 24;

  heading('Navigator');
  const navMaxH = Math.max(60, H - y - (wide ? 150 : 140));
  const nsc = Math.min(iw / s.docW, navMaxH / s.docH);
  const nw = s.docW * nsc;
  const nh = s.docH * nsc;
  const nx = ix + (iw - nw) / 2;
  ctx.fillStyle = C.bg;
  rr(ctx, ix, y, iw, nh, 8);
  ctx.fill();
  ctx.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
  ctx.fillRect(nx, y, nw, nh);
  ctx.drawImage(s.paint, nx, y, nw, nh);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.accent;
  ctx.strokeRect(nx + 1, y + 1, nw - 2, nh - 2);
  y += nh + 24;

  // auto-paint status card at the bottom of the panel
  const cardH = wide ? 100 : 96;
  const cy = H - cardH - pad;
  ctx.fillStyle = C.raised;
  rr(ctx, ix, cy, iw, cardH, 12);
  ctx.fill();
  text(ctx, 'AUTO-PAINT', ix + 16, cy + 22, 13, C.accent, 700);
  text(ctx, `${s.strokes.toLocaleString('en-US')} strokes`, ix + iw - 16, cy + 22, 14, C.muted, 600, 'right');
  ctx.save();
  rr(ctx, ix, cy, iw, cardH, 12);
  ctx.clip();
  text(ctx, s.label, ix + 16, cy + 52, wide ? 18 : 15.5, C.text, 600);
  ctx.restore();
  ctx.fillStyle = C.bg;
  rr(ctx, ix + 16, cy + cardH - 24, iw - 32, 8, 4);
  ctx.fill();
  ctx.fillStyle = C.accent;
  rr(ctx, ix + 16, cy + cardH - 24, Math.max(8, (iw - 32) * Math.min(1, s.progress)), 8, 4);
  ctx.fill();

  // ---- stage
  const ax = left;
  const ay = top;
  const aw = W - left - side;
  const ah = H - top - statusH;
  const m = wide ? 36 : 22;
  const sc = Math.min((aw - m * 2) / s.docW, (ah - m * 2) / s.docH);
  const dw = s.docW * sc;
  const dh = s.docH * sc;
  const dx = ax + (aw - dw) / 2;
  const dy = ay + (ah - dh) / 2;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(dx + 6, dy + 10, dw, dh);
  ctx.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.paint, dx, dy, dw, dh);

  if (s.cursor) {
    const cx = dx + s.cursor.x * sc;
    const cyy = dy + s.cursor.y * sc;
    const r = Math.max(5, (s.size * sc) / 2);
    ctx.beginPath();
    ctx.arc(cx, cyy, r, 0, Math.PI * 2);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.stroke();
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    // little tool badge riding with the cursor
    const bx = cx + r + 8;
    const by = cyy - r - 30;
    ctx.fillStyle = 'rgba(16,17,20,.85)';
    rr(ctx, bx, by, 30, 30, 8);
    ctx.fill();
    icon(ctx, TOOL_ICONS[s.tool], bx + 6, by + 6, 18, C.accent);
  }

  // status bar under the canvas
  ctx.fillStyle = C.panel;
  ctx.fillRect(ax, H - statusH, aw, statusH);
  ctx.fillStyle = C.line;
  ctx.fillRect(ax, H - statusH, aw, 1);
  text(ctx, s.label, ax + 22, H - statusH / 2, 17, C.text, 600);
  text(ctx, `${Math.round(Math.min(1, s.progress) * 100)}%`, ax + aw - 22, H - statusH / 2, 17, C.muted, 600, 'right');

  // watermark
  ctx.font = `600 ${wide ? 17 : 15}px ${FONT}`;
  const tw = ctx.measureText(s.watermark).width;
  const wx = ax + aw - tw - 34;
  const wy = H - statusH - 40;
  ctx.fillStyle = 'rgba(16,17,20,.62)';
  rr(ctx, wx - 12, wy - 15, tw + 24, 30, 15);
  ctx.fill();
  text(ctx, s.watermark, wx, wy + 1, wide ? 17 : 15, 'rgba(255,255,255,.88)', 600);
}
