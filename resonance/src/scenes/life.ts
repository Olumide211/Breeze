// Sky and harbour life: boid bird flocks, helicopters, a plane with blinking lights,
// East River ferries with wakes, and the lone rooftop figure.
import * as THREE from 'three';
import * as PG from '../city/propGeo';
import {hash2} from '../lib/rng';
import {COMMON_PARS, U} from '../shaders/common';
import {makePropMaterial} from '../shaders/prop';
import {FPS, P, SHOTS, type Shot} from '../timeline';
import {hero} from './shots';
import type {System, World} from './world';

// ---------------------------------------------------------------- birds (boids)
type Flock = {n: number; centre: (t: number) => [number, number, number]; spread: number; speed: number; size: number};
const FLOCKS: Record<string, Flock[]> = {
	'01-dawn': [
		{n: 46, centre: (t) => [-1180 + t * 16, 46 + t * 5 + Math.sin(t * 0.9) * 5, 4640 + Math.sin(t * 0.5) * 20], spread: 26, speed: 15, size: 1.0},
		{n: 24, centre: (t) => [-1000 - t * 9, 70 + Math.sin(t * 0.7) * 6, 4700 - t * 6], spread: 18, speed: 13, size: 0.9},
	],
	'02-dumbo': [{n: 30, centre: (t) => [-330 + Math.sin(t * 0.6) * 40, 62 + t * 3, 4900 - t * 22], spread: 16, speed: 14, size: 0.8}],
	'05-park': [
		{n: 54, centre: (t) => [1250 - t * 22, 150 + Math.sin(t) * 8, -2800 + t * 30], spread: 34, speed: 16, size: 1.1},
		{n: 30, centre: (t) => [1000 + t * 14, 120 + Math.sin(t * 0.8) * 6, -2500 + t * 12], spread: 24, speed: 14, size: 1.0},
	],
	'06-rooftop': [{n: 40, centre: () => [0, 0, 0], spread: 14, speed: 12, size: 0.75}],
	'07-bluehour': [{n: 36, centre: (t) => [2600 - t * 12, 70 + Math.sin(t * 0.6) * 10, 900 + t * 16], spread: 30, speed: 14, size: 1.2}],
};

const birdMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: U as any,
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `
			attribute vec4 aBird; // phase, flap speed, glide, size
			uniform float uTime;
			varying vec3 vW;
			void main() {
				vec3 p = position;
				float flap = sin(uTime * aBird.y + aBird.x * 6.283) * (0.75 - 0.5 * aBird.z);
				p.y += abs(p.z) * flap * 0.75;
				p.z *= 1.0 - 0.18 * abs(flap);
				vec4 wp = modelMatrix * instanceMatrix * vec4(p * aBird.w, 1.0);
				vW = wp.xyz;
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec3 vW;
			void main() {
				vec3 col = vec3(0.045, 0.045, 0.055) * (uAmbSky + uSunColor * 0.35) + vec3(0.01);
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
const birdGeo = () => {
	const g = new THREE.BufferGeometry();
	// body + two swept wings (forward = +x)
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.28, 0, 0, -0.26, 0, 0.05, -0.26, 0, -0.05, 0.12, 0, 0, -0.1, 0, 0, -0.02, 0, 0.62, 0.12, 0, 0, -0.02, 0, -0.62, -0.1, 0, 0]), 3));
	return g;
};

export const makeBirds = (world: World): System => {
	const MAX = 120;
	const mesh = new THREE.InstancedMesh(birdGeo(), birdMaterial(), MAX);
	const attr = new Float32Array(MAX * 4);
	for (let i = 0; i < MAX; i++) attr.set([hash2(i, 1), 9 + 5 * hash2(i, 2), hash2(i, 3) > 0.7 ? 1 : 0, 0.8 + 0.5 * hash2(i, 4)], i * 4);
	mesh.geometry.setAttribute('aBird', new THREE.InstancedBufferAttribute(attr, 4));
	mesh.frustumCulled = false;
	mesh.count = 0;
	// fixed-step boids; states are cached per integer step so any frame can be requested in any order
	const DT = 1 / 30;
	let shotId = '';
	let states: Float32Array[] = [];
	let flocks: Flock[] = [];
	let total = 0;
	const flockOf: number[] = [];
	const centreAt = (f: Flock, t: number): [number, number, number] => {
		if (shotId === '06-rooftop') {
			const h = hero.figure;
			return [h[0] - 60 + t * 22 + hero.dir[0] * 40, h[1] + 16 + Math.sin(t * 1.3) * 3 - t * 0.6, h[2] + 26 - t * 9];
		}
		return f.centre(t);
	};
	const init = () => {
		const s = new Float32Array(total * 6);
		let k = 0;
		flocks.forEach((f, fi) => {
			const c = centreAt(f, 0);
			for (let i = 0; i < f.n; i++, k++) {
				flockOf[k] = fi;
				s.set([c[0] + (hash2(k, 11) - 0.5) * f.spread * 2, c[1] + (hash2(k, 12) - 0.5) * f.spread * 0.6, c[2] + (hash2(k, 13) - 0.5) * f.spread * 2, (hash2(k, 14) - 0.5) * 6, 0, (hash2(k, 15) - 0.5) * 6], k * 6);
			}
		});
		return s;
	};
	const step = (prev: Float32Array, n: number) => {
		const s = new Float32Array(prev);
		const t = n * DT;
		for (let i = 0; i < total; i++) {
			const f = flocks[flockOf[i]];
			const c = centreAt(f, t);
			const px = prev[i * 6], py = prev[i * 6 + 1], pz = prev[i * 6 + 2];
			let vx = prev[i * 6 + 3], vy = prev[i * 6 + 4], vz = prev[i * 6 + 5];
			// cohesion to the flock's moving centre
			let ax = (c[0] - px) * 0.9, ay = (c[1] - py) * 1.2, az = (c[2] - pz) * 0.9;
			// separation + alignment with neighbours
			let sx = 0, sy = 0, sz = 0, mx = 0, my = 0, mz = 0, cnt = 0;
			for (let j = 0; j < total; j++) {
				if (j === i || flockOf[j] !== flockOf[i]) continue;
				const dx = px - prev[j * 6], dy = py - prev[j * 6 + 1], dz = pz - prev[j * 6 + 2];
				const d2 = dx * dx + dy * dy + dz * dz;
				if (d2 < 36) { const inv = 1 / (d2 + 0.5); sx += dx * inv; sy += dy * inv; sz += dz * inv; }
				if (d2 < 400) { mx += prev[j * 6 + 3]; my += prev[j * 6 + 4]; mz += prev[j * 6 + 5]; cnt++; }
			}
			ax += sx * 22; ay += sy * 22; az += sz * 22;
			if (cnt) { ax += (mx / cnt - vx) * 0.8; ay += (my / cnt - vy) * 0.8; az += (mz / cnt - vz) * 0.8; }
			// deterministic wander
			ax += (hash2(i * 31 + 7, n >> 3) - 0.5) * 9; ay += (hash2(i * 31 + 8, n >> 3) - 0.5) * 3; az += (hash2(i * 31 + 9, n >> 3) - 0.5) * 9;
			vx += ax * DT; vy += ay * DT; vz += az * DT;
			const sp = Math.hypot(vx, vy, vz) || 1;
			const tgt = Math.min(f.speed * 1.5, Math.max(f.speed * 0.7, sp));
			vx *= tgt / sp; vy *= (tgt / sp) * 0.96; vz *= tgt / sp;
			s.set([px + vx * DT, py + vy * DT, pz + vz * DT, vx, vy, vz], i * 6);
		}
		return s;
	};
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), fwd = new THREE.Vector3(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), xAxis = new THREE.Vector3(1, 0, 0);
	return {
		object: mesh,
		setShot(shot: Shot) {
			shotId = shot.id;
			flocks = FLOCKS[shot.id] || [];
			total = flocks.reduce((a, f) => a + f.n, 0);
			states = total ? [init()] : [];
		},
		update(frame, env) {
			if (!total) { mesh.count = 0; return; }
			const t = Math.max(0, frame / FPS - env.shot.start);
			const n = Math.floor(t / DT), fr = t / DT - n;
			while (states.length <= n) states.push(step(states[states.length - 1], states.length));
			const s = states[n];
			for (let i = 0; i < total; i++) {
				const vx = s[i * 6 + 3], vy = s[i * 6 + 4], vz = s[i * 6 + 5];
				pos.set(s[i * 6] + vx * DT * fr, s[i * 6 + 1] + vy * DT * fr, s[i * 6 + 2] + vz * DT * fr);
				fwd.set(vx, vy * 0.5, vz).normalize();
				q.setFromUnitVectors(xAxis, fwd);
				const sz = flocks[flockOf[i]].size;
				m.compose(pos, q, one.set(sz, sz, sz));
				mesh.setMatrixAt(i, m);
			}
			mesh.count = total;
			mesh.instanceMatrix.needsUpdate = true;
		},
	};
};

// ---------------------------------------------------------------- aircraft
export const makeAircraft = (_world: World): System => {
	const group = new THREE.Group();
	const mat = makePropMaterial({emitDay: 1.5, emitNight: 16, blink: true, noShadow: true});
	const body = makePropMaterial({noShadow: true});
	const helis = [0, 1, 2].map(() => {
		const g = new THREE.Group();
		g.add(new THREE.Mesh(PG.helicopter(), mat));
		const r = new THREE.Mesh(PG.rotor(), body);
		g.add(r);
		g.userData.rotor = r;
		group.add(g);
		return g;
	});
	const plane = new THREE.Mesh(PG.plane(), mat);
	plane.scale.setScalar(1.6);
	group.add(plane);
	group.traverse((o) => { o.frustumCulled = false; });
	// orbit centres: midtown, downtown, East River
	const ORB: [number, number, number, number, number][] = [[250, -300, 520, 900, 0.045], [-1700, 3300, 430, 700, -0.05], [1900, 900, 360, 1100, 0.04]];
	return {
		object: group,
		update(_f, env) {
			const t = env.time;
			helis.forEach((h, i) => {
				const [cx, cz, y, r, w] = ORB[i];
				const a = t * w + i * 2.1;
				h.position.set(cx + Math.cos(a) * r, y + Math.sin(t * 0.3 + i) * 12, cz + Math.sin(a) * r);
				h.rotation.set(0, -a - (w > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
				h.scale.setScalar(1.5);
				(h.userData.rotor as THREE.Mesh).rotation.y = t * 38 + i;
			});
			// airliner on a long straight approach, high above the city
			const k = (t - 24) / 48;
			plane.position.set(-7000 + k * 9000 + 3500, 1900 - k * 250, -1500 + k * 5200);
			plane.rotation.set(0, -Math.atan2(5200, 9000), 0);
		},
	};
};

// ---------------------------------------------------------------- ferries + wakes
const wakeMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: U as any,
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `
			varying vec2 vUv; varying vec3 vW;
			void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec2 vUv; varying vec3 vW;
			void main() {
				// V-shaped foam: bright at the bow, widening and dissolving astern
				float x = abs(vUv.x - 0.5) * 2.0;
				float arms = smoothstep(0.35, 0.8, x) * (1.0 - smoothstep(0.8, 1.0, x));
				float core = (1.0 - smoothstep(0.0, 0.35, x)) * (1.0 - smoothstep(0.0, 0.5, vUv.y));
				float n = texture2D(uNoise, vW.xz / 14.0 + vec2(uTime * 0.05, 0.0)).a;
				float a = (arms * 0.75 + core) * pow(1.0 - vUv.y, 1.5) * smoothstep(0.25, 0.75, n + 0.25);
				vec3 col = (uAmbSky * 1.1 + uSunColor * 0.5 + vec3(0.03)) * 0.85;
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, a * 0.8);
			}`,
	});

export const makeFerries = (_world: World): System => {
	const group = new THREE.Group();
	const mat = makePropMaterial({emitDay: 0.25, emitNight: 5, noShadow: true});
	const geo = PG.ferry();
	const wakeGeo = new THREE.PlaneGeometry(1, 1, 1, 6).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
	const wmat = wakeMaterial();
	// routes along the East River / harbour (start, end, seconds for the trip, time offset)
	const ROUTES: [number, number, number, number, number, number][] = [
		[-1650, 4950, -700, 4480, 150, 30],
		[-150, 4560, -1250, 5050, 170, 80],
		[1900, 2500, 2350, 800, 190, 20],
		[2380, 600, 1750, 3000, 200, 110],
		[-2900, 5600, -1500, 5150, 160, 60],
	];
	const boats = ROUTES.map(() => {
		const b = new THREE.Mesh(geo, mat);
		const w = new THREE.Mesh(wakeGeo, wmat);
		w.renderOrder = 3;
		b.frustumCulled = false; w.frustumCulled = false;
		group.add(b, w);
		return {b, w};
	});
	return {
		object: group,
		update(_f, env) {
			const t = env.time;
			boats.forEach(({b, w}, i) => {
				const [x0, z0, x1, z1, dur, off] = ROUTES[i];
				let k = ((t + off) / dur) % 2;
				const back = k > 1;
				if (back) k = 2 - k;
				const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
				const ang = Math.atan2(z1 - z0, x1 - x0) + (back ? Math.PI : 0);
				b.position.set(x, -0.9 + Math.sin(t * 0.8 + i) * 0.12, z);
				b.rotation.set(0, -ang, Math.sin(t * 0.6 + i * 2) * 0.012);
				// wake trails behind the stern
				w.position.set(x - Math.cos(ang) * 14, -0.62, z - Math.sin(ang) * 14);
				w.rotation.set(0, -ang - Math.PI / 2, 0);
				w.scale.set(46, 1, 240);
			});
		},
	};
};

// ---------------------------------------------------------------- lone rooftop figure
export const makeFigure = (_world: World): System => {
	const mesh = new THREE.Mesh(PG.figure(), makePropMaterial({}));
	mesh.layers.enable(1);
	return {
		object: mesh,
		setShot(shot: Shot) {
			mesh.visible = shot.id === '06-rooftop' && !!hero.roof;
			mesh.position.set(hero.figure[0], hero.figure[1], hero.figure[2]);
			mesh.rotation.set(0, -Math.atan2(hero.dir[1], hero.dir[0]), 0);
			mesh.updateMatrixWorld(true);
		},
	};
};
export const _keep = [P, SHOTS];
