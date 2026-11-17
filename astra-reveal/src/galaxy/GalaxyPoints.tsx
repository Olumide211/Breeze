import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector2} from 'three';
import {useLayout} from '../layout';
import {F} from '../timeline';
import {B, R0, galaxyState, offsetNdc, refDist, sizeMul, viewProjFor} from './camera';
import {GALAXY_COUNT, GalaxyBuffers, getGalaxy} from './galaxyData';

const common = /* glsl */ `
  attribute float aR;
  attribute float aTheta;
  attribute float aZ;
  attribute float aArm;
  attribute float aDelay;
  attribute float aDur;
  attribute float aSize;
  attribute float aBright;
  attribute float aSpike;
  attribute float aTw;
  attribute vec3 aColor;

  uniform float uFrame;
  uniform float uStart;
  uniform float uRot;
  uniform float uTilt;
  uniform mat4 uViewProj;
  uniform vec2 uOffset;
  uniform float uRefDist;
  uniform float uSizeMul;
  uniform float uAlpha;
  uniform float uR0;
  uniform float uB;

  float formP() { return clamp((uFrame - uStart - aDelay) / aDur, 0.0, 1.0); }

  vec4 place(float p) {
    float e = 1.0 - pow(1.0 - p, 3.0);
    float r = aR * e;
    float th;
    if (aArm > -50.0) {
      // ride the log spiral outward: arms unwind from the core
      th = aArm - log(max(r, uR0) / uR0) / uB + aTheta;
    } else {
      th = aTheta + (1.0 - e) * 1.2;
    }
    th += uRot;
    vec3 lp = vec3(r * cos(th), r * sin(th), aZ * e);
    float ct = cos(uTilt);
    float st = sin(uTilt);
    vec3 wp = vec3(lp.x, lp.y * ct + lp.z * st, -lp.y * st + lp.z * ct);
    vec4 clip = uViewProj * vec4(wp, 1.0);
    clip.xy += uOffset * clip.w;
    return clip;
  }
`;

const starVertex = /* glsl */ `
  ${common}
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDisc;
  varying float vSpike;
  void main() {
    float p = formP();
    vec4 clip = place(p);
    gl_Position = clip;
    float disc = aSize * uRefDist / clip.w * uSizeMul;
    // sprite holds the disc plus its bloom (and spikes for the brightest 2%)
    float mul = aSpike > 0.0 ? 6.0 : (aSize > 1.4 ? 2.4 : 1.6);
    float sprite = disc * mul;
    float energy = 1.0;
    if (disc < 1.0) { energy = disc * disc; disc = 1.0; sprite = max(sprite, 1.6); }
    sprite = max(sprite, 1.6);
    gl_PointSize = min(sprite, 80.0);
    float twinkle = 0.86 + 0.14 * sin(uFrame * (0.05 + 0.06 * aTw) + aTw * 40.0);
    vColor = aColor;
    vAlpha = aBright * twinkle * energy * smoothstep(0.0, 0.2, p) * uAlpha;
    vDisc = min(1.0, disc / gl_PointSize);
    vSpike = aSpike;
  }
`;

const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDisc;
  varying float vSpike;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = length(c);
    if (d > 1.0) discard;
    float disc = 1.0 - smoothstep(vDisc * 0.55, vDisc, d);
    // soft, low-strength bloom (large radius, low strength)
    float halo = 0.22 * exp(-d * d / (vDisc * vDisc * 2.2));
    // thin four-point spikes
    float sx = exp(-abs(c.y) / (vDisc * 0.07)) * pow(1.0 - abs(c.x), 2.0);
    float sy = exp(-abs(c.x) / (vDisc * 0.07)) * pow(1.0 - abs(c.y), 2.0);
    float spikes = vSpike * 0.7 * (sx + sy);
    float a = (disc + halo + spikes) * vAlpha;
    // alpha 0: pure light, composited additively (never darkens the space below)
    gl_FragColor = vec4(vColor * a, 0.0);
  }
`;

// Blurred density haze: a subset of stars drawn as wide, faint #87b8de gaussians.
const hazeVertex = /* glsl */ `
  ${common}
  varying float vAlpha;
  void main() {
    float p = formP();
    vec4 clip = place(p);
    gl_Position = clip;
    gl_PointSize = min(30.0 * uRefDist / clip.w * uSizeMul, 90.0);
    vAlpha = smoothstep(0.0, 0.5, p) * uAlpha;
  }
