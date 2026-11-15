// Hand-rolled post pipeline: MSAA HDR scene -> painterly (Kuwahara) filter -> blurred foreground layer ->
// bloom -> lens flare / light leaks / grade / vignette / grain -> canvas.
import * as THREE from 'three';
import { W, H, type Env } from './core';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class Pass {
  mat: THREE.ShaderMaterial; mesh: THREE.Mesh; scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(frag: string, uniforms: Record<string, THREE.IUniform>) {
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.mesh.frustumCulled = false; this.scene.add(this.mesh);
  }
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) { r.setRenderTarget(target); r.render(this.scene, this.cam); }
}

const rt = (w: number, h: number, o: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...o });

const BLUR = /* glsl */ `
  uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tIn, vUv) * 0.19648;
    c += (texture2D(tIn, vUv + uDir * 1.4118) + texture2D(tIn, vUv - uDir * 1.4118)) * 0.29690;
    c += (texture2D(tIn, vUv + uDir * 3.2941) + texture2D(tIn, vUv - uDir * 3.2941)) * 0.09447;
    c += (texture2D(tIn, vUv + uDir * 5.1765) + texture2D(tIn, vUv - uDir * 5.1765)) * 0.01038;
    gl_FragColor = c;
  }`;

const BRIGHT = /* glsl */ `
  uniform sampler2D tIn; uniform float uThresh; varying vec2 vUv; uniform vec2 uPx;
  void main(){
    vec3 c = (texture2D(tIn, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tIn, vUv + uPx * vec2(1.0, -1.0)).rgb + texture2D(tIn, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tIn, vUv + uPx * vec2(1.0, 1.0)).rgb) * 0.25;
    c = min(c, vec3(12.0));
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThresh, uThresh + 0.9, l);
    gl_FragColor = vec4(c * k, 1.0);
  }`;

// 4-sector Kuwahara: flattens detail into brush-like colour patches while keeping edges.
const KUWAHARA = /* glsl */ `
  uniform sampler2D tIn; uniform vec2 uPx; uniform float uRadius; varying vec2 vUv;
  void main(){
    vec3 m[4]; vec3 s[4];
    for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
    const int R = 2;
    for (int j = 0; j <= R; j++) for (int i = 0; i <= R; i++) {
      vec2 o = vec2(float(i), float(j)) * uRadius / float(R);
      vec3 c;
      c = texture2D(tIn, vUv + vec2(-o.x, -o.y) * uPx).rgb; c = c / (1.0 + c); m[0] += c; s[0] += c * c;
      c = texture2D(tIn, vUv + vec2( o.x, -o.y) * uPx).rgb; c = c / (1.0 + c); m[1] += c; s[1] += c * c;
      c = texture2D(tIn, vUv + vec2(-o.x,  o.y) * uPx).rgb; c = c / (1.0 + c); m[2] += c; s[2] += c * c;
      c = texture2D(tIn, vUv + vec2( o.x,  o.y) * uPx).rgb; c = c / (1.0 + c); m[3] += c; s[3] += c * c;
    }
    float n = float((R + 1) * (R + 1));
    float best = 1e9; vec3 outc = vec3(0.0);
    for (int k = 0; k < 4; k++) {
      m[k] /= n; s[k] = abs(s[k] / n - m[k] * m[k]);
      float v = s[k].r + s[k].g + s[k].b;
      if (v < best) { best = v; outc = m[k]; }
    }
    outc = outc / max(1.0 - outc, 0.02);
    gl_FragColor = vec4(outc, 1.0);
  }`;

