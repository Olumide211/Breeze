// Ground (land / parks / asphalt from the OSM raster mask, wet-street reflections,
// street-light pools) and the East River / Hudson water surface.
import * as THREE from 'three';
import type {City} from '../city/data';
import {COMMON_PARS, U} from '../shaders/common';

const VERT = /* glsl */ `
varying vec3 vW;
void main() {
	vec4 wp = modelMatrix * vec4(position, 1.0);
	vW = wp.xyz;
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const makeGround = (city: City) => {
	const M = city.misc.mask;
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			...(U as any),
			uMask: {value: city.maskTex},
			uMaskRect: {value: new THREE.Vector4(M.x0, M.z0, M.w * M.px, M.h * M.px)},
		},
		vertexShader: VERT,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			uniform sampler2D uMask;
			uniform vec4 uMaskRect;
			varying vec3 vW;
			void main() {
				vec2 muv = (vW.xz - uMaskRect.xy) / uMaskRect.zw;
				vec3 m = texture2D(uMask, clamp(muv, 0.001, 0.999)).rgb;
				if (m.r < 0.5) discard;
				vec3 V = normalize(uCamPos - vW);
				float dist = length(uCamPos - vW);
				float fw = max(fwidth(vW.x), fwidth(vW.z));
				float nearD = 1.0 - smoothstep(0.08, 0.5, fw);
				float n1 = texture2D(uNoise, vW.xz / 55.0).g;
				float n2 = texture2D(uNoise, vW.xz / 7.0).a;
				float aaR = clamp(fw * 0.06, 0.01, 0.2);
				float road = smoothstep(0.5 - aaR, 0.5 + aaR, m.b);
				float curb = smoothstep(0.38, 0.47, m.b) * (1.0 - road);
				float park = smoothstep(0.4, 0.6, m.g) * (1.0 - road);
				// sidewalk slabs
				vec3 walk = vec3(0.15, 0.146, 0.14) * (0.85 + 0.25 * n1);
				vec2 slab = abs(fract(vW.xz * mat2(0.875, 0.485, -0.485, 0.875) / 1.5) - 0.5);
				walk *= 1.0 - 0.16 * nearD * (1.0 - smoothstep(0.0, 0.04, min(slab.x, slab.y)));
				walk = mix(walk, walk * 0.62, curb);
				vec3 asphalt = vec3(0.058, 0.06, 0.068) * (0.8 + 0.5 * n1) * (0.92 + 0.16 * n2 * nearD);
				// grass with autumn drift
				float gn = texture2D(uNoise, vW.xz / 160.0).b;
				vec3 grass = mix(vec3(0.055, 0.13, 0.035), vec3(0.17, 0.14, 0.04), smoothstep(0.35, 0.75, gn)) * (0.75 + 0.5 * n1);
				vec3 alb = mix(walk, grass, park);
				alb = mix(alb, asphalt, road);
				// outside the mapped area: generic outer-borough texture so the horizon never looks empty
				float outside = step(muv.x, 0.0) + step(1.0, muv.x) + step(muv.y, 0.0) + step(1.0, muv.y);
				if (outside > 0.5) alb = vec3(0.14, 0.14, 0.15) * (0.7 + 0.6 * n1);

				float sh = sunShadow(vW, vec3(0.0, 1.0, 0.0)) * cloudShadow(vW);
				vec3 col = animeShade(alb, vec3(0.0, 1.0, 0.0), V, sh, 1.0);

				// night: warm street-light pools along the roads, cool spill elsewhere
				vec2 gp = vW.xz * mat2(0.875, 0.485, -0.485, 0.875);
				vec2 lp = abs(fract(gp / vec2(34.0, 34.0)) - 0.5);
				float pools = exp(-dot(lp, lp) * 26.0);
				float nearRoad = smoothstep(0.2, 0.5, m.b);
				col += alb * uNight * vec3(1.0, 0.62, 0.3) * (0.55 + 2.6 * pools) * nearRoad * (1.0 + 2.5 * smoothstep(400.0, 1500.0, dist));
				col += alb * uNight * vec3(0.12, 0.1, 0.16);
				if (outside > 0.5) {
					// distant borough lights
					vec2 lc = floor(vW.xz / 38.0);
					float lh = hash21(lc);
					col += vec3(1.0, 0.72, 0.4) * step(0.72, lh) * uNight * 0.9 * exp(-dot(fract(vW.xz / 38.0) - 0.5, fract(vW.xz / 38.0) - 0.5) * 30.0);
				}

				// wet streets: mirror the city (planar reflection) with puddles + rain ripples
				if (uWet > 0.01 && uReflOn > 0.5) {
					float pud = smoothstep(0.42, 0.62, texture2D(uNoise, vW.xz / 23.0).r + 0.25 * road);
					float wetness = uWet * mix(0.45, 1.0, pud) * mix(0.55, 1.0, road);
					vec2 rip = vec2(0.0);
					vec2 rc = floor(vW.xz / 0.9);
					vec2 rf = fract(vW.xz / 0.9) - 0.5;
					float rh = hash21(rc);
					float ph = fract(uTime * 1.6 + rh * 7.0);
					float ring = sin((length(rf) - ph * 0.5) * 60.0) * exp(-abs(length(rf) - ph * 0.5) * 22.0) * (1.0 - ph);
					rip = normalize(rf + 1e-4) * ring * 0.012 * pud * uRain * (1.0 - smoothstep(20.0, 70.0, dist));
					vec2 rough = (vec2(texture2D(uNoise, vW.xz / 2.3).a, texture2D(uNoise, vW.zx / 2.7).a) - 0.5) * mix(0.05, 0.006, pud);
					vec4 pc = uReflMat * vec4(vW, 1.0);
					vec2 ruv = pc.xy / pc.w + rip + rough * vec2(0.4, 1.0);
					vec3 refl = texture2D(uReflTex, ruv).rgb;
					// vertical smear: the long neon streaks of a wet avenue
					refl = refl * 0.5 + texture2D(uReflTex, ruv + vec2(0.0, 0.012)).rgb * 0.3 + texture2D(uReflTex, ruv + vec2(0.0, 0.03)).rgb * 0.2;
					float fres = 0.06 + 0.94 * pow(1.0 - sat(V.y), 4.0);
					col = mix(col * (1.0 - 0.45 * wetness), refl, sat(fres * wetness * 1.25));
				}
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000, 150, 150).rotateX(-Math.PI / 2), mat);
	mesh.frustumCulled = false;
	return mesh;
};

export const makeWater = (city: City, waterN: THREE.Texture) => {
	const M = city.misc.mask;
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			...(U as any),
			uMask: {value: city.maskTex},
			uMaskRect: {value: new THREE.Vector4(M.x0, M.z0, M.w * M.px, M.h * M.px)},
			uWaterN: {value: waterN},
		},
		vertexShader: VERT,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			uniform sampler2D uMask;
			uniform vec4 uMaskRect;
			uniform sampler2D uWaterN;
			varying vec3 vW;
			void main() {
				vec2 muv0 = (vW.xz - uMaskRect.xy) / uMaskRect.zw;
				if (texture2D(uMask, clamp(muv0, 0.001, 0.999)).r > 0.6) discard;
				vec3 V = normalize(uCamPos - vW);
				float dist = length(uCamPos - vW);
				vec2 p = vW.xz;
				// two scrolling normal layers + a broad swell
				vec2 pr = mat2(0.8, 0.6, -0.6, 0.8) * p;
				vec3 n1 = texture2D(uWaterN, p / 83.0 + vec2(uTime * 0.012, uTime * 0.008)).xyz * 2.0 - 1.0;
				vec3 n2 = texture2D(uWaterN, pr / 29.0 - vec2(uTime * 0.022, -uTime * 0.017)).xyz * 2.0 - 1.0;
				vec3 n3 = texture2D(uWaterN, pr / 410.0 + vec2(-uTime * 0.003, uTime * 0.004)).xyz * 2.0 - 1.0;
				float calm = mix(1.0, 0.5, smoothstep(300.0, 3000.0, dist));
				vec2 nxz = (n1.xy * 0.45 + n2.xy * 0.3 + n3.xy * 0.7) * 0.15 * calm;
				vec3 n = normalize(vec3(nxz.x, 1.0, nxz.y));
				vec3 R = reflect(-V, n);
				R.y = abs(R.y);
				vec3 sky = skyBase(R);
				float fres = 0.03 + 0.97 * pow(1.0 - sat(dot(n, V)), 5.0);
				vec3 deep = uWaterCol * (dot(uAmbSky, vec3(0.3, 0.4, 0.3)) * 0.8 + uAmbSky * 0.25 + uSunColor * 0.05);
				vec3 refl = sky;
				if (uReflOn > 0.5) {
					vec4 pc = uReflMat * vec4(vW.x, 0.0, vW.z, 1.0);
					vec2 ruv = pc.xy / pc.w + nxz * vec2(0.25, 0.9);
					vec4 rt = texture2D(uReflTex, ruv);
					rt.rgb = rt.rgb * 0.6 + texture2D(uReflTex, ruv + vec2(0.0, 0.01)).rgb * 0.4;
					refl = mix(sky, rt.rgb, rt.a * 0.9);
				}
				vec3 col = mix(deep, refl, fres);
				// sun / moon glitter
				float sh = cloudShadow(vW);
				float spec = pow(max(dot(R, uKeyDir), 0.0), 380.0) * 26.0 + pow(max(dot(R, uKeyDir), 0.0), 40.0) * 0.5;
				col += uSunColor * spec * sh;
				// shoreline foam from the land mask
				vec2 muv = (vW.xz - uMaskRect.xy) / uMaskRect.zw;
				float land = texture2D(uMask, clamp(muv, 0.001, 0.999)).r;
				float foam = smoothstep(0.3, 0.48, land) * (0.5 + 0.5 * texture2D(uNoise, p / 9.0 + uTime * 0.02).a);
				col = mix(col, (uAmbSky + uSunColor * 0.35) * 0.9, foam * 0.5);
				// night: the city's glow rides on the ripples
				col += vec3(1.0, 0.6, 0.35) * uNight * 0.02 * (0.5 + n1.x);
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000, 150, 150).rotateX(-Math.PI / 2), mat);
	mesh.position.y = -1.2;
	mesh.frustumCulled = false;
	return mesh;
};
