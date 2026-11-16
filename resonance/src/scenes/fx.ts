// Weather and light: rain streaks, manhole steam, river mist, and the layered,
// animated Times Square billboards (all brands are invented for this film).
import * as THREE from 'three';
import {hash2} from '../lib/rng';
import {COMMON_PARS, U} from '../shaders/common';
import {P, type Shot} from '../timeline';
import {pathDist, type PathSample, type System, type World} from './world';

// ---------------------------------------------------------------- rain
export const makeRain = (_world: World): System => {
	const N = 9000;
	const geo = new THREE.InstancedBufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
	geo.setIndex([0, 1, 2, 0, 2, 3]);
	const seed = new Float32Array(N * 4);
	for (let i = 0; i < N; i++) seed.set([hash2(i, 1), hash2(i, 2), hash2(i, 3), hash2(i, 4)], i * 4);
	geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
	geo.instanceCount = N;
	const mat = new THREE.ShaderMaterial({
		uniforms: U as any,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute vec4 aSeed;
			uniform float uTime; uniform vec3 uCamPos; uniform float uRain;
			varying float vA; varying float vV;
			void main() {
				// drops live in a box that wraps around the camera: pure function of time
				vec3 box = vec3(70.0, 46.0, 70.0);
				float speed = 15.0 + aSeed.w * 7.0;
				vec3 p = aSeed.xyz * box;
				p.y -= uTime * speed;
				p.x += uTime * 1.6;
				p = mod(p - uCamPos, box) - box * 0.5 + uCamPos;
				vec3 toCam = normalize(uCamPos - p);
				vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
				float len = 0.55 + aSeed.w * 0.6;
				vec3 wp = p + right * position.x * 0.018 + vec3(0.11, 1.0, 0.0) * position.y * len;
				float d = distance(wp, uCamPos);
				vA = uRain * smoothstep(1.2, 5.0, d) * (1.0 - smoothstep(22.0, 36.0, d));
				vV = position.y;
				gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
			}`,
		fragmentShader: /* glsl */ `
			varying float vA; varying float vV;
			void main() { gl_FragColor = vec4(vec3(0.55, 0.62, 0.8) * vA * 0.42 * sin(vV * 3.14159), 1.0); }`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.renderOrder = 60;
	return {object: mesh, setShot(shot: Shot) { mesh.visible = (shot.rain ?? 0) > 0; }};
};

// ---------------------------------------------------------------- soft billboards (steam + mist)
const puffMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: U as any,
		transparent: true,
		depthWrite: false,
		vertexShader: /* glsl */ `
			attribute vec4 aPuff; // x, z, phase, kind (0 steam, 1 mist)
			attribute vec3 aRand;
			uniform float uTime; uniform vec3 uCamPos;
			varying vec2 vUv; varying float vA; varying vec3 vW; varying float vK;
			void main() {
				float steam = 1.0 - aPuff.w;
				float life = fract(uTime * mix(0.035, 0.22, steam) + aPuff.z);
				vec3 c = vec3(aPuff.x, 0.0, aPuff.y);
				float size;
				if (steam > 0.5) {
					c.y = 0.3 + life * (7.0 + aRand.x * 5.0);
					c.x += life * (1.8 + aRand.y * 2.5) + sin(uTime * 0.9 + aPuff.z * 30.0) * 0.5 * life;
					c.z += (aRand.z - 0.5) * 2.4 * life;
					size = 0.9 + life * 5.5;
					vA = sin(3.14159 * pow(life, 0.6)) * 0.3;
				} else {
					c.y = 3.0 + aRand.x * 9.0;
					c.x += (life - 0.5) * 260.0;
					c.z += sin(uTime * 0.05 + aPuff.z * 20.0) * 30.0;
					size = 150.0 + aRand.y * 190.0;
					vA = sin(3.14159 * life) * 0.2;
				}
				vec3 toCam = normalize(uCamPos - c);
				vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
				vec3 up = steam > 0.5 ? cross(toCam, right) : vec3(0.0, 0.22, 0.0);
				vec3 wp = c + right * position.x * size + up * position.y * size;
				vUv = position.xy + 0.5; vW = wp; vK = aPuff.w;
				float d = distance(c, uCamPos);
				vA *= smoothstep(size * 0.6, size * 2.2, d);
				gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
			}`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec2 vUv; varying float vA; varying vec3 vW; varying float vK;
			void main() {
				vec2 q = vUv - 0.5;
				float r = length(q) * 2.0;
				float n = texture2D(uNoise, vUv * 0.35 + vW.xz * 0.003 + uTime * 0.01).g;
				float a = (1.0 - smoothstep(0.25, 1.0, r + (n - 0.5) * 0.6)) * vA;
				if (a < 0.003) discard;
				// steam picks up the street's light: warm by sodium lamps, tinted by neon
				vec3 lit = uAmbSky * 1.3 + uSunColor * 0.4 + uNight * (vec3(1.0, 0.7, 0.5) * 0.55 + vec3(0.5, 0.15, 0.4) * 0.35);
				vec3 mist = uSkyHor * 0.95 + uSkyGlow * 0.12;
				vec3 col = mix(vec3(0.85) * lit, mist, vK);
				gl_FragColor = vec4(col, a);
			}`,
	});

export const makeSteamAndMist = (world: World): System => {
	const MAX = 1400;
	const geo = new THREE.InstancedBufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
	geo.setIndex([0, 1, 2, 0, 2, 3]);
	const puff = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
	const rand = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
	geo.setAttribute('aPuff', puff);
	geo.setAttribute('aRand', rand);
	const mesh = new THREE.Mesh(geo, puffMaterial());
	mesh.frustumCulled = false;
	mesh.renderOrder = 40;
	return {
		object: mesh,
		setShot(shot: Shot, samples: PathSample[]) {
			let n = 0;
			const add = (x: number, z: number, ph: number, kind: number, k: number) => {
				if (n >= MAX) return;
				puff.setXYZW(n, x, z, ph, kind);
				rand.setXYZ(n, hash2(k, 21), hash2(k, 22), hash2(k, 23));
				n++;
			};
			if (shot.propRange > 0) {
				const S = world.steamSites;
				for (let i = 0; i < S.length; i += 2) {
					if (pathDist(samples, S[i], S[i + 1]) > Math.min(shot.propRange, 380)) continue;
					for (let k = 0; k < 16; k++) add(S[i], S[i + 1], k / 16 + hash2(i, 5), 0, i * 16 + k);
				}
			}
			if (shot.mist) {
				for (let k = 0; k < 90; k++) {
					const s = samples[Math.floor(hash2(k, 31) * samples.length)];
					add(s.x + (hash2(k, 32) - 0.3) * 1500, s.z + (hash2(k, 33) - 0.5) * 1500, hash2(k, 34), 1, 9000 + k);
				}
			}
			geo.instanceCount = n;
			puff.needsUpdate = true; rand.needsUpdate = true;
			mesh.visible = n > 0;
		},
	};
};

// ---------------------------------------------------------------- Times Square billboards
const BRANDS = ['NOVA COLA', 'KIRA', 'HALCYON', 'ORBIT+', 'LUMEN', 'MIRAI', 'ECHO FM', 'PIXEL POP', 'SOLARIS', 'AURORA AIR', 'TIDAL', 'VELVET', 'KOMOREBI TEA', 'NEKO NOODLE', 'STARFALL', 'HANA', 'BLUE HOUR', '8-BIT BURGER', 'CLOUD NINE', 'YUME', 'PRISM', 'SODAPOP!', 'ZENITH', 'MOONMILK', 'AKARI', 'WAVELENGTH', 'RESONANCE', 'TOKI WATCH', 'HOSHI', 'DRIFT', 'OPAL', 'KAZE', 'NIGHT OWL', 'FABLE', 'SORA', 'MELLOW'];
const TAGS = ['feel the glow', 'since tomorrow', 'now playing', 'taste the sky', 'open all night', 'new season', 'live tonight', 'find your frequency', 'stay golden', 'in every colour'];
const PALETTES: [string, string, string][] = [['#ff2d78', '#2b0a3d', '#ffffff'], ['#00e5ff', '#001b3a', '#ffffff'], ['#ffd400', '#1a1a1a', '#ff3b30'], ['#7c4dff', '#0d0221', '#00f5d4'], ['#ff6b00', '#1b0f00', '#fff3d6'], ['#00ff9c', '#00241a', '#ffffff'], ['#ffffff', '#e4002b', '#ffffff'], ['#f72585', '#3a0ca3', '#4cc9f0'], ['#fdfcdc', '#00afb9', '#f07167'], ['#101010', '#f5f5f5', '#ff0054']];

export const makeBillboardAtlas = (): THREE.CanvasTexture => {
	const G = 6, C = 256;
	const cv = document.createElement('canvas');
	cv.width = cv.height = G * C;
	const x = cv.getContext('2d')!;
	for (let i = 0; i < G * G; i++) {
		const ox = (i % G) * C, oy = Math.floor(i / G) * C;
		const [a, b, c] = PALETTES[Math.floor(hash2(i, 41) * PALETTES.length)];
		const style = Math.floor(hash2(i, 42) * 5);
		x.save();
		x.beginPath(); x.rect(ox, oy, C, C); x.clip();
		const g = x.createLinearGradient(ox, oy, ox + C * (style % 2), oy + C);
		g.addColorStop(0, b); g.addColorStop(1, style === 3 ? a : b);
		x.fillStyle = g; x.fillRect(ox, oy, C, C);
		x.globalAlpha = 0.9;
		x.fillStyle = a;
		if (style === 0) { x.beginPath(); x.arc(ox + C * 0.72, oy + C * 0.36, C * 0.3, 0, Math.PI * 2); x.fill(); }
		else if (style === 1) { for (let k = 0; k < 7; k++) x.fillRect(ox + k * C * 0.16 - 10, oy + C * 0.62, C * 0.08, C * 0.5); }
		else if (style === 2) { x.beginPath(); x.moveTo(ox, oy + C); x.lineTo(ox + C, oy + C * 0.35); x.lineTo(ox + C, oy + C); x.fill(); }
		else if (style === 4) { x.lineWidth = 10; x.strokeStyle = a; for (let k = 1; k < 5; k++) { x.beginPath(); x.arc(ox + C * 0.5, oy + C * 1.05, k * C * 0.17, Math.PI, 0); x.stroke(); } }
		x.globalAlpha = 1;
		const name = BRANDS[i % BRANDS.length];
		let fs = 54;
		x.font = `700 ${fs}px Syncopate, Inter, sans-serif`;
		while (x.measureText(name).width > C * 0.86 && fs > 16) { fs -= 2; x.font = `700 ${fs}px Syncopate, Inter, sans-serif`; }
		x.fillStyle = style === 3 ? b : c;
		x.textBaseline = 'middle';
		x.fillText(name, ox + C * 0.07, oy + C * (style === 0 ? 0.74 : 0.42));
		x.font = `500 17px Inter, sans-serif`;
		x.fillStyle = style === 3 ? b : a;
		x.fillText(TAGS[Math.floor(hash2(i, 43) * TAGS.length)], ox + C * 0.08, oy + C * (style === 0 ? 0.88 : 0.58));
		x.restore();
	}
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace;
	t.generateMipmaps = true;
	t.minFilter = THREE.LinearMipmapLinearFilter;
	t.anisotropy = 4;
	return t;
};

export const makeBillboards = (world: World): System => {
	const city = world.city;
	const atlas = makeBillboardAtlas();
	const pos: number[] = [], uv: number[] = [], info: number[] = [], idx: number[] = [];
	let n = 0;
	const [tx, tz] = P.timesSq;
	for (const b of city.near(tx, tz, 420)) {
		if (b.minH > 1 || b.h < 14) continue;
		let area = 0;
		for (let i = 0; i < b.n; i++) { const j = (i + 1) % b.n; area += b.ring[i * 2] * b.ring[j * 2 + 1] - b.ring[j * 2] * b.ring[i * 2 + 1]; }
		const sgn = area >= 0 ? 1 : -1;
		for (let i = 0; i < b.n; i++) {
			const j = (i + 1) % b.n;
			const ax = b.ring[i * 2], az = b.ring[i * 2 + 1], bx = b.ring[j * 2], bz = b.ring[j * 2 + 1];
			const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
			if (len < 9) continue;
			const nx = (dz / len) * sgn, nz = (-dx / len) * sgn;
			const mx = (ax + bx) / 2, mz = (az + bz) / 2;
			// only walls that face the bow-tie (7th Avenue / Broadway) or a wide street near it
			const fx = mx + nx * 8, fz = mz + nz * 8;
			if (city.maskAt(fx, fz)[2] < 0.3 || city.heightAt(fx, fz, 1) > 0) continue;
			const dC = Math.hypot(mx - tx, mz - tz);
			const density = dC < 230 ? 1 : dC < 330 ? 0.5 : 0.2;
			// stack several signs up the wall
			let y = 5.5;
			let layer = 0;
			while (y < Math.min(b.h - 3, 78) && layer < 6) {
				const hk = hash2(Math.floor(b.seed * 1e6) + i * 13, layer);
				const h = 5 + hk * 13;
				if (y + h > b.h - 1) break;
				if (hash2(Math.floor(b.seed * 1e6) + i * 7, layer + 50) < density) {
					const w = Math.min(len - 1.5, 7 + hash2(Math.floor(b.seed * 1e6) + i, layer + 90) * 22);
					const t0 = 0.5 + (hash2(Math.floor(b.seed * 1e6) + i * 3, layer + 20) - 0.5) * Math.max(0, 1 - w / len);
					const cx = ax + dx * t0, cz = az + dz * t0;
					const off = 0.7 + layer * 0.25; // layered: upper signs stand further off the wall
					const ux = dx / len, uz = dz / len;
					const corners = [[-w / 2, y], [w / 2, y], [w / 2, y + h], [-w / 2, y + h]];
					for (const [s, yy] of corners) pos.push(cx + ux * s + nx * off, yy, cz + uz * s + nz * off);
					// keep text upright & readable: flip u when the wall runs right-to-left for the viewer
					const flip = sgn > 0 ? 1 : 0;
					uv.push(flip, 0, 1 - flip, 0, 1 - flip, 1, flip, 1);
					const id = hash2(n, 61), kind = hash2(n, 62);
					for (let k = 0; k < 4; k++) info.push(id, kind, w / h, hash2(n, 63));
					idx.push(n * 4, n * 4 + 1, n * 4 + 2, n * 4, n * 4 + 2, n * 4 + 3);
					n++;
				}
				y += h + 1.2 + hk * 3;
				layer++;
			}
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
	geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
	geo.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(info), 4));
	geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
	geo.computeBoundingSphere();
	const mat = new THREE.ShaderMaterial({
		uniforms: {...(U as any), uAtlas: {value: atlas}},
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `
			attribute vec4 aInfo;
			varying vec2 vUv; varying vec4 vI; varying vec3 vW;
			void main() { vUv = uv; vI = aInfo; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			uniform sampler2D uAtlas;
			varying vec2 vUv; varying vec4 vI; varying vec3 vW;
			vec3 ad(float idx, vec2 uv) {
				float i = floor(idx * 36.0);
				vec2 cell = vec2(mod(i, 6.0), floor(i / 6.0));
				return texture2D(uAtlas, (cell + clamp(uv, 0.01, 0.99)) / 6.0).rgb;
			}
			void main() {
				// each screen cycles through creatives on its own clock, with a quick wipe between them
				float period = 2.6 + vI.w * 3.0;
				float tt = uTime / period + vI.x * 10.0;
				float slot = floor(tt), ph = fract(tt);
				float idA = fract(vI.x + slot * 0.6180339), idB = fract(vI.x + (slot + 1.0) * 0.6180339);
				// fit the square creative to the panel: wide panels tile it, tall panels letterbox
				vec2 uv = vUv;
				float asp = vI.z;
				if (asp > 1.3) uv.x = fract(uv.x * floor(asp + 0.5));
				else if (asp < 0.75) uv.y = clamp((uv.y - 0.5) / asp + 0.5, 0.0, 1.0);
				if (vI.y > 0.75) uv.x = fract(uv.x + uTime * 0.07); // ticker-style scrollers
				float wipe = smoothstep(0.9, 0.98, ph + (vUv.x - 0.5) * 0.06);
				vec3 c = mix(ad(idA, uv), ad(idB, uv), wipe);
				// LED look: faint pixel grid + deterministic, very gentle luminance breathing (no strobing)
				vec2 px = fract(vUv * vec2(asp, 1.0) * 46.0) - 0.5;
				float led = 0.86 + 0.14 * (1.0 - smoothstep(0.2, 0.5, max(abs(px.x), abs(px.y))));
				float breathe = 0.94 + 0.06 * sin(uTime * 1.9 + vI.x * 40.0);
				float frame = step(0.012, vUv.x) * step(vUv.x, 0.988) * step(0.02, vUv.y) * step(vUv.y, 0.98);
				vec3 col = c * led * breathe * mix(0.75, 3.3, uNight) * frame + c * 0.25 * (uAmbSky + uSunColor * 0.2) * frame + vec3(0.012) * (1.0 - frame);
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.matrixAutoUpdate = false;
	return {object: mesh};
};