const FINAL = /* glsl */ `
  uniform sampler2D tScene, tPaint, tFg, tBloomA, tBloomB, uNoise;
  uniform float uPaint, uHasFg, uBloom, uFrame, uTime, uFlare, uLeak, uRainbow, uSat, uContrast, uVig, uFade, uCard, uSunVis, uGrain;
  uniform vec2 uSun; uniform vec3 uFlareCol, uLift, uGain;
  varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.6667, 0.3333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
  void main(){
    float asp = ${(W / H).toFixed(6)};
    vec3 sharp = texture2D(tScene, vUv).rgb;
    vec3 paint = texture2D(tPaint, vUv).rgb;
    vec3 c = mix(sharp, paint, uPaint);
    if (uHasFg > 0.5) { vec4 f = texture2D(tFg, vUv); c = c * (1.0 - f.a) + f.rgb; }
    vec3 bA = texture2D(tBloomA, vUv).rgb, bB = texture2D(tBloomB, vUv).rgb;
    c += (bA * 0.55 + bB * 0.75) * uBloom;

    // ---- lens flare
    vec2 p = (vUv - 0.5) * vec2(asp, 1.0), s = (uSun - 0.5) * vec2(asp, 1.0);
    vec2 d = p - s; float r = length(d);
    float fl = uFlare * uSunVis;
    if (fl > 0.0) {
      float ang = atan(d.y, d.x);
      float glowv = 0.03 / (r * r * 14.0 + 0.04);
      float rays = pow(0.5 + 0.5 * sin(ang * 6.0 + 0.6), 14.0) * 0.6 + pow(0.5 + 0.5 * sin(ang * 14.0 + 1.9), 24.0) * 0.35;
      float star = rays * exp(-r * 3.2) * 0.9;
      float streak = exp(-abs(d.y) * 70.0) * exp(-abs(d.x) * 1.5) * 0.55 + exp(-abs(d.y) * 14.0) * exp(-abs(d.x) * 3.0) * 0.12;
      vec3 f = uFlareCol * (glowv + star) + vec3(0.55, 0.75, 1.0) * streak;
      // ghosts along the sun -> centre axis
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float k = -0.35 - fi * 0.33 + (i == 4 ? 2.2 : 0.0);
        vec2 gc = s * k; float gr = 0.035 + 0.03 * mod(fi * 2.0, 3.0);
        float gd = length(p - gc);
        float disc = smoothstep(gr, gr * 0.72, gd) * (0.4 + 0.6 * smoothstep(gr * 0.3, gr, gd));
        f += hue(0.05 + fi * 0.17) * disc * 0.085 * (1.0 + 0.5 * mod(fi, 2.0));
      }
      float ring = smoothstep(0.03, 0.0, abs(r - 0.52)) * 0.07;
      f += hue(ang * 0.1592 + r * 2.0) * ring * smoothstep(1.0, 0.2, length(s)) ;
      c += f * fl;
    }

    // ---- tone map (extended Reinhard) + grade
    c = c * (1.0 + c / 9.0) / (1.0 + c);
    c = pow(max(c, 0.0), vec3(1.0 / 2.2));
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSat);
    c = mix(c, smoothstep(0.0, 1.0, c), uContrast);
    c = c * uGain + uLift * (1.0 - c);

    // ---- light leaks (screen blend)
    vec3 leak = vec3(0.0);
    if (uLeak > 0.0) {
      vec2 a1 = vec2(-0.95 + 0.12 * sin(uTime * 0.5), 0.35 + 0.2 * sin(uTime * 0.37));
      vec2 a2 = vec2(0.98 + 0.1 * sin(uTime * 0.43 + 2.0), -0.3 + 0.25 * cos(uTime * 0.31));
      float n = texture2D(uNoise, vUv * 0.35 + vec2(uTime * 0.02, 0.0)).a;
      leak += vec3(1.0, 0.42, 0.12) * smoothstep(0.85, 0.0, length((p - a1) * vec2(1.0, 0.55))) * (0.6 + 0.4 * n);
      leak += vec3(1.0, 0.25, 0.45) * smoothstep(0.7, 0.0, length((p - a2) * vec2(1.0, 0.6))) * (0.5 + 0.5 * n) * 0.8;
      leak *= uLeak;
    }
    if (uRainbow > 0.0) {
      float n = texture2D(uNoise, vUv * 0.22 + vec2(uTime * 0.045, uTime * 0.01)).a;
      float n2 = texture2D(uNoise, vUv * 0.5 - vec2(uTime * 0.03, 0.0)).r;
      float sweep = fract(uTime * 0.27);
      float band = p.x * 0.55 + p.y * 0.32 + n * 0.5;
      float m1 = smoothstep(0.55, 0.0, abs(band - (sweep * 3.4 - 1.4)));
      float m2 = smoothstep(0.4, 0.0, abs(band - (fract(sweep + 0.45) * 3.4 - 1.5))) * 0.7;
      float edge = smoothstep(0.15, 0.95, length(p * vec2(0.75, 1.0))) * 0.55;
      vec3 rb = hue(band * 1.5 + uTime * 0.13 + n2 * 0.3);
      rb = mix(vec3(1.0, 0.75, 0.5), rb, 0.88);
      leak += rb * (m1 * 1.25 + m2 + edge * (0.5 + 0.5 * n2)) * uRainbow * (0.6 + 0.4 * n2);
    }
    c = 1.0 - (1.0 - c) * (1.0 - clamp(leak, 0.0, 1.0));

    // ---- vignette, paper tooth, grain
    float vr = length(p * vec2(0.85, 1.0));
    c *= 1.0 - uVig * smoothstep(0.35, 1.05, vr);
    float tooth = texture2D(uNoise, vUv * vec2(asp, 1.0) * 5.0).b;
    c *= 0.975 + 0.05 * tooth;
    float g = hash(gl_FragCoord.xy + vec2(uFrame * 17.0, uFrame * 31.0)) - 0.5;
    c += g * uGrain * (0.5 + 0.5 * (1.0 - l));

    // ---- title card and fades
    if (uCard > 0.0) {
      vec3 soft = (bA + bB * 1.5); soft = soft / (1.0 + soft);
      vec3 cardc = mix(vec3(0.035, 0.10, 0.16), vec3(0.10, 0.22, 0.24), vUv.y) + pow(soft, vec3(0.6)) * 0.10;
      cardc += (paint / (1.0 + paint)) * 0.22;
      cardc *= 1.0 - 0.45 * smoothstep(0.3, 1.1, vr);
      cardc += g * uGrain;
      c = mix(c, cardc, uCard);
    }
    c *= 1.0 - uFade;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

export interface FrameFx { fade: number; card: number; sun: THREE.Vector2; sunVis: number; frame: number; time: number; hasFg: boolean }

export class Post {
  scene = rt(W, H, { depthBuffer: true, samples: new URLSearchParams(location.search).has('nomsaa') ? 0 : 2 });
  noPaint = new URLSearchParams(location.search).has('nopaint');
  paint = rt(W, H);
  fgA = rt(W / 2, H / 2, { depthBuffer: true }); fgB = rt(W / 2, H / 2);
  b1a = rt(W / 4, H / 4); b1b = rt(W / 4, H / 4); b2a = rt(W / 8, H / 8); b2b = rt(W / 8, H / 8);
  blur = new Pass(BLUR, { tIn: { value: null }, uDir: { value: new THREE.Vector2() } });
  bright = new Pass(BRIGHT, { tIn: { value: null }, uThresh: { value: 1.15 }, uPx: { value: new THREE.Vector2(1 / W, 1 / H) } });
  kuwa = new Pass(KUWAHARA, { tIn: { value: null }, uPx: { value: new THREE.Vector2(1 / W, 1 / H) }, uRadius: { value: 3.2 } });
  final: Pass;
  constructor(public r: THREE.WebGLRenderer, noise: THREE.Texture) {
    this.final = new Pass(FINAL, {
      tScene: { value: this.scene.texture }, tPaint: { value: this.paint.texture }, tFg: { value: this.fgA.texture },
      tBloomA: { value: this.b1a.texture }, tBloomB: { value: this.b2a.texture }, uNoise: { value: noise },
      uPaint: { value: 0.85 }, uHasFg: { value: 0 }, uBloom: { value: 0.5 }, uFrame: { value: 0 }, uTime: { value: 0 },
      uFlare: { value: 0 }, uLeak: { value: 0 }, uRainbow: { value: 0 }, uSat: { value: 1.1 }, uContrast: { value: 0.25 }, uVig: { value: 0.3 },
      uFade: { value: 0 }, uCard: { value: 0 }, uSunVis: { value: 1 }, uGrain: { value: 0.045 }, uSun: { value: new THREE.Vector2() },
      uFlareCol: { value: new THREE.Color(1, 0.8, 0.55) }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
    });
  }
  private blurInto(src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, spread: number) {
    const u = this.blur.mat.uniforms;
    u.tIn.value = src.texture; u.uDir.value.set(spread / src.width, 0); this.blur.render(this.r, tmp);
    u.tIn.value = tmp.texture; u.uDir.value.set(0, spread / src.height); this.blur.render(this.r, src);
  }
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, env: Env, fx: FrameFx, light?: THREE.DirectionalLight) {
    const r = this.r;
    camera.layers.set(0);
    if (light) light.shadow.needsUpdate = true;
    r.setRenderTarget(this.scene); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, camera);
    if (fx.hasFg) {
      camera.layers.set(1);
      const bg = scene.background; scene.background = null;
      r.setRenderTarget(this.fgA); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
      scene.background = bg; camera.layers.set(0);
      this.blurInto(this.fgA, this.fgB, 1.6); this.blurInto(this.fgA, this.fgB, 2.6);
    }
    const paintK = this.noPaint ? 0 : (env.paint ?? 0.85);
    if (paintK > 0) { this.kuwa.mat.uniforms.tIn.value = this.scene.texture; this.kuwa.render(r, this.paint); }
    this.bright.mat.uniforms.tIn.value = this.scene.texture; this.bright.mat.uniforms.uPx.value.set(1 / W, 1 / H); this.bright.render(r, this.b1a);
    this.blurInto(this.b1a, this.b1b, 1.0);
    this.bright.mat.uniforms.tIn.value = this.b1a.texture; this.bright.mat.uniforms.uThresh.value = 0.0; this.bright.mat.uniforms.uPx.value.set(2 / W, 2 / H); this.bright.render(r, this.b2a);
    this.bright.mat.uniforms.uThresh.value = 1.15;
    this.blurInto(this.b2a, this.b2b, 1.0); this.blurInto(this.b2a, this.b2b, 2.0);
    const u = this.final.mat.uniforms;
    u.uPaint.value = paintK; u.uHasFg.value = fx.hasFg ? 1 : 0; u.uBloom.value = env.bloom ?? 0.5; u.uFrame.value = fx.frame; u.uTime.value = fx.time;
    u.uFlare.value = env.flare ?? 0; u.uFlareCol.value.set(env.flareCol ?? 0xffc98a); u.uLeak.value = env.leak ?? 0; u.uRainbow.value = env.rainbow ?? 0;
    u.uSat.value = env.sat ?? 1.12; u.uContrast.value = env.contrast ?? 0.25; u.uVig.value = env.vignette ?? 0.3;
    u.uLift.value.set(...(env.lift ?? [0.02, 0.015, 0.05])); u.uGain.value.set(...(env.gain ?? [1.0, 0.98, 0.95]));
    u.uFade.value = fx.fade; u.uCard.value = fx.card; u.uSun.value.copy(fx.sun); u.uSunVis.value = fx.sunVis;
    this.final.render(r, null);
  }
}
