// Custom post effects: silhouette outlines, lens flare / sun sparkle / light leaks,
// and the final ACES tone map + per-shot colour grade with grain and vignette.
import {BlendFunction, Effect, EffectAttribute} from 'postprocessing';
import * as THREE from 'three';

export class OutlineEffect extends Effect {
	constructor() {
		super(
			'OutlineEffect',
			/* glsl */ `
			uniform float uStrength;
			uniform vec3 uInk;
			float vz(vec2 uv) { return -getViewZ(readDepth(uv)); }
			void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
				vec2 t = texelSize * max(1.0, resolution.y / 1080.0);
				float z = -getViewZ(depth);
				float zl = vz(uv - vec2(t.x, 0.0)), zr = vz(uv + vec2(t.x, 0.0)), zu = vz(uv + vec2(0.0, t.y)), zd = vz(uv - vec2(0.0, t.y));
				// second derivative of depth: fires on silhouettes, not on smooth slopes
				float e = max(abs(zl + zr - 2.0 * z), abs(zu + zd - 2.0 * z)) / max(min(min(zl, zr), min(zu, zd)), 1.0);
				float line = smoothstep(0.02, 0.09, e) * (1.0 - smoothstep(2500.0, 7000.0, min(min(zl, zr), min(zu, zd))));
				float lum = dot(inputColor.rgb, vec3(0.3, 0.6, 0.1));
				vec3 ink = mix(uInk, inputColor.rgb * 0.45, 0.5);
				outputColor = vec4(mix(inputColor.rgb, ink, line * uStrength * (1.0 - smoothstep(1.5, 4.0, lum))), inputColor.a);
			}`,
			{
				blendFunction: BlendFunction.NORMAL,
				attributes: EffectAttribute.DEPTH,
				uniforms: new Map<string, THREE.Uniform>([['uStrength', new THREE.Uniform(0.5)], ['uInk', new THREE.Uniform(new THREE.Color(0.03, 0.035, 0.09))]]),
			},
		);
	}
}

