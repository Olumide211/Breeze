// STAGE 3: instanced detail. Rooftop, wall and street props are generated per city tile from
// seeded hashes of the building ids, built lazily, and shown per shot (the set is locked for
// the whole shot, so nothing ever pops in or out).
import * as THREE from 'three';
import {TILE, type Tile} from '../city/buildings';
import type {Building, City} from '../city/data';
import {srgb, type RGB} from '../city/geo';
import * as PG from '../city/propGeo';
import {hash2, hs, rng} from '../lib/rng';
import {COMMON_PARS, U} from '../shaders/common';
import {makePropMaterial} from '../shaders/prop';
import {CROSS, UP, type Shot} from '../timeline';
import {hero} from './shots';
import {pathDist, type PathSample, type System, type World} from './world';

type Batch = {m: number[]; c: number[]};
const TYPES = ['waterTower', 'ac', 'mech', 'vent', 'bulkhead', 'antenna', 'dish', 'garden', 'fireEscape', 'ladder', 'scaffold', 'sign', 'lamp', 'signal', 'tree', 'treeLow', 'pit', 'subway', 'cart', 'crosswalk'] as const;
type TypeName = (typeof TYPES)[number];

const put = (b: Batch, x: number, y: number, z: number, rot: number, sx = 1, sy = 1, sz = 1, col?: RGB) => {
	const c = Math.cos(rot), s = Math.sin(rot);
	b.m.push(c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, x, y, z, 1);
	if (col) b.c.push(col[0], col[1], col[2]);
	else b.c.push(1, 1, 1);
};

const AUTUMN: RGB[] = [srgb('#b23a1c'), srgb('#d8701c'), srgb('#e6aa26'), srgb('#c98a1e'), srgb('#93a02e'), srgb('#557a2c'), srgb('#a02a22')];
const SUMMER: RGB[] = [srgb('#3f7a2c'), srgb('#4f8a30'), srgb('#5f8e2e'), srgb('#7a9a30'), srgb('#b89a2a')];
const NEON: RGB[] = [[1, 0.2, 0.5], [0.2, 0.9, 1], [1, 0.75, 0.25], [0.6, 0.4, 1], [0.3, 1, 0.5], [1, 0.35, 0.2]];

const inRing = (x: number, z: number, b: Building) => {
	let inside = false;
	for (let i = 0, j = b.n - 1; i < b.n; j = i++) {
		const xi = b.ring[i * 2], zi = b.ring[i * 2 + 1], xj = b.ring[j * 2], zj = b.ring[j * 2 + 1];
		if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
	}
	return inside;
};
const edgeDist = (x: number, z: number, b: Building) => {
	let d = 1e9;
	for (let i = 0; i < b.n; i++) {
		const j = (i + 1) % b.n;
		const ax = b.ring[i * 2], az = b.ring[i * 2 + 1], bx = b.ring[j * 2], bz = b.ring[j * 2 + 1];
		const dx = bx - ax, dz = bz - az;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
		d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
	}
	return d;
};

export type StreetData = Map<string, Record<string, number[]>>;
const tkey = (x: number, z: number) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;

