// Procedural pieces the asset pack does not contain: foliage blobs, hanging vines, cloth, palm fronds, water, signs, light shafts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, TOON_COMMON_FRAG, toon, mulberry32, rr, glowTexture, type Rng, type ToonOpts } from './core';
import { textures, cachedToon } from './assets';

const GREEN_SET = [0x3f8f3a, 0x4fa23c, 0x2f7a3e, 0x6bb23f, 0x2c6e44, 0x5a9a2e];
const col = new THREE.Color();

function paintGeo(g: THREE.BufferGeometry, hex: number, jitter = 0.06, r?: Rng) {
  const n = g.attributes.position.count; const c = new Float32Array(n * 3);
  col.setHex(hex); const j = r ? (r() - 0.5) * jitter : 0;
  const h = { h: 0, s: 0, l: 0 }; col.getHSL(h); col.setHSL(h.h + j * 0.3, h.s, Math.max(0, h.l + j));
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function strip(g: THREE.BufferGeometry) { g.deleteAttribute('uv'); return g; }

/** Lumpy foliage mass built from displaced icospheres. pts = [x, y, z, radius]. */
export function blobGeo(seed: number, pts: number[][], palette = GREEN_SET, detail = 2): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts = pts.map((p) => {
    const g = strip(new THREE.IcosahedronGeometry(p[3], detail));
    const a = g.attributes.position; const ph = r() * 10;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      const d = 1 + 0.16 * Math.sin(x * 5.1 / p[3] + ph) * Math.sin(y * 4.3 / p[3] + ph * 1.7) + 0.1 * Math.sin(z * 7.7 / p[3] + ph * 0.6);
      a.setXYZ(i, x * d + p[0], y * d * (p[4] ?? 0.85) + p[1], z * d + p[2]);
    }
    g.computeVertexNormals();
    return paintGeo(g, palette[Math.floor(r() * palette.length)], 0.08, r);
  });
  return mergeGeometries(parts)!;
}
export function foliageMat(o: ToonOpts = {}) {
  return cachedToon({ foliage: 1, noiseScale: 0.5, noiseAmp: 0.26, wobble: 0.45, wrap: 0.3, dapple: 0.3, rim: 0.5, ...o });
}
export function blob(parent: THREE.Object3D, seed: number, pts: number[][], o: ToonOpts & { palette?: number[]; layer?: number } = {}): THREE.Mesh {
  const { palette, layer, ...t } = o;
  const g = blobGeo(seed, pts, palette);
  g.computeBoundingBox();
  const m = new THREE.Mesh(g, foliageMat({ sway: 1, swayAmp: 0.06, swayFreq: 1.2, swayY0: g.boundingBox!.min.y, swayH: Math.max(0.5, g.boundingBox!.max.y - g.boundingBox!.min.y), ...t }));
  m.castShadow = m.receiveShadow = true; if (layer !== undefined) m.layers.set(layer);
  parent.add(m); return m;
}
/** A run of foliage along a segment (hedges, creeper on parapets). */
export function hedgePts(r: Rng, a: [number, number, number], b: [number, number, number], n: number, rad: number, spread = 0.4): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + r() * 0.8) / n;
    out.push([a[0] + (b[0] - a[0]) * t + rr(r, -spread, spread) * rad, a[1] + (b[1] - a[1]) * t + rr(r, -spread, spread) * rad, a[2] + (b[2] - a[2]) * t + rr(r, -spread, spread) * rad, rad * rr(r, 0.65, 1.25)]);
  }
  return out;
}

