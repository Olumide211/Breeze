// Core: deterministic RNG, painterly noise texture, shared (per-shot) uniforms and the custom toon/cel material.
import * as THREE from 'three';

export const W = 1920;
export const H = 1080;
export const FPS = 24;
export const TOTAL_FRAMES = 720;

// ---------------------------------------------------------------- RNG
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;
export const rr = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, arr: T[]): T => arr[Math.floor(r() * arr.length) % arr.length];

// ---------------------------------------------------------------- painterly noise texture (tileable)
function tileNoise(size: number, period: number, seed: number): Float32Array {
  const r = mulberry32(seed);
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const out = new Float32Array(size * size);
  const s = period / size;
  for (let y = 0; y < size; y++) {
    const fy = y * s, y0 = Math.floor(fy), ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = x * s, x0 = Math.floor(fx), tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const a = lat[(y0 % period) * period + (x0 % period)];
      const b = lat[(y0 % period) * period + ((x0 + 1) % period)];
      const c = lat[((y0 + 1) % period) * period + (x0 % period)];
      const d = lat[((y0 + 1) % period) * period + ((x0 + 1) % period)];
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}
function fbmTile(size: number, period: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 0.5, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(size, period << o, seed + o * 17);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < out.length; i++) { out[i] /= tot; mn = Math.min(mn, out[i]); mx = Math.max(mx, out[i]); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}
export function makeNoiseTexture(): THREE.DataTexture {
  const S = 256;
  const r = fbmTile(S, 4, 4, 11);   // broad washes
  const g = fbmTile(S, 12, 3, 23);  // brush marks
  const b = fbmTile(S, 40, 2, 37);  // dabs
  const a = fbmTile(S, 5, 2, 51);   // smooth blobs (dappled light)
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = r[i] * 255; data[i * 4 + 1] = g[i] * 255; data[i * 4 + 2] = b[i] * 255; data[i * 4 + 3] = a[i] * 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- shared uniforms (re-pointed per shot)
export const G = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.5, 0.4).normalize() },
  uSunR: { value: new THREE.Vector3(1, 0, 0) },
  uSunU: { value: new THREE.Vector3(0, 0, 1) },
  uSunCol: { value: new THREE.Color(1.5, 1.2, 0.9) },
  uSkyCol: { value: new THREE.Color(0.4, 0.45, 0.7) },
  uGroundCol: { value: new THREE.Color(0.35, 0.3, 0.3) },
  uFogCol: { value: new THREE.Color(0.9, 0.7, 0.6) },
  uFogSun: { value: new THREE.Color(1.0, 0.8, 0.5) },
  uFog: { value: new THREE.Vector3(0.004, 0.02, 0.9) }, // density, height falloff, max
  uDapple: { value: new THREE.Vector4(0, 0.05, 1, 0) }, // strength, scale, speed
  uFogStart: { value: 18 },
  uNoise: { value: null as THREE.Texture | null },
};

export interface Env {
  hdri: 'fire' | 'spruit';
  sunAz: number; sunEl: number;           // degrees; azimuth measured from +x toward +z
  sunCol: [number, number, number];
  skyCol: [number, number, number];        // cool ambient from above (shadow colour)
  groundCol: [number, number, number];     // warm bounce from below
  fogCol: [number, number, number]; fogSun: [number, number, number];
  fog: [number, number, number];
  zenith: number; horizon: number;         // painted gradient colours (hex)
  hdrMix: number; exposure: number;
  dapple?: [number, number, number];
  flare?: number; flareCol?: number;
  leak?: number; rainbow?: number;
  fogStart?: number; bloom?: number; sat?: number; contrast?: number; lift?: [number, number, number]; gain?: [number, number, number];
  paint?: number; vignette?: number; sunDisc?: number;
}

export function sunVector(az: number, el: number) {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
}

export function applyEnv(env: Env) {
  const s = sunVector(env.sunAz, env.sunEl);
  G.uSunDir.value.copy(s);
  const r = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), s).normalize();
  const u = new THREE.Vector3().crossVectors(s, r).normalize();
  G.uSunR.value.copy(r); G.uSunU.value.copy(u);
  G.uSunCol.value.setRGB(...env.sunCol);
  G.uSkyCol.value.setRGB(...env.skyCol);
  G.uGroundCol.value.setRGB(...env.groundCol);
  G.uFogCol.value.setRGB(...env.fogCol);
  G.uFogSun.value.setRGB(...env.fogSun);
  G.uFog.value.set(...env.fog); G.uFogStart.value = env.fogStart ?? 18;
  const d = env.dapple ?? [0, 0.05, 1];
  G.uDapple.value.set(d[0], d[1], d[2], 0);
}