// Street furniture placements for the whole city (cheap arrays; meshes are built lazily per tile).
const planStreets = (city: City, world: World): StreetData => {
	const data: StreetData = new Map();
	const slot = (x: number, z: number, k: string) => {
		const key = tkey(x, z);
		let o = data.get(key);
		if (!o) data.set(key, (o = {}));
		return (o[k] ||= []);
	};
	const p = {x: 0, z: 0, dx: 0, dz: 0};
	const free = (x: number, z: number) => city.maskAt(x, z)[0] > 0.5 && city.heightAt(x, z, 1.5) === 0;
	const steam: number[] = [];
	city.roads.forEach((r, ri) => {
		if (r.cls < 1 || r.cls > 4 || r.len < 40) return;
		// lamps, alternating sides
		let side = 1;
		for (let s = 14; s < r.len - 6; s += 34) {
			city.roadPoint(r, s, p);
			const nx = -p.dz, nz = p.dx;
			const x = p.x + nx * (r.width / 2 + 1.2) * side, z = p.z + nz * (r.width / 2 + 1.2) * side;
			if (free(x, z)) slot(x, z, 'lamp').push(x, z, Math.atan2(-nx * side, -nz * side));
			side = -side;
		}
		// street trees in cobble pits
		if (r.cls >= 2) {
			for (let s = 9; s < r.len - 6; s += 16) for (const sd of [-1, 1]) {
				if (hash2(ri * 131 + sd, Math.floor(s)) > 0.42) continue;
				city.roadPoint(r, s, p);
				const x = p.x - p.dz * (r.width / 2 + 2.3) * sd, z = p.z + p.dx * (r.width / 2 + 2.3) * sd;
				if (free(x, z) && city.maskAt(x, z)[2] < 0.42) slot(x, z, 'streetTree').push(x, z, hash2(ri, Math.floor(s) * 7 + sd));
			}
		}
		// crosswalks either side of every intersection + occasional steaming manhole
		if (r.width >= 7) {
			for (const i of r.inter) {
				const s0 = r.cum[i];
				for (const off of [-1, 1]) {
					const s = s0 + off * (5.5 + r.width * 0.12);
					if (s < 1 || s > r.len - 1) continue;
					city.roadPoint(r, s, p);
					slot(p.x, p.z, 'crosswalk').push(p.x, p.z, Math.atan2(-p.dz, p.dx), r.width - 0.6);
				}
				if (hash2(ri * 977, i) < 0.07) {
					city.roadPoint(r, s0 + 3, p);
					steam.push(p.x + p.dz * r.width * 0.2, p.z - p.dx * r.width * 0.2);
				}
			}
		}
	});
	world.steamSites = steam;
	const M = city.misc;
	for (let i = 0; i < M.trees.length; i += 2) {
		const x = M.trees[i], z = M.trees[i + 1];
		if (free(x, z)) slot(x, z, city.maskAt(x, z)[1] > 0.5 ? 'parkTree' : 'streetTree').push(x, z, hash2(i, 77));
	}
	// park canopy: jittered grid over every park pixel
	const mk = M.mask;
	const G = 10.5;
	for (let gz = 0; gz < (mk.h * mk.px) / G; gz++) for (let gx = 0; gx < (mk.w * mk.px) / G; gx++) {
		const h1 = hash2(gx, gz * 3 + 1), h2 = hash2(gx * 5 + 2, gz);
		const x = mk.x0 + (gx + h1) * G, z = mk.z0 + (gz + h2) * G;
		const m = city.maskAt(x, z);
		if (m[1] < 0.6 || m[0] < 0.6 || m[2] > 0.3) continue;
		if (hash2(gx * 7, gz * 11) > 0.78) continue;
		if (city.heightAt(x, z, 2) > 0) continue;
		slot(x, z, 'parkTree').push(x, z, hash2(gx * 13 + 5, gz * 17));
	}
	const ga = Math.atan2(CROSS[1], CROSS[0]);
	for (let i = 0; i < M.signals.length; i += 2) {
		const q = Math.floor(hash2(i, 3) * 4);
		const a = ga + (q * Math.PI) / 2;
		const x = M.signals[i] + Math.cos(a + 0.6) * 9, z = M.signals[i + 1] + Math.sin(a + 0.6) * 9;
		if (free(x, z)) slot(x, z, 'signal').push(x, z, -a + Math.PI * 0.75);
		if (hash2(i, 9) < 0.06) {
			const cx = M.signals[i] + Math.cos(a + 2.2) * 12, cz = M.signals[i + 1] + Math.sin(a + 2.2) * 12;
			if (free(cx, cz)) slot(cx, cz, 'cart').push(cx, cz, -ga + q);
		}
	}
	for (let i = 0; i < M.subways.length; i += 2) {
		const x = M.subways[i], z = M.subways[i + 1];
		if (city.maskAt(x, z)[0] > 0.5) slot(x, z, 'subway').push(x, z, -ga + (hash2(i, 5) > 0.5 ? Math.PI / 2 : 0));
	}
	return data;
};

const crosswalkMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: U as any,
		transparent: true,
		depthWrite: false,
		polygonOffset: true,
		polygonOffsetFactor: -4,
		polygonOffsetUnits: -4,
		vertexShader: /* glsl */ `
			varying vec3 vW; varying vec2 vUv;
			void main() { vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz; vUv = uv; gl_Position = projectionMatrix * viewMatrix * wp; }`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec3 vW; varying vec2 vUv;
			void main() {
				// zebra stripes across the carriageway, worn by a noise mask
				float w = fwidth(vUv.y * 14.0);
				float stripe = smoothstep(0.5 - w, 0.5 + w, abs(fract(vUv.y * 14.0) - 0.5) * 2.0);
				float wear = 0.55 + 0.45 * texture2D(uNoise, vW.xz / 3.0).a;
				float a = (1.0 - stripe) * wear * (1.0 - smoothstep(0.35, 1.2, w)) * 0.85;
				if (a < 0.01) discard;
				vec3 V = normalize(uCamPos - vW);
				float sh = sunShadow(vW, vec3(0.0, 1.0, 0.0)) * cloudShadow(vW);
				vec3 col = animeShade(vec3(0.62, 0.62, 0.58), vec3(0.0, 1.0, 0.0), V, sh, 1.0);
				col += vec3(0.62) * uNight * vec3(1.0, 0.62, 0.3) * 0.9;
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, a * (1.0 - uWet * 0.35));
			}`,
	});

export const makeProps = (world: World): System => {
	const city = world.city;
	const streets = planStreets(city, world);
	const generic = makePropMaterial({emitDay: 0.5, emitNight: 6});
	const lampMat = makePropMaterial({emitDay: 0, emitNight: 9, noShadow: true});
	const signMat = makePropMaterial({emitDay: 0.3, emitNight: 5, tintEmissive: true, noShadow: true});
	const signalMat = makePropMaterial({emitDay: 2.4, emitNight: 6, signal: true, noShadow: true});
	const foliage = makePropMaterial({pattern: 'foliage', sway: true});
	const ironMat = makePropMaterial({noShadow: true, doubleSide: true});
	const cwGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const defs: Record<TypeName, {geo: THREE.BufferGeometry; mat: THREE.Material; shadow: boolean}> = {
		waterTower: {geo: PG.waterTower(), mat: generic, shadow: true},
		ac: {geo: PG.acUnit(), mat: generic, shadow: false},
		mech: {geo: PG.mechUnit(), mat: generic, shadow: true},
		vent: {geo: PG.vent(), mat: generic, shadow: false},
		bulkhead: {geo: PG.bulkhead(), mat: generic, shadow: true},
		antenna: {geo: PG.antenna(), mat: generic, shadow: false},
		dish: {geo: PG.dish(), mat: generic, shadow: false},
		garden: {geo: PG.roofGarden(), mat: generic, shadow: false},
		fireEscape: {geo: PG.fireEscape(), mat: ironMat, shadow: false},
		ladder: {geo: PG.dropLadder(), mat: ironMat, shadow: false},
		scaffold: {geo: PG.scaffold(), mat: generic, shadow: false},
		sign: {geo: PG.bladeSign(), mat: signMat, shadow: false},
		lamp: {geo: PG.streetLamp(), mat: lampMat, shadow: false},
		signal: {geo: PG.trafficSignal(), mat: signalMat, shadow: false},
		tree: {geo: PG.tree(false), mat: foliage, shadow: true},
		treeLow: {geo: PG.tree(true), mat: foliage, shadow: true},
		pit: {geo: PG.treePit(), mat: generic, shadow: false},
		subway: {geo: PG.subwayEntrance(), mat: generic, shadow: false},
		cart: {geo: PG.hotdogCart(), mat: generic, shadow: false},
		crosswalk: {geo: cwGeo, mat: crosswalkMaterial(), shadow: false},
	};
	const group = new THREE.Group();
	const built = new Map<string, THREE.Group>();

	const buildTile = (tile: Tile, detail: boolean): THREE.Group => {
		const B = Object.fromEntries(TYPES.map((t) => [t, {m: [], c: []} as Batch])) as Record<TypeName, Batch>;
		for (const b of tile.buildings) {
			if (b.minH > 1 || b.area < 60) continue;
			const r = rng('roof' + b.seed);
			const isHero = b === hero.roof;
			const y = b.roofY;
			const spot = (margin: number): [number, number] | null => {
				for (let k = 0; k < 10; k++) {
					const x = b.cx + (r() - 0.5) * 2 * b.r, z = b.cz + (r() - 0.5) * 2 * b.r;
					if (!inRing(x, z, b) || edgeDist(x, z, b) < margin) continue;
					if (isHero) {
						const lat = -(x - b.cx) * hero.dir[1] + (z - b.cz) * hero.dir[0];
						if (Math.abs(lat) < 11) continue;
					}
					return [x, z];
				}
				return null;
			};
			const old = b.kind <= 1;
			if (isHero) {
				for (const t of hero.towers) put(B.waterTower, t[0], y, t[2], 0.4, 1.15, 1.15, 1.15);
			} else if (old && b.h > 16 && b.h < 170 && b.area > 220 && hs(b.seed, 21) < 0.62) {
				const n = b.area > 1400 && hs(b.seed, 22) < 0.5 ? 2 : 1;
				for (let i = 0; i < n; i++) {
					const p = spot(3.2);
					// taller dunnage on big roofs so the tanks read against the sky
					if (p) put(B.waterTower, p[0], y + (b.h > 60 ? 2.5 : 0), p[1], r() * 6.28, 1 + r() * 0.25, 1 + r() * 0.3, 1 + r() * 0.25);
				}
			}
			if (b.area > 110 && b.h > 9) {
				const p = spot(2.6);
				if (p) put(B.bulkhead, p[0], y, p[1], Math.atan2(CROSS[1], CROSS[0]) + Math.floor(r() * 4) * 1.5708, 1, 1, 1, old ? [1, 1, 1] : [0.8, 0.85, 0.9]);
			}
			if (!detail) continue;
			const nAc = Math.min(7, Math.floor(b.area / 260) + (r() < 0.6 ? 1 : 0));
			for (let i = 0; i < nAc; i++) {
				const p = spot(1.6);
				if (!p) continue;
				if (!old && b.area > 900 && i < 2) put(B.mech, p[0], y, p[1], -Math.atan2(CROSS[1], CROSS[0]) + (r() > 0.5 ? 1.5708 : 0));
				else put(B.ac, p[0], y, p[1], -Math.atan2(CROSS[1], CROSS[0]) + Math.floor(r() * 4) * 1.5708, 1, 1, 1);
			}
			const nV = Math.min(5, Math.floor(b.area / 320) + 1);
			for (let i = 0; i < nV; i++) {
				const p = spot(1.2);
				if (p) put(B.vent, p[0], y, p[1], 0, 1, 0.7 + r() * 0.9, 1);
			}
			if (b.h > 55 && hs(b.seed, 23) < 0.3) { const p = spot(2); if (p) put(B.antenna, p[0], y, p[1], r() * 3, 1, 1 + r() * 1.2, 1); }
			if (hs(b.seed, 24) < 0.16) { const p = spot(1.5); if (p) put(B.dish, p[0], y, p[1], r() * 6.28); }
			if (old && b.area > 320 && hs(b.seed, 25) < 0.1) { const p = spot(4.5); if (p) put(B.garden, p[0], y, p[1], -Math.atan2(CROSS[1], CROSS[0])); }

			// ---- walls: fire escapes, sidewalk sheds, blade signs ----
			let area = 0;
			for (let i = 0; i < b.n; i++) { const j = (i + 1) % b.n; area += b.ring[i * 2] * b.ring[j * 2 + 1] - b.ring[j * 2] * b.ring[i * 2 + 1]; }
			const sgn = area >= 0 ? 1 : -1;
			let escapes = 0;
			for (let i = 0; i < b.n; i++) {
				const j = (i + 1) % b.n;
				const ax = b.ring[i * 2], az = b.ring[i * 2 + 1], bx = b.ring[j * 2], bz = b.ring[j * 2 + 1];
				const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
				if (len < 6.5) continue;
				const nx = (dz / len) * sgn, nz = (-dx / len) * sgn;
				const mx = (ax + bx) / 2, mz = (az + bz) / 2;
				const fx = mx + nx * 6, fz = mz + nz * 6;
				if (city.maskAt(fx, fz)[2] < 0.3 || city.heightAt(fx, fz, 1) > 0) continue; // must face a street
				const rot = Math.atan2(nx, nz);
				const h1 = hs(b.seed, 40 + i);
				if (b.kind === 0 && b.h > 11 && b.h < 34 && escapes < 2 && h1 < 0.8) {
					const floors = Math.max(1, Math.round((b.h - b.minH) / 3.4));
					const t = 0.5 + (hs(b.seed, 60 + i) - 0.5) * Math.max(0, 1 - 5 / len);
					const px = ax + dx * t, pz = az + dz * t;
					for (let k = 1; k < floors; k++) put(B.fireEscape, px, k * (b.h / floors) + 0.25, pz, rot, k % 2 ? 1 : -1, b.h / floors / 3.4, 1);
					put(B.ladder, px - (dx / len) * 1.2, b.h / floors + 0.25, pz - (dz / len) * 1.2, rot);
					escapes++;
				}
				if (len > 9 && hs(b.seed, 80 + i) < 0.07) {
					const n = Math.floor(len / 2.4);
					for (let k = 0; k < n; k++) {
						const t = (k + 0.5) / n;
						put(B.scaffold, ax + dx * t, 0, az + dz * t, rot, len / n / 2.4, 1, 1);
					}
				}
				if (b.h < 90 && hs(b.seed, 100 + i) < 0.3) {
					const t = 0.15 + hs(b.seed, 120 + i) * 0.7;
					put(B.sign, ax + dx * t, 4.3 + hs(b.seed, 140 + i) * 4, az + dz * t, rot, 1, 0.7 + hs(b.seed, 160 + i) * 0.9, 1, NEON[Math.floor(hs(b.seed, 180 + i) * NEON.length)]);
				}
			}
		}
		// ---- streets ----
		const st = streets.get(tile.key) || {};
		const arr = (k: string) => st[k] || [];
		for (let a = arr('lamp'), i = 0; i < a.length; i += 3) put(B.lamp, a[i], 0, a[i + 1], a[i + 2]);
		for (let a = arr('signal'), i = 0; i < a.length; i += 3) put(B.signal, a[i], 0, a[i + 1], a[i + 2]);
		for (let a = arr('cart'), i = 0; i < a.length; i += 3) put(B.cart, a[i], 0, a[i + 1], a[i + 2]);
		for (let a = arr('subway'), i = 0; i < a.length; i += 3) put(B.subway, a[i], 0, a[i + 1], a[i + 2]);
		for (let a = arr('crosswalk'), i = 0; i < a.length; i += 4) put(B.crosswalk, a[i], 0.045, a[i + 1], a[i + 2], 3.3, 1, a[i + 3]);
		for (let a = arr('streetTree'), i = 0; i < a.length; i += 3) {
			const h = a[i + 2];
			const s = 0.75 + h * 0.6;
			const col = SUMMER[Math.floor(hash2(Math.floor(h * 1e6), 3) * SUMMER.length)];
			put(detail ? B.tree : B.treeLow, a[i], 0, a[i + 1], h * 6.28, s, s * (0.9 + 0.3 * hash2(Math.floor(h * 1e6), 5)), s, col);
			if (detail) put(B.pit, a[i], 0, a[i + 1], -Math.atan2(CROSS[1], CROSS[0]));
		}
		for (let a = arr('parkTree'), i = 0; i < a.length; i += 3) {
			const h = a[i + 2];
			const s = 1.05 + h * 0.95;
			const col = AUTUMN[Math.floor(hash2(Math.floor(h * 1e6), 3) * AUTUMN.length)];
			const v = 0.8 + 0.4 * hash2(Math.floor(h * 1e6), 9);
			put(detail ? B.tree : B.treeLow, a[i], 0, a[i + 1], h * 6.28, s, s * (0.95 + 0.35 * hash2(Math.floor(h * 1e6), 5)), s, [col[0] * v, col[1] * v, col[2] * v]);
		}
		const g = new THREE.Group();
		for (const t of TYPES) {
			const b = B[t];
			const n = b.m.length / 16;
			if (!n) continue;
			const d = defs[t];
			const mesh = new THREE.InstancedMesh(d.geo, d.mat, n);
			mesh.instanceMatrix.array.set(b.m);
			mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(b.c), 3);
			mesh.computeBoundingSphere();
			mesh.matrixAutoUpdate = false;
			if (d.shadow) mesh.layers.enable(1);
			if (t === 'crosswalk') mesh.renderOrder = 5;
			g.add(mesh);
		}
		return g;
	};

	// tiles that have street furniture but no buildings (parks) still need a Tile record
	const tileIndex = new Map(world.tiles.map((t) => [t.key, t]));
	for (const key of streets.keys()) {
		if (tileIndex.has(key)) continue;
		const [tx, tz] = key.split(',').map(Number);
		tileIndex.set(key, {key, cx: (tx + 0.5) * TILE, cz: (tz + 0.5) * TILE, mesh: null as any, buildings: [], radius: TILE * 0.71});
	}

	return {
		object: group,
		setShot(shot: Shot, samples: PathSample[]) {
			for (const g of built.values()) g.visible = false;
			if (shot.propRange <= 0) return;
			for (const tile of tileIndex.values()) {
				const d = pathDist(samples, tile.cx, tile.cz) - TILE * 0.71;
				if (d > shot.propRange) continue;
				// full detail near the camera path; roof-scale silhouettes (towers, bulkheads, trees) further out
				const detail = d < shot.propRange * 0.55;
				const id = `${tile.key}|${detail ? 1 : 0}`;
				let g = built.get(id);
				if (!g) {
					g = buildTile(tile, detail);
					built.set(id, g);
					group.add(g);
				}
				g.visible = true;
			}
		},
	};
};
export const _unused = [UP];