/** Hanging vines: ribbons with leaves, tops at y = 0, along local x in [-w/2, w/2]. Use with sway mode 2. */
export function vineGeo(seed: number, width: number, count: number, lenMin: number, lenMax: number, depth = 0.5): { geo: THREE.BufferGeometry; maxLen: number } {
  const r = mulberry32(seed); const P: number[] = [], N: number[] = [], C: number[] = [], I: number[] = [];
  let maxLen = 0;
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hex: number, j: number) => {
    const base = P.length / 3; const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    col.setHex(hex); const h = { h: 0, s: 0, l: 0 }; col.getHSL(h); col.setHSL(h.h, h.s, h.l + j);
    for (const v of [a, b, c, d]) { P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); C.push(col.r, col.g, col.b); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let s = 0; s < count; s++) {
    const x0 = rr(r, -width / 2, width / 2), z0 = rr(r, -depth / 2, depth / 2);
    const len = rr(r, lenMin, lenMax) * (0.6 + 0.4 * r()); maxLen = Math.max(maxLen, len);
    const segs = Math.max(3, Math.round(len / 0.35)); const w = rr(r, 0.02, 0.035); const curl = rr(r, -0.25, 0.25);
    let prev = new THREE.Vector3(x0, 0, z0);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs; const p = new THREE.Vector3(x0 + curl * t * t + Math.sin(t * 6 + s) * 0.05, -len * t, z0 + Math.cos(t * 5 + s * 2) * 0.05);
      quad(new THREE.Vector3(prev.x - w, prev.y, prev.z), new THREE.Vector3(prev.x + w, prev.y, prev.z), new THREE.Vector3(p.x + w, p.y, p.z), new THREE.Vector3(p.x - w, p.y, p.z), 0x2c5e30, 0);
      // leaves
      const nl = 2 + Math.floor(r() * 2);
      for (let k = 0; k < nl; k++) {
        const ls = rr(r, 0.1, 0.2) * (1 - t * 0.3); const ang = r() * Math.PI * 2; const tilt = rr(r, -0.6, 0.2);
        const c0 = new THREE.Vector3().lerpVectors(prev, p, r());
        const dir = new THREE.Vector3(Math.cos(ang), tilt, Math.sin(ang)).normalize(); const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(ls * 0.45);
        const tip = c0.clone().addScaledVector(dir, ls * 1.3), mid = c0.clone().addScaledVector(dir, ls * 0.55);
        quad(c0, mid.clone().add(side), tip, mid.clone().sub(side), GREEN_SET[Math.floor(r() * GREEN_SET.length)], rr(r, -0.06, 0.1));
      }
      prev = p;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return { geo: g, maxLen };
}
export function vines(parent: THREE.Object3D, seed: number, o: { x: number; y: number; z: number; ry?: number; width: number; count: number; len: [number, number]; depth?: number; amp?: number; layer?: number; dir?: [number, number, number] }): THREE.Mesh {
  const { geo, maxLen } = vineGeo(seed, o.width, o.count, o.len[0], o.len[1], o.depth);
  const m = new THREE.Mesh(geo, foliageMat({ side: THREE.DoubleSide, sway: 2, swayAmp: o.amp ?? 0.35, swayFreq: 1.4, swayY0: 0, swayH: maxLen, swayDir: o.dir ?? [0.35, 0, 1], foliage: 0.7, noiseScale: 1.2, wrap: 0.5 }));
  m.position.set(o.x, o.y, o.z); m.rotation.y = o.ry ?? 0; m.castShadow = true; m.receiveShadow = true;
  if (o.layer !== undefined) m.layers.set(o.layer);
  parent.add(m); return m;
}

