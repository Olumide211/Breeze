// Painted sky: gradient dome, glowing sun disc, moon, stars, a soft 2D cloud deck
// and big billboard cumulus towers lit with baked normals (Shinkai-style clouds).
import {createNoise2D, createNoise4D} from 'simplex-noise';
import * as THREE from 'three';
import {rng} from '../lib/rng';
import {COMMON_PARS, U} from '../shaders/common';

// ---------- tileable fbm noise texture (R: cloud shapes, G/B: paint detail, A: fine grain) ----------
export const makeNoiseTexture = (size = 512): THREE.DataTexture => {
	const data = new Uint8Array(size * size * 4);
	const chans = [
		{n: createNoise4D(rng('noise-r')), oct: 5, base: 0.9},
		{n: createNoise4D(rng('noise-g')), oct: 5, base: 2.2},
		{n: createNoise4D(rng('noise-b')), oct: 4, base: 1.4},
		{n: createNoise4D(rng('noise-a')), oct: 3, base: 6.0},
	];
	const TAU = Math.PI * 2;
	for (let y = 0; y < size; y++) {
		const v = y / size;
		const cz = Math.cos(TAU * v), sz = Math.sin(TAU * v);
		for (let x = 0; x < size; x++) {
			const u = x / size;
			const cx = Math.cos(TAU * u), sx = Math.sin(TAU * u);
			for (let c = 0; c < 4; c++) {
				const ch = chans[c];
				let amp = 0.5, f = ch.base, sum = 0, norm = 0;
				for (let o = 0; o < ch.oct; o++) {
					sum += amp * ch.n(cx * f, sx * f, cz * f, sz * f);
					norm += amp;
					amp *= 0.5;
					f *= 2.03;
				}
				const val = 0.5 + 0.5 * (sum / norm) * 1.55;
				data[(y * size + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(val * 255)));
			}
		}
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.generateMipmaps = true;
	tex.needsUpdate = true;
	return tex;
};

// tileable water normal map derived from the noise texture's fine channels
export const makeWaterNormals = (noise: THREE.DataTexture): THREE.DataTexture => {
	const size = noise.image.width as number;
	const src = noise.image.data as Uint8Array;
	const out = new Uint8Array(size * size * 4);
	const hgt = (x: number, y: number) => {
		const i = (((y + size) % size) * size + ((x + size) % size)) * 4;
		return (src[i + 1] * 0.6 + src[i + 3] * 0.4) / 255;
	};
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 6.0;
		const dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 6.0;
		const l = Math.hypot(dx, dy, 1);
		const i = (y * size + x) * 4;
		out[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
		out[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
		out[i + 2] = Math.round((1 / l) * 255);
		out[i + 3] = 255;
	}
	const tex = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.generateMipmaps = true;
	tex.needsUpdate = true;
	return tex;
};

// ---------- sky dome ----------
export const makeSkyDome = () => {
	const mat = new THREE.ShaderMaterial({
		uniforms: {...(U as any), uMoonDir: {value: new THREE.Vector3(0.45, 0.5, 0.74).normalize()}},
		side: THREE.BackSide,
		depthWrite: false,
		depthTest: true,
		depthFunc: THREE.LessEqualDepth,
		vertexShader: /* glsl */ `
			varying vec3 vDir;
			void main() {
				vDir = position;
				vec4 p = projectionMatrix * viewMatrix * vec4(position * 1000.0 + cameraPosition, 1.0);
				gl_Position = p.xyww;
			}`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			uniform vec3 uMoonDir;
			varying vec3 vDir;
			void main() {
				vec3 d = normalize(vDir);
				vec3 col = skyBase(d);
				float sd = dot(d, uSunDir);
				// stars
				vec2 sp = d.xz / (abs(d.y) + 0.35) * 55.0;
				vec2 sc = floor(sp);
				vec3 sh = hash32(sc);
				float star = smoothstep(0.985, 1.0, sh.x) * (1.0 - smoothstep(0.0, 0.32 + 0.2 * sh.y, length(fract(sp) - 0.5 - (sh.yz - 0.5) * 0.5)));
				star *= 0.75 + 0.25 * sin(uTime * 1.3 + sh.z * 40.0);
				col += vec3(0.8, 0.88, 1.0) * star * 2.2 * uStars * smoothstep(0.03, 0.35, d.y);
				// moon
				float md = dot(d, uMoonDir);
				float moon = smoothstep(0.99975, 0.99985, md);
				col += vec3(0.85, 0.9, 1.0) * (moon * 3.0 + pow(max(md, 0.0), 900.0) * 0.5 + pow(max(md, 0.0), 60.0) * 0.06) * uStars;
				// sun disc + corona (HDR so bloom and flares pick it up)
				float disc = smoothstep(0.99962, 0.99982, sd);
				vec3 sunC = normalize(uSkyGlow + vec3(1.0, 0.9, 0.75)) * 1.7;
				col += (sunC * disc * 26.0 + uSkyGlow * pow(max(sd, 0.0), 700.0) * 5.0 + uSkyGlow * pow(max(sd, 0.0), 120.0) * 1.2) * uSunUp;

				// ---- soft cloud deck (projected plane at 1500 m) ----
				if (d.y > 0.004) {
					float t = (1500.0 - min(uCamPos.y, 1300.0)) / max(d.y, 0.02);
					vec2 p = uCamPos.xz + d.xz * t;
					vec2 uv = p / 9000.0 + uCloudOffset;
					float thr = 1.0 - uCloudCover;
					float n = texture2D(uNoise, uv).r;
					float dt = texture2D(uNoise, uv * 3.3 + vec2(0.37, 0.11) + uCloudOffset * 1.7).g;
					float shape = n + 0.22 * (dt - 0.5);
					float dens = smoothstep(thr - 0.03, thr + 0.16, shape);
					vec2 sdir = normalize(uSunDir.xz + vec2(1e-4));
					float ns = texture2D(uNoise, uv + sdir * 0.014).r + 0.22 * (texture2D(uNoise, (uv + sdir * 0.014) * 3.3 + vec2(0.37, 0.11) + uCloudOffset * 1.7).g - 0.5);
					float edgeLit = sat((shape - ns) * 7.0 + 0.55);
					float thick = smoothstep(thr + 0.06, thr + 0.42, shape);
					vec3 cc = mix(uCloudLit * (0.75 + 0.5 * edgeLit), uCloudShade, thick * (0.55 + 0.45 * (1.0 - edgeLit)));
					// forward scattering halo near the sun, city glow from below at night
					cc += uSkyGlow * pow(max(sd, 0.0), 5.0) * (1.0 - thick) * 0.9 * uSunUp;
					cc += vec3(0.5, 0.26, 0.34) * uNight * 0.22 * (1.0 - d.y);
					float horizon = smoothstep(0.015, 0.2, d.y);
					cc = mix(mix(uSkyHor, cc, 0.45), cc, horizon);
					col = mix(col, cc, dens * smoothstep(0.05, 0.42, d.y) * 0.9);
					// high cirrus streaks
					float ci = texture2D(uNoise, uv * vec2(0.22, 1.3) + vec2(0.6, 0.2) - uCloudOffset * 0.5).b;
					float cirrus = smoothstep(0.52, 0.9, ci) * smoothstep(0.05, 0.4, d.y) * 0.32 * (1.0 - dens);
					col = mix(col, uCloudLit * 0.95 + uSkyGlow * 0.15 * pow(max(sd, 0.0), 3.0), cirrus);
				}
				gl_FragColor = vec4(col, 0.0);
			}`,
	});
	const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), mat);
	mesh.frustumCulled = false;
	mesh.renderOrder = -100;
	return mesh;
};

// ---------- billboard cumulus ----------
const VAR = 4;
export const makeCloudAtlas = (cell = 384): THREE.DataTexture => {
	const W = cell * 2;
	const data = new Uint8Array(W * W * 4);
	for (let v = 0; v < VAR; v++) {
		const r = rng('cumulus-' + v);
		const n2 = createNoise2D(rng('cumulus-noise-' + v));
		const balls: [number, number, number][] = [];
		const towers = 2 + Math.floor(r() * 3);
		for (let t = 0; t < towers; t++) {
			const tx = 0.24 + r() * 0.52;
			const th = 0.25 + r() * 0.42;
			const steps = 5 + Math.floor(r() * 4);
			for (let s = 0; s < steps; s++) {
				const k = s / steps;
				balls.push([tx + (r() - 0.5) * 0.2 * (1 - k * 0.5), 0.26 + k * th + (r() - 0.5) * 0.04, 0.07 + (1 - k) * 0.09 + r() * 0.04]);
			}
		}
		for (let i = 0; i < 12; i++) balls.push([0.14 + r() * 0.72, 0.24 + r() * 0.1, 0.06 + r() * 0.07]);
		const ox = (v % 2) * cell, oy = Math.floor(v / 2) * cell;
		for (let py = 0; py < cell; py++) for (let px = 0; px < cell; px++) {
			const x = (px + 0.5) / cell, y = 1 - (py + 0.5) / cell;
			let cov = -10, zmax = 0, nx = 0, ny = 0, wsum = 0;
			for (const [bx, by, br] of balls) {
				const dx = x - bx, dy = y - by;
				const d2 = dx * dx + dy * dy;
				const d = Math.sqrt(d2);
				cov = Math.max(cov, (br - d) / 0.05);
				if (d2 < br * br) {
					const z = Math.sqrt(br * br - d2);
					const w = Math.exp(z * 40);
					nx += (dx / br) * w; ny += (dy / br) * w; wsum += w;
					zmax = Math.max(zmax, z);
				}
			}
			const fb = n2(x * 7, y * 7) * 0.5 + n2(x * 17, y * 17) * 0.3 + n2(x * 37, y * 37) * 0.2;
			let a = Math.max(0, Math.min(1, cov * 0.5 + 0.5 + fb * 0.42));
			a = a * a * (3 - 2 * a);
			// flat base
			const base = Math.max(0, Math.min(1, (y - 0.2) / 0.05));
			a *= base;
			if (wsum > 0) { nx /= wsum; ny /= wsum; }
			nx += n2(x * 23 + 5, y * 23) * 0.22; ny += n2(x * 23, y * 23 + 9) * 0.22;
			const i = ((oy + py) * W + ox + px) * 4;
			data[i] = Math.round((Math.max(-1, Math.min(1, nx)) * 0.5 + 0.5) * 255);
			data[i + 1] = Math.round((Math.max(-1, Math.min(1, ny)) * 0.5 + 0.5) * 255);
			data[i + 2] = Math.round(Math.min(1, zmax / 0.2) * 255);
			data[i + 3] = Math.round(a * 255);
		}
	}
	const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.generateMipmaps = true;
	tex.needsUpdate = true;
	return tex;
};

export type CloudSpec = {x: number; y: number; z: number; w: number; h: number; variant: number; alpha: number; flip: number};

export const makeClouds = (atlas: THREE.Texture, specs: CloudSpec[]) => {
	const geo = new THREE.InstancedBufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
	geo.setIndex([0, 1, 2, 0, 2, 3]);
	const n = specs.length;
	const aPos = new Float32Array(n * 3), aSize = new Float32Array(n * 2), aVar = new Float32Array(n * 3);
	specs.forEach((s, i) => {
		aPos.set([s.x, s.y, s.z], i * 3);
		aSize.set([s.w, s.h], i * 2);
		aVar.set([s.variant, s.alpha, s.flip], i * 3);
	});
	geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
	geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
	geo.setAttribute('aVar', new THREE.InstancedBufferAttribute(aVar, 3));
	geo.instanceCount = n;
	const mat = new THREE.ShaderMaterial({
		uniforms: {...(U as any), uAtlas: {value: atlas}, uWind: {value: new THREE.Vector3()}},
		transparent: true,
		depthWrite: false,
		vertexShader: /* glsl */ `
			attribute vec3 aPos;
			attribute vec2 aSize;
			attribute vec3 aVar;
			uniform vec3 uWind;
			uniform vec3 uCamPos;
			varying vec2 vUv;
			varying vec3 vW;
			varying vec3 vRight;
			varying vec3 vFwd;
			varying float vAlpha;
			void main() {
				vec3 c = aPos + uWind;
				vec3 toCam = normalize(vec3(uCamPos.x - c.x, 0.0, uCamPos.z - c.z));
				vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
				vec3 wp = c + right * position.x * aSize.x + vec3(0.0, position.y * aSize.y, 0.0);
				float vx = floor(mod(aVar.x, 2.0)), vy = floor(aVar.x / 2.0);
				float px = position.x + 0.5;
				if (aVar.z > 0.5) px = 1.0 - px;
				vUv = vec2((vx + 0.01 + px * 0.98) * 0.5, (vy + 0.01 + (1.0 - position.y) * 0.98) * 0.5);
				vW = wp; vRight = right * (aVar.z > 0.5 ? -1.0 : 1.0); vFwd = toCam; vAlpha = aVar.y;
				gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
			}`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			uniform sampler2D uAtlas;
			varying vec2 vUv;
			varying vec3 vW;
			varying vec3 vRight;
			varying vec3 vFwd;
			varying float vAlpha;
			void main() {
				vec4 t = texture2D(uAtlas, vUv);
				float a = t.a * vAlpha;
				if (a < 0.004) discard;
				vec2 nxy = t.rg * 2.0 - 1.0;
				float nz = sqrt(max(1.0 - dot(nxy, nxy), 0.05));
				vec3 n = normalize(vRight * nxy.x + vec3(0.0, 1.0, 0.0) * nxy.y + vFwd * nz);
				vec3 L = normalize(mix(uSunDir, vec3(uSunDir.x, 0.75, uSunDir.z), 0.45));
				float ndl = dot(n, L);
				float lit = smoothstep(-0.35, 0.55, ndl);
				lit = lit * 0.8 + 0.2 * smoothstep(0.55, 0.8, ndl);
				vec3 col = mix(uCloudShade, uCloudLit, lit);
				// darker flat bases, bright crowns
				col *= mix(0.78, 1.08, smoothstep(0.0, 0.6, nxy.y * 0.5 + 0.5));
				vec3 V = normalize(vW - uCamPos);
				float back = pow(max(dot(V, uSunDir), 0.0), 6.0);
				col += uSkyGlow * back * (1.0 - t.b * 0.8) * 1.4 * uSunUp; // silver lining
				col += vec3(0.5, 0.25, 0.32) * uNight * 0.16 * (1.0 - nxy.y * 0.5 - 0.5);
				// aerial perspective
				float dist = length(vW - uCamPos);
				float f = 1.0 - exp(-dist * uFog * 0.18);
				vec3 fd = normalize(vec3(V.x, abs(V.y) * 0.3 + 0.04, V.z));
				col = mix(col, skyBase(fd), f * 0.85);
				gl_FragColor = vec4(col, a);
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.renderOrder = 50;
	return mesh;
};

export const cloudLayout = (): CloudSpec[] => {
	const r = rng('cloud-layout');
	const out: CloudSpec[] = [];
	// horizon ring of towering cumulus
	for (let i = 0; i < 64; i++) {
		const a = (i / 64) * Math.PI * 2 + r() * 0.08;
		const dist = 9000 + r() * 13000;
		const w = 3200 + r() * 5200;
		out.push({x: Math.cos(a) * dist, y: 500 + r() * 900, z: 1500 + Math.sin(a) * dist, w, h: w * (0.55 + r() * 0.35), variant: Math.floor(r() * VAR), alpha: 0.96, flip: r() > 0.5 ? 1 : 0});
	}
	// a nearer, higher scatter
	for (let i = 0; i < 26; i++) {
		const a = r() * Math.PI * 2;
		const dist = 4500 + r() * 5000;
		const w = 1500 + r() * 2200;
		out.push({x: Math.cos(a) * dist, y: 900 + r() * 900, z: 1500 + Math.sin(a) * dist, w, h: w * (0.5 + r() * 0.3), variant: Math.floor(r() * VAR), alpha: 0.9, flip: r() > 0.5 ? 1 : 0});
	}
	// low wisps drifting between the skyscrapers
	for (let i = 0; i < 14; i++) {
		out.push({x: -1500 + r() * 3600, y: 230 + r() * 260, z: -2400 + r() * 5200, w: 380 + r() * 520, h: 150 + r() * 160, variant: Math.floor(r() * VAR), alpha: 0.38, flip: r() > 0.5 ? 1 : 0});
	}
	return out;
};
