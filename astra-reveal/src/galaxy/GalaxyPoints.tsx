import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
  Vector2,
} from 'three';
import {F, H, W} from '../timeline';
import {B, R0, REF_DIST, galaxyState, offsetNdc, viewProjFor} from './camera';
import {GALAXY_COUNT, getGalaxy} from './galaxyData';

const vertex = /* glsl */ `
  attribute float aR;
  attribute float aTheta;
  attribute float aZ;
  attribute float aArm;
  attribute float aDelay;
  attribute float aDur;
  attribute float aSize;
  attribute float aBright;
  attribute float aHalo;
  attribute float aTw;
  attribute vec3 aColor;

  uniform float uFrame;
  uniform float uStart;
  uniform float uRot;
  uniform float uTilt;
  uniform mat4 uViewProj;
  uniform vec2 uOffset;
  uniform float uRefDist;
  uniform float uAlpha;
  uniform float uR0;
  uniform float uB;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  varying float vDisc;

  void main() {
    float p = clamp((uFrame - uStart - aDelay) / aDur, 0.0, 1.0);
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
    gl_Position = clip;

    float disc = aSize * uRefDist / clip.w;
    float sprite = disc * (aHalo > 0.0 ? 2.6 : 1.5);
    float energy = 1.0;
    if (sprite < 1.5) { energy = (sprite * sprite) / 2.25; sprite = 1.5; }
    gl_PointSize = min(sprite, 72.0);

    float twinkle = 0.88 + 0.12 * sin(uFrame * (0.05 + 0.06 * aTw) + aTw * 40.0);
    vColor = aColor;
    vAlpha = aBright * twinkle * energy * smoothstep(0.0, 0.2, p) * uAlpha;
    vHalo = aHalo;
    vDisc = aHalo > 0.0 ? 1.0 / 2.6 : 1.0 / 1.5;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  varying float vDisc;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = length(c);
    if (d > 1.0) discard;
    // crisp-edged disc (like the hero's dots) ...
    float disc = 1.0 - smoothstep(vDisc * 0.62, vDisc, d);
    // ... plus a soft, low-strength bloom halo on brighter stars only
    float halo = vHalo * 0.28 * exp(-d * d * 7.0);
    float a = (disc + halo) * vAlpha;
    // alpha 0: pure light, composited additively over the space layer (never darkens it)
    gl_FragColor = vec4(vColor * a, 0.0);
  }
`;

const makeMaterial = () =>
  new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
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
      uRefDist: {value: REF_DIST},
      uAlpha: {value: 1},
      uR0: {value: R0},
      uB: {value: B},
    },
  });

// Sample-based motion blur for the fast moment: render sub-frame copies at 1/N strength.
const isFast = (f: number) => f >= F.galaxy - 2 && f < F.galaxy + 14;
const SAMPLES = 6;
const SHUTTER = 0.5; // 180 degrees

export const GalaxyPoints: React.FC = () => {
  const frame = useCurrentFrame();

  const geometry = useMemo(() => {
    const g = getGalaxy();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(GALAXY_COUNT * 3), 3));
    geo.setAttribute('aR', new BufferAttribute(g.r, 1));
    geo.setAttribute('aTheta', new BufferAttribute(g.theta, 1));
    geo.setAttribute('aZ', new BufferAttribute(g.z, 1));
    geo.setAttribute('aArm', new BufferAttribute(g.arm, 1));
    geo.setAttribute('aDelay', new BufferAttribute(g.delay, 1));
    geo.setAttribute('aDur', new BufferAttribute(g.dur, 1));
    geo.setAttribute('aSize', new BufferAttribute(g.size, 1));
    geo.setAttribute('aBright', new BufferAttribute(g.bright, 1));
    geo.setAttribute('aHalo', new BufferAttribute(g.halo, 1));
    geo.setAttribute('aTw', new BufferAttribute(g.tw, 1));
    geo.setAttribute('aColor', new BufferAttribute(g.color, 3));
    return geo;
  }, []);

  const materials = useMemo(() => Array.from({length: SAMPLES}, makeMaterial), []);

  const fast = isFast(frame);
  const n = fast ? SAMPLES : 1;
  for (let k = 0; k < SAMPLES; k++) {
    const t = fast ? frame - SHUTTER / 2 + (SHUTTER * k) / (SAMPLES - 1) : frame;
    const s = galaxyState(t);
    const u = materials[k].uniforms;
    u.uFrame.value = t;
    u.uRot.value = s.rot;
    u.uTilt.value = s.tilt;
    u.uViewProj.value = viewProjFor(s);
    const [ox, oy] = offsetNdc(s);
    (u.uOffset.value as Vector2).set(ox, oy);
    u.uAlpha.value = 1 / n;
  }

  return (
    <ThreeCanvas
      width={W}
      height={H}
      linear
      flat
      dpr={1}
      gl={{antialias: false, alpha: true, premultipliedAlpha: true}}
      style={{position: 'absolute', inset: 0}}
    >
      {materials.slice(0, n).map((m, k) => (
        <points key={k} geometry={geometry} material={m} frustumCulled={false} />
      ))}
    </ThreeCanvas>
  );
};
