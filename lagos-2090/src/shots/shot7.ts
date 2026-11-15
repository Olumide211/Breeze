// Shot 7 — inside a danfo looking out of the window: the city passes, rainbow light leaks wash over the lens.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, glow, G, type Env } from '../core';
import { place, textures } from '../assets';
import { ground, box, cyl, blob, hedgePts, sign, cloth, shaft, wire, water } from '../build';
import { parasol, skyline, tree } from '../kit';
import { makeClouds } from '../sky';

export function shot7(): Shot {
  const env: Env = {
    hdri: 'fire', sunAz: 8, sunEl: 9.5, sunCol: [1.7, 1.0, 0.5], skyCol: [0.24, 0.24, 0.46], groundCol: [0.34, 0.22, 0.2],
    fogCol: [0.95, 0.56, 0.42], fogSun: [1.35, 0.8, 0.42], fog: [0.0026, 0.0, 0.86], zenith: 0x35539e, horizon: 0xffa060, hdrMix: 0.72, exposure: 0.55,
    flare: 0.5, flareCol: 0xffc080, leak: 0.3, rainbow: 0.85, bloom: 0.8, sat: 1.22, contrast: 0.45, fogStart: 25,
  };
  const s = stage(env, { cam: [-0.95, 1.2, 0.75], look: [1.05, 1.42, -0.25], fov: 56, near: 0.05, shadow: { center: [4, 1, 0], size: 14, depth: 160 } });
  const sc = s.scene; const r = mulberry32(707);

  // ---------------- interior (static; the camera rides with the bus)
  const I = new THREE.Group(); sc.add(I);
  const WX = 1.05;
  const paint = { color: 0xf2b21c, noiseScale: 1.2, noiseAmp: 0.14, map: textures.metal, mapScale: 1.5, mapMix: 0.25 };
  const cream = { color: 0xf3e2c2, noiseScale: 1.2, noiseAmp: 0.16 };
  const dark = { color: 0x23262e, noiseAmp: 0.06 };
  box(I, 0.1, 0.95, 7, WX + 0.05, 0.475, 0, paint);
  for (const y of [0.56, 0.7]) box(I, 0.012, 0.07, 7, WX - 0.005, y, 0, { color: 0x111114 });
  box(I, 0.1, 0.4, 7, WX + 0.05, 1.95, 0, cream);
  const wins: [number, number][] = [[-3.2, -1.72], [-1.56, -0.08], [0.08, 1.56], [1.72, 3.2]];
  for (const z of [-3.28, -1.64, 0, 1.64, 3.28]) box(I, 0.12, 0.84, 0.16, WX + 0.04, 1.35, z, dark);
  for (const [z0, z1] of wins) {
    box(I, 0.13, 0.035, z1 - z0, WX + 0.04, 0.965, (z0 + z1) / 2, dark); box(I, 0.13, 0.035, z1 - z0, WX + 0.04, 1.755, (z0 + z1) / 2, dark);
    // sliding pane rail + a short fringe curtain
    box(I, 0.02, 0.8, 0.03, WX + 0.02, 1.36, (z0 + z1) / 2 + 0.2, { color: 0x3a3e48, spec: 0.5 });
    cloth(I, { x: WX - 0.03, y: 1.76, z: (z0 + z1) / 2, ry: Math.PI / 2, w: z1 - z0 - 0.04, h: 0.13, c1: 0xb5262e, c2: 0xf2c230, pattern: 4, amp: 0.035, freq: 5, dir: [0.4, 0, 1] });
  }
  box(I, 0.16, 0.03, 7, WX - 0.04, 0.945, 0, { color: 0x3a2a22, map: textures.wood, mapScale: 1.2 });
  box(I, 3, 0.08, 7, -0.2, 2.16, 0, { ...cream, color: 0xe6d2b0 });
  box(I, 3, 0.06, 7, -0.2, 0.0, 0, { color: 0x3a3238, noiseAmp: 0.2 });
  // front bulkhead with a windscreen opening
  box(I, 3, 0.95, 0.1, -0.2, 0.475, -3.45, paint); box(I, 3, 0.4, 0.1, -0.2, 1.95, -3.45, cream);
  for (const x of [-1.6, -0.2, 1.0]) box(I, 0.14, 0.84, 0.12, x, 1.35, -3.45, dark);
  box(I, 0.1, 2.2, 7, -1.65, 1.1, 0, { ...paint, color: 0xd9a01a });
  // grab rail and swaying straps
  cyl(I, 0.018, 0.018, 7, 0.45, 1.98, 0, { color: 0xb8bcc8, spec: 0.8, rx: Math.PI / 2 });
  for (const z of [-1.5, -0.55, 0.3]) { cloth(I, { x: 0.45, y: 1.97, z, ry: Math.PI / 2, w: 0.035, h: 0.28, c1: 0x2a2a30, amp: 0.05, freq: 4.2, dir: [0, 0, 1] }); }
  // seats: vinyl backs with a strip of ankara
  const vinyl = { color: 0x7a3b2e, noiseScale: 1.5, noiseAmp: 0.2, rim: 0.5 };
  for (const z of [-1.35, -0.05]) {
    box(I, 0.95, 0.62, 0.11, 0.52, 0.82, z, { ...vinyl, rx: -0.08 });
    cyl(I, 0.055, 0.055, 0.95, 0.52, 1.13, z + 0.025, { ...vinyl, rz: Math.PI / 2 });
    box(I, 0.95, 0.12, 0.5, 0.52, 0.5, z + 0.3, vinyl);
    box(I, 0.96, 0.1, 0.115, 0.52, 0.98, z + 0.012, { color: 0x1f9d8f, noiseAmp: 0.3, noiseScale: 6, rx: -0.08 });
    cyl(I, 0.016, 0.016, 0.5, 0.06, 0.92, z, { color: 0xb8bcc8, spec: 0.8 });
  }
  // near seat back in the foreground (close to lens)
  box(I, 1.0, 0.7, 0.12, -0.75, 0.78, -0.35, { ...vinyl, color: 0x6a3026 });
  cyl(I, 0.06, 0.06, 1.0, -0.75, 1.13, -0.35, { ...vinyl, color: 0x6a3026, rz: Math.PI / 2 });
  // a sticker on the pillar + small hanging charm
  sign(I, 'NO SHAKING', { x: WX - 0.025, y: 1.45, z: 0, ry: -Math.PI / 2, w: 0.13, h: 0.22, bg: '#f2c230', fg: '#1a1a1a', glow: 0.5, font: 30 });
  // glass streaks
  for (const [z0, z1] of wins) { const sh = shaft(I, { x: WX + 0.07, y: 1.75, z: (z0 + z1) / 2 + 0.3, w: 0.5, len: 1.1, rz: 0, ry: -Math.PI / 2, color: 0xffe0c0, k: 0.06 }); sh.rotation.set(0.5, -Math.PI / 2, 0); }

  // ---------------- the city sliding past (everything in one group moving along +z)
  const O = new THREE.Group(); sc.add(O);
  ground(O, 13, 900, { color: 0x6f6470, map: textures.asphalt, mapScale: 0.2, noiseScale: 0.1, noiseAmp: 0.25, x: -1.5, y: -0.55 });
  box(O, 0.4, 0.2, 900, 5.0, -0.45, 0, { color: 0xd0bfb2, map: textures.concrete, mapScale: 0.3 });
  box(O, 9.6, 0.16, 900, 10, -0.47, 0, { color: 0xd2b49c, map: textures.concrete, mapScale: 0.3, noiseAmp: 0.25 });
  box(O, 0.5, 0.8, 900, 14.9, -0.1, 0, { color: 0xe6d2bc, map: textures.concrete, mapScale: 0.3 });
  for (let i = 0; i < 70; i++) box(O, 0.16, 0.02, 2.4, 2.9, -0.53, 40 - i * 6, { color: 0xf3e6c8, cast: false });
  const lagoon = water(sc, 3000, { y: -1.6, x: 900, deep: 0x163a78, shallow: 0x2f74a8, sky: 0xff9c78, scale: 1, glitter: 1.0, lines: 1.0 });
  // promenade: lamps, palms, trees, kiosks and parasols whipping past
  for (let k = 0; k < 9; k++) { const zz = 34 - k * 17; place(O, 'street-light-curved', { x: 6.0, y: -0.4, z: zz, h: 6.5, ry: Math.PI / 2, color: 0x9aa0b8 }); const g = glow(0xffd9a0, 2.4, 1.4); g.position.set(4.8, 5.95, zz); O.add(g); }
  for (let k = 0; k < 13; k++) { const zz = 36 - k * 11 + rr(r, -2.5, 2.5); if (k % 3 === 1) tree(O, 720 + k, rr(r, 11, 13.5), zz, rr(r, 6, 8), 1.2, { y: -0.4 }); else place(O, pick(r, ['palm-tall', 'palm-detailed-tall', 'palm']), { x: rr(r, 9.5, 13.5), y: -0.4, z: zz, h: rr(r, 7.5, 10.5), ry: r() * 6 }); }
  blob(O, 730, hedgePts(r, [14.4, 0.1, 40], [14.4, 0.1, -110], 90, 0.8, 0.5), { swayAmp: 0.04 });
  for (let k = 0; k < 7; k++) {
    const zz = 30 - k * 20 + rr(r, -3, 3);
    if (k % 2 === 0) { parasol(O, k % 4 === 0 ? 'parasol-a' : 'parasol-b', 9.4, zz, 3.0, pick(r, [0xe8443a, 0xf7b500, 0x1f9d8f, 0xd9418c]), pick(r, [0xfff1d6, 0x2a62c9, 0xf07c2a]), r() * 6); place(O, 'table', { x: 8.6, y: -0.4, z: zz + 0.5, s: 2.0, color: 0xb98356 }); place(O, 'display-fruit', { x: 9.4, y: 0.26, z: zz, s: 1.2 }); }
    else { place(O, 'bench-park', { x: 12.6, y: -0.4, z: zz, s: 1.7, ry: -Math.PI / 2, color: 0xc9a078 }); const fg = pick(r, ['#ffb347', '#6fe8ff', '#ff8ad0', '#8dffb0']); sign(O, pick(r, ['BUKA', 'SUYA', 'CHARGE', 'FERRY']), { x: 9.8, y: 3.4, z: zz + 6, ry: -Math.PI / 2, w: 2.6, h: 0.9, bg: '#1a1220', fg, border: fg, glow: 2.2 }); box(O, 0.1, 3.0, 0.1, 9.9, 1.1, zz + 6, { color: 0x2a2228 }); }
  }
  // the waterfront city across the lagoon: stilted blocks, roof gardens, turbines
  const walls = [0xf3b08a, 0x8fc7b5, 0xf6d28c, 0xe89aa0, 0x8fb6dd, 0xf0c6a0, 0xc7dba0, 0xe7a070];
  const bnames = ['commercial-building-a', 'commercial-building-b', 'commercial-building-d', 'commercial-building-h', 'commercial-building-c', 'commercial-building-g', 'commercial-building-e', 'commercial-building-f'];
  box(O, 60, 2.6, 520, 108, -1.4, -60, { color: 0x86a05c, noiseScale: 0.03, noiseAmp: 0.3 });
  for (let i = 0; i < 26; i++) {
    const z = 150 - i * 17 + rr(r, -4, 4); const n = bnames[i % bnames.length]; const sc2 = rr(r, 12, 20);
    const m = place(O, n, { x: rr(r, 88, 112), y: -0.2, z, s: sc2, ry: -Math.PI / 2, color: walls[i % walls.length], noiseScale: 0.05, noiseAmp: 0.2, grad: [0, 12], gradCol: 0xb07a78, spec: 0.2, cast: false });
    if (i % 2 === 0) blob(O, 740 + i, hedgePts(r, [m.position.x - 2, m.geometry.boundingBox!.max.y * sc2, z - 4], [m.position.x - 2, m.geometry.boundingBox!.max.y * sc2 + 0.5, z + 4], 5, 2.2), { swayAmp: 0 });
    if (i % 3 === 0) tree(O, 760 + i, 80, z + 8, rr(r, 10, 14), 1.3, { y: -0.2 });
    if (i % 5 === 0) place(O, 'windmill', { x: 84, y: -0.2, z: z - 8, h: rr(r, 26, 34), color: 0xfff0e2, cast: false });
  }
  const boatsG: THREE.Object3D[] = [];
  ([['boat-sail-a', 34, 6, 7], ['canoe', 24, -22, 5.5], ['boat-fishing-small', 52, -52, 8], ['boat-row-small', 28, 34, 4.5], ['boat-sail-b', 60, -96, 8], ['boat-tug-a', 46, 70, 10]] as [string, number, number, number][]).forEach(([nm, x, z, len]) => { boatsG.push(place(O, nm, { x, y: -1.7, z, len, ry: r() * 6 })); });
  const far = new THREE.Group(); far.rotation.y = -Math.PI / 2; far.position.set(0, -0.5, 0); O.add(far);
  skyline(far, 76, { x0: -520, x1: 560, z: -300, depth: 120, count: 40, s: [34, 76], green: 0.3, turbines: 0.1 });
  const clouds = makeClouds(71, { lit: 0xffd9a8, mid: 0xff8f70, shade: 0x7a5c94 }, [{ x: 420, y: 110, z: -120, w: 170, h: 54, fade: 0.2, ry: Math.PI / 2 }, { x: 520, y: 150, z: 160, w: 210, h: 66, fade: 0.22, ry: Math.PI / 2 }, { x: 560, y: 70, z: -360, w: 160, h: 44, fade: 0.35, ry: Math.PI / 2 }], 0);
  sc.add(clouds.group);
  sc.add(motes({ count: 140, box: [1.8, 1.6, 3.4], center: [0.1, 1.3, 0], size: 0.012, color: 0xffe0b0, intensity: 1.4, speed: 0.8, drift: [0.05, 0.03, 0.08], seed: 77 }));

  return {
    name: 'danfo-window', ...s, env, title: ['STORYLINE', 'BREEZEOG'],
    sunVis: (t) => 0.55 + 0.45 * Math.sin(t * 2.6 + 0.5) * Math.sin(t * 1.3),
    update(t) {
      O.position.z = t * 8.6; (lagoon.material as THREE.ShaderMaterial).uniforms.uOffset.value.set(0, -t * 8.6);
      boatsG.forEach((b, i) => { b.position.y = -1.7 + Math.sin(t * 1.5 + i * 2) * 0.06; b.rotation.z = Math.sin(t * 1.3 + i) * 0.04; });
      O.position.y = Math.sin(t * 2.3) * 0.018 + Math.sin(t * 5.1) * 0.006;   // the bus hovers; the world bobs gently instead of the camera
      O.rotation.x = Math.sin(t * 1.7) * 0.002;
    },
  };
}
