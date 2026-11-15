// Shot 4 — an okada rider's glowing electric bike parked by a red kiosk; blurred palm leaves sway in front.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, glow, glowDisc, type Env } from '../core';
import { place, textures, type Recolor } from '../assets';
import { ground, box, cyl, blob, hedgePts, wire, sign, vines, frondGeo, foliageMat } from '../build';
import { skyline, scatter, tree } from '../kit';
import { makeClouds } from '../sky';

const kioskRed: Recolor = (c, i) => {
  if (i.hsl.s > 0.5 && (i.hsl.h < 0.1 || i.hsl.h > 0.9)) c.setHex(i.hsl.l > 0.6 ? 0xd3222a : 0xb5161f);  // container panels -> deep red
  else c.setHex(i.hsl.l > 0.7 ? 0xffe9c9 : 0x8a2a2a);
};
const okada: Recolor = (c, i) => {
  if (i.mat === 'Yellow') c.setHex(0xffe9a0);
  else if (i.mat === 'LightPurple') c.setHex(0x16c9c2);     // body panels -> electric teal
  else c.setHex(0x14141c);
};

export function shot4(): Shot {
  const env: Env = {
    hdri: 'fire', sunAz: -128, sunEl: 11, sunCol: [1.35, 0.8, 0.45], skyCol: [0.26, 0.28, 0.58], groundCol: [0.34, 0.22, 0.24],
    fogCol: [0.92, 0.52, 0.44], fogSun: [1.2, 0.72, 0.42], fog: [0.004, 0.0, 0.85], zenith: 0x2f4a96, horizon: 0xff9a62, hdrMix: 0.7, exposure: 0.5,
    leak: 0.3, bloom: 0.75, sat: 1.25, contrast: 0.5, dapple: [0.55, 0.07, 1], fogStart: 14,
  };
  const s = stage(env, { cam: [1.0, 1.15, 8.6], look: [0.75, 1.7, 0], fov: 40, shadow: { center: [0, 0, 0], size: 14, depth: 120 } });
  const sc = s.scene; const r = mulberry32(404);

  ground(sc, 200, 200, { color: 0x8c6a5c, map: textures.asphalt, mapScale: 0.22, noiseScale: 0.2, noiseAmp: 0.3 });
  box(sc, 60, 0.16, 5.4, 0, 0.08, -0.4, { color: 0xc7a892, map: textures.concrete, mapScale: 0.3, noiseAmp: 0.25 });
  // painted compound wall behind the kiosk
  box(sc, 60, 3.3, 0.4, 0, 1.65, -3.2, { color: 0x3f9a93, map: textures.plaster, mapScale: 0.25, mapMix: 0.7, noiseScale: 0.25, noiseAmp: 0.25, grad: [0, 2.2], gradCol: 0x8a6a70 });
  box(sc, 60, 0.18, 0.6, 0, 3.36, -3.2, { color: 0xf0d2a8, noiseAmp: 0.2 });
  blob(sc, 41, hedgePts(r, [-9, 3.7, -3.3], [10, 3.8, -3.3], 16, 0.9, 0.6), { swayAmp: 0.06 });
  vines(sc, 42, { x: 1, y: 3.4, z: -2.95, width: 18, count: 46, len: [0.6, 2.4], amp: 0.2 });

  // red kiosk: recoloured pack shipping container + hatch, counter, awning, stock
  const K = new THREE.Group(); K.position.set(-0.9, 0.16, -0.4); sc.add(K);
  const cont = place(K, 'shipping-container-a', { ry: Math.PI / 2, key: 'kiosk', recolor: kioskRed, map: textures.metal, mapScale: 0.5, mapMix: 0.5, noiseScale: 0.6, noiseAmp: 0.14, spec: 0.15 });
  cont.scale.set(6.4, 7.6, 5.4);
  box(K, 2.5, 0.08, 0.12, 0, 2.17, 1.2, { color: 0x1a0d10 }); box(K, 0.08, 1.1, 0.12, -1.25, 1.62, 1.2, { color: 0x1a0d10 }); box(K, 0.08, 1.1, 0.12, 1.25, 1.62, 1.2, { color: 0x1a0d10 });
  box(K, 2.3, 0.94, 0.02, 0, 1.62, 0.6, { color: 0x3a1a12, emissive: 0xffa85a, emissiveK: 0.85, flicker: 0.04, cast: false });
  place(K, 'shelf-boxes', { x: -0.45, y: 0.95, z: 0.95, s: 1.5, color: 0x6a3a2a, cast: false }); place(K, 'shelf-bags', { x: 0.7, y: 0.95, z: 0.95, s: 1.5, color: 0x6a3a2a, cast: false });
  box(K, 2.9, 0.09, 0.6, 0, 1.05, 1.42, { color: 0xb07a4e, map: textures.wood, mapScale: 0.8 });
  const aw = place(K, 'awning-wide', { x: 0, y: 2.2, z: 0.82, s: 3.7, color: 0xffe2c0, trans: 0.35, side: THREE.DoubleSide, recolor: (c, i) => { c.setHex(Math.floor((i.x + 2) * 12) % 2 ? 0xd3222a : 0xfff0dc); }, key: 'kawn' });
  for (let i = 0; i < 9; i++) place(K, i % 3 === 1 ? 'soda-can' : 'soda-bottle', { x: -1.0 + i * 0.25, y: 1.1, z: 1.3, h: i % 3 === 1 ? 0.16 : 0.34, ry: r() * 6, color: pick(r, [0xffffff, 0xffd0a0, 0xa0ffd0]) });
  place(K, 'radio', { x: 0.75, y: 1.1, z: 1.55, s: 1.5, ry: 0.2 });
  place(K, 'plant-small-1', { x: -1.25, y: 1.1, z: 1.5, h: 0.42 });
  place(K, 'solar-panel-flat', { x: 0.4, y: 2.66, z: 0, s: 3.4, ry: Math.PI / 2, spec: 0.8, color: 0xbfd0ff });
  place(K, 'string-lights-colored', { x: 0, y: 2.35, z: 1.25, s: 4.2, selfGlow: 3, cast: false });
  sign(K, 'MAMA T', { x: 0, y: 3.15, z: 1.0, w: 3.0, h: 0.95, bg: '#2a0a10', fg: '#ffd27a', border: '#ff7a5a', glow: 2.4, sub: 'COLD DRINKS  •  SOLAR CHARGE' });
  box(K, 3.15, 1.1, 0.1, 0, 3.15, 0.93, { color: 0x231418 });
  for (const sx of [-1.4, 1.4]) cyl(K, 0.04, 0.04, 0.6, sx, 2.9, 0.93, { color: 0x231418 });
  const kg = glow(0xffa860, 6, 0.55); kg.position.set(0, 1.7, 1.9); K.add(kg);
  const kpool = glowDisc(0xffa050, 6, 0.3); kpool.position.set(0, 0.02, 2.6); K.add(kpool);
  place(K, 'lantern', { x: -2.3, z: 1.5, h: 1.5, selfGlow: 3.5, flicker: 0.15 });
  const lg = glow(0xffb050, 2.6, 1.2); lg.position.set(-2.3, 1.2, 1.5); K.add(lg);
  // clutter: crates, barrel, plants, bench
  place(K, 'box-large', { x: -2.9, z: 0.4, s: 3.0, ry: 0.2 }); place(K, 'box', { x: -2.85, y: 0.75, z: 0.45, s: 2.6, ry: -0.3 }); place(K, 'box-open', { x: -3.7, z: 1.0, s: 2.7, ry: 0.7 });
  place(K, 'barrel', { x: 2.2, z: 0.5, s: 2.9, color: 0x4f8fa8 }); place(K, 'potted-plant', { x: 2.15, y: 0.98, z: 0.5, h: 1.1 });
  place(K, 'potted-plant', { x: -1.9, z: 1.9, h: 1.25, ry: 2 });
  place(sc, 'bench-short', { x: -5.2, y: 0.16, z: 0.2, s: 1.5, ry: 0.3 });
  scatter(sc, 43, 'grass-large', 60, (q) => [rr(q, -12, 12), 0.16, rr(q, -2.9, -2.4)], [1.6, 3], { dapple: 0.5 });
  scatter(sc, 44, 'flower-yellow', 14, (q) => [rr(q, -10, 10), 0.16, rr(q, -2.8, -2.4)], [2.4, 3.2]);

  // the okada: pack motorcycle, dark body with teal panels, glow strips and hub rings
  const B = new THREE.Group(); B.position.set(2.75, 0.0, 2.3); B.rotation.set(0, Math.PI / 2 + 0.32, 0); sc.add(B);
  const lean = new THREE.Group(); lean.rotation.z = -0.13; B.add(lean);
  const bs = 2.25;
  place(lean, 'motorcycle', { s: bs, key: 'okada', recolor: okada, selfGlow: 1.35, spec: 0.6, noiseAmp: 0.05, rim: 0.7, dapple: 0.4 });
  box(lean, 0.02, 0.03, 1.1, 0.19, 0.5, 0.1, { color: 0x0a2a2a, emissive: 0x4ff5e6, emissiveK: 5, cast: false });
  box(lean, 0.02, 0.03, 1.1, -0.19, 0.5, 0.1, { color: 0x0a2a2a, emissive: 0x4ff5e6, emissiveK: 5, cast: false });
  const hl = glow(0xfff0c0, 1.5, 1.4); hl.position.set(0, 0.78, 1.25); lean.add(hl);
  const tl = glow(0xff3050, 0.7, 1.2); tl.position.set(0, 0.7, -0.95); lean.add(tl);
  const ug = glow(0x40f0e0, 3.2, 0.5); ug.position.set(0, 0.35, 0.15); lean.add(ug);
  const pool = glowDisc(0x35e8d8, 4.6, 0.55); pool.position.set(2.7, 0.03, 2.35); sc.add(pool);
  
  // charging cable from the kiosk
  const cab = wire(sc, [0.4, 1.3, 1.05], [2.45, 0.8, 2.2], 0.55, 0x1c5a4a, 0.018);
  const cg = glow(0x70ffb0, 0.5, 1.4); cg.position.set(2.45, 0.8, 2.2); sc.add(cg);

  // background: palms, pole, city, sky
  for (let i = 0; i < 7; i++) place(sc, pick(r, ['palm-tall', 'palm-detailed-tall', 'palm-bend', 'palm']), { x: -14 + i * 4.6 + rr(r, -1, 1), z: -6 - rr(r, 0, 6), h: rr(r, 8, 12), ry: r() * 6 });
  tree(sc, 45, -9, -7, 9, 1.3); tree(sc, 46, 11, -9, 11, 1.3);
  place(sc, 'electricity-pole', { x: 10.6, z: -2.4, h: 8.2, ry: 0, color: 0x7a6a66 });
  for (const dy of [0, -0.5]) wire(sc, [10.6, 7.8 + dy, -2.4], [-22, 7.6 + dy, -3.4], 0.9);
  skyline(sc, 47, { x0: -110, x1: 120, z: -70, depth: 50, count: 18, s: [16, 34], turbines: 0.2 });
  const clouds = makeClouds(41, { lit: 0xffd4a0, mid: 0xff8a6e, shade: 0x77588f }, [{ x: -80, y: 70, z: -330, w: 150, h: 46, fade: 0.2 }, { x: 90, y: 95, z: -400, w: 190, h: 60, fade: 0.2 }, { x: 0, y: 150, z: -460, w: 160, h: 44, fade: 0.3 }], 1.4);
  sc.add(clouds.group);
  sc.add(motes({ count: 220, box: [12, 4, 8], center: [1, 2, 1.5], size: 0.03, color: 0xffd0a0, intensity: 1.2, speed: 0.7, drift: [0.3, 0.08, 0.15], seed: 44 }));
  // fireflies around the planting
  sc.add(motes({ count: 40, box: [10, 2.2, 3], center: [1, 1.4, -1.5], size: 0.07, color: 0xd0ff90, intensity: 1.4, speed: 0.5, drift: [0.1, 0.02, 0.05], seed: 45, twinkle: 0.9 }));

  // blurred foreground palm fronds (layer 1)
  const fm = foliageMat({ side: THREE.DoubleSide, sway: 1, swayAmp: 0.16, swayFreq: 1.5, swayY0: -1.2, swayH: 3.2, foliage: 0.6, wrap: 0.7, dapple: 0, color: 0xb8c8a0 });
  const fronds: [number, number, number, number, number, number, number][] = [
    [-2.4, 2.9, 5.0, 0.2, -0.25, -0.5, 3.2], [-2.6, 2.2, 5.3, 0.6, 0.3, -0.95, 2.8], [-2.2, 3.1, 4.6, -0.3, -0.6, -0.15, 2.6],
    [4.4, 2.75, 5.6, 0.2, 2.9, -0.45, 2.6], [4.5, 2.2, 5.9, -0.3, 3.3, -0.9, 2.2],
  ];
  fronds.forEach(([x, y, z, rx, ry, rz, len], i) => { const m = new THREE.Mesh(frondGeo(400 + i, len, 0.5, 20, 0.75), fm); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.layers.set(1); sc.add(m); });

  return {
    name: 'okada', ...s, env, fg: true, title: ['3D ANIMATION', 'BREEZEOG'],
    update(t) {
      clouds.update(t);
      const k = 0.85 + 0.15 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 17);
      (pool.material as THREE.MeshBasicMaterial).color.setRGB(0.21 * 0.55 * k, 0.91 * 0.55 * k, 0.85 * 0.55 * k);
      ug.material.opacity = 0.7 + 0.3 * Math.sin(t * 3.1);
      cg.scale.setScalar(0.5 + 0.2 * Math.sin(t * 6));
    },
  };
}
