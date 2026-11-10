/// Painting engine worker: owns the paint layer, rasterises every stroke
/// (manual and auto), keeps undo history and a stroke log for timelapse replay.

import { PAPER, StrokeEngine, type BrushParams, type Rect } from './brush';
import { AutoPainter, type AutoStroke, type Detail } from './autopaint';
import { ssimRGBA } from './imgproc';
import type { AutoState, AutoUi, DirtyPatch, FromWorker, ToWorker } from './protocol';

const ctx = self as unknown as {
  postMessage(m: FromWorker, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

interface LoggedStroke {
  params: BrushParams;
  pts: Float32Array;
  snap: boolean;
  phase: number; // 0..4 auto phases, 5 manual
  label: string;
}

interface HistoryEntry {
  rect: Rect;
  px: Float32Array;
  logArr: LoggedStroke[];
  logLen: number;
}

let eng: StrokeEngine | null = null;
let ref: Uint8ClampedArray | null = null;
/** copy of the layer as it was before the stroke in progress */
let backup = new Float32Array(0);
let log: LoggedStroke[] = [];
let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];
const MAX_HISTORY_FLOATS = 48e6;

// manual stroke in progress
let manual: { params: BrushParams; pts: number[] } | null = null;

// auto-paint
const T1X: Record<Detail, number> = { low: 12 * 60, med: 25 * 60, high: 40 * 60 }; // seconds at 1x
let auto: {
  painter: AutoPainter;
  cur: AutoStroke | null;
  idx: number;
  credit: number;
  speed: number;
  paused: boolean;
  last: number;
  total: number;
  ui: AutoUi | null;
} | null = null;
let autoState: AutoState = 'idle';
let waitingAck = false;
let tickTimer = 0;

// timelapse replay
let replay: { saved: Float32Array; cum: Float64Array; frames: number; frame: number; ri: number; ui: AutoUi | null } | null = null;

function post(m: FromWorker, transfer?: Transferable[]): void {
  ctx.postMessage(m, transfer);
}

function takePatch(): DirtyPatch | null {
  if (!eng) return null;
  const r = eng.takeDirty();
  if (!r) return null;
  const buf = eng.toRGBA8(r).buffer;
  return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0, buf };
}

function sendUpdate(needAck = false): void {
  const patch = takePatch();
  post(
    { type: 'update', patch, ui: auto ? auto.ui : null, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, strokes: log.length, needAck },
    patch ? [patch.buf] : undefined,
  );
}

function newDoc(w: number, h: number, refData: Uint8ClampedArray | null): void {
  stopAuto(false);
  replay = null;
  eng = new StrokeEngine(w, h);
  backup = new Float32Array(w * h * 4);
  ref = refData;
  log = [];
  undoStack = [];
  redoStack = [];
  manual = null;
  autoState = 'idle';
  const copy = refData ? refData.slice().buffer : null;
  post({ type: 'doc', w, h, ref: copy }, copy ? [copy] : undefined);
  post({ type: 'autoState', state: 'idle', ssim: null, strokes: 0 });
}

function copyRect(src: Float32Array, r: Rect, w: number): Float32Array {
  const rw = (r.x1 - r.x0) * 4;
  const out = new Float32Array(rw * (r.y1 - r.y0));
  for (let y = r.y0, o = 0; y < r.y1; y++, o += rw) out.set(src.subarray((y * w + r.x0) * 4, (y * w + r.x0) * 4 + rw), o);
  return out;
}

function pasteRect(dst: Float32Array, r: Rect, w: number, px: Float32Array): void {
  const rw = (r.x1 - r.x0) * 4;
  for (let y = r.y0, o = 0; y < r.y1; y++, o += rw) dst.set(px.subarray(o, o + rw), (y * w + r.x0) * 4);
}

function pushUndo(e: HistoryEntry): void {
  undoStack.push(e);
  redoStack = [];
  let total = 0;
  for (const u of undoStack) total += u.px.length;
  while (undoStack.length > 1 && (total > MAX_HISTORY_FLOATS || undoStack.length > 60)) {
    total -= (undoStack.shift() as HistoryEntry).px.length;
  }
}

