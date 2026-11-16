// Stylised material for everything that is not a facade: props, vehicles, bridges, trees.
// Vertex colour = albedo, colour alpha = emissive factor; supports instancing + instance colour.
import * as THREE from 'three';
import {COMMON_PARS, U, WORLD_VERT} from './common';

export type PropOpts = {
	emitDay?: number; // emissive multiplier in daylight
	emitNight?: number; // emissive multiplier at night
	pattern?: 'none' | 'stone' | 'planks' | 'truss' | 'foliage';
	transparent?: boolean;
	doubleSide?: boolean;
	blink?: boolean; // emissive parts blink (beacons); phase from instance position
	sway?: boolean; // foliage sway
	noShadow?: boolean;
	signal?: boolean; // traffic signal: colour alpha selects the lamp, lamps cycle over time
	tintEmissive?: boolean; // instance colour also tints emissive parts (neon signs)
};

export const makePropMaterial = (o: PropOpts = {}) => {
	const pat = {none: 0, stone: 1, planks: 2, truss: 3, foliage: 4}[o.pattern ?? 'none'];
	return new THREE.ShaderMaterial({
		uniforms: {...(U as any), uEmitDay: {value: o.emitDay ?? 0}, uEmitNight: {value: o.emitNight ?? 1}},
		defines: {PATTERN: pat, ...(o.blink ? {BLINK: ''} : {}), ...(o.sway ? {SWAY: ''} : {}), ...(o.noShadow ? {NOSHADOW: ''} : {}), ...(o.signal ? {SIGNAL: ''} : {}), ...(o.tintEmissive ? {TINT_EMISSIVE: ''} : {})},
		side: o.doubleSide || pat === 3 ? THREE.DoubleSide : THREE.FrontSide,
		transparent: !!o.transparent,
		vertexShader: /* glsl */ `
			attribute vec4 color;
			uniform float uTime;
			varying vec3 vW;
			varying vec3 vN;
			varying vec4 vC;
			varying vec2 vUv;
			varying float vPhase;
			${WORLD_VERT}
			void main() {
				vec4 wp = worldPos4(position);
				vN = worldNormal(normal);
				vC = color;
				#ifdef USE_INSTANCING_COLOR
				#ifdef TINT_EMISSIVE
				vC.rgb *= instanceColor;
				#else
				vC.rgb *= mix(instanceColor, vec3(1.0), step(0.01, color.a));
				#endif
				#endif
				vUv = uv;
				#ifdef USE_INSTANCING
				vec3 org = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
				#else
				vec3 org = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
				#endif
				vPhase = fract(dot(org.xz, vec2(0.0137, 0.0291)));
				#ifdef SWAY
				float h = max(position.y - 2.0, 0.0);
				wp.x += sin(uTime * 1.3 + org.x * 0.31 + org.z * 0.17) * 0.035 * h;
				wp.z += cos(uTime * 1.1 + org.x * 0.23) * 0.025 * h;
				#endif
				vW = wp.xyz;
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			uniform float uEmitDay;
			uniform float uEmitNight;
			varying vec3 vW;
			varying vec3 vN;
			varying vec4 vC;
			varying vec2 vUv;
			varying float vPhase;
			void main() {
				vec3 N = normalize(vN);
				if (!gl_FrontFacing) N = -N;
				vec3 V = normalize(uCamPos - vW);
				vec3 alb = vC.rgb;
				#if PATTERN == 1
				// granite blocks
				vec2 bp = vec2(dot(vW.xz, vec2(N.z, -N.x)) / 1.7 + floor(vW.y / 0.8) * 0.5, vW.y / 0.8);
				vec2 bf = fract(bp);
				float bw = max(fwidth(bp.x), fwidth(bp.y));
				float joint = max(1.0 - smoothstep(0.0, 0.03 + bw, bf.x), 1.0 - smoothstep(0.0, 0.06 + bw, bf.y));
				float tone = hash21(floor(bp));
				float bfade = 1.0 - smoothstep(0.25, 0.9, bw);
				alb *= 1.0 + bfade * ((tone - 0.5) * 0.16 - joint * 0.2);
				alb *= 0.85 + 0.3 * texture2D(uNoise, vec2(bp.x * 0.05, bp.y * 0.03)).g;
				#elif PATTERN == 2
				float pl = fract(vUv.y * 1.0);
				float pw = fwidth(vUv.y);
				alb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.08 + pw, pl)) * (1.0 - smoothstep(0.3, 1.0, pw));
				alb *= 0.85 + 0.3 * hash11(floor(vUv.y));
				#elif PATTERN == 3
				// lattice truss: chords top/bottom, posts and X diagonals; everything else is cut out
				vec2 q = fract(vUv);
				vec2 qw = fwidth(vUv);
				float chord = step(q.y, 0.07) + step(0.93, q.y);
				float post = step(q.x, 0.04) + step(0.96, q.x);
				float diag = step(abs(q.x - q.y), 0.045) + step(abs(q.x - (1.0 - q.y)), 0.045);
				float cover = sat(chord + post + diag);
				if (cover < 0.5) discard;
				#elif PATTERN == 4
				alb *= 0.8 + 0.4 * texture2D(uNoise, vW.xz * 0.11 + vW.y * 0.07).a;
				#endif
				#ifdef NOSHADOW
				float sh = cloudShadow(vW);
				#else
				float sh = sunShadow(vW, N) * cloudShadow(vW);
				#endif
				vec3 col = animeShade(alb, N, V, sh, 1.0);
				col += alb * uNight * (vec3(1.0, 0.62, 0.34) * 0.4 * exp(-max(vW.y, 0.0) / 10.0) + vec3(0.09, 0.07, 0.13));
				float e = vC.a * mix(uEmitDay, uEmitNight, uNight);
				#ifdef SIGNAL
				// 16 s cycle: green, amber, red; the cross street runs half a cycle out of phase
				float ph = fract(uTime / 16.0 + floor(vPhase * 2.0) * 0.5 + 0.1);
				float lampId = vC.a;
				float on = lampId > 0.6 ? step(ph, 0.42) : lampId > 0.4 ? step(0.42, ph) * step(ph, 0.5) : step(0.5, ph);
				e = on * mix(uEmitDay, uEmitNight, uNight);
				alb *= vC.a > 0.01 ? 0.25 : 1.0;
				#endif
				#ifdef BLINK
				e *= smoothstep(0.0, 0.08, fract(uTime * 0.75 + vPhase)) * (1.0 - smoothstep(0.32, 0.42, fract(uTime * 0.75 + vPhase)));
				#endif
				col += vC.rgb * e;
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
};
