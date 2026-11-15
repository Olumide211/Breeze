import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { modelNames, model, place } from '../assets';
import { box, ground } from '../build';
import type { Env } from '../core';
import { shot1 } from './shot1';
import { shot2 } from './shot2';
import { shot3 } from './shot3';
import { shot4 } from './shot4';
import { shot5 } from './shot5';
import { shot6 } from './shot6';
import { shot7 } from './shot7';
import { shot8 } from './shot8';
import { danfo } from '../kit';

const builders: Record<number, () => Shot> = { 1: shot1, 2: shot2, 3: shot3, 4: shot4, 5: shot5, 6: shot6, 7: shot7, 8: shot8 };

export function buildShots(only?: number[]): (Shot | null)[] {
  const out: (Shot | null)[] = [];
  for (let i = 1; i <= 8; i++) out.push((!only || only.includes(i)) && builders[i] ? builders[i]() : null);
  return out;
}

/** Debug contact sheet of pack models (not part of the film). */
export function sheetShot(page: number, dbg: HTMLElement): Shot {
  const env: Env = { hdri: 'spruit', sunAz: 60, sunEl: 50, sunCol: [1.1, 1.0, 0.9], skyCol: [0.5, 0.55, 0.7], groundCol: [0.4, 0.38, 0.36], fogCol: [0.8, 0.85, 0.9], fogSun: [1, 0.9, 0.8], fog: [0, 0, 0], zenith: 0x88aadd, horizon: 0xddeeff, hdrMix: 0, exposure: 1, paint: 0, bloom: 0, vignette: 0 };
  const cols = 8, rows = 5; const names = modelNames().sort().slice(page * cols * rows, (page + 1) * cols * rows);
  const s = stage(env, { cam: [cols * 0.75 + 3, 9, rows * 1.5 + 7], look: [cols * 0.75 - 0.8, 0, rows * 0.75 - 0.5], fov: 30, shadow: { center: [6, 0, 4], size: 12 } });
  ground(s.scene, 60, 60, { color: 0x99a0a8, noiseAmp: 0.02 });
  if (page === 99) { const d = danfo(s.scene); d.group.position.set(6, 0, 4); d.group.rotation.y = 0.5; d.update(0); s.camera.position.set(16, 3.5, 12); s.camera.lookAt(6, 1.5, 4); }
  if (page === 98) {
    const list = ['motorcycle', 'bicycle', 'butterfly', 'bird', 'shipping-container-a', 'vending-machine', 'fence-1x3', 'fence-3x3', 'display-small', 'awning-wide', 'road-bridge', 'road-side'];
    list.forEach((n, i) => { const b = model(n); const sc = 2.6 / Math.max(b.size.x, b.size.y, b.size.z); place(s.scene, n, { x: 1 + (i % 4) * 3.4, z: Math.floor(i / 4) * 3.4, s: sc, y: -b.box.min.y * sc, sway: 0 }); box(s.scene, 0.1, 0.02, 1.2, 1 + (i % 4) * 3.4, 0.01, Math.floor(i / 4) * 3.4 + 1.9, { color: 0x2244ff }); });
    s.camera.position.set(18, 7, 14); s.camera.lookAt(6, 0.8, 3.2);
    return { name: 'sheet', ...s, env, update() {} };
  }
  const labels: string[] = [];
  names.forEach((n, i) => {
    const b = model(n); const sc = 1.1 / Math.max(b.size.x, b.size.y, b.size.z);
    const x = (i % cols) * 1.5, z = Math.floor(i / cols) * 1.5;
    place(s.scene, n, { x, z, s: sc, y: -b.box.min.y * sc, sway: 0 });
    box(s.scene, 0.08, 0.02, 0.5, x, 0.01, z + 0.75, { color: 0x2244ff }); box(s.scene, 0.5, 0.02, 0.08, x + 0.75, 0.01, z, { color: 0xff2222 });
    const p = new THREE.Vector3(x, 0, z + 0.6).project(s.camera);
    labels.push(`<div style="position:absolute;left:${((p.x * 0.5 + 0.5) * 1920 - 60).toFixed(0)}px;top:${((0.5 - p.y * 0.5) * 1080).toFixed(0)}px;font:13px monospace;color:#fff;background:#0008">${n} ${b.size.x.toFixed(2)},${b.size.y.toFixed(2)},${b.size.z.toFixed(2)}</div>`);
  });
  dbg.innerHTML = labels.join('');
  return { name: 'sheet', ...s, env, update() {} };
}
