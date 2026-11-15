// Shot 1 — low angle: a yellow hover-danfo glides under a vine-covered overpass at golden hour.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, motes, glow, type Env } from '../core';
import { place, textures } from '../assets';
import { ground, box, blob, hedgePts, vines, sign, wire, frondGeo, foliageMat, shaft } from '../build';
import { danfo, skyline, scatter, tree } from '../kit';
import { makeClouds } from '../sky';

export function shot1(): Shot {
  const env: Env = {
    hdri: 'fire', sunAz: -86, sunEl: 7.5, sunCol: [1.5, 0.9, 0.45], skyCol: [0.27, 0.28, 0.54], groundCol: [0.38, 0.23, 0.22],
    fogCol: [0.86, 0.5, 0.42], fogSun: [1.2, 0.72, 0.4], fog: [0.003, 0.004, 0.85], zenith: 0x35589e, horizon: 0xffa868, hdrMix: 0.72, exposure: 0.55,
    flare: 0.62, flareCol: 0xffc07a, leak: 0.3, bloom: 0.5, sat: 1.2, contrast: 0.5, dapple: [0, 0.05, 1],
  };
  const s = stage(env, { cam: [-3.7, 0.42, 7], look: [1.9, 3.05, -8], fov: 41, shadow: { center: [0, 0, -6], size: 30, depth: 260 } });
  const sc = s.scene; const r = mulberry32(101);

  // ground: verge, road, kerbs
  ground(sc, 900, 900, { color: 0x5d7a3e, map: textures.grass, mapScale: 0.12, noiseScale: 0.05, noiseAmp: 0.3, y: -0.02 });
  ground(sc, 9.5, 400, { color: 0x595264, map: textures.asphalt, mapScale: 0.18, noiseScale: 0.09, noiseAmp: 0.22, z: -150, spec: 0.12 });
  for (const sx of [-1, 1]) {
    box(sc, 0.5, 0.22, 400, sx * 5.0, 0.11, -150, { color: 0xc9b8b0, map: textures.concrete, mapScale: 0.3, noiseAmp: 0.2 });
    box(sc, 2.6, 0.16, 400, sx * 6.5, 0.08, -150, { color: 0xb9a79e, map: textures.concrete, mapScale: 0.25, noiseAmp: 0.25 });
  }
  for (let i = 0; i < 40; i++) box(sc, 0.16, 0.02, 2.2, 0, 0.012, 12 - i * 5.5, { color: 0xf3e6c8, cast: false, noiseAmp: 0.3, noiseScale: 0.8 });

  // overpass: concrete deck, parapets, piers (pack bridge pillars scaled up)
  const OZ = -13, DY = 7.4;
  const conc = { color: 0xcdbfb6, map: textures.concrete, mapScale: 0.14, noiseScale: 0.07, noiseAmp: 0.26, grad: [5.5, 9.5] as [number, number], gradCol: 0x9a8496 };
  box(sc, 90, 1.25, 9.5, 0, DY + 0.62, OZ, conc);
  box(sc, 90, 0.45, 8.3, 0, DY - 0.2, OZ, { ...conc, color: 0xb8a9a6 });
  for (const dz of [-4.6, 4.6]) box(sc, 90, 1.0, 0.35, 0, DY + 1.75, OZ + dz, conc);
  for (const px of [-8.2, 8.2, -30, 30]) {
    for (const dz of [-2.6, 2.6]) place(sc, 'bridge-pillar-wide', { x: px, z: OZ + dz, h: DY - 0.4, ...conc, mapScale: 0.2 });
    box(sc, 2.4, 0.9, 8.6, px, DY - 0.75, OZ, { ...conc, color: 0xbcaea8 });
  }
  sign(sc, 'LAGOS ISLAND', { x: -2.4, y: DY + 0.55, z: OZ + 4.79, w: 5.2, h: 1.0, bg: '#0d4b46', fg: '#eafff4', glow: 1.25, border: '#bff5e0', font: 62, sub: 'THIRD MAINLAND  •  2 KM' });

  // greenery: creeper along parapets, hanging vine curtains, pier wraps
  blob(sc, 3, hedgePts(r, [-40, DY + 2.3, OZ + 4.7], [40, DY + 2.3, OZ + 4.7], 46, 0.85, 0.5), { swayAmp: 0.05, noiseScale: 0.6 });
  blob(sc, 4, hedgePts(r, [-40, DY + 2.4, OZ - 4.6], [40, DY + 2.4, OZ - 4.6], 30, 1.0, 0.5), { swayAmp: 0.05 });
  vines(sc, 5, { x: 0, y: DY + 1.9, z: OZ + 4.95, width: 70, count: 170, len: [1.2, 4.6], depth: 0.4, amp: 0.4 });
  vines(sc, 6, { x: 0, y: DY + 0.1, z: OZ + 4.2, width: 60, count: 70, len: [0.6, 2.2], depth: 1.2, amp: 0.3 });
  vines(sc, 7, { x: 0, y: DY + 1.7, z: OZ - 4.9, width: 70, count: 90, len: [1.0, 4.0], depth: 0.4, amp: 0.35 });
  for (const px of [-8.2, 8.2]) {
    const pts: number[][] = [];
    for (let i = 0; i < 26; i++) { const a = i * 0.9 + px, y = 0.4 + i * 0.24; pts.push([px + Math.cos(a) * 1.0, y, OZ + 2.6 + Math.sin(a) * 1.0, rr(r, 0.35, 0.62)]); }
    for (let i = 0; i < 10; i++) pts.push([px + rr(r, -1.6, 1.6), rr(r, 0.1, 0.5), OZ + 2.6 + rr(r, -1.4, 1.8), rr(r, 0.4, 0.75)]);
    blob(sc, 20 + px, pts, { swayAmp: 0.04, noiseScale: 0.7 });
    vines(sc, 30 + px, { x: px, y: DY - 0.3, z: OZ + 3.7, width: 2.6, count: 16, len: [1.5, 3.5], depth: 1, amp: 0.25 });
  }
  // roof-garden trees up on the deck
  for (let i = 0; i < 9; i++) tree(sc, 60 + i, -36 + i * 9 + rr(r, -2, 2), OZ + rr(r, -1.5, 1.5), rr(r, 4, 6.5), 1.1, { y: DY + 1.2 });

  // roadside planting, palms, poles
  scatter(sc, 8, 'grass-large', 420, (q) => { const sx = q() < 0.5 ? -1 : 1; return [sx * rr(q, 7.9, 16), 0, rr(q, -60, 13)]; }, [1.6, 3.6]);
  scatter(sc, 9, 'flower-yellow', 60, (q) => { const sx = q() < 0.5 ? -1 : 1; return [sx * rr(q, 7.9, 12), 0, rr(q, -30, 12)]; }, [2.2, 3.4]);
  scatter(sc, 10, 'flower-red', 50, (q) => { const sx = q() < 0.5 ? -1 : 1; return [sx * rr(q, 7.9, 12), 0, rr(q, -30, 12)]; }, [2.2, 3.4]);
  const palms = ['palm-tall', 'palm-detailed-tall', 'palm-bend', 'palm'];
  for (let i = 0; i < 16; i++) { const sx = i % 2 ? -1 : 1; place(sc, palms[i % 4], { x: sx * rr(r, 8.5, 11), z: -20 - i * 6.5 + rr(r, -2, 2), h: rr(r, 8, 12), ry: r() * 6 }); }
  place(sc, 'palm-detailed-tall', { x: 9.2, z: 0.5, h: 10.5, ry: 1 }); place(sc, 'palm-bend', { x: -9.5, z: -2.5, h: 9, ry: 2.5 });
  for (let i = 0; i < 5; i++) { const z = -2 - i * 24; place(sc, 'street-light-curved', { x: 5.6, z, h: 6.4, ry: Math.PI / 2, color: 0x9aa0b8 }); const gl = glow(0xffd9a0, 2.2, 1.6); gl.position.set(4.4, 6.25, z); sc.add(gl); }
  for (let i = 0; i < 4; i++) place(sc, 'electricity-pole', { x: -7.0, z: -18 - i * 26, h: 8.5, ry: Math.PI / 2, color: 0x7a6a66 });
  for (let i = 0; i < 3; i++) for (const dx of [-1.6, 0, 1.6]) wire(sc, [-7.0 + dx, 8.1, -18 - i * 26], [-7.0 + dx, 8.1, -44 - i * 26], 0.9);
  tree(sc, 41, -15, -4, 9, 1.2); tree(sc, 42, 16, -16, 11, 1.2); tree(sc, 43, -20, -24, 12, 1.3); tree(sc, 44, 21, 2, 8, 1.2);
  blob(sc, 45, hedgePts(r, [-8.4, 0.5, 9], [-8.4, 0.5, -3], 10, 0.8), { swayAmp: 0.04 });
  blob(sc, 46, hedgePts(r, [8.4, 0.5, 6], [8.4, 0.5, -6], 9, 0.8), { swayAmp: 0.04 });

  // hazy city beyond
  skyline(sc, 11, { x0: -170, x1: 150, z: -120, depth: 60, count: 30, s: [22, 40], turbines: 0.2 });
  skyline(sc, 12, { x0: -260, x1: 240, z: -230, depth: 90, count: 34, s: [30, 62], green: 0.3 });
  const clouds = makeClouds(7, { lit: 0xffe2b4, mid: 0xff9c78, shade: 0x8b6a9c }, [
    { x: -150, y: 95, z: -420, w: 150, h: 46, fade: 0.2 }, { x: 110, y: 120, z: -520, w: 190, h: 60, fade: 0.25 }, { x: 10, y: 60, z: -600, w: 120, h: 30, fade: 0.4 },
    { x: -330, y: 140, z: -560, w: 200, h: 62, fade: 0.3 }, { x: 300, y: 70, z: -480, w: 130, h: 38, fade: 0.35 },
  ], 1.5);
  sc.add(clouds.group);

  // hero danfo + atmosphere
  const bus = danfo(sc);
  const dust = motes({ count: 420, box: [22, 7, 30], center: [0, 3.4, -4], size: 0.045, color: 0xffd9a0, intensity: 1.5, speed: 0.7, drift: [0.5, 0.12, 0.3], seed: 3 });
  sc.add(dust);
  shaft(sc, { x: -1.5, y: DY - 0.2, z: OZ + 5.2, w: 5, len: 9, rz: -0.5, ry: 0.3, color: 0xffb070, k: 0.22 });
  shaft(sc, { x: 5.5, y: DY - 0.2, z: OZ + 5.4, w: 3.4, len: 8, rz: -0.42, ry: 0.3, color: 0xffb070, k: 0.16 });
  // distant birds
  const birds: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) { const b = place(sc, 'bird', { s: 2.2, color: 0x2a2030, sway: 3, swayAmp: 0.9, swayFreq: 9, unlitMix: 0.6, cast: false }); birds.push(b); }

  // blurred foreground: leaves leaning into frame
  const fr = new THREE.Mesh(frondGeo(71, 3.2, 0.55, 22, 0.8), foliageMat({ side: THREE.DoubleSide, sway: 1, swayAmp: 0.12, swayFreq: 1.6, swayY0: 0, swayH: 3, foliage: 0.6, wrap: 0.6 }));
  fr.position.set(-6.6, 3.3, 4.4); fr.rotation.set(0.4, -0.3, -0.35); fr.layers.set(1); sc.add(fr);
  const fr2 = new THREE.Mesh(frondGeo(72, 2.6, 0.6, 18, 0.7), fr.material); fr2.position.set(-6.4, 0.1, 5.2); fr2.rotation.set(0.2, -0.5, 0.75); fr2.layers.set(1); sc.add(fr2);

  return {
    name: 'overpass', ...s, env, fg: true, title: ['CREATED BY', 'BREEZEOG'],
    update(t) {
      bus.group.position.set(2.7 - t * 0.22, 0, -18.5 + t * 4.7); bus.update(t); bus.group.rotation.y = -0.2;
      clouds.update(t);
      birds.forEach((b, i) => { b.position.set(-30 + i * 5 + t * 5.5, 22 + i * 1.7 + Math.sin(t * 1.5 + i) * 0.6, -70 - i * 9); b.rotation.y = Math.PI / 2; });
    },
  };
}
