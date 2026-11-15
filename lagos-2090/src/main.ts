import * as THREE from 'three';
import { W, H, FPS, TOTAL_FRAMES, G, applyEnv, makeNoiseTexture, smooth } from './core';
import { loadAll, describe } from './assets';
import { Post } from './post';
import type { Shot } from './shots/common';
import { buildShots, sheetShot } from './shots';

declare global { interface Window { __ready: boolean; __render: (f: number) => Promise<void>; __total: number; __err?: string; __info: () => any } }

const SHOT_LEN = [84, 84, 84, 84, 84, 84, 84, 132];
const STARTS = SHOT_LEN.map((_, i) => SHOT_LEN.slice(0, i).reduce((a, b) => a + b, 0));

const canvas = document.getElementById('c') as HTMLCanvasElement;
const dbg = document.getElementById('dbg')!;
const credit = document.getElementById('credit')!; const card = document.getElementById('card')!;
const q = new URLSearchParams(location.search);

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.NoToneMapping; renderer.autoClear = false;
  renderer.debug.onShaderError = (gl, prog, vs, fs) => {
    const msg = 'SHADER ERROR\n' + gl.getProgramInfoLog(prog) + '\nVS: ' + gl.getShaderInfoLog(vs) + '\nFS: ' + gl.getShaderInfoLog(fs);
    window.__err = msg; console.error(msg);
  };
  G.uNoise.value = makeNoiseTexture();
  await Promise.all([loadAll((s) => (dbg.textContent = 'loading ' + s)), (document as any).fonts.load('300 40px Montserrat')]);
  dbg.textContent = '';
  const post = new Post(renderer, G.uNoise.value!);
  const only = q.get('shot') ? [parseInt(q.get('shot')!, 10)] : undefined;
  const sheet = q.get('sheet');
  const shots: (Shot | null)[] = sheet !== null ? [] : buildShots(only);
  const sheetS = sheet !== null ? sheetShot(parseInt(sheet, 10), dbg) : null;
  const sun = new THREE.Vector3(), sun2 = new THREE.Vector2();

  function draw(frame: number) {
    let si = SHOT_LEN.length - 1; for (let i = 0; i < STARTS.length; i++) if (frame >= STARTS[i]) si = i;
    const lf = frame - STARTS[si]; const t = lf / FPS;
    const shot = sheetS ?? shots[si];
    if (!shot) throw new Error('shot not built: ' + (si + 1));
    applyEnv(shot.env); G.uTime.value = t + si * 10;
    shot.update(t, lf);
    shot.camera.updateMatrixWorld();
    sun.copy(shot.camera.position).addScaledVector(G.uSunDir.value, 1000).project(shot.camera);
    const behind = new THREE.Vector3().copy(G.uSunDir.value).dot(shot.camera.getWorldDirection(new THREE.Vector3())) < 0.05;
    sun2.set(sun.x * 0.5 + 0.5, sun.y * 0.5 + 0.5);
    let cardK = 0, cardText = 0, cred = 0;
    if (si === 7) { cardK = smooth(82, 104, lf); cardText = smooth(100, 120, lf); }
    if (shot.title) cred = smooth(12, 30, lf) * (1 - smooth(72, 82, lf));
    post.render(shot.scene, shot.camera, shot.env, { fade: 0, card: cardK, sun: sun2, sunVis: behind ? 0 : (shot.sunVis?.(t) ?? 1), frame, time: t + si * 10, hasFg: !!shot.fg }, shot.light);
    if (shot.title) { (credit.querySelector('.role') as HTMLElement).textContent = shot.title[0]; (credit.querySelector('.name') as HTMLElement).textContent = shot.title[1]; }
    credit.style.opacity = cred.toFixed(4);
    card.style.opacity = cardText.toFixed(4);
    (card.querySelector('.big') as HTMLElement).style.transform = `translateY(${((1 - cardText) * 14).toFixed(2)}px)`;
  }

  (window as any).__describe = describe;
  window.__total = TOTAL_FRAMES;
  window.__info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length });
  window.__render = async (f: number) => {
    draw(f);
    renderer.getContext().finish();
    await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
  };
  if (q.get('f') !== null) draw(parseInt(q.get('f')!, 10));
  else if (only) draw(STARTS[only[0] - 1] + parseInt(q.get('lf') ?? '40', 10));
  else if (sheetS) draw(0);
  else if (q.get('play') !== null) {
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); (document.getElementById('stage') as HTMLElement).style.transform = `scale(${s})`; };
    fit(); addEventListener('resize', fit);
    const t0 = performance.now(); const loop = () => { draw(Math.floor(((performance.now() - t0) / 1000) * FPS) % TOTAL_FRAMES); requestAnimationFrame(loop); }; loop();
  }
  window.__ready = true;
}
boot().catch((e) => { window.__err = String(e?.stack ?? e); console.error(e); });
