// Shot 8 — top-down view of a lush lagoon-side park: grass swaying, two egrets flying across, pollen drifting.
import * as THREE from 'three';
import type { Shot } from './common';
import { stage } from './common';
import { mulberry32, rr, pick, motes, type Env } from '../core';
import { place, textures, cachedToon, type Recolor } from '../assets';
import { box, cyl, blob, hedgePts, water, clothGeo } from '../build';
import { scatter, tree } from '../kit';

const egretCol: Recolor = (c, i) => {
  if (i.hsl.s > 0.5 && i.hsl.h > 0.05 && i.hsl.h < 0.12) c.setHex(0xf2a53a);       // beak
  else if (i.hsl.l < 0.12 && i.z < -0.5) c.setHex(0x1c1c22);                       // eye
  else c.setHex(0xfffdf6);
};

export function shot8(): Shot {
  const env: Env = {
    hdri: 'spruit', sunAz: 214, sunEl: 41, sunCol: [1.3, 1.08, 0.74], skyCol: [0.30, 0.38, 0.60], groundCol: [0.3, 0.3, 0.26],
    fogCol: [0.9, 0.9, 0.8], fogSun: [1, 1, 0.8], fog: [0.0, 0.0, 0.0], zenith: 0x3d84da, horizon: 0xffe6c4, hdrMix: 0.4, exposure: 0.9,
    leak: 0.22, bloom: 0.45, sat: 1.28, contrast: 0.5, vignette: 0.34,
  };
  const s = stage(env, { cam: [0, 47, 0], look: [0, 0, 0], up: [0, 0, -1], fov: 40, shadow: { center: [0, 0, 0], size: 46, depth: 200, res: 4096 } });
  const sc = s.scene; const r = mulberry32(808);
  const n = new THREE.Vector2(0.62, -0.78).normalize(), td = new THREE.Vector2(0.78, 0.62).normalize(); const C = -9;
  const shoreOff = (u: number) => 2.4 * Math.sin(u * 0.13) + 1.3 * Math.sin(u * 0.31 + 1) + 0.6 * Math.sin(u * 0.7);
  const landShape = (c: number) => {
    const sh = new THREE.Shape(); let first = true;
    for (let u = -90; u <= 90; u += 1.5) { const k = c + shoreOff(u); const x = n.x * k + td.x * u, z = n.y * k + td.y * u; if (first) { sh.moveTo(x, -z); first = false; } else sh.lineTo(x, -z); }
    const a = [n.x * 160 + td.x * 90, n.y * 160 + td.y * 90], b = [n.x * 160 - td.x * 90, n.y * 160 - td.y * 90];
    sh.lineTo(a[0], -a[1]); sh.lineTo(b[0], -b[1]); sh.closePath();
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.deleteAttribute('uv'); return g;
  };
  const onLand = (x: number, z: number, m = 1) => { const u = x * td.x + z * td.y; return x * n.x + z * n.y > C + shoreOff(u) + m; };

  water(sc, 400, { y: -0.35, deep: 0x1d6f9a, shallow: 0x4fc2c4, sky: 0xbfeaf2, scale: 2.2, glitter: 0.45, lines: 1.5, shore: new THREE.Vector4(-n.x, -n.y, -(C - 2.6), 1) });
  const sand = new THREE.Mesh(landShape(C - 2.6), cachedToon({ vcol: false, color: 0xf3dcaa, noiseScale: 0.25, noiseAmp: 0.22, map: textures.concrete, mapScale: 0.2, mapMix: 0.4 })); sand.position.y = -0.06; sand.receiveShadow = true; sc.add(sand);
  const grass = new THREE.Mesh(landShape(C), cachedToon({ vcol: false, color: 0x6fae45, map: textures.grass, mapScale: 0.09, mapMix: 0.7, noiseScale: 0.06, noiseAmp: 0.34, wind: 0.5 })); grass.receiveShadow = true; sc.add(grass);

  // winding sand paths (ribbons)
  const ribbon = (pts: [number, number][], w: number, color: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.04, z))); const N = 90; const P: number[] = [], I: number[] = [];
    for (let i = 0; i <= N; i++) { const p = curve.getPoint(i / N), t = curve.getTangent(i / N); const nx = -t.z, nz = t.x; const ww = w * (1 + 0.12 * Math.sin(i * 0.5)); P.push(p.x + nx * ww / 2, 0.04, p.z + nz * ww / 2, p.x - nx * ww / 2, 0.04, p.z - nz * ww / 2); if (i < N) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, cachedToon({ vcol: false, color, noiseScale: 0.4, noiseAmp: 0.22, side: THREE.DoubleSide })); m.receiveShadow = true; sc.add(m); return curve;
  };
  const mainPath = ribbon([[34, -13], [22, -10.5], [13, -5], [7, 1.5], [1.5, 3.2], [-3.2, 6.6], [-5.0, 8.2]], 2.3, 0xf0d6a4);
  const paths = [mainPath, ribbon([[7, 1.5], [3, -5], [-6, -9], [-18, -10], [-34, -15]], 1.9, 0xf0d6a4), ribbon([[13, -5], [17, 4], [22, 12], [27, 20]], 1.7, 0xf0d6a4)];

  // pier + moored boats
  const P = new THREE.Group(); P.position.set(-5.4, 0, 8.6); P.rotation.y = Math.atan2(-n.x, -n.y); sc.add(P);
  for (let i = 0; i < 16; i++) box(P, 2.0, 0.08, 0.5, 0, 0.12, 0.3 + i * 0.56, { color: i % 3 ? 0xc79a6a : 0xb98a5c, map: textures.wood, mapScale: 0.8, noiseAmp: 0.2 });
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) cyl(P, 0.1, 0.1, 0.9, sx * 0.95, -0.1, 0.5 + i * 2.1, { color: 0x7a5a40 });
  const boats: { m: THREE.Object3D; x: number; z: number; ry: number; ph: number; vx: number; vz: number }[] = [];
  const addBoat = (nm: string, x: number, z: number, len: number, ry: number, vx = 0, vz = 0, color = 0xffffff) => { const g = new THREE.Group(); sc.add(g); place(g, nm, { len, y: -0.42, color, map: textures.wood, mapScale: 0.6, mapMix: 0.4 }); boats.push({ m: g, x, z, ry, ph: boats.length * 2, vx, vz }); };
  addBoat('boat-row-small', -11.2, 10.9, 3.6, 0.3, 0, 0, 0xfff0e0); addBoat('canoe', -9.2, 14.6, 4.6, 2.3, 0, 0, 0xe0a060); addBoat('canoe', -21, 7.5, 4.4, 1.2, 0.3, -0.12, 0xd98a50); addBoat('boat-row-small', -24.5, 13.5, 3.4, -0.6, -0.2, 0.05, 0xffe6d0);
  // lily pads
  const pad = new THREE.CylinderGeometry(0.45, 0.45, 0.03, 9); pad.deleteAttribute('uv');
  const pm = cachedToon({ vcol: false, color: 0x4f9a48, noiseAmp: 0.2, noiseScale: 1 }); const pads = new THREE.InstancedMesh(pad, pm, 60); const d = new THREE.Object3D(); let pc = 0;
  for (let i = 0; i < 400 && pc < 60; i++) { const x = rr(r, -30, 6), z = rr(r, -2, 17); const u = x * td.x + z * td.y; const dist = (C + shoreOff(u)) - (x * n.x + z * n.y); if (dist > 4 && dist < 10 && (Math.sin(x * 0.5) + Math.cos(z * 0.6)) > 0.3) { d.position.set(x, -0.3, z); d.scale.setScalar(rr(r, 0.6, 1.5)); d.rotation.y = r() * 6; d.updateMatrix(); pads.setMatrixAt(pc++, d.matrix); } }
  pads.count = pc; pads.receiveShadow = true; sc.add(pads);

  // trees, palms, beds
  const spots: [number, number, number][] = [[23, -1, 7], [28, 8, 8], [-3, -11, 7.5], [-13, -4, 6.5], [-22, -14, 8], [8, -15, 7], [31, -11, 6.5], [20, 15, 7.5], [-29, -7, 7], [-10, -16, 6.5], [3.5, 9, 5.5]];
  spots.forEach(([x, z, h], i) => tree(sc, 800 + i, x, z, h, 1.0, { amp: 0.16, palette: i % 3 === 0 ? [0x2f7a3e, 0x3f8f3a, 0x5a9a2e] : undefined }));
  const palms: [number, number][] = [[-1.5, 9.2], [3.5, 12.5], [-12.5, 2.2], [-17, -1.5], [8.5, 14.8], [12, 16.5], [-24, -4.5], [0.5, 6.2], [-8.5, 3.8]];
  palms.forEach(([x, z], i) => place(sc, ['palm-tall', 'palm-detailed-tall', 'palm-bend', 'palm'][i % 4], { x, z, h: rr(r, 7, 10), ry: r() * 6, swayAmp: 0.3 }));
  const beds: [number, number, number][] = [[12.5, 2.5, 2.6], [-4.5, -1.2, 2.2], [24, -14.5, 2.4], [-14, -9.5, 2.0]];
  beds.forEach(([bx, bz, br], i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(br, br + 0.35, 24), cachedToon({ vcol: false, color: 0xe8d8c0, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(bx, 0.05, bz); sc.add(ring);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(br, 24), cachedToon({ vcol: false, color: 0x6a4a3a, noiseAmp: 0.3, noiseScale: 1.5 })); soil.rotation.x = -Math.PI / 2; soil.position.set(bx, 0.045, bz); soil.receiveShadow = true; sc.add(soil);
    for (const fl of ['flower-red', 'flower-yellow', 'flower-purple', 'flower-red-b', 'flower-yellow-b']) scatter(sc, 820 + i * 7 + fl.length, fl, 16, (q) => { const a = q() * 6.28, rad = Math.sqrt(q()) * br * 0.92; return [bx + Math.cos(a) * rad, 0.05, bz + Math.sin(a) * rad]; }, [4.5, 6.5], { cast: true, selfGlow: 0.25 });
    blob(sc, 840 + i, [[bx, 0.6, bz, 0.7], [bx + 0.5, 0.5, bz + 0.3, 0.5]], { swayAmp: 0.05 });
  });
  // meadow: instanced pack grass + wildflowers, swaying
  const pathPts: THREE.Vector3[] = []; for (const c of paths) for (let i = 0; i <= 40; i++) pathPts.push(c.getPoint(i / 40));
  const nearPath = (x: number, z: number) => { for (const p of pathPts) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < 2.4) return true; } return false; };
  const land = (m: number) => (q: () => number): [number, number, number] => { for (let k = 0; k < 40; k++) { const x = rr(q, -34, 34), z = rr(q, -20, 20); if (onLand(x, z, m) && !nearPath(x, z)) return [x, 0.02, z]; } return [20, 0.02, -16]; };
  scatter(sc, 81, 'grass-large', 3600, land(1.0), [2.4, 5.2], { swayAmp: 0.28, swayFreq: 2.2, cast: false, wind: 0.6 });
  scatter(sc, 82, 'grass-leafs-large', 900, land(0.6), [2.2, 4.2], { swayAmp: 0.24, swayFreq: 2.4, wind: 0.6 });
  scatter(sc, 83, 'flower-yellow', 150, land(1.5), [3.5, 5], { swayAmp: 0.2, selfGlow: 0.2 }); scatter(sc, 84, 'flower-red', 110, land(1.5), [3.5, 5], { swayAmp: 0.2, selfGlow: 0.2 }); scatter(sc, 85, 'flower-purple', 110, land(1.5), [3.5, 5], { swayAmp: 0.2, selfGlow: 0.2 });
  scatter(sc, 86, 'bush-detailed', 40, land(2), [3, 5.5], { cast: true, swayAmp: 0.1 }); scatter(sc, 87, 'bush', 30, land(1.2), [3, 5], { cast: true, swayAmp: 0.1 });
  for (let i = 0; i < 12; i++) { const u = -40 + i * 7 + rr(r, -2, 2); const k = C - 1.2 + shoreOff(u) + rr(r, -1, 0.4); place(sc, pick(r, ['rock-small-a', 'rock-small-c', 'rock-large-a']), { x: n.x * k + td.x * u, y: -0.1, z: n.y * k + td.y * u, s: rr(r, 2.2, 4), ry: r() * 6, recolor: (c) => { c.setHex(0xb8aa9c); }, key: 'rockgrey' }); }
  // benches along the path, a picnic blanket
  for (const tt of [0.18, 0.42, 0.62]) { const p = mainPath.getPoint(tt), t = mainPath.getTangent(tt); place(sc, 'bench-park', { x: p.x - t.z * 2.1, y: 0.02, z: p.z + t.x * 2.1, s: 1.9, color: 0x9c8468, ry: Math.atan2(t.x, t.z) - Math.PI / 2 }); }
  const blanket = new THREE.Mesh(clothGeo(2.6, 2.0, 0xe8443a, 0xfff1d6, 2), cachedToon({ noiseAmp: 0.1, side: THREE.DoubleSide })); blanket.rotation.set(-Math.PI / 2, 0, 0.5); blanket.position.set(17.5, 0.3, -9.2); blanket.receiveShadow = true; sc.add(blanket);
  place(sc, 'box-open', { x: 18.6, y: 0.3, z: -8.6, s: 2.2, ry: 0.4 }); place(sc, 'fruit-watermelon', { x: 17.2, y: 0.3, z: -8.2, s: 1.6 }); place(sc, 'fruit-orange', { x: 17.9, y: 0.3, z: -7.6, s: 1.8 });
  place(sc, 'solar-panel-landscape-group', { x: 27.5, z: 13, s: 3.2, ry: 0.6, spec: 0.8, color: 0xbfd0ff });

  // egrets: pack bird mesh stretched, whitened and flapped in the shader
  const egrets = [0, 1].map((i) => {
    const g = new THREE.Group(); sc.add(g);
    const m = place(g, 'bird', { key: 'egret', recolor: egretCol, sway: 3, swayAmp: 0.95, swayFreq: 7.5 + i * 0.8, unlitMix: 0.25, noiseAmp: 0.03, rim: 0.2, side: THREE.DoubleSide });
    m.scale.set(7.0, 2.6, 3.6); m.position.z = 1.2;
    return g;
  });
  sc.add(motes({ count: 520, box: [70, 26, 42], center: [0, 20, 0], size: 0.085, color: 0xfff6c8, intensity: 1.15, speed: 0.7, drift: [2.2, 0.3, 0.9], seed: 88, twinkle: 0.5 }));
  sc.add(motes({ count: 60, box: [50, 8, 30], center: [0, 38, 0], size: 0.16, color: 0xfff2c0, intensity: 0.55, speed: 0.5, drift: [1.6, 0.2, 0.6], seed: 89, twinkle: 0.3 }));

  return {
    name: 'park', ...s, env,
    update(t) {
      for (const b of boats) { b.m.position.set(b.x + b.vx * t, Math.sin(t * 1.4 + b.ph) * 0.05, b.z + b.vz * t); b.m.rotation.set(Math.sin(t * 1.1 + b.ph) * 0.03, b.ry + Math.sin(t * 0.5 + b.ph) * 0.05, Math.sin(t * 1.6 + b.ph) * 0.04); }
      egrets.forEach((g, i) => {
        const u = t - i * 0.5; const x = 25 - u * 10.5 + i * 1.5, z = 9.5 - u * 4.6 - i * 5.5 + Math.sin(u * 1.2 + i) * 1.0;
        g.position.set(x, 17 + i * 2.5 + Math.sin(u * 2 + i) * 0.4, z);
        g.rotation.set(0, Math.atan2(10.5, 4.6 - Math.cos(u * 1.2 + i) * 1.2), Math.sin(u * 1.2 + i) * 0.15, 'YXZ');
      });
    },
  };
}
