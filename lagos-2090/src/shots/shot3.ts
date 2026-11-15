// Shot 3 — market street: colourful umbrellas, fruit stalls, hanging lanterns, glowing signs, dust motes.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, glow, glowDisc, type Env } from '../core';
import { place, textures } from '../assets';
import { ground, box, blob, hedgePts, wire, sign, shaft, vines, cloth } from '../build';
import { parasol, skyline, tree } from '../kit';
import { makeClouds } from '../sky';

const FAB = [0xe8443a, 0xf7b500, 0x1f9d8f, 0xf07c2a, 0x2a62c9, 0xd9418c, 0x48a84a, 0xfff1d6, 0x7a3fb0];

export function shot3(): Shot {
  const env: Env = {
    hdri: 'fire', sunAz: -97, sunEl: 13, sunCol: [1.5, 0.92, 0.5], skyCol: [0.30, 0.30, 0.56], groundCol: [0.40, 0.26, 0.24],
    fogCol: [0.95, 0.56, 0.42], fogSun: [1.3, 0.8, 0.42], fog: [0.0045, 0.0, 0.85], zenith: 0x3a55a0, horizon: 0xffa462, hdrMix: 0.7, exposure: 0.55,
    flare: 0.5, flareCol: 0xffb877, leak: 0.3, bloom: 0.62, sat: 1.25, contrast: 0.48,
  };
  const s = stage(env, { cam: [0.5, 1.6, 10], look: [-0.2, 2.5, -12], fov: 47, shadow: { center: [0, 0, -8], size: 26, depth: 200 } });
  const sc = s.scene; const r = mulberry32(303);

  ground(sc, 300, 300, { color: 0x9a7460, map: textures.asphalt, mapScale: 0.2, noiseScale: 0.12, noiseAmp: 0.3, z: -100 });
  // worn paving strip + drains
  for (const sx of [-1, 1]) box(sc, 1.6, 0.14, 120, sx * 5.6, 0.07, -45, { color: 0xc9a48c, map: textures.concrete, mapScale: 0.3, noiseAmp: 0.25 });

  // street walls: pack buildings, painted in Lagos pastels
  const walls = [0xf3b08a, 0x8fc7b5, 0xf6d28c, 0xe89aa0, 0x8fb6dd, 0xf0c6a0, 0xc7dba0, 0xe7a070];
  const names = ['commercial-building-a', 'commercial-building-b', 'commercial-building-d', 'commercial-building-h', 'commercial-building-c', 'commercial-building-f', 'commercial-building-g', 'commercial-building-e'];
  for (const sx of [-1, 1]) {
    let z = 12;
    for (let i = 0; i < 9; i++) {
      const n = names[(i * 3 + (sx > 0 ? 1 : 4)) % names.length]; const sc2 = rr(r, 9, 11.5);
      const m = place(sc, n, { x: sx * 11.2, z, s: sc2, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, color: walls[(i + (sx > 0 ? 3 : 0)) % walls.length], map: textures.plaster, mapScale: 0.18, mapMix: 0.6, noiseScale: 0.12, noiseAmp: 0.2, grad: [0, 5], gradCol: 0xb07a78, spec: 0.15 });
      const depth = m.geometry.boundingBox!.max.x - m.geometry.boundingBox!.min.x;
      // awning + shop sign per frontage
      const aw = place(sc, 'awning-wide', { x: sx * 6.35, y: 2.6, z, s: 7.5, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, color: pick(r, [0xff8a70, 0xffd070, 0x70d0c0, 0xff9ac0]), trans: 0.3, side: THREE.DoubleSide });
      z -= depth * sc2 + rr(r, 0.2, 1.2);
    }
  }
  // roof gardens spilling over the street walls
  for (const sx of [-1, 1]) { blob(sc, 31 + sx, hedgePts(r, [sx * 7.2, 10.5, 6], [sx * 7.4, 11.5, -60], 26, 1.5, 0.8), { swayAmp: 0.05, noiseScale: 0.3 }); vines(sc, 35 + sx, { x: sx * 6.7, y: 9.8, z: -22, ry: Math.PI / 2, width: 60, count: 60, len: [1, 4.5], amp: 0.3, dir: [1, 0, 0.3] }); }

  // stalls
  const fruit = ['fruit-orange', 'fruit-apple', 'fruit-tomato', 'fruit-coconut', 'fruit-watermelon', 'fruit-pineapple', 'fruit-banana', 'fruit-grapes'];
  const disp = ['display-fruit', 'display-flowers', 'display-bread', 'display-cans', 'display-fruit', 'shelf-bags'];
  let fi = 0;
  for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) {
    const z = 4.6 - i * 4.6 + (sx > 0 ? -1.6 : 0) + rr(r, -0.4, 0.4); const x = sx * rr(r, 3.3, 3.9);
    const c1 = FAB[(fi * 2 + 1) % FAB.length], c2 = FAB[(fi * 2 + 4) % FAB.length]; fi++;
    if (i % 3 === 2) {
      place(sc, i % 2 ? 'tent' : 'tent-canvas', { x: x + sx * 0.3, z, s: 5.6, ry: r() * 0.3, color: i % 2 ? 0xffd9a0 : 0xffb0a0, trans: 0.4, side: THREE.DoubleSide });
    } else parasol(sc, i % 2 ? 'parasol-a' : 'parasol-b', x + sx * 0.2, z + 0.2, rr(r, 2.9, 3.4), c1, c2, r() * 6);
    // table (pack table is corner-anchored) + produce
    place(sc, 'table', { x: x - 0.95, z: z + 0.5, s: 2.25, color: 0xb98356, map: textures.wood, mapScale: 0.8 });
    cloth(sc, { x, y: 0.76, z: z + 0.52, w: 1.9, h: 0.5, c1: c2, c2: c1, pattern: 1 + (fi % 3), amp: 0.03 });
    place(sc, disp[fi % disp.length], { x: x + rr(r, -0.3, 0.3), y: 0.74, z: z - 0.05, s: 1.25, ry: r() * 0.4 });
    for (let k = 0; k < 5; k++) place(sc, pick(r, fruit), { x: x + rr(r, -0.8, 0.8), y: 0.74, z: z + rr(r, 0.15, 0.4), s: rr(r, 0.9, 1.3), ry: r() * 6 });
    // crates, barrels, sacks around
    const px = x - sx * 1.5;
    place(sc, pick(r, ['box', 'box-large', 'box-open', 'barrel', 'barrel-open']), { x: px, z: z + rr(r, -0.6, 0.6), h: rr(r, 0.6, 0.85), ry: r() * 6 });
    if (r() < 0.6) place(sc, pick(r, ['bag', 'cardboard-box-open', 'box']), { x: px + rr(r, -0.3, 0.3), z: z + 1.2, h: rr(r, 0.45, 0.7), ry: r() * 6 });
    if (r() < 0.5) for (let k = 0; k < 4; k++) place(sc, pick(r, fruit), { x: px + rr(r, -0.25, 0.25), y: 0.62, z: z + rr(r, -0.7, -0.4), s: 1.2, ry: r() * 6 });
    const lamp = glow(0xffc070, 2.6, 0.5); lamp.position.set(x, 1.9, z); sc.add(lamp);
  }
  // hanging lanterns and string lights across the street
  const flick: THREE.Sprite[] = [];
  for (let i = 0; i < 9; i++) {
    const z = 5 - i * 4.4; const h = 5.4 + (i % 3) * 0.5;
    const w = wire(sc, [-6.6, h + 0.6, z], [6.6, h + 0.3, z - 1.2], 1.0, 0x2a2026, 0.012);
    for (let k = 0; k < 4; k++) {
      const p = w.at(0.14 + k * 0.24 + rr(r, -0.03, 0.03));
      place(sc, 'lantern-hanging', { x: p.x, y: p.y - 0.12, z: p.z - 0.3, s: 1.25, ry: r() * 6, selfGlow: 3.2, color: pick(r, [0xffffff, 0xffd0c0, 0xfff0b0]), flicker: 0.2, cast: false });
      const g = glow(pick(r, [0xffb347, 0xff8a3c, 0xffd070]), 2.4, 1.3); g.position.set(p.x, p.y - 0.75, p.z); sc.add(g); flick.push(g);
    }
  }
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) place(sc, 'string-lights-colored', { x: sx * 6.2, y: 3.9, z: 4 - i * 7, s: 6.5, ry: Math.PI / 2, selfGlow: 2.6, cast: false });

  // glowing signs (blade signs facing the camera + fascia boards)
  const signs: [string, number, number, number, string, string, string?][] = [
    ['SUYA SPOT', -5.3, 5.0, 2.5, '#2a0f18', '#ffb347', 'OPEN TILL LATE'], ['FRUITS', 5.4, 4.6, -1.5, '#0e2a22', '#8dffb0'], ['MAMA NKECHI', -5.4, 6.3, -6.5, '#2b1030', '#ff8ad0', 'RICE • STEW • DODO'],
    ['CHARGE HUB', 5.3, 6.6, -9.0, '#081c30', '#6fe8ff', 'SOLAR  24H'], ['AKARA', -5.2, 4.4, -13.5, '#30200a', '#ffe070'], ['ANKARA', 5.5, 5.2, -17.0, '#2a0d10', '#ff7a66', 'TAILOR'], ['BUKA 90', -5.5, 6.0, -22, '#0d2630', '#9af0e0'],
  ];
  for (const [t, x, y, z, bg, fg, sub] of signs) {
    sign(sc, t, { x, y, z, w: 2.6, h: sub ? 1.15 : 0.9, bg, fg, border: fg, glow: 2.3, sub });
    box(sc, 2.75, sub ? 1.3 : 1.05, 0.1, x, y, z - 0.07, { color: 0x2a2228 });
    const g = glow(fg as any, 5, 0.3); g.position.set(x, y, z + 0.3); sc.add(g);
  }
  // end of the street: trees, haze, city
  tree(sc, 51, -5.8, -42, 11, 1.3); tree(sc, 52, 6.2, -52, 13, 1.3); tree(sc, 53, 0, -84, 14, 1.4);
  for (let i = 0; i < 6; i++) place(sc, pick(r, ['palm-tall', 'palm-detailed-tall', 'palm-bend']), { x: rr(r, -5, 5) + (i % 2 ? 6 : -6), z: -30 - i * 7, h: rr(r, 9, 13), ry: r() * 6 });
  skyline(sc, 33, { x0: -90, x1: 90, z: -120, depth: 60, count: 16, s: [26, 48], turbines: 0.25 });
  const clouds = makeClouds(31, { lit: 0xffd9a8, mid: 0xff8f70, shade: 0x7e5f96 }, [{ x: -60, y: 110, z: -420, w: 170, h: 54, fade: 0.2 }, { x: 110, y: 150, z: -520, w: 200, h: 62, fade: 0.22 }, { x: 10, y: 70, z: -560, w: 110, h: 30, fade: 0.4 }], 1.4);
  sc.add(clouds.group);
  // vehicles parked deep in the street
  place(sc, 'truck-flat', { x: -1.6, z: -27, s: 1.7, ry: 0.1, color: 0xfff0e0 });
  // light shafts + dust
  for (let i = 0; i < 6; i++) shaft(sc, { x: -3.5 + i * 1.5 + rr(r, -0.5, 0.5), y: 9.5, z: -1 - i * 3.2, w: rr(r, 1.4, 2.6), len: 11, rz: 0.12 + rr(r, -0.05, 0.05), ry: 0.1, color: 0xffb070, k: rr(r, 0.1, 0.2) });
  sc.add(motes({ count: 900, box: [12, 7, 30], center: [0, 3.6, -4], size: 0.035, color: 0xffd9a0, intensity: 1.6, speed: 0.8, drift: [0.25, 0.1, 0.5], seed: 31, twinkle: 0.8 }));
  sc.add(motes({ count: 120, box: [8, 4, 6], center: [0, 2, 6], size: 0.06, color: 0xffe2b8, intensity: 0.8, speed: 0.6, drift: [0.2, 0.08, 0.3], seed: 32 }));

  return {
    name: 'market', ...s, env,
    update(t) {
      clouds.update(t);
      flick.forEach((g, i) => { const k = 1.15 + 0.22 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i) + 0.1 * Math.sin(t * 23 + i * 5); g.material.opacity = Math.min(1, k * 0.8); g.position.x += 0; g.scale.setScalar(2.4 * (0.92 + 0.12 * Math.sin(t * 2.2 + i))); });
    },
  };
}