function applyHistory(from: HistoryEntry[], to: HistoryEntry[]): void {
  if (!eng || autoState === 'running' || autoState === 'paused' || replay || manual) return;
  const e = from.pop();
  if (!e) return;
  to.push({ rect: e.rect, px: copyRect(eng.data, e.rect, eng.w), logArr: log, logLen: log.length });
  pasteRect(eng.data, e.rect, eng.w, e.px);
  pasteRect(backup, e.rect, eng.w, e.px);
  log = e.logArr.length === e.logLen ? e.logArr : e.logArr.slice(0, e.logLen);
  eng.markDirty(e.rect);
  if (autoState === 'done') {
    autoState = 'idle';
    post({ type: 'autoState', state: 'idle', ssim: null, strokes: log.length });
  }
  sendUpdate();
}

function drawStroke(st: LoggedStroke): void {
  const e = eng as StrokeEngine;
  e.begin(st.params);
  const p = st.pts;
  if (st.snap) for (let i = 0; i < p.length; i += 3) e.dab(p[i], p[i + 1], p[i + 2]);
  else for (let i = 0; i < p.length; i += 3) e.point(p[i], p[i + 1], p[i + 2]);
  e.end();
}

function uiFor(st: LoggedStroke, ptIndex: number, progress: number, strokes: number): AutoUi {
  const p = st.params;
  const i = Math.min(st.pts.length / 3 - 1, Math.max(0, ptIndex)) * 3;
  return {
    tool: p.tool, size: p.size, flow: p.flow, hardness: p.hardness, opacity: p.opacity, r: p.r, g: p.g, b: p.b,
    x: st.pts[i], y: st.pts[i + 1], phase: st.phase, label: st.label, progress, strokes,
  };
}

// ------------------------------------------------------------- auto-paint

function startAuto(detail: Detail, style: 'realistic' | 'painterly' | 'sketch', speed: number, seed: number): void {
  if (!eng || !ref || replay) return;
  stopAuto(false);
  if (manual) {
    eng.end();
    manual = null;
  }
  const full: Rect = { x0: 0, y0: 0, x1: eng.w, y1: eng.h };
  pushUndo({ rect: full, px: eng.data.slice(), logArr: log, logLen: log.length });
  eng.data.fill(0);
  eng.markAllDirty();
  log = [];
  auto = {
    painter: new AutoPainter(ref, eng.w, eng.h, eng.data, { detail, style, seed }),
    cur: null, idx: 0, credit: 0, speed, paused: false, last: performance.now(), total: T1X[detail], ui: null,
  };
  autoState = 'running';
  waitingAck = false;
  post({ type: 'autoState', state: 'running', ssim: null, strokes: 0 });
  tickTimer = setTimeout(tick, 0) as unknown as number;
}

function finishAuto(done: boolean): void {
  if (!eng || !auto) return;
  if (auto.cur) {
    eng.end();
    log.push({ params: auto.cur.params, pts: auto.cur.pts.slice(0, Math.max(3, auto.idx * 3)), snap: auto.cur.snap, phase: auto.cur.phase, label: auto.cur.label });
  }
  auto = null;
  backup.set(eng.data);
  autoState = done ? 'done' : 'idle';
  sendUpdate();
  const s = done && ref ? ssimRGBA(eng.compositeRGBA8(), ref, eng.w, eng.h) : null;
  post({ type: 'autoState', state: autoState, ssim: s, strokes: log.length });
}

function stopAuto(notify: boolean): void {
  clearTimeout(tickTimer);
  if (auto) {
    if (notify) finishAuto(false);
    else auto = null;
  }
}

