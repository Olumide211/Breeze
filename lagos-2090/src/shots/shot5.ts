// Shot 5 — Third Mainland Bridge wrapped in greenery over the lagoon at sunset; small boats drift, water ripples.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, glow, type Env } from '../core';
import { place, textures } from '../assets';
import { box, blob, hedgePts, vines, water } from '../build';
import { skyline, tree } from '../kit';
import { makeClouds } from '../sky';

export function shot5(): Shot {
  const env: Env = {
    hdri: 'fire', sunAz: -101, sunEl: 5.0, sunCol: [1.6, 0.85, 0.4], skyCol: [0.27, 0.27, 0.56], groundCol: [0.40, 0.24, 0.26],
    fogCol: [0.82, 0.46, 0.44], fogSun: [1.25, 0.7, 0.36], fog: [0.0013, 0.0, 0.86], zenith: 0x2c4b9c, horizon: 0xff9e5c, hdrMix: 0.78, exposure: 0.6,
    flare: 0.6, flareCol: 0xffb070, leak: 0.25, bloom: 0.7, sat: 1.25, contrast: 0.5, fogStart: 30,
  };
  const s = stage(env, { cam: [-13, 2.4, 50], look: [-15, 11.5, -40], fov: 42, shadow: { center: [-10, 0, -20], size: 90, depth: 500, res: 4096 }, far: 6000 });
  const sc = s.scene; const r = mulberry32(505);

  water(sc, 6000, { deep: 0x163a78, shallow: 0x2f74a8, sky: 0xff9c78, scale: 1, glitter: 1.0, lines: 1.0 });

  // the bridge: a long gentle S-curve of spans marching to the horizon
  const path = (u: number) => new THREE.Vector3(27 - u * 0.33 + Math.sin(u * 0.006) * 18 - 0.00012 * u * u, 0, 44 - u);
  const DY = 9.5; const SPAN = 24; const conc = { color: 0xd9c4b4, map: textures.concrete, mapScale: 0.08, noiseScale: 0.04, noiseAmp: 0.25, grad: [0, 9] as [number, number], gradCol: 0x9a7f92 };
  const hedgeL: number[][] = [], hedgeR: number[][] = [];
  const lampGlows: THREE.Sprite[] = [];
  for (let i = 0; i < 46; i++) {
    const a = path(i * SPAN), b = path((i + 1) * SPAN); const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a); const len = dir.length(); const ry = Math.atan2(dir.x, dir.z); dir.normalize(); const nrm = new THREE.Vector3(dir.z, 0, -dir.x);
    box(sc, 15, 1.5, len + 0.6, mid.x, DY + 0.75, mid.z, { ...conc, ry });
    box(sc, 12, 0.9, len + 0.6, mid.x, DY - 0.4, mid.z, { ...conc, color: 0xc2ada4, ry });
    for (const sgn of [-1, 1]) box(sc, 0.4, 1.1, len + 0.6, mid.x + nrm.x * 7.4 * sgn, DY + 2.0, mid.z + nrm.z * 7.4 * sgn, { ...conc, ry });
    // pier: cap beam + pack pillars
    box(sc, 13, 1.3, 2.4, a.x, DY - 1.4, a.z, { ...conc, color: 0xc9b4a8, ry });
    for (const sgn of [-1, 1]) place(sc, 'bridge-pillar-wide', { x: a.x + nrm.x * 4.2 * sgn, y: -1, z: a.z + nrm.z * 4.2 * sgn, h: DY - 0.9, ry, ...conc, mapScale: 0.15 });
    const n = i < 14 ? 7 : i < 26 ? 4 : 2;
    for (let k = 0; k < n; k++) for (const sgn of [-1, 1]) {
      const t = (k + r()) / n; const p = a.clone().lerp(b, t);
      (sgn < 0 ? hedgeL : hedgeR).push([p.x + nrm.x * (7.5 + rr(r, -0.3, 0.5)) * sgn, DY + 2.5 + rr(r, -0.3, 0.6), p.z + nrm.z * (7.5 + rr(r, -0.3, 0.5)) * sgn, rr(r, 1.0, 1.9) * (i < 14 ? 1 : 1.5)]);
      if (i < 12 && r() < 0.6) (sgn < 0 ? hedgeL : hedgeR).push([p.x + nrm.x * 7.9 * sgn, DY + rr(r, 0.2, 1.4), p.z + nrm.z * 7.9 * sgn, rr(r, 0.7, 1.3)]);
    }
    if (i < 11) for (const sgn of [-1, 1]) vines(sc, 500 + i * 2 + sgn, { x: mid.x + nrm.x * 7.75 * sgn, y: DY + 2.3, z: mid.z + nrm.z * 7.75 * sgn, ry: ry + Math.PI / 2, width: len, count: Math.round(34 - i * 2), len: [1.5, 6.5 - i * 0.2], depth: 0.5, amp: 0.5, dir: [nrm.x * sgn, 0, nrm.z * sgn] });
    if (i < 9) { // creeper down the pier
      const pts: number[][] = []; for (let k = 0; k < 16; k++) { const ang = k * 1.1 + i; pts.push([a.x + nrm.x * 4.2 * (i % 2 ? 1 : -1) + Math.cos(ang) * 1.2, 0.4 + k * 0.5, a.z + nrm.z * 4.2 * (i % 2 ? 1 : -1) + Math.sin(ang) * 1.2, rr(r, 0.5, 0.9)]); }
      blob(sc, 520 + i, pts, { swayAmp: 0.04 });
    }
    if (i < 22 && i % 2 === 0) tree(sc, 540 + i, mid.x + nrm.x * rr(r, -5, 5), mid.z + nrm.z * rr(r, -5, 5), rr(r, 5, 8), 1.1, { y: DY + 1.4, amp: 0.08 });
    if (i < 30) {
      place(sc, 'street-light-curved-double', { x: a.x, y: DY + 1.5, z: a.z, h: 8, ry, color: 0xa8a0b8, cast: i < 8 });
      for (const sgn of [-1, 1]) { const g = glow(0xffd9a0, i < 10 ? 3.2 : 5, 1.5); g.position.set(a.x + nrm.x * 2.3 * sgn, DY + 9.3, a.z + nrm.z * 2.3 * sgn); sc.add(g); lampGlows.push(g); }
    }
  }
  blob(sc, 51, hedgeL, { swayAmp: 0.07, noiseScale: 0.3 }); blob(sc, 52, hedgeR, { swayAmp: 0.07, noiseScale: 0.3 });
  // wind turbines along the deck, far out
  for (let i = 0; i < 6; i++) { const p = path(300 + i * 130); place(sc, 'windmill', { x: p.x + 16, y: 0, z: p.z, h: 42 + i * 3, color: 0xfff0e2, cast: false }); }

  // mangrove islets, far shore, skyline
  for (let k = 0; k < 7; k++) {
    const cx = [-75, 40, -120, 95, -30, 150, -190][k], cz = [-40, -90, -150, -200, -260, -120, -300][k]; const pts: number[][] = [];
    for (let i = 0; i < 14; i++) pts.push([cx + rr(r, -14, 14), rr(r, 0.5, 2.5), cz + rr(r, -6, 6), rr(r, 2.5, 5)]);
    blob(sc, 560 + k, pts, { swayAmp: 0.08, noiseScale: 0.2 });
    for (let i = 0; i < 3; i++) place(sc, pick(r, ['palm-tall', 'palm-bend', 'palm-detailed-tall']), { x: cx + rr(r, -8, 8), y: 1.5, z: cz + rr(r, -3, 3), h: rr(r, 9, 14), ry: r() * 6 });
  }
  const shore: number[][] = []; for (let i = 0; i < 70; i++) shore.push([-900 + i * 26 + rr(r, -8, 8), rr(r, 0, 5), -900 + rr(r, -30, 30), rr(r, 9, 18)]);
  blob(sc, 58, shore, { swayAmp: 0, noiseScale: 0.05 }).castShadow = false;
  skyline(sc, 53, { x0: -900, x1: 700, z: -960, depth: 160, count: 50, s: [22, 46], green: 0.4, turbines: 0.15 });
  skyline(sc, 54, { x0: -1300, x1: 1100, z: -1300, depth: 260, count: 44, s: [30, 72], green: 0.2, turbines: 0 });

  // boats (pack) — drifting and bobbing
  const boats: { m: THREE.Object3D; x: number; z: number; vx: number; vz: number; ph: number; ry: number }[] = [];
  const addBoat = (n: string, x: number, z: number, len: number, ry: number, vx: number, vz: number, color = 0xffffff) => {
    const g = new THREE.Group(); sc.add(g);
    place(g, n, { len, map: textures.wood, mapScale: 0.5, mapMix: 0.4, noiseScale: 0.5, color, y: -0.12 });
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.75, len * 1.5), new THREE.MeshBasicMaterial({ color: 0x0c1c38, transparent: true, opacity: 0.38, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; g.add(sh);
    boats.push({ m: g, x, z, vx, vz, ph: boats.length * 1.7, ry });
  };
  addBoat('canoe', -20, 36, 6.2, 1.1, 0.45, -0.12, 0xd9a066);
  addBoat('boat-row-small', -4, 30, 4.6, -0.5, -0.3, 0.05, 0xfff0e0);
  addBoat('boat-sail-a', -44, -6, 7.5, 2.0, 0.55, 0.1);
  addBoat('boat-fishing-small', -30, -40, 8, 0.8, -0.4, 0.1);
  addBoat('boat-sail-b', -78, -70, 8, 1.4, 0.5, 0.0);
  addBoat('canoe', -34, 18, 5.4, 2.2, 0.25, 0.2, 0xc98a5a);
  addBoat('boat-row-large', -62, -24, 5.5, 0.3, 0.3, -0.1);
  addBoat('boat-house-a', -110, -120, 11, 1.0, 0.15, 0);
  addBoat('boat-tug-a', -160, -210, 12, 1.7, 0.6, 0);
  addBoat('ship-small', -260, -420, 44, 1.5, 0.5, 0);
  addBoat('boat-sail-a', -150, -150, 9, 0.3, -0.4, 0);

  const clouds = makeClouds(51, { lit: 0xffe0aa, mid: 0xff9a78, shade: 0xa878a0 }, [
    { x: -420, y: 150, z: -1500, w: 520, h: 150, fade: 0.4 }, { x: 260, y: 210, z: -1700, w: 620, h: 190, fade: 0.42 }, { x: -60, y: 90, z: -1900, w: 420, h: 90, fade: 0.6 },
    { x: -900, y: 260, z: -1800, w: 600, h: 170, fade: 0.35 }, { x: 820, y: 150, z: -1500, w: 420, h: 120, fade: 0.35 }, { x: -200, y: 380, z: -1600, w: 500, h: 110, fade: 0.3 },
  ], 4);
  sc.add(clouds.group);
  const birds: THREE.Mesh[] = []; for (let i = 0; i < 7; i++) birds.push(place(sc, 'bird', { s: 3.2, color: 0x2a2030, sway: 3, swayAmp: 0.9, swayFreq: 8, unlitMix: 0.6, cast: false }));
  sc.add(motes({ count: 200, box: [60, 12, 60], center: [-20, 7, 10], size: 0.06, color: 0xffc890, intensity: 1.0, speed: 0.6, drift: [1, 0.1, 0.4], seed: 55 }));

  return {
    name: 'bridge', ...s, env,
    update(t) {
      clouds.update(t);
      for (const b of boats) {
        b.m.position.set(b.x + b.vx * t, Math.sin(t * 1.5 + b.ph) * 0.07, b.z + b.vz * t);
        b.m.rotation.set(Math.sin(t * 1.2 + b.ph) * 0.03, b.ry + Math.sin(t * 0.4 + b.ph) * 0.03, Math.sin(t * 1.7 + b.ph * 2) * 0.045);
      }
      birds.forEach((b, i) => { b.position.set(-120 + i * 9 + t * 7, 34 + (i % 3) * 3 + Math.sin(t * 1.4 + i) * 0.8, -160 - i * 14 + (i % 2) * 8); b.rotation.y = Math.PI / 2; });
      lampGlows.forEach((g, i) => { g.material.opacity = 0.85 + 0.15 * Math.sin(t * 11 + i * 3.3) * Math.sin(t * 5 + i); });
    },
  };
}
