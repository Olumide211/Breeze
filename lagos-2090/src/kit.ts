// Reusable set dressing assembled from pack models + procedural pieces.
import * as THREE from 'three';
import { mulberry32, rr, pick, glow, glowDisc, toon, type Rng } from './core';
import { place, model, geo, restyle, cachedToon, textures, type Recolor } from './assets';
import { blob, cyl, box, hedgePts, foliageMat } from './build';

const YELLOW = 0xf7b500;
export const danfoRecolor: Recolor = (c, i) => {
  if (i.hsl.s > 0.3 && i.hsl.h > 0.5 && i.hsl.h < 0.75) {
    if (i.y > 0.74 && i.z > 0.6 && i.nz > 0.25) { c.setHex(0x3d6f84); return; }   // windscreen -> deep teal glass
    c.setHex(YELLOW); return Math.abs(i.nx) > 0.5 ? 1 : 0;                         // paintwork -> danfo yellow (+ stripe mask)
  }
  c.setHex(i.hsl.l < 0.3 ? 0x121217 : 0x1d1d24);                                    // tyres, bumpers, trim
};

/** Yellow hover-danfo built from the Kenney van: wheels removed, hover pods and glow added. Front faces +z. */
export function danfo(parent: THREE.Object3D, scale = 1.75): { group: THREE.Group; update(t: number): void } {
  const g = new THREE.Group(); parent.add(g);
  place(g, 'van', { s: scale, key: 'danfo', recolor: danfoRecolor, skip: /wheel/, stripe: [0.56, 0.62, 0.67, 0.73], spec: 0.35, unlitMix: 0.3, noiseAmp: 0.07, noiseScale: 0.6, rim: 0.5, dapple: 0.5 });
  const pods: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.62, 0.86], [0.62, 0.86], [-0.62, -0.92], [0.62, -0.92]]) {
    const pod = cyl(g, 0.3 * scale, 0.36 * scale, 0.16 * scale, x * scale, 0.2 * scale, z * scale, { color: 0x20242c, spec: 0.4, noiseAmp: 0.03, seg: 16 });
    const ring = cyl(g, 0.3 * scale, 0.3 * scale, 0.03 * scale, x * scale, 0.11 * scale, z * scale, { color: 0x102030, emissive: 0x4fe8ff, emissiveK: 5, flicker: 0.12, seg: 16 });
    ring.castShadow = false; pods.push(pod);
    const gl = glow(0x59e6ff, 1.5 * scale, 0.75); gl.position.set(x * scale, 0.05 * scale, z * scale); g.add(gl);
  }
  // side + rear windows, roof rack with cargo (pack crates)
  const glass = { color: 0x1c3a4c, spec: 0.3, noiseAmp: 0.04, rim: 0.3 };
  for (const sx of [-1, 1]) for (const [z0, z1] of [[-1.18, -0.55], [-0.47, 0.12], [0.2, 0.62]]) box(g, 0.05 * scale, 0.27 * scale, (z1 - z0) * scale, sx * 0.685 * scale, 1.0 * scale, ((z0 + z1) / 2) * scale, glass);
  box(g, 1.0 * scale, 0.27 * scale, 0.04 * scale, 0, 1.0 * scale, -1.39 * scale, glass);
  box(g, 1.2 * scale, 0.03 * scale, 1.7 * scale, 0, 1.39 * scale, -0.3 * scale, { color: 0x1d1d24 });
  place(g, 'box-large', { x: -0.25 * scale, y: 1.4 * scale, z: -0.6 * scale, s: 1.15 * scale, ry: 0.1, color: 0xd9a066 });
  place(g, 'box', { x: 0.3 * scale, y: 1.4 * scale, z: -0.2 * scale, s: 1.1 * scale, ry: -0.2, color: 0x4f9a8a });
  place(g, 'barrel', { x: -0.2 * scale, y: 1.4 * scale, z: 0.25 * scale, s: 1.0 * scale, color: 0xe86a4a });
  // headlights
  for (const x of [-0.5, 0.5]) { const h = glow(0xfff0c0, 1.6, 1.1); h.position.set(x * scale, 0.52 * scale, 1.38 * scale); g.add(h); }
  const pool = glowDisc(0x45d8ff, 5.2 * scale, 0.5); g.add(pool);
  const pool2 = glowDisc(0xbff6ff, 2.4 * scale, 0.5); g.add(pool2);
  return {
    group: g,
    update(t) {
      const bob = Math.sin(t * 2.3) * 0.045 + Math.sin(t * 5.1) * 0.012;
      g.position.y = 0.62 + bob;
      g.rotation.z = Math.sin(t * 1.7) * 0.012; g.rotation.x = Math.sin(t * 1.3 + 1) * 0.01 - 0.012;
      pool.position.y = -g.position.y + 0.04; pool2.position.y = -g.position.y + 0.05;
      const k = 0.9 + 0.1 * Math.sin(t * 17) * Math.sin(t * 7.3);
      (pool.material as THREE.MeshBasicMaterial).color.setRGB(0.27 * 0.55 * k, 0.85 * 0.55 * k, 1.0 * 0.55 * k);
    },
  };
}