/** Cloth panel hanging from its top edge (y = 0). Vertex colours carry a simple wax-print pattern. */
export function clothGeo(w: number, h: number, c1: number, c2: number, pattern: number): THREE.BufferGeometry {
  const g = strip(new THREE.PlaneGeometry(w, h, Math.max(4, Math.round(w * 8)), Math.max(6, Math.round(h * 8))));
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position; const c = new Float32Array(p.count * 3); const a = new THREE.Color(c1), b = new THREE.Color(c2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i); let k = 0;
    if (pattern === 1) k = Math.floor((y / h) * 6) % 2 === 0 ? 1 : 0;
    else if (pattern === 2) k = (Math.floor(x * 5 + 50) + Math.floor(y * 5 + 50)) % 2 === 0 ? 1 : 0;
    else if (pattern === 3) k = Math.abs(Math.sin(x * 9) * Math.sin(y * 9)) > 0.55 ? 1 : 0;
    else if (pattern === 4) k = y > -h * 0.18 ? 1 : 0;
    const cc = k ? b : a; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
export function cloth(parent: THREE.Object3D, o: { x: number; y: number; z: number; ry?: number; w: number; h: number; c1: number; c2?: number; pattern?: number; amp?: number; freq?: number; dir?: [number, number, number] }): THREE.Mesh {
  const m = new THREE.Mesh(clothGeo(o.w, o.h, o.c1, o.c2 ?? o.c1, o.pattern ?? 0), toon({ side: THREE.DoubleSide, sway: 2, swayAmp: o.amp ?? 0.22, swayFreq: o.freq ?? 2.2, swayY0: 0, swayH: o.h, swayDir: o.dir ?? [0.2, 0.05, 1], noiseScale: 1.5, noiseAmp: 0.1, wrap: 0.6, rim: 0.2 }));
  m.position.set(o.x, o.y, o.z); m.rotation.y = o.ry ?? 0; m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

/** A large arching palm frond (rib + leaflets), base at origin, growing along +x. Use with sway mode 1. */
export function frondGeo(seed: number, length: number, droop = 0.5, leaflets = 26, leafLen = 0.9): THREE.BufferGeometry {
  const r = mulberry32(seed); const P: number[] = [], N: number[] = [], C: number[] = [], I: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, hex: number, j: number) => {
    const base = P.length / 3; const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    col.setHex(hex); const h = { h: 0, s: 0, l: 0 }; col.getHSL(h); col.setHSL(h.h, h.s, h.l + j);
    for (const v of [a, b, c]) { P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); C.push(col.r, col.g, col.b); }
    I.push(base, base + 1, base + 2);
  };
  const rib = (t: number) => new THREE.Vector3(length * t, Math.sin(t * 1.9) * length * 0.28 - t * t * length * droop, 0);
  for (let i = 0; i < leaflets; i++) {
    const t = 0.08 + 0.92 * (i / (leaflets - 1)); const p = rib(t), p2 = rib(Math.min(1, t + 0.035));
    const ll = leafLen * Math.sin(Math.PI * (0.15 + 0.8 * t)) * rr(r, 0.85, 1.15) + 0.1;
    for (const sgn of [-1, 1]) {
      const tip = new THREE.Vector3(p.x + ll * 0.45, p.y - ll * rr(r, 0.35, 0.7), sgn * ll * rr(r, 0.75, 1));
      tri(p, p2, tip, GREEN_SET[Math.floor(r() * GREEN_SET.length)], rr(r, -0.08, 0.06));
    }
    if (i > 0) { const q = rib(0.08 + 0.92 * ((i - 1) / (leaflets - 1))); tri(q, p, new THREE.Vector3((p.x + q.x) / 2, (p.y + q.y) / 2 - 0.04, 0.03), 0x35602c, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return g;
}

// ---------------------------------------------------------------- primitives
export function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, o: ToonOpts & { ry?: number; rx?: number; rz?: number; cast?: boolean } = {}): THREE.Mesh {
  const { ry = 0, rx = 0, rz = 0, cast = true, ...t } = o;
  const m = new THREE.Mesh(strip(new THREE.BoxGeometry(w, h, d)), cachedToon({ vcol: false, ...t }));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
export function ground(parent: THREE.Object3D, w: number, d: number, o: ToonOpts & { x?: number; y?: number; z?: number } = {}): THREE.Mesh {
  const { x = 0, y = 0, z = 0, ...t } = o;
  const g = strip(new THREE.PlaneGeometry(w, d, 1, 1)); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, cachedToon({ vcol: false, ...t })); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m;
}
export function cyl(parent: THREE.Object3D, rt: number, rb: number, h: number, x: number, y: number, z: number, o: ToonOpts & { rx?: number; rz?: number; seg?: number } = {}): THREE.Mesh {
  const { rx = 0, rz = 0, seg = 12, ...t } = o;
  const m = new THREE.Mesh(strip(new THREE.CylinderGeometry(rt, rb, h, seg)), cachedToon({ vcol: false, ...t }));
  m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
/** A sagging line (washing line, power cable, lantern string) between two points. */
export function wire(parent: THREE.Object3D, a: [number, number, number], b: [number, number, number], sag: number, color = 0x1a1a22, rad = 0.012): { mesh: THREE.Mesh; at(t: number): THREE.Vector3 } {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const at = (t: number) => new THREE.Vector3().lerpVectors(A, B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const pts: THREE.Vector3[] = []; for (let i = 0; i <= 16; i++) pts.push(at(i / 16));
  const m = new THREE.Mesh(strip(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rad, 5)), cachedToon({ vcol: false, color, noiseAmp: 0 }));
  m.castShadow = true; parent.add(m); return { mesh: m, at };
}

// ---------------------------------------------------------------- water
export function water(parent: THREE.Object3D, size: number, o: { y?: number; x?: number; z?: number; deep: number; shallow: number; sky: number; scale?: number; glitter?: number; lines?: number; shore?: THREE.Vector4 }): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...G, uDeep: { value: new THREE.Color(o.deep) }, uShallow: { value: new THREE.Color(o.shallow) }, uSkyRef: { value: new THREE.Color(o.sky) }, uScale: { value: o.scale ?? 1 }, uGlitter: { value: o.glitter ?? 1 }, uLines: { value: o.lines ?? 1 }, uShore: { value: o.shore ?? new THREE.Vector4(0, 0, 0, 0) }, uOffset: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${TOON_COMMON_FRAG}
      uniform vec3 uDeep, uShallow, uSkyRef; uniform float uScale, uGlitter, uLines; uniform vec4 uShore; uniform vec2 uOffset;
      varying vec3 vW;
      void main(){
        vec2 p = (vW.xz + uOffset) * uScale; float t = uTime;
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        float n1 = texture2D(uNoise, p * 0.012 + vec2(t * 0.006, t * 0.004)).r;
        float n2 = texture2D(uNoise, p * vec2(0.035, 0.09) + vec2(t * 0.022, -t * 0.03)).g;
        float n3 = texture2D(uNoise, p * vec2(0.09, 0.26) - vec2(t * 0.035, t * 0.05)).g;
        float n4 = texture2D(uNoise, p * vec2(0.3, 0.8) + vec2(-t * 0.06, t * 0.09)).b;
        float fres = pow(1.0 - max(V.y, 0.0), 2.5);
        vec3 c = mix(uDeep, uShallow, smoothstep(0.25, 0.8, n1 * 0.7 + n2 * 0.3));
        c = mix(c, uSkyRef, fres * 0.62);
        // painted ripple lines
        float rip = smoothstep(0.50, 0.56, n2 * 0.55 + n3 * 0.45) * smoothstep(0.75, 0.55, n2 * 0.55 + n3 * 0.45 + 0.12);
        float rip2 = smoothstep(0.56, 0.62, n3 * 0.5 + n4 * 0.5);
        c += uSkyRef * (rip * 0.22 + rip2 * 0.1) * uLines;
        c *= 1.0 - 0.12 * smoothstep(0.5, 0.35, n3) * uLines;
        // sun glitter path
        vec3 N = normalize(vec3((n3 - 0.5) * 0.5, 1.0, (n2 - 0.5) * 0.9));
        vec3 R = reflect(-V, N);
        float sp = pow(max(dot(R, uSunDir), 0.0), 48.0);
        float sparkle = smoothstep(0.62, 0.7, n4 * 0.6 + n3 * 0.4 + sp * 0.35) * smoothstep(0.02, 0.35, sp);
        c += uSunCol * vec3(1.0, 0.9, 0.75) * (sparkle * 1.3 + sp * 0.25) * uGlitter;
        // optional shoreline foam: uShore = (nx, nz, offset, on)
        if (uShore.w > 0.0) {
          float sd = dot(vW.xz, uShore.xy) - uShore.z + (n2 - 0.5) * 3.0;
          float foam = smoothstep(1.4, 0.2, sd) + smoothstep(0.35, 0.0, abs(sd - 2.6 - 0.8 * sin(t * 0.9))) * 0.7 + smoothstep(0.3, 0.0, abs(sd - 5.2 - 0.8 * sin(t * 0.9 + 1.0))) * 0.35;
          c = mix(c, uShallow * 1.25, smoothstep(9.0, 0.0, sd) * 0.6);
          c = mix(c, vec3(1.0, 0.98, 0.92) * (uSkyCol + uSunCol * 0.8), clamp(foam, 0.0, 1.0) * 0.85);
        }
        c = applyFog(c, vW, 1.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m); mesh.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0); parent.add(mesh); return mesh;
}

// ---------------------------------------------------------------- signs & light
export function sign(parent: THREE.Object3D, text: string, o: { x: number; y: number; z: number; ry?: number; w: number; h: number; bg: string; fg: string; glow?: number; border?: string; font?: number; sub?: string }): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * o.h / o.w);
  const g = c.getContext('2d')!;
  g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 14; g.strokeRect(14, 14, c.width - 28, c.height - 28); }
  g.fillStyle = o.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = o.font ?? c.height * 0.5;
  for (let i = 0; i < 20; i++) {
    g.font = `300 ${fs}px Montserrat, sans-serif`; (g as any).letterSpacing = `${fs * 0.12}px`;
    if (g.measureText(text).width < c.width * 0.84) break; fs *= 0.93;
  }
  g.fillText(text, c.width / 2, c.height * (o.sub ? 0.42 : 0.53));
  if (o.sub) { g.font = `300 ${fs * 0.36}px Montserrat, sans-serif`; (g as any).letterSpacing = `${fs * 0.12}px`; g.fillText(o.sub, c.width / 2, c.height * 0.78); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const k = o.glow ?? 1.6;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
  m.position.set(o.x, o.y, o.z); m.rotation.y = o.ry ?? 0; parent.add(m); return m;
}
/** Soft additive light shaft (god ray) as a gradient quad. */
export function shaft(parent: THREE.Object3D, o: { x: number; y: number; z: number; w: number; len: number; rz: number; ry?: number; color: number; k: number }): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
  const g2 = g.createLinearGradient(0, 0, 64, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = g2; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  const geo = new THREE.PlaneGeometry(o.w, o.len); geo.translate(0, -o.len / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(o.color).multiplyScalar(o.k), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(o.x, o.y, o.z); m.rotation.set(0, o.ry ?? 0, o.rz); m.renderOrder = 11; parent.add(m); return m;
}
export const tex = () => textures;
export { glowTexture };
