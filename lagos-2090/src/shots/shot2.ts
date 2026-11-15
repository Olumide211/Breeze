// Shot 2 — rooftop garden on a Lagos apartment block: solar panels, plants, washing lines, skyline.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, type Env } from '../core';
import { place, textures, cachedToon } from '../assets';
import { ground, box, cyl, blob, hedgePts, wire, cloth, vines, clothGeo } from '../build';
import { skyline, scatter, tree } from '../kit';
import { makeClouds } from '../sky';

export function shot2(): Shot {
  const env: Env = {
    hdri: 'spruit', sunAz: -150, sunEl: 23, sunCol: [1.15, 0.88, 0.6], skyCol: [0.30, 0.37, 0.62], groundCol: [0.36, 0.28, 0.25],
    fogCol: [0.98, 0.80, 0.70], fogSun: [1.2, 0.95, 0.7], fog: [0.0022, 0.0, 0.8], zenith: 0x3f86d8, horizon: 0xffd9b8, hdrMix: 0.3, exposure: 0.9,
    leak: 0.2, bloom: 0.42, sat: 1.22, contrast: 0.5, fogStart: 40,
  };
  const s = stage(env, { cam: [-7.6, 2.5, 8.6], look: [2.6, 1.5, -6], fov: 43, shadow: { center: [0, 0, 0], size: 16, depth: 120 } });
  const sc = s.scene; const r = mulberry32(202);
  const GY = -19; // street level below the roof

  // roof slab + parapet
  ground(sc, 20, 15, { color: 0xd8b295, map: textures.concrete, mapScale: 0.35, noiseScale: 0.25, noiseAmp: 0.22 });
  const wall = { color: 0xf1cfa8, map: textures.plaster, mapScale: 0.3, noiseScale: 0.3, noiseAmp: 0.22, grad: [0, 1.1] as [number, number], gradCol: 0xb98a7a };
  box(sc, 20.4, 1.0, 0.35, 0, 0.5, -7.5, wall); box(sc, 0.35, 1.0, 15, 10, 0.5, 0, wall); box(sc, 0.35, 1.0, 15, -10, 0.5, 0, wall);
  box(sc, 20.4, 0.1, 0.5, 0, 1.03, -7.5, { ...wall, color: 0xc97b5a }); box(sc, 0.5, 0.1, 15, 10, 1.03, 0, { ...wall, color: 0xc97b5a });
  box(sc, 20, 22, 15, 0, -11.02, 0, { ...wall, color: 0xe9c29c, grad: [-19, 0] });
  // stair bulkhead with a zinc roof
  box(sc, 3.2, 2.7, 3, 7.6, 1.35, -5.4, { ...wall, color: 0xe78f5e, grad: [0, 2.7] });
  box(sc, 3.8, 0.12, 3.6, 7.6, 2.78, -5.4, { color: 0x9fb6c0, map: textures.metal, mapScale: 0.5, spec: 0.3, rz: 0.06 });
  box(sc, 0.9, 1.9, 0.08, 6.5, 0.95, -3.88, { color: 0x2f6f73, map: textures.wood, mapScale: 0.6 });

  // solar: pack panels, glassy blue
  const pv = { spec: 0.9, noiseAmp: 0.05, color: 0xbfd0ff };
  place(sc, 'solar-panel-landscape-group', { x: 3.0, z: -4.3, s: 3.3, ry: Math.PI, ...pv });
  place(sc, 'solar-panel-landscape-group', { x: -2.6, z: -5.0, s: 3.3, ry: Math.PI, ...pv });
  place(sc, 'solar-panel-portrait', { x: 8.2, y: 2.85, z: -5.4, s: 3.2, ry: Math.PI, ...pv });

  // planters and beds
  for (let i = 0; i < 7; i++) {
    const x = -8.6 + i * 2.25;
    place(sc, 'planter', { x, z: -6.75, s: 4.6, color: 0xc98a62 });
    blob(sc, 30 + i, hedgePts(r, [x - 0.7, 0.95, -6.75], [x + 0.7, 0.95, -6.75], 4, 0.42), { swayAmp: 0.04, noiseScale: 1.2 });
    place(sc, pick(r, ['flower-red', 'flower-yellow', 'flower-purple']), { x: x + rr(r, -0.5, 0.5), y: 0.95, z: -6.4, s: 3.2, ry: r() * 6 });
  }
  // raised vegetable beds (wood + soil + leafy rows)
  for (const [bx, bz] of [[-6.2, -2.2], [-6.2, 0.4], [5.6, 0.6]] as const) {
    box(sc, 3.4, 0.45, 1.5, bx, 0.225, bz, { color: 0xa9744c, map: textures.wood, mapScale: 0.7, noiseAmp: 0.2 });
    box(sc, 3.2, 0.06, 1.3, bx, 0.47, bz, { color: 0x5a3f33, noiseAmp: 0.3, noiseScale: 2 });
    for (let k = 0; k < 9; k++) place(sc, pick(r, ['plant-flat-tall', 'plant-flat-short', 'grass-leafs-large', 'bush-small', 'grass-large']), { x: bx - 1.3 + (k % 5) * 0.65 + rr(r, -0.1, 0.1), y: 0.5, z: bz + (k < 5 ? -0.3 : 0.35), s: rr(r, 2.2, 3.4), ry: r() * 6 });
    if (bx > 0) for (let k = 0; k < 4; k++) place(sc, 'flower-yellow-b', { x: bx - 1.2 + k * 0.8, y: 0.5, z: bz, s: 3.4, ry: r() * 6 });
  }
  place(sc, 'potted-plant', { x: -3.4, z: 4.6, h: 1.3, ry: 1 }); place(sc, 'potted-plant', { x: 4.6, z: -1.9, h: 1.7, ry: 2 });
  place(sc, 'potted-plant', { x: -8.9, z: 2.9, h: 1.4, ry: 3 });
  place(sc, 'plant-small-1', { x: 1.6, z: 2.6, h: 0.55 }); place(sc, 'plant-small-2', { x: 2.3, z: 2.9, h: 0.5 }); place(sc, 'plant-small-1', { x: -4.2, z: 4.2, h: 0.6 });
  place(sc, 'barrel', { x: 0.8, z: -6.4, s: 3.2, color: 0x4f8fa8 }); tree(sc, 5, 0.8, -6.4, 3.4, 1.0, { y: 0.9, amp: 0.06 });
  place(sc, 'barrel', { x: 9.0, z: 1.6, s: 3.2, color: 0xe2a13a }); tree(sc, 6, 9.0, 1.6, 3.9, 1.0, { y: 0.9, amp: 0.06 });
  place(sc, 'bench-cushion', { x: 3.1, z: 2.6, s: 3.4, ry: -2.4 }); place(sc, 'table', { x: 4.4, z: 3.8, s: 1.5, ry: 0.4 });
  place(sc, 'washer', { x: 6.3, z: -3.7, s: 2.3, ry: 0 }); place(sc, 'dryer', { x: 5.0, z: -3.7, s: 2.3, ry: 0 });
  // black water tank on a stand (a Lagos rooftop staple)
  for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) cyl(sc, 0.06, 0.06, 1.3, -8.0 + dx, 0.65, -4.9 + dz, { color: 0x555a66 });
  box(sc, 1.9, 0.1, 1.9, -8.0, 1.33, -4.9, { color: 0x6a6f7a });
  cyl(sc, 0.95, 1.0, 1.7, -8.0, 2.23, -4.9, { color: 0x1c2a3a, spec: 0.35, noiseAmp: 0.08, seg: 20 }); cyl(sc, 0.3, 0.9, 0.3, -8.0, 3.2, -4.9, { color: 0x1c2a3a, seg: 20 });
  vines(sc, 9, { x: -8.0, y: 1.3, z: -3.95, width: 1.8, count: 10, len: [0.5, 1.2], amp: 0.1 });

  // woven mat, stool and watering cans in the foreground
  const mat = new THREE.Mesh(clothGeo(2.8, 1.9, 0x2f8f9d, 0xf2c230, 1), cachedToon({ noiseAmp: 0.14, noiseScale: 2, side: THREE.DoubleSide })); mat.rotation.set(-Math.PI / 2, 0, 0.5); mat.position.set(-1.2, 0.02, 4.6); mat.receiveShadow = true; sc.add(mat);
  place(sc, 'chair', { x: -0.4, z: 5.4, s: 1.9, ry: 2.4, color: 0xd9a066 }); place(sc, 'bag', { x: -2.1, y: 0.02, z: 4.2, h: 0.5, ry: 0.5 });
  place(sc, 'fruit-watermelon', { x: -1.3, y: 0.03, z: 4.3, s: 1.3 }); place(sc, 'fruit-pineapple', { x: -0.8, y: 0.03, z: 4.0, s: 1.2 });
  for (let i = 0; i < 5; i++) place(sc, i % 2 ? 'plant-small-1' : 'plant-small-2', { x: 0.6 + i * 0.55, z: 5.6 - i * 0.25, h: rr(r, 0.4, 0.6) });
  // washing lines
  const poleC = { color: 0x8a94a6, noiseAmp: 0.1 };
  const lines: [number, number, number, number, number][] = [[-4.2, 1.2, 4.4, 2.3, -0.2], [-3.0, -2.0, 5.2, 2.4, -3.0]];
  const cols = [0xf2c230, 0xe8554e, 0x2f8f9d, 0xfaf3e3, 0xe07a3a, 0x7c4fa3, 0x3fa66a, 0xf2e2c4, 0xd94f7a, 0x2b5fb3];
  let ci = 0;
  lines.forEach(([x0, z0, x1, h, z1], li) => {
    cyl(sc, 0.045, 0.055, h + 0.2, x0, (h + 0.2) / 2, z0, poleC); cyl(sc, 0.045, 0.055, h + 0.2, x1, (h + 0.2) / 2, z1, poleC);
    box(sc, 0.06, 0.06, 0.9, x0, h + 0.1, z0, poleC); box(sc, 0.06, 0.06, 0.9, x1, h + 0.1, z1, poleC);
    const w = wire(sc, [x0, h + 0.12, z0], [x1, h + 0.12, z1], 0.16, 0xeeeeee, 0.008);
    const ry = -Math.atan2(z1 - z0, x1 - x0);
    const n = li === 0 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.7) / (n + 0.4); const p = w.at(t);
      const big = li === 1 || i % 3 === 0;
      cloth(sc, { x: p.x, y: p.y - 0.01, z: p.z, ry, w: big ? rr(r, 0.9, 1.25) : rr(r, 0.5, 0.75), h: big ? rr(r, 1.1, 1.45) : rr(r, 0.65, 0.95), c1: cols[ci % cols.length], c2: cols[(ci + 3) % cols.length], pattern: [0, 1, 3, 4, 2, 0][ci % 6], amp: big ? 0.3 : 0.22, freq: 2.0 + (ci % 3) * 0.3, dir: [0.25, 0.04, 1] });
      ci++;
    }
  });

  // neighbouring roofs and the city
  const nb: [string, number, number, number, number][] = [['commercial-building-c', -16, -44, 15, 0], ['commercial-building-e', 22, -40, 13, 1], ['commercial-building-a', 46, -30, 12, 2], ['commercial-building-d', 2, -70, 13.5, 3], ['commercial-building-h', -46, -66, 13, 1], ['commercial-building-b', 64, -70, 14, 0]];
  nb.forEach(([n, x, z, sScale, k], i) => {
    const m = place(sc, n, { x, y: GY, z, s: sScale, ry: k * Math.PI / 2, color: [0xfde3c6, 0xf6c9b0, 0xdfeedd, 0xfbe9b8][i % 4], noiseScale: 0.05, noiseAmp: 0.16, grad: [GY, GY + 14], gradCol: 0xb48a92, spec: 0.2 });
    const top = GY + (m.geometry.boundingBox!.max.y) * sScale;
    blob(sc, 80 + i, hedgePts(r, [x - 4, top + 0.6, z], [x + 4, top + 0.6, z + 2], 7, 1.5), { swayAmp: 0.03, noiseScale: 0.3 });
    place(sc, 'solar-panel-landscape-group', { x: x + 2, y: top, z: z - 2, s: 4, ...pv });
    if (i % 2 === 0) place(sc, 'water-tower', { x: x - 3, y: top, z: z - 3, h: 6, color: 0xd9c0a8 });
  });
  for (let i = 0; i < 12; i++) tree(sc, 90 + i, rr(r, -70, 70), rr(r, -70, -18), rr(r, 9, 15), 1.3, { y: GY, amp: 0.05 });
  ground(sc, 2000, 2000, { color: 0x7a946a, y: GY, noiseScale: 0.01, noiseAmp: 0.3 });
  skyline(sc, 21, { x0: -260, x1: 300, z: -190, depth: 80, count: 30, s: [13, 24], y: GY, turbines: 0.25 });
  skyline(sc, 22, { x0: -520, x1: 560, z: -380, depth: 140, count: 44, s: [22, 50], y: GY, green: 0.35, turbines: 0.1 });
  const clouds = makeClouds(21, { lit: 0xfffaf0, mid: 0xffe2d0, shade: 0xd6c4dc }, [
    { x: -160, y: 110, z: -700, w: 190, h: 64, fade: 0.12 }, { x: 170, y: 150, z: -600, w: 230, h: 80, fade: 0.15 }, { x: 40, y: 70, z: -640, w: 150, h: 40, fade: 0.3 },
    { x: -340, y: 90, z: -560, w: 170, h: 50, fade: 0.25 }, { x: 360, y: 80, z: -520, w: 140, h: 44, fade: 0.25 },
  ], 2.0);
  sc.add(clouds.group);
  sc.add(motes({ count: 160, box: [16, 5, 12], center: [0, 2.6, 0], size: 0.03, color: 0xfff0d0, intensity: 0.9, speed: 0.6, drift: [0.4, 0.1, 0.2], seed: 8 }));
  const birds: THREE.Mesh[] = []; for (let i = 0; i < 4; i++) birds.push(place(sc, 'bird', { s: 2.4, color: 0x33303c, sway: 3, swayAmp: 0.9, swayFreq: 9, unlitMix: 0.5, cast: false }));

  return {
    name: 'rooftop', ...s, env, title: ['CONCEPT AND DESIGN', 'BREEZEOG'],
    update(t) {
      clouds.update(t);
      birds.forEach((b, i) => { b.position.set(30 + i * 6 - t * 6, 16 + i * 2.2 + Math.sin(t * 1.4 + i) * 0.5, -90 - i * 12); b.rotation.y = -Math.PI / 2; });
    },
  };
}