function tick(): void {
  const a = auto;
  const e = eng;
  if (!a || !e || a.paused) return;
  const now = performance.now();
  const dt = Math.min(100, now - a.last);
  a.last = now;
  a.credit += ((dt / 1000) * a.speed) / a.total;
  // never bank more than a quarter second of work if the CPU cannot keep up
  const cap = (0.25 * a.speed) / a.total;
  if (a.credit > cap) a.credit = cap;
  const tEnd = now + 12;
  let finished = false;
  let guard = 0;
  while (a.credit > 0) {
    if ((++guard & 15) === 0 && performance.now() > tEnd) break;
    if (!a.cur) {
      const st = a.painter.next();
      if (!st) {
        finished = true;
        break;
      }
      a.cur = st;
      a.idx = 0;
      e.begin(st.params);
    }
    const st = a.cur;
    const np = st.pts.length / 3;
    const per = st.cost / np;
    const n = per > 0 ? Math.min(np - a.idx, Math.max(1, Math.floor(a.credit / per))) : np - a.idx;
    const p = st.pts;
    const end = a.idx + n;
    if (st.snap) for (let i = a.idx; i < end; i++) e.dab(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    else for (let i = a.idx; i < end; i++) e.point(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    a.idx = end;
    a.credit -= n * per;
    a.ui = uiFor(st, end - 1, a.painter.progress - st.cost * (1 - end / np), log.length + 1);
    if (end >= np) {
      e.end();
      log.push({ params: st.params, pts: st.pts, snap: st.snap, phase: st.phase, label: st.label });
      a.cur = null;
    }
  }
  if (finished) {
    finishAuto(true);
    return;
  }
  if (!waitingAck) {
    waitingAck = true;
    sendUpdate(true);
  }
  tickTimer = setTimeout(tick, 0) as unknown as number;
}

// ---------------------------------------------------------------- replay

const REPLAY_SHARE = [0.1, 0.16, 0.36, 0.08, 0.3];

function startReplay(frames: number): void {
  if (!eng || replay || !log.length || autoState === 'running' || autoState === 'paused') {
    post({ type: 'replayDone', ok: false, patch: null });
    return;
  }
  const n = log.length;
  const counts = [0, 0, 0, 0, 0, 0];
  for (const s of log) counts[s.phase]++;
  const autoCount = n - counts[5];
  const manualShare = counts[5] ? (autoCount ? 0.25 : 1) : 0;
  let shareSum = 0;
  for (let i = 0; i < 5; i++) if (counts[i]) shareSum += REPLAY_SHARE[i];
  const weight = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) if (counts[i]) weight[i] = ((REPLAY_SHARE[i] / shareSum) * (1 - manualShare)) / counts[i];
  if (counts[5]) weight[5] = manualShare / counts[5];
  const cum = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += weight[log[i].phase];
    cum[i] = acc;
  }
  replay = { saved: eng.data.slice(), cum, frames: Math.max(2, frames), frame: 0, ri: 0, ui: null };
  eng.data.fill(0);
  eng.markAllDirty();
  replayStep();
}

function replayStep(): void {
  const r = replay;
  if (!r || !eng) return;
  r.frame++;
  const n = log.length;
  const total = r.cum[n - 1];
  const target = r.frame >= r.frames ? Infinity : ((r.frame - 1) / (r.frames - 1)) * total;
  while (r.ri < n && r.cum[r.ri] <= target + 1e-12) {
    drawStroke(log[r.ri]);
    r.ri++;
  }
  if (r.ri > 0) {
    const st = log[r.ri - 1];
    r.ui = uiFor(st, st.pts.length / 3 - 1, r.frame / r.frames, r.ri);
  }
  const patch = takePatch();
  post({ type: 'replayFrame', index: r.frame, total: r.frames, patch, ui: r.ui }, patch ? [patch.buf] : undefined);
}

function endReplay(ok: boolean): void {
  if (!replay || !eng) return;
  eng.data.set(replay.saved);
  eng.markAllDirty();
  replay = null;
  const patch = takePatch();
  post({ type: 'replayDone', ok, patch }, patch ? [patch.buf] : undefined);
}

// -------------------------------------------------------------- messages

