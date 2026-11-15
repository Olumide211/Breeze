// Shot 6 — roadside corner: vending kiosk, stacked crates, a bicycle against a fence, dappled tree shadows, butterflies.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, glow, type Env } from '../core';
import { place, textures, type Recolor } from '../assets';
import { ground, box, cyl, blob, hedgePts, sign, vines, frondGeo, foliageMat, shaft } from '../build';
import { scatter, tree, skyline } from '../kit';
import { makeClouds } from '../sky';

const vend: Recolor = (c, i) => {
  if (i.hsl.s > 0.5 && (i.hsl.h < 0.1 || i.hsl.h > 0.9)) c.setHex(i.hsl.l > 0.55 ? 0x1fa79a : 0x15877f); // orange shell -> teal
  else if (i.hsl.l > 0.8) c.setHex(0xfff6e0);
};
const fenceCol: Recolor = (c, i) => { c.setHex(i.hsl.l > 0.55 ? 0xf2e3c6 : 0xd9c3a0); };

export function shot6(): Shot {
  const env: Env = {
    hdri: 'spruit', sunAz: 132, sunEl: 47, sunCol: [1.3, 1.05, 0.72], skyCol: [0.28, 0.36, 0.60], groundCol: [0.34, 0.30, 0.24],
    fogCol: [0.90, 0.85, 0.75], fogSun: [1.1, 1.0, 0.8], fog: [0.003, 0.0, 0.7], zenith: 0x3d84da, horizon: 0xffe6c4, hdrMix: 0.45, exposure: 0.9,
    leak: 0.22, bloom: 0.42, sat: 1.25, contrast: 0.5, dapple: [0.92, 0.085, 1.2], fogStart: 30,
  };
  const s = stage(env, { cam: [3.6, 1.4, 7.6], look: [0.3, 1.45, 0], fov: 39, shadow: { center: [0, 0, 0], size: 16, depth: 120 } });
  const sc = s.scene; const r = mulberry32(606);

  // road, kerb, pavement, verge
  ground(sc, 300, 300, { color: 0x6c6672, map: textures.asphalt, mapScale: 0.2, noiseScale: 0.15, noiseAmp: 0.25 });
  box(sc, 80, 0.2, 0.4, 0, 0.1, 3.6, { color: 0xd8c8b8, map: textures.concrete, mapScale: 0.4 });
  box(sc, 80, 0.18, 3.8, 0, 0.09, 1.6, { color: 0xd4b79c, map: textures.concrete, mapScale: 0.3, noiseScale: 0.3, noiseAmp: 0.25 });
  box(sc, 80, 0.16, 6, 0, 0.08, -3.2, { color: 0x6f9146, map: textures.grass, mapScale: 0.25, noiseScale: 0.2, noiseAmp: 0.3 });
  for (let i = 0; i < 16; i++) box(sc, 0.03, 0.01, 3.8, -14 + i * 1.9, 0.185, 1.6, { color: 0xa88f7c, cast: false });

  // fence (pack sections, repainted cream) with a hedge and garden wall behind
  // picket fence (procedural) + pack fence sections further along
  const wood = { color: 0xf4e6cc, map: textures.wood, mapScale: 0.9, mapMix: 0.55, noiseScale: 0.6, noiseAmp: 0.14 };
  for (let i = 0; i < 70; i++) { const x = -3.6 + i * 0.26; const h = 1.25 + 0.05 * Math.sin(i * 1.7); box(sc, 0.16, h, 0.04, x, 0.18 + h / 2, -0.9, { ...wood, rz: 0.012 * Math.sin(i * 2.3) }); }
  for (const y of [0.55, 1.1]) box(sc, 18.6, 0.09, 0.05, 5.5, y, -0.95, wood);
  for (let i = 0; i < 6; i++) box(sc, 0.14, 1.55, 0.14, -3.7 + i * 3.64, 0.95, -0.97, wood);
  for (let i = 0; i < 2; i++) place(sc, 'fence-1x3', { x: -13.5 + i * 5.4, y: 0.18, z: -0.9, s: 4.3, key: 'fence', recolor: fenceCol, map: textures.wood, mapScale: 0.7, mapMix: 0.6, noiseScale: 0.5 });
  blob(sc, 61, hedgePts(r, [-16, 1.0, -2.2], [14, 1.1, -2.2], 26, 1.0, 0.5), { swayAmp: 0.05, dapple: 0.8 });
  place(sc, 'suburban-building-e', { x: -7.5, y: 0.1, z: -12, s: 9.5, ry: 0, color: 0xf7cfa6, map: textures.plaster, mapScale: 0.2, mapMix: 0.6, noiseScale: 0.15, recolor: (c, i) => { if (i.hsl.s > 0.3 && i.hsl.h > 0.2 && i.hsl.h < 0.55) c.setHex(0xc75f3c); }, key: 'house6' });
  place(sc, 'suburban-building-k', { x: 9, y: 0.1, z: -15, s: 9.5, ry: -0.3, color: 0xcfe3d6, map: textures.plaster, mapScale: 0.2, mapMix: 0.6, recolor: (c, i) => { if (i.hsl.s > 0.3 && i.hsl.h > 0.2 && i.hsl.h < 0.55) c.setHex(0x3f7f8c); }, key: 'house6b' });

  // the vending kiosk: pack vending machine (teal), solar lid, small display stand + awning, sign
  const V = new THREE.Group(); V.position.set(-2.2, 0.18, 0.4); V.rotation.y = 0.18; sc.add(V);
  place(V, 'vending-machine', { h: 2.05, key: 'vend', recolor: vend, spec: 0.3, selfGlow: 0, noiseAmp: 0.08 });
  box(V, 0.62, 0.86, 0.02, -0.14, 1.36, 0.69, { color: 0x203038, emissive: 0xbff8ff, emissiveK: 0.9, flicker: 0.05, cast: false });
  for (let k = 0; k < 9; k++) place(V, k % 2 ? 'soda-can' : 'soda-bottle', { x: -0.36 + (k % 3) * 0.22, y: 1.05 + Math.floor(k / 3) * 0.28, z: 0.66, h: 0.2, color: pick(r, [0xff8a70, 0xfff0a0, 0x90e0ff, 0xffffff]), cast: false });
  place(V, 'solar-panel-flat', { x: 0, y: 2.05, z: 0, s: 2.6, rx: -0.2, spec: 0.8, color: 0xbfd0ff });
  const vg = glow(0xbff4ff, 2.6, 0.5); vg.position.set(-0.1, 1.3, 1.0); V.add(vg);
  place(V, 'barrel', { x: 1.45, z: 0.15, s: 2.9, color: 0xe2a13a }); place(V, 'fruit-pineapple', { x: 1.45, y: 0.98, z: 0.15, s: 1.4 });
  place(V, 'awning-wide', { x: 0.7, y: 2.1, z: 0.25, s: 3.9, recolor: (c, i) => { c.setHex(Math.floor((i.x + 2) * 12) % 2 ? 0xf2a23a : 0xfff0dc); }, key: 'vawn', trans: 0.4, side: THREE.DoubleSide });
  sign(V, 'COLD ZOBO', { x: 0.7, y: 2.75, z: 0.42, w: 2.3, h: 0.6, bg: '#123a38', fg: '#fff2c8', border: '#ffd27a', glow: 1.25, sub: 'SOLAR CHILLED' });
  
  place(V, 'potted-plant', { x: 2.3, z: 0.2, h: 1.2 });
  // stacked crates and boxes
  const C = new THREE.Group(); C.position.set(-5.0, 0.18, 0.5); sc.add(C);
  const crate = { map: textures.wood, mapScale: 0.9, mapMix: 0.5 };
  place(C, 'box-large', { x: 0, z: 0, s: 3.1, ry: 0.1, ...crate }); place(C, 'box-large', { x: 0.05, y: 0.775, z: 0, s: 3.1, ry: -0.08, ...crate, color: 0xc8e0d0 });
  place(C, 'box', { x: 0, y: 1.55, z: 0.1, s: 2.8, ry: 0.35, ...crate }); place(C, 'box', { x: 1.0, z: 0.5, s: 3.0, ry: 0.5, ...crate, color: 0xffd9b0 });
  place(C, 'box-open', { x: 1.05, y: 0.75, z: 0.5, s: 2.6, ry: 0.2, ...crate });
  place(C, 'box', { x: -1.0, z: 0.6, s: 2.9, ry: -0.3, ...crate, color: 0xb8d8ff }); place(C, 'cardboard-box-closed', { x: -1.3, y: 0.72, z: 0.75, s: 2.4, ry: 0.2 });
  place(C, 'barrel', { x: 1.95, z: -0.1, s: 2.9, color: 0xe8a23c });
  for (const [fx, fz] of [[1.05, 0.5], [0.95, 0.6], [1.15, 0.45]]) place(C, pick(r, ['fruit-orange', 'fruit-apple', 'fruit-pineapple']), { x: fx, y: 1.0, z: fz, s: 1.3, ry: r() * 6 });
  // bicycle (pack) leaning on the fence
  const bk = place(sc, 'bicycle', { len: 1.85, x: 2.3, y: 0.18, z: -0.38, ry: Math.PI / 2 + 0.06, rz: 0, color: 0xffffff, spec: 0.3, noiseAmp: 0.05, recolor: (c, i) => { if (i.mat === 'FF5722') c.setHex(0xe8443a); else if (i.mat === '78909C') c.setHex(0xb8c4cc); else c.setHex(0x1a1a20); }, key: 'bike6' });
  bk.rotation.set(0, Math.PI / 2 + 0.06, 0.2, 'YXZ');
  // street furniture
  place(sc, 'street-light-square', { x: 5.4, y: 0.18, z: 2.9, h: 5.6, ry: Math.PI, color: 0x8f96aa });
  place(sc, 'bench-park', { x: 5.3, y: 0.18, z: 0.1, s: 1.55, ry: 0 });
  place(sc, 'trashcan', { x: 0.75, y: 0.18, z: 0.0, h: 0.95, color: 0x7fb0a0 });
  place(sc, 'road-sign-street', { x: -8.2, y: 0.18, z: 3.0, h: 3.0, ry: 0.5 });

  // planting: grass tufts, flowers, shade tree whose canopy hangs into frame
  scatter(sc, 62, 'grass-large', 260, (q) => [rr(q, -16, 14), 0.16, rr(q, -5.5, -1.3)], [1.8, 3.6]);
  scatter(sc, 63, 'flower-red', 34, (q) => [rr(q, -12, 12), 0.18, rr(q, -1.35, -1.05)], [2.6, 3.6], { cast: true });
  scatter(sc, 64, 'flower-yellow', 34, (q) => [rr(q, -12, 12), 0.18, rr(q, -1.4, -1.0)], [2.6, 3.6], { cast: true });
  scatter(sc, 65, 'flower-purple', 30, (q) => [rr(q, -12, 12), 0.18, rr(q, -1.4, -1.0)], [2.6, 3.6], { cast: true });
  scatter(sc, 66, 'grass-leafs', 50, (q) => [rr(q, -12, 10), 0.19, rr(q, -0.6, 3.3)], [1.2, 2.2]);
  tree(sc, 67, 7.4, -2.6, 9.5, 1.5, { amp: 0.14 });
  tree(sc, 68, -11, -4, 10, 1.4, { amp: 0.12 }); tree(sc, 69, -1, -7, 9, 1.3); tree(sc, 70, 16, -8, 11, 1.3);
  // canopy overhanging the top of frame (casts the real shadows that mix with the painted dapple)
  const can: number[][] = []; for (let i = 0; i < 16; i++) can.push([rr(r, -3, 8), rr(r, 6.4, 8.2), rr(r, -1, 4.5), rr(r, 1.0, 1.9)]);
  blob(sc, 71, can, { swayAmp: 0.16, dapple: 0, noiseScale: 0.35 });
  vines(sc, 72, { x: 3, y: 5.8, z: 2.5, width: 9, count: 26, len: [0.5, 2.0], depth: 3, amp: 0.3 });
  skyline(sc, 73, { x0: -120, x1: 120, z: -90, depth: 50, count: 14, s: [14, 30], turbines: 0.2 });
  const clouds = makeClouds(61, { lit: 0xfffaf0, mid: 0xffe0cc, shade: 0xa0aad8 }, [{ x: -70, y: 60, z: -300, w: 130, h: 44, fade: 0.12 }, { x: 80, y: 90, z: -360, w: 170, h: 56, fade: 0.15 }], 1.6);
  sc.add(clouds.group);

  // butterflies (pack mesh, recoloured, flapping in the shader)
  const hues = [0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff];
  const flies = hues.map((h, i) => {
    const m = place(sc, 'butterfly', { s: 0.27, color: h, sway: 3, swayAmp: 1.15, swayFreq: 15 + i * 1.3, side: THREE.DoubleSide, unlitMix: 0.6, key: 'bf' + i, recolor: (c, q) => { if (q.hsl.l < 0.35) c.setHex(0x2a2440); else { c.setHSL((q.hsl.h + [0, 0.5, 0.08, 0.85, 0.02, 0.3][i]) % 1, 0.95, 0.6); } }, noiseAmp: 0.03, cast: true, dapple: 0.3 });
    return { m, cx: [-0.6, 3.4, 1.4, -3.4, 4.6, 0.4][i], cy: [1.5, 1.15, 2.1, 1.0, 1.8, 0.9][i], cz: [1.6, 1.0, 0.6, 1.9, 2.2, 2.6][i], a: 0.9 + i * 0.25, ph: i * 2.1 };
  });
  sc.add(motes({ count: 220, box: [14, 5, 8], center: [0.5, 2.4, 1.5], size: 0.03, color: 0xfff2c8, intensity: 1.1, speed: 0.6, drift: [0.3, 0.06, 0.1], seed: 66 }));
  shaft(sc, { x: -1.0, y: 6.4, z: 2.2, w: 1.6, len: 7, rz: 0.5, color: 0xfff0c0, k: 0.1 }); shaft(sc, { x: 2.4, y: 6.4, z: 1.6, w: 1.1, len: 7, rz: 0.5, color: 0xfff0c0, k: 0.09 }); shaft(sc, { x: 4.6, y: 6.4, z: 2.6, w: 2.0, len: 7, rz: 0.5, color: 0xfff0c0, k: 0.08 });
  // blurred leaves in the near foreground
  const fm = foliageMat({ side: THREE.DoubleSide, sway: 1, swayAmp: 0.1, swayFreq: 1.7, swayY0: -1, swayH: 2.5, foliage: 0.7, wrap: 0.7, dapple: 0 });
  const f1 = new THREE.Mesh(frondGeo(601, 2.4, 0.5, 18, 0.6), fm); f1.position.set(5.6, 2.55, 5.4); f1.rotation.set(0.2, 2.8, -0.4); f1.layers.set(1); sc.add(f1);
  const f2 = new THREE.Mesh(frondGeo(602, 2.0, 0.6, 16, 0.55), fm); f2.position.set(5.5, 0.4, 5.6); f2.rotation.set(-0.2, 2.6, 0.8); f2.layers.set(1); sc.add(f2);

  return {
    name: 'corner', ...s, env, fg: true,
    update(t) {
      clouds.update(t);
      flies.forEach((f, i) => {
        const u = t * f.a + f.ph;
        const x = f.cx + Math.sin(u) * 0.9 + Math.sin(u * 2.3) * 0.25, y = f.cy + Math.sin(u * 1.7) * 0.28 + Math.sin(u * 4.1) * 0.06, z = f.cz + Math.cos(u * 0.8) * 0.6;
        const dx = Math.cos(u) * 0.9 + Math.cos(u * 2.3) * 0.58, dz = -Math.sin(u * 0.8) * 0.48;
        f.m.position.set(x, y, z); f.m.rotation.set(0.35, Math.atan2(dx, dz), 0, 'YXZ');
      });
    },
  };
}