`;
const hazeFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(c, c);
    if (d2 > 1.0) discard;
    float a = exp(-d2 * 4.0) * 0.018 * vAlpha;
    gl_FragColor = vec4(vec3(0.529, 0.722, 0.871) * a, 0.0);
  }
`;

const makeMaterial = (haze: boolean) =>
  new ShaderMaterial({
    vertexShader: haze ? hazeVertex : starVertex,
    fragmentShader: haze ? hazeFragment : starFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
    uniforms: {
      uFrame: {value: 0},
      uStart: {value: F.galaxy},
      uRot: {value: 0},
      uTilt: {value: 0},
      uViewProj: {value: null},
      uOffset: {value: new Vector2()},
      uRefDist: {value: 1},
      uSizeMul: {value: 1},
      uAlpha: {value: 1},
      uR0: {value: R0},
      uB: {value: B},
    },
  });

const buildGeometry = (g: GalaxyBuffers, stride: number) => {
  const n = Math.floor(GALAXY_COUNT / stride);
  const pick = (src: Float32Array, k: number) => {
    if (stride === 1) return src;
    const out = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = src[i * stride * k + j];
    return out;
  };
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aR', new BufferAttribute(pick(g.r, 1), 1));
  geo.setAttribute('aTheta', new BufferAttribute(pick(g.theta, 1), 1));
  geo.setAttribute('aZ', new BufferAttribute(pick(g.z, 1), 1));
  geo.setAttribute('aArm', new BufferAttribute(pick(g.arm, 1), 1));
  geo.setAttribute('aDelay', new BufferAttribute(pick(g.delay, 1), 1));
  geo.setAttribute('aDur', new BufferAttribute(pick(g.dur, 1), 1));
  geo.setAttribute('aSize', new BufferAttribute(pick(g.size, 1), 1));
  geo.setAttribute('aBright', new BufferAttribute(pick(g.bright, 1), 1));
  geo.setAttribute('aSpike', new BufferAttribute(pick(g.spike, 1), 1));
  geo.setAttribute('aTw', new BufferAttribute(pick(g.tw, 1), 1));
  geo.setAttribute('aColor', new BufferAttribute(pick(g.color, 3), 3));
  return geo;
};

// Sample-based motion blur for the burst: sub-frame copies at 1/N strength.
const isFast = (f: number) => f >= F.galaxy - 2 && f < F.galaxy + 14;
const SAMPLES = 6;
const SHUTTER = 0.5; // 180 degrees
const HAZE_STRENGTH = 0.35;

export const GalaxyPoints: React.FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();

  const {stars, haze} = useMemo(() => {
    const g = getGalaxy();
    return {stars: buildGeometry(g, 1), haze: buildGeometry(g, 4)};
  }, []);
  const starMats = useMemo(() => Array.from({length: SAMPLES}, () => makeMaterial(false)), []);
  const hazeMat = useMemo(() => makeMaterial(true), []);

  const fast = isFast(frame);
  const n = fast ? SAMPLES : 1;
  const setUniforms = (m: ShaderMaterial, t: number, alpha: number) => {
    const s = galaxyState(t, L);
    const u = m.uniforms;
    u.uFrame.value = t;
    u.uRot.value = s.rot;
    u.uTilt.value = s.tilt;
    u.uViewProj.value = viewProjFor(s, L);
    const [ox, oy] = offsetNdc(s, L);
    (u.uOffset.value as Vector2).set(ox, oy);
    u.uRefDist.value = refDist(L);
    u.uSizeMul.value = sizeMul(L);
    u.uAlpha.value = alpha;
  };
  for (let k = 0; k < n; k++) {
    const t = fast ? frame - SHUTTER / 2 + (SHUTTER * k) / (SAMPLES - 1) : frame;
    setUniforms(starMats[k], t, 1 / n);
  }
  setUniforms(hazeMat, frame, HAZE_STRENGTH * 2.6);

  return (
    <ThreeCanvas
      width={L.W}
      height={L.H}
      linear
      flat
      dpr={1}
      gl={{antialias: false, alpha: true, premultipliedAlpha: true}}
      style={{position: 'absolute', inset: 0}}
    >
      <points geometry={haze} material={hazeMat} frustumCulled={false} />
      {starMats.slice(0, n).map((m, k) => (
        <points key={k} geometry={stars} material={m} frustumCulled={false} />
      ))}
    </ThreeCanvas>
  );
};