ctx.onmessage = (ev) => {
  const m = ev.data;
  switch (m.type) {
    case 'newDoc':
      newDoc(m.w, m.h, null);
      break;
    case 'loadImage': {
      const bw = m.bitmap.width;
      const bh = m.bitmap.height;
      const sc = Math.min(1, m.maxSide / Math.max(bw, bh));
      const w = Math.max(1, Math.round(bw * sc));
      const h = Math.max(1, Math.round(bh * sc));
      const oc = new OffscreenCanvas(w, h);
      const c = oc.getContext('2d') as OffscreenCanvasRenderingContext2D;
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
      c.fillRect(0, 0, w, h);
      c.drawImage(m.bitmap, 0, 0, w, h);
      m.bitmap.close();
      newDoc(w, h, c.getImageData(0, 0, w, h).data);
      break;
    }
    case 'strokeBegin':
      if (!eng || auto || replay) break;
      if (manual) eng.end();
      manual = { params: m.params, pts: [] };
      eng.begin(m.params);
      break;
    case 'strokePoints':
      if (!eng || !manual) break;
      for (let i = 0; i < m.pts.length; i += 3) {
        eng.point(m.pts[i], m.pts[i + 1], m.pts[i + 2]);
        manual.pts.push(m.pts[i], m.pts[i + 1], m.pts[i + 2]);
      }
      sendUpdate();
      break;
    case 'strokeEnd': {
      if (!eng || !manual) break;
      const rect = eng.end();
      if (rect && manual.pts.length) {
        pushUndo({ rect, px: copyRect(backup, rect, eng.w), logArr: log, logLen: log.length });
        pasteRect(backup, rect, eng.w, copyRect(eng.data, rect, eng.w));
        log.push({ params: manual.params, pts: new Float32Array(manual.pts), snap: false, phase: 5, label: 'Painting' });
      }
      manual = null;
      sendUpdate();
      break;
    }
    case 'undo':
      applyHistory(undoStack, redoStack);
      break;
    case 'redo':
      applyHistory(redoStack, undoStack);
      break;
    case 'pick': {
      if (!eng) break;
      const x = Math.floor(m.x);
      const y = Math.floor(m.y);
      if (x < 0 || y < 0 || x >= eng.w || y >= eng.h) break;
      const j = (y * eng.w + x) * 4;
      const ia = 1 - eng.data[j + 3];
      const under = m.withRef && ref ? [ref[j], ref[j + 1], ref[j + 2]] : PAPER;
      post({ type: 'picked', r: Math.round(eng.data[j] + ia * under[0]), g: Math.round(eng.data[j + 1] + ia * under[1]), b: Math.round(eng.data[j + 2] + ia * under[2]) });
      break;
    }
    case 'autoStart':
      startAuto(m.detail, m.style, m.speed, m.seed);
      break;
    case 'autoPause':
      if (auto && (autoState === 'running' || autoState === 'paused')) {
        auto.paused = m.paused;
        autoState = m.paused ? 'paused' : 'running';
        post({ type: 'autoState', state: autoState, ssim: null, strokes: log.length });
        if (!m.paused) {
          auto.last = performance.now();
          clearTimeout(tickTimer);
          tickTimer = setTimeout(tick, 0) as unknown as number;
        }
      }
      break;
    case 'autoStop':
      stopAuto(true);
      break;
    case 'setSpeed':
      if (auto) auto.speed = m.speed;
      break;
    case 'ack':
      waitingAck = false;
      break;
    case 'replayStart':
      startReplay(m.frames);
      break;
    case 'replayAck':
      if (replay) {
        if (replay.frame >= replay.frames) endReplay(true);
        else replayStep();
      }
      break;
    case 'replayCancel':
      endReplay(false);
      break;
    case 'snapshot': {
      if (!eng) break;
      const buf = eng.compositeRGBA8().buffer;
      post({ type: 'snapshot', w: eng.w, h: eng.h, buf }, [buf]);
      break;
    }
  }
};