/** Painterly broadleaf tree: tapered trunk + lumpy canopy. */
export function tree(parent: THREE.Object3D, seed: number, x: number, z: number, h: number, spread = 1, o: { palette?: number[]; y?: number; amp?: number } = {}): THREE.Group {
  const r = mulberry32(seed); const g = new THREE.Group(); g.position.set(x, o.y ?? 0, z); parent.add(g);
  const th = h * 0.5;
  cyl(g, h * 0.035, h * 0.06, th, 0, th / 2, 0, { color: 0x6b4630, map: textures.wood, mapScale: 0.6, noiseAmp: 0.2, seg: 8 });
  for (let i = 0; i < 3; i++) { const a = r() * 6.28; const b = cyl(g, h * 0.015, h * 0.03, h * 0.3, Math.cos(a) * h * 0.09, th + h * 0.08, Math.sin(a) * h * 0.09, { color: 0x6b4630, noiseAmp: 0.2, seg: 6, rz: Math.cos(a) * -0.6, rx: Math.sin(a) * 0.6 }); b.castShadow = true; }
  const pts: number[][] = []; const R = h * 0.3 * spread;
  const n = 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 1.05; pts.push([Math.cos(a) * d, th + h * 0.22 + rr(r, -0.1, 0.22) * h, Math.sin(a) * d, R * rr(r, 0.55, 0.85)]); }
  pts.push([0, th + h * 0.34, 0, R * 0.9]);
  blob(g, seed + 1, pts, { palette: o.palette, swayAmp: o.amp ?? 0.1, noiseScale: 0.4, dapple: 0 });
  return g;
}

/** Distant skyline: hazy mid-rises and towers, crowned with roof gardens and wind turbines. */
export function skyline(parent: THREE.Object3D, seed: number, o: { x0: number; x1: number; z: number; depth: number; count: number; s: [number, number]; green?: number; tint?: number; y?: number; turbines?: number }) {
  const r = mulberry32(seed);
  const names = ['commercial-building-a', 'commercial-building-b', 'commercial-building-d', 'commercial-building-f', 'commercial-building-g', 'commercial-building-h', 'skyscraper-a', 'skyscraper-c', 'skyscraper-e', 'low-detail-building-a', 'low-detail-building-d', 'low-detail-building-g', 'low-detail-building-wide-a', 'commercial-building-c', 'commercial-building-e'];
  const tints = [0xfff0e0, 0xffe2cf, 0xf6d8c8, 0xe8e0f0, 0xfff6d8, 0xd8ecec];
  for (let i = 0; i < o.count; i++) {
    const n = pick(r, names); const b = model(n);
    const s = rr(r, o.s[0], o.s[1]) * (n.startsWith('low') ? 1.6 : 1);
    const x = o.x0 + (o.x1 - o.x0) * ((i + r() * 0.7) / o.count), z = o.z - r() * o.depth;
    place(parent, n, { x, y: o.y ?? 0, z, s, ry: Math.floor(r() * 4) * Math.PI / 2, color: o.tint ?? pick(r, tints), noiseScale: 0.02, noiseAmp: 0.14, grad: [0, b.size.y * s * 0.8], gradCol: 0xb08a9a, cast: false, spec: 0.25 });
    if (r() < (o.green ?? 0.6)) {
      const top = b.size.y * s, w = b.size.x * s * 0.33;
      blob(parent, seed + i * 7, hedgePts(r, [x - w, top + (o.y ?? 0), z], [x + w, top + (o.y ?? 0), z], 4, w * 0.55), { swayAmp: 0, noiseScale: 0.05, dapple: 0 }).castShadow = false;
    }
    if (r() < (o.turbines ?? 0.12)) place(parent, 'windmill', { x: x + rr(r, -4, 4), y: (o.y ?? 0) + b.size.y * s, z, h: rr(r, 10, 18), cast: false, color: 0xfff4e6 });
  }
}

/** Scatter instanced pack plants (grass clumps, flowers) over a region. */
export function scatter(parent: THREE.Object3D, seed: number, name: string, count: number, area: (r: Rng) => [number, number, number], s: [number, number], o: Record<string, any> = {}): THREE.InstancedMesh {
  const r = mulberry32(seed); const b = model(name);
  const g = geo(name, 'std', restyle);
  const m = cachedToon({ foliage: 0.7, noiseScale: 0.9, noiseAmp: 0.22, wobble: 0.35, side: THREE.DoubleSide, sway: 1, swayAmp: 0.07, swayFreq: 2.0, swayY0: b.box.min.y, swayH: b.size.y, wrap: 0.4, dapple: 1, ...o });
  const im = new THREE.InstancedMesh(g, m, count); const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const p = area(r); const sc = rr(r, s[0], s[1]);
    d.position.set(p[0], p[1] - b.box.min.y * sc, p[2]); d.rotation.set(0, r() * 6.28, 0); d.scale.setScalar(sc); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
  }
  im.castShadow = o.cast ?? false; im.receiveShadow = true; im.frustumCulled = false; parent.add(im); return im;
}
export { box };

/** Market parasol recoloured in two alternating bright fabric colours (per canopy segment). */
export function parasol(parent: THREE.Object3D, kind: 'parasol-a' | 'parasol-b', x: number, z: number, h: number, c1: number, c2: number, ry = 0): THREE.Mesh {
  const A = new THREE.Color(c1), B = new THREE.Color(c2);
  const rec: Recolor = (c, i) => {
    if (i.hsl.s > 0.3 && i.hsl.h > 0.3 && i.hsl.h < 0.5) { const seg = Math.floor(((Math.atan2(i.z, i.x) + Math.PI) / (Math.PI * 2)) * 6 + 0.5) % 2; c.copy(seg ? A : B); }
    else if (i.hsl.l > 0.8) c.setHex(0xfff4e0); else c.setHex(0x6a5a52);
  };
  return place(parent, kind, { x, z, h, ry, key: 'p' + c1 + '_' + c2, recolor: rec, trans: 0.55, side: THREE.DoubleSide, noiseScale: 1.0, noiseAmp: 0.1, wrap: 0.4, sway: 1, swayAmp: 0.025, swayFreq: 1.8, swayY0: 0, swayH: 0.45 });
}
