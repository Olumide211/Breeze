// Painted sky dome (HDRI + art-directed gradient) and puffy cel-shaded cloud geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, TOON_COMMON_FRAG, mulberry32, rr, type Env, type Rng } from './core';
import { hdris } from './assets';

export function makeSky(env: Env): THREE.Mesh {
  const h = hdris[env.hdri];
  const yaw = THREE.MathUtils.degToRad(h.sunAz - env.sunAz); // rotate the HDRI so its sun sits at the shot's sun azimuth
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...G, uHdr: { value: h.tex }, uYaw: { value: yaw }, uExposure: { value: env.exposure }, uHdrMix: { value: env.hdrMix },
      uZenith: { value: new THREE.Color(env.zenith) }, uHorizon: { value: new THREE.Color(env.horizon) }, uDisc: { value: env.sunDisc ?? 1 },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      ${TOON_COMMON_FRAG}
      uniform sampler2D uHdr; uniform float uYaw, uExposure, uHdrMix, uDisc; uniform vec3 uZenith, uHorizon;
      varying vec3 vDir;
      vec3 hdr(vec3 d, float lod) {
        float c = cos(uYaw), s = sin(uYaw);
        vec3 r = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
        vec2 uv = vec2(atan(r.z, r.x) * 0.15915494 + 0.5, asin(clamp(r.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        return texture2DLodEXT(uHdr, uv, lod).rgb;
      }
      void main() {
        vec3 d = normalize(vDir);
        // brushy lookup: jitter the direction with painterly noise so cloud edges break into strokes
        vec2 q = vec2(atan(d.z, d.x), d.y * 3.0);
        vec3 n1 = texture2D(uNoise, q * vec2(0.9, 0.7)).rgb;
        vec3 n2 = texture2D(uNoise, q * vec2(3.1, 2.3) + 0.4).rgb;
        vec3 dj = normalize(d + (vec3(n1.r, n1.g, n2.r) - 0.5) * 0.035 + (vec3(n2.g, n2.b, n1.b) - 0.5) * 0.012);
        dj.y = max(dj.y, 0.004);
        vec3 h = hdr(dj, 2.2) * uExposure;
        h = h / (1.0 + h);
        float l = dot(h, vec3(0.3, 0.6, 0.1));
        // soft posterisation into painted value steps
        float steps = 7.0; float lq = (floor(l * steps) + smoothstep(0.35, 0.65, fract(l * steps))) / steps;
        h *= mix(1.0, lq / max(l, 1e-3), 0.75);
        h = mix(vec3(dot(h, vec3(0.33))), h, 1.35);
        float gy = pow(smoothstep(-0.02, 0.8, d.y + (n1.g - 0.5) * 0.06), 0.55);
        vec3 grad = mix(uHorizon, uZenith, gy);
        vec3 c = mix(grad, h * 1.25 + grad * 0.25, uHdrMix);
        float sd = max(dot(d, uSunDir), 0.0);
        c += uFogSun * (pow(sd, 900.0) * 6.0 * uDisc + pow(sd, 60.0) * 0.55 * uDisc + pow(sd, 7.0) * 0.22);
        c = mix(c, mix(uFogCol, uFogSun, pow(sd, 6.0)), smoothstep(0.07, -0.01, d.y) * 0.95);
        c *= 0.97 + 0.06 * n2.g;
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
    extensions: { shaderTextureLOD: true } as any,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

// ---------------------------------------------------------------- clouds
function puff(r: Rng, cx: number, cy: number, cz: number, rad: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(rad, 3);
  g.translate(cx, cy, cz);
  return g;
}
export function cloudGeometry(seed: number, width = 60, height = 22): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n - 0.5;
    const env = Math.cos(u * Math.PI);           // tall in the middle
    const rad = height * (0.28 + 0.38 * env) * rr(r, 0.8, 1.15);
    parts.push(puff(r, u * width, rad * 0.55, rr(r, -4, 4), rad));
    if (r() < 0.75) parts.push(puff(r, u * width + rr(r, -5, 5), rad * rr(r, 1.0, 1.5), rr(r, -3, 3), rad * rr(r, 0.5, 0.75)));
    if (r() < 0.5) parts.push(puff(r, u * width + rr(r, -6, 6), rad * 0.35, rr(r, 4, 9), rad * rr(r, 0.4, 0.6)));
  }
  const g = mergeGeometries(parts)!;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) p.setY(i, y * 0.18); } // flat, hazy undersides
  g.computeVertexNormals();
  return g;
}
const CLOUD_FRAG = /* glsl */ `
  ${TOON_COMMON_FRAG}
  uniform vec3 uLit, uMid, uShade; uniform float uFade;
  varying vec3 vW; varying vec3 vN; varying vec3 vL;
  void main() {
    vec3 N = normalize(vN);
    vec3 nz = tri(uNoise, vL * 0.035, N); vec3 nz2 = tri(uNoise, vL * 0.11 + 0.3, N);
    float w = (nz.r - 0.5) * 0.55 + (nz2.g - 0.5) * 0.3;
    float ndl = dot(N, uSunDir) + w;
    float up = N.y + w;
    float a = smoothstep(-0.25, 0.05, ndl);
    float b = smoothstep(0.25, 0.6, ndl);
    vec3 c = mix(uShade, uMid, a);
    c = mix(c, uLit, b);
    c = mix(c, uShade * 0.92, smoothstep(-0.1, -0.75, up) * 0.75);
    vec3 V = normalize(vW - cameraPosition);
    float rim = pow(1.0 - abs(dot(N, V)), 2.5) * pow(max(dot(V, uSunDir), 0.0), 3.0);
    c += uFogSun * rim * 1.4;
    c *= 0.96 + 0.08 * nz2.b;
    c = mix(c, mix(uFogCol, uFogSun, pow(max(dot(V, uSunDir), 0.0), 6.0)), uFade);
    gl_FragColor = vec4(c, 1.0);
  }`;
export interface CloudStyle { lit: number; mid: number; shade: number }
export function makeClouds(seed: number, style: CloudStyle, specs: { x: number; y: number; z: number; w: number; h: number; fade?: number; ry?: number }[], drift = 1.2): { group: THREE.Group; update(t: number): void } {
  const group = new THREE.Group();
  const items: { m: THREE.Mesh; x: number; k: number }[] = [];
  specs.forEach((s, i) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...G, uLit: { value: new THREE.Color(style.lit) }, uMid: { value: new THREE.Color(style.mid) }, uShade: { value: new THREE.Color(style.shade) }, uFade: { value: s.fade ?? 0.25 } },
      vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN; varying vec3 vL; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: CLOUD_FRAG,
    });
    const m = new THREE.Mesh(cloudGeometry(seed + i * 13, s.w, s.h), mat);
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry ?? 0; m.frustumCulled = false;
    group.add(m); items.push({ m, x: s.x, k: 0.6 + ((i * 37) % 10) / 12 });
  });
  return { group, update(t) { for (const it of items) it.m.position.x = it.x + t * drift * it.k; } };
}
