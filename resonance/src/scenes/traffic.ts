// Traffic on the real OSM road chains: yellow taxis, cars and buses with head/tail lights,
// long-exposure style light trails at night, and a distant "light flow" layer on the avenues.
// Every vehicle position is an analytic function of time (no simulation state).
import * as THREE from 'three';
import type {Road} from '../city/data';
import {srgb, type RGB} from '../city/geo';
import * as PG from '../city/propGeo';
import {hash2} from '../lib/rng';
import {COMMON_PARS, U} from '../shaders/common';
import {makePropMaterial} from '../shaders/prop';
import type {Shot} from '../timeline';
import {pathDist, type PathSample, type System, type World} from './world';

type Car = {road: Road; s0: number; speed: number; lat: number; dir: number; type: number; idx: number};
const COLORS: RGB[] = [srgb('#e8e8ea'), srgb('#15161a'), srgb('#8a8d92'), srgb('#c0c3c8'), srgb('#7a1a1a'), srgb('#1f3a6a'), srgb('#2a2d33'), srgb('#d8d4c8')];
const TAXI = srgb('#f4c20d');

const trailMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: U as any,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		vertexShader: /* glsl */ `
			varying vec2 vUv; varying vec3 vC; varying vec3 vW;
			void main() { vUv = uv; vC = instanceColor; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec2 vUv; varying vec3 vC; varying vec3 vW;
			void main() {
				// two streaks (left/right lamp) fading along the trail
				float lane = exp(-pow((abs(vUv.y - 0.5) - 0.32) * 9.0, 2.0));
				float fade = pow(1.0 - vUv.x, 1.6) * smoothstep(0.0, 0.04, vUv.x);
				float a = lane * fade * uNight;
				vec3 col = vC * a * 2.2;
				float dist = length(vW - uCamPos);
				col *= exp(-dist * uFog * 0.6);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});

// distant avenues at night: streams of white and red lights
const flowMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: U as any,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		polygonOffset: true,
		polygonOffsetFactor: -6,
		polygonOffsetUnits: -6,
		vertexShader: /* glsl */ `
			attribute vec3 aFlow; // length along the road, lane side (-1/1), speed
			varying vec3 vF; varying vec3 vW; varying float vU;
			void main() { vF = aFlow; vU = uv.x; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec3 vF; varying vec3 vW; varying float vU;
			void main() {
				float dist = length(vW - uCamPos);
				float far = smoothstep(260.0, 520.0, dist);
				if (far * uNight < 0.01) discard;
				float s = vF.x + uTime * vF.z * vF.y;
				float cell = floor(s / 13.0);
				float h = hash11(cell + vF.y * 37.0);
				float f = fract(s / 13.0);
				float blob = smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.3, 0.75, f)) * step(0.42, h);
				float across = 1.0 - smoothstep(0.2, 0.5, abs(vU - 0.5));
				vec3 c = vF.y > 0.0 ? vec3(1.0, 0.1, 0.05) : vec3(1.0, 0.93, 0.78);
				vec3 col = c * blob * across * far * uNight * 1.6 * exp(-dist * uFog * 0.5);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});