// ---------------------------------------------------------------- toon material
export interface ToonOpts {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null; mapScale?: number; mapMix?: number;
  noiseScale?: number; noiseAmp?: number; wobble?: number;
  foliage?: number;
  emissive?: THREE.ColorRepresentation; emissiveK?: number; flicker?: number;
  grad?: [number, number]; gradCol?: THREE.ColorRepresentation;
  stripe?: [number, number, number, number];
  sway?: 0 | 1 | 2 | 3; swayAmp?: number; swayFreq?: number; swayY0?: number; swayH?: number; swayDir?: [number, number, number];
  side?: THREE.Side; dapple?: number; fog?: number; spec?: number; rim?: number;
  vcol?: boolean; unlitMix?: number; opacity?: number; transparent?: boolean; depthWrite?: boolean;
  wrap?: number; selfGlow?: number; trans?: number; wind?: number;
}

const TOON_VERT = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
uniform float uTime;
uniform vec4 uSway;      // amp, freq, y0, 1/h
uniform vec3 uSwayDir;
varying vec3 vW; varying vec3 vN; varying vec3 vCol; varying vec3 vObj; varying float vMask;
#ifdef USE_VCOL
attribute vec3 color;
#endif
#ifdef USE_MASK
attribute float mask;
#endif
void main() {
  vec3 p = position;
  vec3 n = normal;
  mat4 mm = modelMatrix;
  #ifdef USE_INSTANCING
    mm = modelMatrix * instanceMatrix;
  #endif
  float phase = mm[3].x * 0.37 + mm[3].z * 0.71;
  #if SWAY == 3
    // wing flap around the body axis (wings extend along local x)
    float fl = sin(uTime * uSway.y + phase * 5.0);
    float ax = abs(p.x);
    p.y += ax * fl * uSway.x;
    p.x *= 1.0 - 0.5 * (fl * 0.5 + 0.5) * min(uSway.x, 1.0);
  #endif
  vec4 wp = mm * vec4(p, 1.0);
  vec3 wn = normalize(mat3(mm) * n);
  #if SWAY == 1
    float w = pow(clamp((position.y - uSway.z) * uSway.w, 0.0, 1.0), 1.6);
    float t = uTime * uSway.y;
    wp.x += (sin(t + phase + wp.y * 0.35) + 0.35 * sin(t * 2.7 + wp.x * 1.3 + wp.z * 1.7)) * uSway.x * w;
    wp.z += (cos(t * 0.8 + phase * 1.3 + wp.y * 0.3) + 0.35 * sin(t * 3.1 + wp.x * 1.9)) * uSway.x * 0.6 * w;
  #endif
  #if SWAY == 2
    // pinned along the top edge (cloth, hanging vines)
    float w2 = clamp((uSway.z - position.y) * uSway.w, 0.0, 1.0);
    float t2 = uTime * uSway.y;
    float wave = sin(t2 + wp.x * 1.4 + wp.z * 1.1 + phase) * 0.6 + sin(t2 * 1.9 + wp.y * 2.2 + wp.x * 0.7) * 0.4 + 0.5;
    wp.xyz += uSwayDir * wave * uSway.x * w2 * w2;
  #endif
  vW = wp.xyz; vN = wn; vObj = position;
  #ifdef USE_VCOL
    vCol = color;
  #else
    vCol = vec3(1.0);
  #endif
  #ifdef USE_MASK
    vMask = mask;
  #else
    vMask = 0.0;
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    vDirectionalShadowCoord[0] = directionalShadowMatrix[0] * (wp + vec4(wn * directionalLightShadows[0].shadowNormalBias, 0.0));
  #endif
}`;

export const TOON_COMMON_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uSunDir, uSunR, uSunU, uSunCol, uSkyCol, uGroundCol, uFogCol, uFogSun;
uniform vec3 uFog; uniform vec4 uDapple; uniform float uFogStart;
vec3 tri(sampler2D t, vec3 p, vec3 n) {
  vec3 w = abs(n); w = w * w * w * w; w /= (w.x + w.y + w.z);
  return texture2D(t, p.zy).rgb * w.x + texture2D(t, p.xz).rgb * w.y + texture2D(t, p.xy).rgb * w.z;
}
float dappleMask(vec3 w) {
  vec2 p = vec2(dot(w, uSunR), dot(w, uSunU)) * uDapple.y;
  vec2 sw = vec2(sin(uTime * 0.9 * uDapple.z + p.y * 9.0), cos(uTime * 0.7 * uDapple.z + p.x * 8.0)) * 0.012;
  float a = texture2D(uNoise, p + sw).a;
  float b = texture2D(uNoise, p * 2.7 + sw * 2.0 + 0.31).a;
  float c = texture2D(uNoise, p * 6.1 - sw + 0.17).r;
  return smoothstep(0.43, 0.56, a * 0.55 + b * 0.3 + c * 0.15);
}
vec3 applyFog(vec3 col, vec3 w, float k) {
  vec3 v = w - cameraPosition; float d = length(v);
  float f = 1.0 - exp(-max(d - uFogStart, 0.0) * uFog.x);
  f *= exp(-max(w.y, 0.0) * uFog.y);
  f = min(f, uFog.z) * k;
  float s = pow(max(dot(v / d, uSunDir), 0.0), 6.0);
  return mix(col, mix(uFogCol, uFogSun, s), f);
}`;

