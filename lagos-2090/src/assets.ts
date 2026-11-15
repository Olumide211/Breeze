// Asset pack loading. Every GLB is baked into one merged, vertex-coloured geometry so it can be
// recoloured freely and drawn with the custom toon material (no stock PBR materials survive).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { toon, type ToonOpts } from './core';

export interface Baked {
  name: string;
  pos: Float32Array; nor: Float32Array; col: Float32Array; // linear rgb
  mat: Uint8Array; matNames: string[]; nodeNames: string[]; node: Uint8Array;
  index: Uint32Array;
  box: THREE.Box3; size: THREE.Vector3;
}
export type Recolor = (c: THREE.Color, info: { name: string; mat: string; node: string; x: number; y: number; z: number; nx: number; ny: number; nz: number; hsl: { h: number; s: number; l: number } }) => number | void;

const baked = new Map<string, Baked>();
const geoCache = new Map<string, THREE.BufferGeometry>();
export const textures: Record<string, THREE.Texture> = {};
export const hdris: Record<string, { tex: THREE.DataTexture; sunAz: number; top: THREE.Color; horizon: THREE.Color }> = {};
export let manifest: any = null;

const imgData = new Map<any, ImageData>();
function pixels(img: any): ImageData {
  let d = imgData.get(img);
  if (!d) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
    d = g.getImageData(0, 0, c.width, c.height); imgData.set(img, d);
  }
  return d;
}

function bake(name: string, root: THREE.Object3D): Baked {
  // normalise Z-up / huge CAD-style exports
  root.updateMatrixWorld(true);
  const P: number[] = [], N: number[] = [], C: number[] = [], M: number[] = [], ND: number[] = [], I: number[] = [];
  const matNames: string[] = [], nodeNames: string[] = [];
  const tmp = new THREE.Color(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mat = mats[0] as THREE.MeshStandardMaterial;
    let mi = matNames.indexOf(mat.name); if (mi < 0) { mi = matNames.length; matNames.push(mat.name); }
    let ni = nodeNames.indexOf(mesh.name); if (ni < 0) { ni = nodeNames.length; nodeNames.push(mesh.name); }
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color;
    const img = mat.map ? pixels(mat.map.image) : null;
    const base = P.length / 3;
    nm.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld); P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z);
      tmp.copy(mat.color);
      if (img && ua) {
        let u = ua.getX(i), w = ua.getY(i); u -= Math.floor(u); w -= Math.floor(w);
        const px = Math.min(img.width - 1, Math.floor(u * img.width)), py = Math.min(img.height - 1, Math.floor(w * img.height));
        const k = (py * img.width + px) * 4;
        const t = new THREE.Color().setRGB(img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255, THREE.SRGBColorSpace);
        tmp.multiply(t);
      }
      if (ca) tmp.multiply(new THREE.Color(ca.getX(i), ca.getY(i), ca.getZ(i)));
      C.push(tmp.r, tmp.g, tmp.b); M.push(mi); ND.push(ni);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i));
    else for (let i = 0; i < pa.count; i++) I.push(base + i);
  });
  const pos = new Float32Array(P);
  const box = new THREE.Box3().setFromArray(pos as any);
  return { name, pos, nor: new Float32Array(N), col: new Float32Array(C), mat: new Uint8Array(M), matNames, nodeNames, node: new Uint8Array(ND), index: new Uint32Array(I), box, size: box.getSize(new THREE.Vector3()) };
}