export const makeTraffic = (world: World): System => {
	const city = world.city;
	const group = new THREE.Group();
	const carMat = makePropMaterial({emitDay: 0.6, emitNight: 7});
	const MAX = 5200;
	const mk = (geo: THREE.BufferGeometry, n: number, mat: THREE.Material) => {
		const m = new THREE.InstancedMesh(geo, mat, n);
		m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
		m.frustumCulled = false;
		m.count = 0;
		m.matrixAutoUpdate = false;
		group.add(m);
		return m;
	};
	const taxi = mk(PG.car(true), MAX, carMat), car = mk(PG.car(false), MAX, carMat), bus = mk(PG.bus(), 500, carMat);
	const trailGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
	const tails = mk(trailGeo, MAX * 2 + 500, trailMaterial());
	const heads = mk(trailGeo, MAX * 2 + 500, trailMaterial());
	tails.renderOrder = 20; heads.renderOrder = 20;

	// distant light-flow ribbons on the avenues and big cross streets
	{
		const pos: number[] = [], uv: number[] = [], fl: number[] = [], idx: number[] = [];
		let n = 0;
		city.roads.forEach((r, ri) => {
			if (r.cls > 2 || r.len < 150) return;
			const lanes = r.oneway ? [1] : [1, -1];
			for (const side of lanes) {
				const off = r.oneway ? 0 : side * r.width * 0.22;
				const hw = r.oneway ? r.width * 0.36 : r.width * 0.18;
				const speed = 11 + 4 * hash2(ri, 5);
				for (let i = 0; i < r.n; i++) {
					const a = Math.max(0, i - 1), b = Math.min(r.n - 1, i + 1);
					let dx = r.pts[b * 2] - r.pts[a * 2], dz = r.pts[b * 2 + 1] - r.pts[a * 2 + 1];
					const l = Math.hypot(dx, dz) || 1;
					dx /= l; dz /= l;
					const x = r.pts[i * 2] - dz * off, z = r.pts[i * 2 + 1] + dx * off;
					pos.push(x + dz * hw, 0.6, z - dx * hw, x - dz * hw, 0.6, z + dx * hw);
					uv.push(0, 0, 1, 0);
					const sgn = r.oneway ? (hash2(ri, 9) > 0.5 ? 1 : -1) : side;
					fl.push(r.cum[i] + ri * 3.7, sgn, speed, r.cum[i] + ri * 3.7, sgn, speed);
					if (i > 0) idx.push(n + i * 2 - 2, n + i * 2 - 1, n + i * 2 + 1, n + i * 2 - 2, n + i * 2 + 1, n + i * 2);
				}
				n += r.n * 2;
			}
		});
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
		g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
		g.setAttribute('aFlow', new THREE.BufferAttribute(new Float32Array(fl), 3));
		g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
		const m = new THREE.Mesh(g, flowMaterial());
		m.frustumCulled = false;
		m.renderOrder = 19;
		m.matrixAutoUpdate = false;
		group.add(m);
	}

	let cars: Car[] = [];
	const cache = new Map<string, Car[]>();
	const p = {x: 0, z: 0, dx: 0, dz: 0};
	const M = new THREE.Matrix4();
	const setM = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, dx: number, dz: number, sx: number, sy: number, sz: number) => {
		// local +x = travel direction
		M.set(dx * sx, 0, -dz * sz, x, 0, sy, 0, y, dz * sx, 0, dx * sz, z, 0, 0, 0, 1);
		mesh.setMatrixAt(i, M);
	};
	return {
		object: group,
		hideInReflection: false,
		setShot(shot: Shot, samples: PathSample[]) {
			let list = cache.get(shot.id);
			if (!list) {
				list = [];
				if (shot.propRange > 0) {
					city.roads.forEach((r, ri) => {
						if (r.cls < 1 || r.cls > 4 || r.len < 90 || list!.length > MAX * 1.9) return;
						let near = false;
						for (let i = 0; i < r.n && !near; i += 2) if (pathDist(samples, r.pts[i * 2], r.pts[i * 2 + 1]) < shot.propRange + 60) near = true;
						if (!near) return;
						const lanes = Math.max(1, Math.min(5, Math.round((r.width - 2.4) / 3.3)));
						for (let ln = 0; ln < lanes; ln++) {
							const dir = r.oneway ? 1 : ln < lanes / 2 ? -1 : 1;
							const lat = (ln - (lanes - 1) / 2) * 3.2 * (r.oneway ? 1 : 1);
							const spacing = (r.cls <= 2 ? 19 : 34) * (0.8 + 0.6 * hash2(ri, ln));
							const speed = (r.cls <= 2 ? 11.5 : 8) * (0.85 + 0.3 * hash2(ri * 3, ln));
							const n = Math.floor(r.len / spacing);
							for (let k = 0; k < n; k++) {
								const h = hash2(ri * 7919 + ln, k);
								if (h < 0.22) continue; // gaps in the flow
								const th = hash2(ri * 31 + ln, k * 3 + 1);
								list!.push({road: r, s0: (k + 0.15 + 0.5 * hash2(ri, k * 5 + ln)) * spacing, speed, lat: dir > 0 ? lat : lat, dir, type: th < 0.38 ? 0 : th < 0.93 ? 1 : 2, idx: Math.floor(hash2(ri + 5, k * 11 + ln) * 1000)});
							}
						}
					});
				}
				cache.set(shot.id, list);
			}
			cars = list;
			// instance colours are static per shot
			let nt = 0, nc = 0, nb = 0;
			for (const c of cars) {
				if (c.type === 0) { taxi.setColorAt(nt++, new THREE.Color(...TAXI)); }
				else if (c.type === 1) { const col = COLORS[c.idx % COLORS.length]; car.setColorAt(nc++, new THREE.Color(col[0], col[1], col[2])); }
				else if (nb < 500) { bus.setColorAt(nb++, new THREE.Color(0.85, 0.87, 0.9)); }
			}
			taxi.count = Math.min(nt, MAX); car.count = Math.min(nc, MAX); bus.count = nb;
			for (const m of [taxi, car, bus]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
		},
		update(_f, env) {
			const t = env.time;
			let nt = 0, nc = 0, nb = 0, nl = 0;
			const night = env.night > 0.25;
			const tailC = tails.instanceColor!.array as Float32Array, headC = heads.instanceColor!.array as Float32Array;
			for (const c of cars) {
				const r = c.road;
				let s = (c.s0 + c.speed * t) % r.len;
				if (c.dir < 0) s = r.len - s;
				city.roadPoint(r, s, p);
				const dx = p.dx * c.dir, dz = p.dz * c.dir;
				// right-hand traffic: lateral offset to the right of travel
				const x = p.x - p.dz * c.lat, z = p.z + p.dx * c.lat;
				const len = c.type === 2 ? 6 : 2.26;
				if (c.type === 0) { if (nt < MAX) setM(taxi, nt++, x, 0, z, dx, dz, 1, 1, 1); }
				else if (c.type === 1) { if (nc < MAX) { const v = c.idx % 7 === 0 ? 1.28 : 1; setM(car, nc++, x, 0, z, dx, dz, v > 1 ? 1.12 : 1, v, 1); } }
				else if (nb < 500) setM(bus, nb++, x, 0, z, dx, dz, 1, 1, 1);
				if (night && nl < MAX * 2) {
					setM(tails, nl, x - dx * len, 0.62, z - dz * len, -dx, -dz, 5 + c.speed * 0.55, 1, 1.9);
					tailC[nl * 3] = 1.0; tailC[nl * 3 + 1] = 0.07; tailC[nl * 3 + 2] = 0.04;
					setM(heads, nl, x + dx * len, 0.09, z + dz * len, dx, dz, 8.5, 1, 2.3);
					headC[nl * 3] = 0.5; headC[nl * 3 + 1] = 0.46; headC[nl * 3 + 2] = 0.36;
					nl++;
				}
			}
			tails.count = nl; heads.count = nl;
			for (const m of [taxi, car, bus, tails, heads]) m.instanceMatrix.needsUpdate = true;
			tails.instanceColor!.needsUpdate = true; heads.instanceColor!.needsUpdate = true;
		},
	};
};