const TOON_FRAG = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
${TOON_COMMON_FRAG}
uniform vec3 uColor, uEmissive, uGradCol;
uniform float uSelfGlow, uTrans, uWind, uEmissiveK, uFlicker, uMapMix, uMapScale, uNoiseScale, uNoiseAmp, uWobble, uFoliage, uDappleK, uFogK, uSpec, uRim, uUnlit, uOpacity, uWrap;
uniform vec4 uGrad, uStripe;
uniform sampler2D uMap;
varying vec3 vW; varying vec3 vN; varying vec3 vCol; varying vec3 vObj; varying float vMask;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 base = vCol * uColor;
  if (uStripe.x > -90.0 && vMask > 0.5) {
    float y = vObj.y;
    if ((y > uStripe.x && y < uStripe.y) || (y > uStripe.z && y < uStripe.w)) base = vec3(0.012, 0.012, 0.016);
  }
  vec3 nz = tri(uNoise, vW * uNoiseScale, N);
  vec3 nz2 = tri(uNoise, vW * uNoiseScale * 3.3 + 0.37, N);
  #ifdef USE_TMAP
    vec3 tx = tri(uMap, vW * uMapScale, N);
    vec3 tx2 = tri(uMap, vW * uMapScale * 0.27 + 0.5, N);
    // PBR colour maps are used as a painterly input: only their tonal variation is kept, softened and re-tinted
    float tl = dot(tx, vec3(0.3, 0.6, 0.1)) * 0.6 + dot(tx2, vec3(0.3, 0.6, 0.1)) * 0.4;
    tl = smoothstep(0.1, 0.9, tl);
    base *= mix(vec3(1.0), vec3(0.62) + vec3(0.8, 0.78, 0.74) * tl, uMapMix);
  #endif
  if (uWind > 0.0) {
    float wv = texture2D(uNoise, vW.xz * 0.011 + vec2(uTime * 0.045, uTime * 0.02)).r;
    float wv2 = texture2D(uNoise, vW.xz * 0.037 + vec2(uTime * 0.10, uTime * 0.045)).g;
    float band = smoothstep(0.42, 0.7, wv * 0.62 + wv2 * 0.38);
    base *= 1.0 + uWind * (band - 0.35);
    base += uWind * band * vec3(0.05, 0.06, 0.0);
  }
  float paint = (nz.r - 0.5) * 2.0;
  float dab = (nz2.g - 0.5) * 2.0;
  base *= 1.0 + uNoiseAmp * (paint * 0.65 + dab * 0.45);
  base += uNoiseAmp * 0.18 * vec3(paint, 0.2 * dab, -paint) * dot(base, vec3(0.33));   // warm/cool drift like layered gouache
  if (uGrad.z > 0.0) {
    float g = smoothstep(uGrad.x, uGrad.y, vW.y + paint * 0.25 * (uGrad.y - uGrad.x));
    base = mix(base * uGradCol, base, g);
  }
  float ndl = dot(N, uSunDir);
  float sh = getShadowMask();
  float wob = (nz2.r - 0.5) * uWobble + (nz.g - 0.5) * uWobble * 0.6;
  float lit = smoothstep(-0.03 - uWrap, 0.09, ndl + wob);
  float lit2 = smoothstep(0.45, 0.8, ndl + wob);
  float dap = 1.0;
  if (uDapple.x > 0.0 && uDappleK > 0.0) dap = mix(1.0, dappleMask(vW), uDapple.x * uDappleK);
  float direct = lit * sh * dap;
  float hemi = N.y * 0.5 + 0.5;
  vec3 amb = mix(uGroundCol, uSkyCol, smoothstep(0.0, 1.0, hemi));
  vec3 col = base * (amb + uSunCol * direct * (0.78 + 0.22 * lit2));
  if (uFoliage > 0.0) {
    float d1 = smoothstep(0.56, 0.64, nz2.b);
    float d2 = smoothstep(0.46, 0.38, nz2.b);
    col += base * uSunCol * vec3(1.0, 0.95, 0.45) * d1 * direct * 0.45 * uFoliage;
    col *= 1.0 - 0.3 * uFoliage * d2 * (1.0 - direct * 0.6);
    float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
    col += base * uSunCol * vec3(0.9, 1.0, 0.3) * back * 0.55 * uFoliage * sh;
  }
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uSunCol * base * fres * uRim * smoothstep(-0.3, 0.5, ndl) * (0.4 + 0.6 * sh);
  if (uSpec > 0.0) {
    float sp = dot(N, normalize(uSunDir + V));
    col += uSunCol * smoothstep(0.93, 0.97, sp + wob * 0.05) * uSpec * sh;
    col += uSkyCol * fres * uSpec * 0.8;
  }
  if (uTrans > 0.0) col += base * uSunCol * (pow(max(dot(-V, uSunDir), 0.0), 2.0) * 0.8 + max(-ndl, 0.0) * 0.5) * uTrans * sh;
  col = mix(col, base, uUnlit);
  if (uSelfGlow > 0.0) {
    float mx = max(vCol.r, max(vCol.g, vCol.b)), mn = min(vCol.r, min(vCol.g, vCol.b));
    col += vCol * uSelfGlow * smoothstep(0.25, 0.5, mx - mn) * smoothstep(0.35, 0.6, mx);
  }
  float fl = 1.0 + uFlicker * (0.5 * sin(uTime * 13.0 + vW.x * 3.0 + vW.z * 5.0) + 0.5 * sin(uTime * 7.3 + vW.z * 2.0 + vW.y));
  col += uEmissive * uEmissiveK * fl;
  col = applyFog(col, vW, uFogK);
  gl_FragColor = vec4(col, uOpacity);
}`;

export function toon(o: ToonOpts = {}): THREE.ShaderMaterial {
  const defines: Record<string, any> = { SWAY: o.sway ?? 0 };
  if (o.vcol !== false) defines.USE_VCOL = '';
  if (o.stripe) defines.USE_MASK = '';
  if (o.map) defines.USE_TMAP = '';
  const uniforms: Record<string, THREE.IUniform> = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    ...G,
    uColor: { value: new THREE.Color(o.color ?? 0xffffff) },
    uEmissive: { value: new THREE.Color(o.emissive ?? 0x000000) },
    uEmissiveK: { value: o.emissiveK ?? (o.emissive !== undefined ? 1 : 0) },
    uFlicker: { value: o.flicker ?? 0 },
    uMap: { value: o.map ?? null }, uMapMix: { value: o.mapMix ?? 0.8 }, uMapScale: { value: o.mapScale ?? 0.25 },
    uNoiseScale: { value: o.noiseScale ?? 0.12 }, uNoiseAmp: { value: o.noiseAmp ?? 0.16 },
    uWobble: { value: o.wobble ?? 0.12 }, uFoliage: { value: o.foliage ?? 0 },
    uGrad: { value: new THREE.Vector4(o.grad?.[0] ?? 0, o.grad?.[1] ?? 1, o.grad ? 1 : 0, 0) },
    uGradCol: { value: new THREE.Color(o.gradCol ?? 0x8a6a7a) },
    uStripe: { value: new THREE.Vector4(...(o.stripe ?? [-99, 0, 0, 0])) },
    uSway: { value: new THREE.Vector4(o.swayAmp ?? 0, o.swayFreq ?? 1.5, o.swayY0 ?? 0, 1 / (o.swayH ?? 1)) },
    uSwayDir: { value: new THREE.Vector3(...(o.swayDir ?? [0, 0, 1])) },
    uDappleK: { value: o.dapple ?? 1 }, uFogK: { value: o.fog ?? 1 }, uSpec: { value: o.spec ?? 0 },
    uRim: { value: o.rim ?? 0.35 }, uUnlit: { value: o.unlitMix ?? 0 }, uOpacity: { value: o.opacity ?? 1 },
    uWrap: { value: o.wrap ?? 0 }, uSelfGlow: { value: o.selfGlow ?? 0 }, uTrans: { value: o.trans ?? 0 }, uWind: { value: o.wind ?? 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms, defines, vertexShader: TOON_VERT, fragmentShader: TOON_FRAG, lights: true,
    side: o.side ?? THREE.FrontSide, transparent: o.transparent ?? false, depthWrite: o.depthWrite ?? true,
  });
  return m;
}

// ---------------------------------------------------------------- small helpers
let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.LinearSRGBColorSpace;
  return glowTex;
}
/** Additive camera-facing glow. */
export function glow(color: THREE.ColorRepresentation, size: number, intensity = 1): THREE.Sprite {
  const col = new THREE.Color(color).multiplyScalar(intensity);
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = 10;
  return s;
}
/** Flat additive glow lying on a surface (hover light pools, lamp pools). */
export function glowDisc(color: THREE.ColorRepresentation, size: number, intensity = 1): THREE.Mesh {
  const col = new THREE.Color(color).multiplyScalar(intensity);
  const m = new THREE.MeshBasicMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 9;
  return mesh;
}

/** Drifting additive motes (dust, pollen). All motion is a pure function of uTime. */
export function motes(opts: { count: number; box: [number, number, number]; center: [number, number, number]; size: number; color: THREE.ColorRepresentation; intensity?: number; speed?: number; drift?: [number, number, number]; seed?: number; twinkle?: number }): THREE.Points {
  const r = mulberry32(opts.seed ?? 5);
  const pos = new Float32Array(opts.count * 3), rnd = new Float32Array(opts.count * 4);
  for (let i = 0; i < opts.count; i++) {
    pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r();
    rnd[i * 4] = r(); rnd[i * 4 + 1] = r(); rnd[i * 4 + 2] = r(); rnd[i * 4 + 3] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...opts.center), 1e4);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: G.uTime, uSunDir: G.uSunDir, uBox: { value: new THREE.Vector3(...opts.box) }, uCenter: { value: new THREE.Vector3(...opts.center) },
      uSize: { value: opts.size }, uColor: { value: new THREE.Color(opts.color).multiplyScalar(opts.intensity ?? 1) },
      uSpeed: { value: opts.speed ?? 1 }, uDrift: { value: new THREE.Vector3(...(opts.drift ?? [0.1, 0.03, 0.05])) }, uTw: { value: opts.twinkle ?? 0.6 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 rnd; uniform float uTime, uSize, uSpeed, uTw; uniform vec3 uBox, uCenter, uDrift;
      varying float vA;
      void main() {
        float t = uTime * uSpeed;
        vec3 p = position + uDrift * t / uBox * (0.5 + rnd.x);
        p += vec3(sin(t * (0.4 + rnd.y) + rnd.x * 40.0), sin(t * (0.3 + rnd.z) + rnd.y * 40.0), cos(t * (0.35 + rnd.w) + rnd.z * 40.0)) * 0.035;
        p = fract(p);
        vec3 edge = smoothstep(vec3(0.0), vec3(0.08), p) * smoothstep(vec3(1.0), vec3(0.92), p);
        vec3 w = uCenter + (p - 0.5) * uBox;
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = uSize * (0.4 + rnd.w * 1.2);
        gl_PointSize = s * 1080.0 / max(-mv.z, 0.5) * projectionMatrix[1][1] * 0.5;
        vA = edge.x * edge.y * edge.z * (1.0 - uTw + uTw * (0.5 + 0.5 * sin(t * (1.5 + rnd.x * 3.0) + rnd.y * 30.0)));
        vA *= smoothstep(0.3, 1.5, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.0, r); a = a * a * vA; gl_FragColor = vec4(uColor * a, a); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 12;
  return p;
}

export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