export async function loadAll(onProgress?: (s: string) => void) {
  manifest = await (await fetch('./assets-manifest.json')).json();
  const gl = new GLTFLoader();
  const models = (manifest.assets as any[]).filter((a) => a.path.endsWith('.glb'));
  let done = 0;
  await Promise.all(models.map(async (a) => {
    const gltf = await gl.loadAsync('./' + a.path);
    const name = a.path.replace(/^models\/[^/]+\//, '').replace('.glb', '');
    const root = gltf.scene;
    if (name === 'school-bus') root.rotation.x = -Math.PI / 2;
    baked.set(name, bake(name, root));
    onProgress?.(`models ${++done}/${models.length}`);
  }));
  const tl = new THREE.TextureLoader();
  const tex: Record<string, string> = {
    concrete: 'textures/concrete/Concrete034_1K-JPG_Color.jpg', plaster: 'textures/plaster-wall/Plaster001_1K-JPG_Color.jpg',
    asphalt: 'textures/asphalt/Asphalt033_1K-JPG_Color.jpg', grass: 'textures/grass/Grass001_1K-JPG_Color.jpg',
    wood: 'textures/wood/Wood051_1K-JPG_Color.jpg', metal: 'textures/corrugated-metal/CorrugatedSteel007A_1K-JPG_Color.jpg',
  };
  await Promise.all(Object.entries(tex).map(async ([k, p]) => {
    const t = await tl.loadAsync('./' + p);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    textures[k] = t;
  }));
  const rl = new RGBELoader().setDataType(THREE.FloatType);
  for (const [k, p] of [['fire', 'hdri/the_sky_is_on_fire_2k.hdr'], ['spruit', 'hdri/spruit_sunrise_2k.hdr']] as const) {
    const t = await rl.loadAsync('./' + p);
    hdris[k] = analyseHdr(t);
    onProgress?.('hdri ' + k);
  }
}

/** Find the sun azimuth and average sky colours; store a half-float, mip-mapped copy for the painted sky. */
function analyseHdr(src: THREE.DataTexture) {
  const d = src.image.data as unknown as Float32Array, w = src.image.width, h = src.image.height;
  // RGBE rows are stored top-first
  let best = -1, bx = 0;
  const colSum = new Float32Array(w);
  const top = new THREE.Color(0, 0, 0), hor = new THREE.Color(0, 0, 0); let nt = 0, nh = 0;
  for (let y = 0; y < h / 2; y += 2) {
    const el = (0.5 - (y + 0.5) / h) * Math.PI;
    for (let x = 0; x < w; x += 2) {
      const k = (y * w + x) * 4; const r = d[k], g = d[k + 1], b = d[k + 2];
      const l = Math.min(r * 0.3 + g * 0.6 + b * 0.1, 50);
      if (el < 0.5) colSum[x] += l * l;
      if (el > 0.5) { top.r += Math.min(r, 4); top.g += Math.min(g, 4); top.b += Math.min(b, 4); nt++; }
      else if (el < 0.25) { hor.r += Math.min(r, 4); hor.g += Math.min(g, 4); hor.b += Math.min(b, 4); nh++; }
    }
  }
  const win = Math.floor(w / 24);
  for (let x = 0; x < w; x += 2) { let s = 0; for (let i = -win; i <= win; i += 2) s += colSum[(x + i + w) % w - ((x + i + w) % w) % 2]; if (s > best) { best = s; bx = x; } }
  const u = (bx + 0.5) / w;
  const sunAz = THREE.MathUtils.radToDeg((u - 0.5) * Math.PI * 2); // matches atan(z, x) used by the sky shader
  top.multiplyScalar(1 / nt); hor.multiplyScalar(1 / nh);
  const half = new Uint16Array(d.length);
  for (let i = 0; i < d.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(d[i], 60000));
  const tex = new THREE.DataTexture(half, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.flipY = true; tex.wrapS = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.colorSpace = THREE.LinearSRGBColorSpace; tex.needsUpdate = true;
  return { tex, sunAz, top, horizon: hor };
}

export function model(name: string): Baked {
  const b = baked.get(name);
  if (!b) throw new Error('model not in pack: ' + name);
  return b;
}
export const modelNames = () => [...baked.keys()];

/** Geometry for a model, optionally recoloured. The recolour callback may return 1 to set the "body" mask (used for stripes). */
export function geo(name: string, key = '', recolor?: Recolor, skipNode?: RegExp): THREE.BufferGeometry {
  const ck = name + '|' + key;
  let g = geoCache.get(ck);
  if (g) return g;
  const b = model(name);
  const col = new Float32Array(b.col); const mask = new Float32Array(b.pos.length / 3);
  const c = new THREE.Color(); const hsl = { h: 0, s: 0, l: 0 };
  const n = b.pos.length / 3;
  if (recolor) for (let i = 0; i < n; i++) {
    c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    const r = recolor(c, { name, mat: b.matNames[b.mat[i]], node: b.nodeNames[b.node[i]], x: b.pos[i * 3], y: b.pos[i * 3 + 1], z: b.pos[i * 3 + 2], nx: b.nor[i * 3], ny: b.nor[i * 3 + 1], nz: b.nor[i * 3 + 2], hsl });
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; if (r) mask[i] = r;
  }
  let index = b.index;
  if (skipNode) {
    const keep: number[] = [];
    for (let i = 0; i < index.length; i += 3) if (!skipNode.test(b.nodeNames[b.node[index[i]]])) keep.push(index[i], index[i + 1], index[i + 2]);
    index = new Uint32Array(keep);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(b.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('mask', new THREE.BufferAttribute(mask, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  geoCache.set(ck, g);
  return g;
}

// ---------------------------------------------------------------- palette-driven default restyle
const GREENS = [0x3f8f3a, 0x4fa23c, 0x2f7a3e, 0x6bb23f, 0x2c6e44];
/** Default restyle: Kenney's teal greens become rich warm greens, bark becomes deep umber, everything gets a little more saturated. */
export const restyle: Recolor = (c, i) => {
  const m = i.mat.toLowerCase();
  if (/leaf|grass|plant/.test(m) || (/tree|bush|flower|palm|patch/.test(i.name) && i.hsl.s > 0.3 && i.hsl.h > 0.2 && i.hsl.h < 0.47)) {
    const k = Math.abs(Math.floor(i.x * 7.3 + i.z * 5.1 + i.y * 3.7)) % GREENS.length;
    c.setHex(GREENS[k]);
  } else if (/bark|dirt/.test(m)) c.setHex(0x7a5236);
  else { const h = { h: 0, s: 0, l: 0 }; c.getHSL(h); c.setHSL(h.h, Math.min(1, h.s * 1.15), h.l); }
};

export interface PlaceOpts extends ToonOpts {
  x?: number; y?: number; z?: number; ry?: number; rx?: number; rz?: number;
  s?: number;        // uniform scale
  h?: number;        // or: target height in metres
  len?: number;      // or: target length of the longest horizontal side
  recolor?: Recolor; key?: string; skip?: RegExp;
  cast?: boolean; receive?: boolean; mat?: THREE.Material; layer?: number;
}
const matCache = new Map<string, THREE.ShaderMaterial>();
export function cachedToon(o: ToonOpts): THREE.ShaderMaterial {
  const k = JSON.stringify(o, (kk, v) => (v && v.isTexture ? 'tex:' + v.uuid : v));
  let m = matCache.get(k); if (!m) { m = toon(o); matCache.set(k, m); }
  return m;
}
/** Instance a pack model with the toon shader. */
export function place(parent: THREE.Object3D, name: string, o: PlaceOpts = {}): THREE.Mesh {
  const { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s, h, len, recolor, key, skip, cast = true, receive = true, mat, layer, ...t } = o;
  const g = geo(name, key ?? (recolor ? 'custom' : 'std') + (skip ? skip.source : ''), recolor ?? restyle, skip);
  const b = model(name);
  let sc = s ?? 1;
  if (h) sc = h / b.size.y; else if (len) sc = len / Math.max(b.size.x, b.size.z);
  const isFoliageModel = /tree|palm|bush|plant|flower|grass/.test(name);
  const def: ToonOpts = isFoliageModel
    ? { foliage: 0.8, noiseScale: 0.35 / Math.max(sc, 0.2), noiseAmp: 0.22, wobble: 0.35, side: THREE.DoubleSide, sway: 1, swayAmp: 0.05 * Math.min(sc, 6), swayFreq: 1.3, swayY0: b.box.min.y, swayH: b.size.y, dapple: 0.4, wrap: 0.25 }
    : { noiseScale: 0.22, noiseAmp: 0.12, wobble: 0.1 };
  const m = mat ?? cachedToon({ ...def, ...t });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.scale.setScalar(sc);
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  if (layer !== undefined) mesh.layers.set(layer);
  parent.add(mesh);
  return mesh;
}

/** Debug: unique colours / nodes of a model. */
export function describe(name: string) {
  const b = model(name); const seen = new Map<string, number>(); const c = new THREE.Color();
  for (let i = 0; i < b.pos.length / 3; i++) { c.setRGB(b.col[i * 3], b.col[i * 3 + 1], b.col[i * 3 + 2]); const k = '#' + c.getHexString() + ' ' + b.matNames[b.mat[i]] + ' ' + b.nodeNames[b.node[i]]; seen.set(k, (seen.get(k) ?? 0) + 1); }
  return { box: [b.box.min.toArray(), b.box.max.toArray()], colors: [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60) };
}