export class FlareEffect extends Effect {
	constructor() {
		super(
			'FlareEffect',
			/* glsl */ `
			uniform vec2 uSun;      // sun position in uv space
			uniform float uSunVis;  // 0..1 (on screen, above horizon)
			uniform vec3 uSunTint;
			uniform float uLeak;
			uniform float uT;
			float disc(vec2 p, vec2 c, float r, float soft) { return 1.0 - smoothstep(r - soft, r + soft, length(p - c)); }
			void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
				vec3 col = inputColor.rgb;
				vec2 asp = vec2(aspect, 1.0);
				if (uSunVis > 0.001) {
					// occlusion: the flare dims as buildings / bridge cables cover the disc
					float vis = 0.0;
					for (int i = 0; i < 5; i++) {
						vec2 o = i == 0 ? vec2(0.0) : vec2(i == 1 ? 1.0 : i == 2 ? -1.0 : 0.0, i == 3 ? 1.0 : i == 4 ? -1.0 : 0.0) * 0.006;
						vis += step(0.99999, readDepth(clamp(uSun + o, 0.001, 0.999)));
					}
					vis = vis / 5.0 * uSunVis;
					if (vis > 0.001) {
						vec2 p = (uv - 0.5) * asp, s = (uSun - 0.5) * asp;
						vec2 d = p - s;
						float r = length(d);
						float ang = atan(d.y, d.x);
						vec3 f = vec3(0.0);
						// glow + anamorphic streak + star rays (sun sparkle)
						f += uSunTint * 0.16 / (1.0 + r * 9.0) * exp(-r * 2.2);
						f += uSunTint * vec3(0.7, 0.85, 1.0) * 0.35 * exp(-abs(d.y) * 160.0) / (1.0 + abs(d.x) * 7.0);
						float rays = pow(abs(cos(ang * 3.0 + 0.4)), 60.0) + 0.6 * pow(abs(cos(ang * 4.0 - 0.7)), 90.0);
						f += uSunTint * rays * 0.22 * exp(-r * 5.5);
						// ghosts along the sun -> centre axis
						vec2 axis = -s;
						f += vec3(0.25, 0.55, 1.0) * 0.045 * disc(p, s + axis * 0.55, 0.05, 0.012);
						f += vec3(1.0, 0.5, 0.3) * 0.04 * disc(p, s + axis * 0.9, 0.028, 0.01);
						f += vec3(0.4, 1.0, 0.6) * 0.035 * disc(p, s + axis * 1.35, 0.075, 0.02);
						f += vec3(0.9, 0.5, 1.0) * 0.03 * disc(p, s + axis * 1.8, 0.11, 0.03);
						float halo = exp(-pow((length(p - (s + axis * 2.0)) - 0.33) * 22.0, 2.0));
						f += vec3(1.0, 0.7, 0.45) * 0.03 * halo;
						col += f * vis * 2.2;
					}
				}
				if (uLeak > 0.001) {
					// soft drifting light leaks from the frame edges
					vec2 q = uv - vec2(0.5 + 0.55 * sin(uT * 0.21), 1.05);
					float l1 = exp(-dot(q * vec2(0.9, 1.7), q * vec2(0.9, 1.7)) * 2.4);
					vec2 q2 = uv - vec2(-0.08, 0.35 + 0.3 * sin(uT * 0.17 + 1.0));
					float l2 = exp(-dot(q2 * vec2(2.0, 1.0), q2 * vec2(2.0, 1.0)) * 3.2);
					col += (vec3(1.0, 0.45, 0.2) * l1 + vec3(1.0, 0.3, 0.45) * l2 * 0.7) * uLeak * 0.16;
				}
				outputColor = vec4(col, inputColor.a);
			}`,
			{
				blendFunction: BlendFunction.NORMAL,
				attributes: EffectAttribute.DEPTH,
				uniforms: new Map<string, THREE.Uniform>([
					['uSun', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
					['uSunVis', new THREE.Uniform(0)],
					['uSunTint', new THREE.Uniform(new THREE.Vector3(1, 0.9, 0.7))],
					['uLeak', new THREE.Uniform(0)],
					['uT', new THREE.Uniform(0)],
				]),
			},
		);
	}
}

export class GradeEffect extends Effect {
	constructor() {
		super(
			'GradeEffect',
			/* glsl */ `
			uniform float uExposure;
			uniform float uSat;
			uniform float uContrast;
			uniform vec3 uLift;
			uniform vec3 uGain;
			uniform float uFrame;
			uniform float uFlash;
			uniform float uFade;
			uniform float uVignette;
			uniform float uGrain;
			// ACES filmic (Stephen Hill fit)
			vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
			vec3 aces(vec3 c) {
				const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
				const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
				return clamp(outM * rrtOdt(inM * c), 0.0, 1.0);
			}
			float gh(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
			void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
				vec3 c = max(inputColor.rgb, 0.0) * uExposure;
				c = aces(c * 0.55);
				// grade in display-linear space
				float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
				c = mix(vec3(l), c, uSat);
				c = (c - 0.18) * uContrast + 0.18;
				c = c * uGain + uLift * (1.0 - c);
				// vignette
				vec2 q = uv - 0.5;
				float vig = smoothstep(0.95, 0.25, length(q * vec2(1.0, 0.82)));
				c *= mix(1.0, vig, uVignette);
				// deterministic film grain keyed on pixel + frame number
				vec2 gp = floor(uv * vec2(1920.0, 1080.0));
				float g = gh(vec3(gp, uFrame)) + gh(vec3(gp + 17.0, uFrame + 3.0)) - 1.0;
				c += g * uGrain * (0.6 + 0.4 * (1.0 - l));
				c = mix(c, vec3(1.0), uFlash);
				c *= uFade;
				outputColor = vec4(max(c, 0.0), 1.0);
			}`,
			{
				blendFunction: BlendFunction.NORMAL,
				uniforms: new Map<string, THREE.Uniform>([
					['uExposure', new THREE.Uniform(1)],
					['uSat', new THREE.Uniform(1)],
					['uContrast', new THREE.Uniform(1)],
					['uLift', new THREE.Uniform(new THREE.Vector3())],
					['uGain', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
					['uFrame', new THREE.Uniform(0)],
					['uFlash', new THREE.Uniform(0)],
					['uFade', new THREE.Uniform(1)],
					['uVignette', new THREE.Uniform(0.55)],
					['uGrain', new THREE.Uniform(0.028)],
				]),
			},
		);
	}
}

// Camera motion blur by depth reprojection (one scene pass per frame). This is the default on
// software GL; with a GPU, raise the sub-frame count instead and this effect stays subtle.
export class MotionBlurEffect extends Effect {
	constructor() {
		super(
			'MotionBlurEffect',
			/* glsl */ `
			uniform mat4 uReproj;
			uniform float uMax;
			uniform float uFrame;
			void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
				vec4 pc = uReproj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
				vec2 v = pc.w > 1e-5 ? uv - (pc.xy / pc.w * 0.5 + 0.5) : vec2(0.0);
				float l = length(v);
				if (l < 0.0007) { outputColor = inputColor; return; }
				if (l > uMax) v *= uMax / l;
				float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) + uFrame * 0.61803));
				vec3 acc = vec3(0.0);
				for (int i = 0; i < 9; i++) {
					float t = (float(i) + n) / 9.0 - 0.5;
					acc += texture2D(inputBuffer, clamp(uv + v * t, 0.001, 0.999)).rgb;
				}
				outputColor = vec4(acc / 9.0, inputColor.a);
			}`,
			{
				blendFunction: BlendFunction.NORMAL,
				attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
				uniforms: new Map<string, THREE.Uniform>([['uReproj', new THREE.Uniform(new THREE.Matrix4())], ['uMax', new THREE.Uniform(0.03)], ['uFrame', new THREE.Uniform(0)]]),
			},
		);
	}
}
