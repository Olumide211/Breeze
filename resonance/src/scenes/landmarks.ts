// STAGE 2: hand-modelled procedural hero landmarks.
import earcut from 'earcut';
import * as THREE from 'three';
import {addPrism, newBuilder, type Builder} from '../city/buildings';
import type {City} from '../city/data';
import {Geo, srgb, type RGB} from '../city/geo';
import {COMMON_PARS, U} from '../shaders/common';
import {makePropMaterial} from '../shaders/prop';
import {P} from '../timeline';
import type {System, World} from './world';

const GA = (29 * Math.PI) / 180;
// rectangle aligned to the Manhattan grid: w along cross-streets, d along avenues
const rect = (cx: number, cz: number, w: number, d: number, ox = 0, oz = 0, ang = GA) => {
	const c = Math.cos(ang), s = Math.sin(ang);
	const out = new Float32Array(8);
	[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
		const lx = ox + (sx * w) / 2, lz = oz + (sz * d) / 2;
		out[i * 2] = cx + lx * c - lz * s;
		out[i * 2 + 1] = cz + lx * s + lz * c;
	});
	return out;
};
const ngon = (cx: number, cz: number, r: number, n: number, rot = 0) => {
	const out = new Float32Array(n * 2);
	for (let i = 0; i < n; i++) {
		const a = rot + (i / n) * Math.PI * 2;
		out[i * 2] = cx + Math.cos(a) * r;
		out[i * 2 + 1] = cz + Math.sin(a) * r;
	}
	return out;
};
const poly = (cx: number, cz: number, pts: number[][], ang = GA) => {
	const c = Math.cos(ang), s = Math.sin(ang);
	const out = new Float32Array(pts.length * 2);
	pts.forEach(([lx, lz], i) => {
		out[i * 2] = cx + lx * c - lz * s;
		out[i * 2 + 1] = cz + lx * s + lz * c;
	});
	return out;
};

// planar facade polygon (convex) with bay/floor UVs: used for One WTC's tapering triangles
const facePoly = (B: Builder, pts: number[][], seed: number, kind: number, y0: number, floors: number, bayW: number, surf = 0) => {
	const a = new THREE.Vector3(...(pts[0] as [number, number, number])), b = new THREE.Vector3(...(pts[1] as [number, number, number])), c = new THREE.Vector3(...(pts[2] as [number, number, number]));
	const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
	const uAxis = new THREE.Vector3(-n.z, 0, n.x).normalize();
	const base = B.count;
	for (const p of pts) B.vert(p[0], p[1], p[2], n.x, n.y, n.z, (p[0] * uAxis.x + p[2] * uAxis.z) / bayW + 500, (p[1] - y0) / 3.4, seed, kind, floors, surf);
	for (let i = 1; i + 1 < pts.length; i++) B.idx.push(base, base + i, base + i + 1);
};

// ---------------------------------------------------------------- towers
const buildTowers = (city: City) => {
	const B = newBuilder();
	const S = city.misc.sites;
	// ---- Empire State Building (443 m) ----
	{
		const [cx, cz] = S.esb ?? P.esb;
		const sd = 0.4321, k = 4;
		addPrism(B, rect(cx, cz, 129, 57), 4, 0, 24, sd, k, {bayW: 2.0});
		addPrism(B, rect(cx, cz, 114, 52), 4, 24, 80, sd, k, {bayW: 2.0});
		addPrism(B, rect(cx, cz, 98, 46), 4, 80, 116, sd, k, {bayW: 2.0});
		// shaft: cruciform plan gives the Art Deco pier-and-recess silhouette
		const cross = (w: number, d: number, nw: number, nd: number) => poly(cx, cz, [[-w / 2, -nd / 2], [-nw / 2, -nd / 2], [-nw / 2, -d / 2], [nw / 2, -d / 2], [nw / 2, -nd / 2], [w / 2, -nd / 2], [w / 2, nd / 2], [nw / 2, nd / 2], [nw / 2, d / 2], [-nw / 2, d / 2], [-nw / 2, nd / 2], [-w / 2, nd / 2]]);
		addPrism(B, cross(82, 42, 50, 28), 12, 116, 250, sd, k, {bayW: 2.0});
		addPrism(B, cross(68, 40, 44, 26), 12, 250, 296, sd, k, {bayW: 2.0});
		addPrism(B, cross(56, 36, 40, 26), 12, 296, 320, sd, k, {bayW: 2.0, surf: 2});
		addPrism(B, rect(cx, cz, 40, 30), 4, 320, 331, sd, k, {bayW: 2.0, surf: 2});
		addPrism(B, rect(cx, cz, 25, 25), 4, 331, 345, sd, k, {bayW: 2.0, surf: 2});
		// mooring mast with four fins
		addPrism(B, ngon(cx, cz, 9.5, 12), 12, 345, 368, sd, k, {bayW: 2.0, surf: 2});
		addPrism(B, rect(cx, cz, 24, 3), 4, 345, 362, sd, k, {bayW: 1e6, surf: 2});
		addPrism(B, rect(cx, cz, 3, 24), 4, 345, 362, sd, k, {bayW: 1e6, surf: 2});
		addPrism(B, ngon(cx, cz, 8.4, 12), 12, 368, 381, sd, k, {bayW: 1e6, surf: 2, topRing: ngon(cx, cz, 2.6, 12)});
	}
	// ---- Chrysler Building shaft (crown is a separate mesh) ----
	{
		const [cx, cz] = S.chrysler ?? P.chrysler;
		const sd = 0.777, k = 5;
		addPrism(B, rect(cx, cz, 61, 61), 4, 0, 64, sd, k, {bayW: 2.4});
		addPrism(B, rect(cx, cz, 52, 52), 4, 64, 96, sd, k, {bayW: 2.4});
		addPrism(B, rect(cx, cz, 43, 43), 4, 96, 122, sd, k, {bayW: 2.4});
		const cross = poly(cx, cz, [[-16.5, -11], [-11, -11], [-11, -16.5], [11, -16.5], [11, -11], [16.5, -11], [16.5, 11], [11, 11], [11, 16.5], [-11, 16.5], [-11, 11], [-16.5, 11]]);
		addPrism(B, cross, 12, 122, 232, sd, k, {bayW: 2.2});
	}
	// ---- One World Trade Center (541 m) ----
	{
		const [cx, cz] = S.wtc1 ?? P.wtc;
		const sd = 0.3131, k = 6, ang = GA;
		const hw = 30.5;
		const bot = rect(cx, cz, 61, 61, 0, 0, ang);
		addPrism(B, bot, 4, 0, 57, sd, k, {bayW: 1.6});
		const A: number[][] = [], T: number[][] = [];
		for (let i = 0; i < 4; i++) A.push([bot[i * 2], 57, bot[i * 2 + 1]]);
		// top square is rotated 45 degrees: its corners sit above the base edge midpoints
		const topHw = hw * Math.SQRT1_2 * 1.0;
		for (let i = 0; i < 4; i++) {
			const j = (i + 1) % 4;
			const mx = (A[i][0] + A[j][0]) / 2 - cx, mz = (A[i][2] + A[j][2]) / 2 - cz;
			const l = Math.hypot(mx, mz);
			T.push([cx + (mx / l) * topHw * Math.SQRT2 * 0.72, 417, cz + (mz / l) * topHw * Math.SQRT2 * 0.72]);
		}
		const outward = (pts: number[][]) => {
			const a = pts[0], b = pts[1], c = pts[2];
			const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
			const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
			const mx = (a[0] + b[0] + c[0]) / 3 - cx, mz = (a[2] + b[2] + c[2]) / 3 - cz;
			return nx * mx + nz * mz >= 0 ? pts : [pts[0], pts[2], pts[1]];
		};
		for (let i = 0; i < 4; i++) {
			const j = (i + 1) % 4;
			facePoly(B, outward([A[i], A[j], T[i]]), sd, k, 57, 106, 1.6); // upright triangle on each base edge
			facePoly(B, outward([T[i], A[j], T[j]]), sd, k, 57, 106, 1.6); // inverted triangle on each corner
		}
		const topRing = new Float32Array(T.flatMap((p) => [p[0], p[2]]));
		addPrism(B, topRing, 4, 417, 424, sd, k, {bayW: 1.6});
	}
	// ---- Flatiron Building (87 m): triangular plan with a rounded prow pointing uptown ----
	{
		const [cx, cz] = S.flatiron ?? P.flatiron;
		const ring = poly(cx, cz, [[-1.2, -30], [1.2, -30], [2.4, -28.5], [14, 26], [-12, 26], [-2.4, -28.5]]);
		addPrism(B, ring, 6, 0, 87, 0.6113, 1, {bayW: 2.4, roofY: 86});
	}
	// ---- Billionaires' Row ----
	{
		const cpt = S.cpt, st = S.steinway, pk = S.park432, o57 = S.one57;
		// Central Park Tower (472 m)
		addPrism(B, rect(cpt[0], cpt[1], 62, 44), 4, 0, 96, 0.151, 9, {bayW: 1.6});
		addPrism(B, rect(cpt[0], cpt[1], 44, 36, 4, 0), 4, 96, 300, 0.151, 9, {bayW: 1.6});
		addPrism(B, rect(cpt[0], cpt[1], 36, 32, 6, 0), 4, 300, 420, 0.151, 9, {bayW: 1.6});
		addPrism(B, rect(cpt[0], cpt[1], 28, 28, 6, 0), 4, 420, 472, 0.151, 9, {bayW: 1.6});
		// 111 West 57th (435 m): pencil tower with a feathered, stepped crown
		const stepsN = 9;
		addPrism(B, rect(st[0], st[1], 18, 26), 4, 0, 250, 0.262, 7, {bayW: 2.0});
		for (let i = 0; i < stepsN; i++) {
			const d = 26 - (i + 1) * 2.4;
			addPrism(B, rect(st[0], st[1], 18, d, 0, -(26 - d) / 2), 4, 250 + i * 20.5, 250 + (i + 1) * 20.5, 0.262, 7, {bayW: 2.0});
		}
		// 432 Park Avenue (426 m): square concrete grid
		addPrism(B, rect(pk[0], pk[1], 28.5, 28.5), 4, 0, 426, 0.373, 8, {bayW: 4.75, floorsOverride: 88});
		// One57 (306 m)
		addPrism(B, rect(o57[0], o57[1], 46, 30), 4, 0, 210, 0.484, 6, {bayW: 1.6});
		addPrism(B, rect(o57[0], o57[1], 40, 30, -3, 0), 4, 210, 270, 0.484, 6, {bayW: 1.6});
		addPrism(B, rect(o57[0], o57[1], 32, 30, -7, 0), 4, 270, 306, 0.484, 6, {bayW: 1.6});
	}
	return B.geometry();
};

// ---- spires, masts, beacons (prop material) ----
const buildSpires = (city: City) => {
	const g = new Geo();
	const S = city.misc.sites;
	const steel = srgb('#8d949c'), dark = srgb('#4a4f58');
	const [ex, ez] = S.esb ?? P.esb;
	g.cyl(ex, 381, ez, 2.4, 1.6, 22, 10, steel);
	g.cyl(ex, 403, ez, 1.5, 0.9, 22, 8, dark);
	g.cyl(ex, 425, ez, 0.8, 0.25, 18, 6, steel);
	for (let i = 0; i < 4; i++) g.cyl(ex, 384 + i * 9, ez, 3.0, 3.0, 0.8, 10, dark);
	const [wx, wz] = S.wtc1 ?? P.wtc;
	g.cyl(wx, 424, wz, 10, 10, 3, 16, dark);
	g.cyl(wx, 427, wz, 3.2, 2.2, 40, 10, steel);
	g.cyl(wx, 467, wz, 2.1, 1.2, 40, 8, steel);
	g.cyl(wx, 507, wz, 1.1, 0.4, 34, 6, steel);
	for (let i = 0; i < 6; i++) g.cyl(wx, 432 + i * 14, wz, 4.2 - i * 0.5, 4.2 - i * 0.5, 0.7, 10, dark);
	const [cx, cz] = S.chrysler ?? P.chrysler;
	g.cyl(cx, 283, cz, 1.9, 0.2, 36, 8, steel);
	return g.build();
};
const buildBeacons = (city: City, steady: boolean) => {
	const g = new Geo();
	const S = city.misc.sites;
	const red: RGB = [1, 0.08, 0.05];
	if (steady) {
		const [ex, ez] = S.esb ?? P.esb;
		g.sphere(ex, 443.5, ez, 0.9, 8, red, 1);
		const [cx, cz] = S.chrysler ?? P.chrysler;
		g.sphere(cx, 319.4, cz, 0.6, 8, red, 1);
		for (const k of ['cpt', 'steinway', 'park432', 'one57'] as const) {
			const h = {cpt: 473, steinway: 436, park432: 427, one57: 307}[k];
			g.sphere(S[k][0], h, S[k][1], 0.8, 8, red, 1);
		}
	} else {
		const [wx, wz] = S.wtc1 ?? P.wtc;
		g.sphere(wx, 541.5, wz, 1.5, 10, red, 1);
		g.sphere(wx, 468, wz, 1.0, 8, red, 0.7);
	}
	return g.build();
};

// ---- Chrysler crown: stainless-steel sunburst with triangular windows ----
const buildChryslerCrown = (city: City) => {
	const [cx, cz] = city.misc.sites.chrysler ?? P.chrysler;
	const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
	const y0 = 232, H = 52, hw0 = 16.5, rings = 26;
	const hw = (k: number) => hw0 * Math.pow(Math.max(0, 1 - k), 0.55) * (1 - 0.22 * k) + 0.7 * (1 - k) + 0.5;
	const c = Math.cos(GA), s = Math.sin(GA);
	let n = 0;
	for (let f = 0; f < 4; f++) {
		const a = (f * Math.PI) / 2;
		const fx = Math.cos(a), fz = Math.sin(a); // face normal (local)
		const tx = -fz, tz = fx; // tangent
		for (let r = 0; r <= rings; r++) {
			const k = r / rings;
			const w = hw(k), dw = (hw(Math.min(1, k + 0.02)) - hw(Math.max(0, k - 0.02))) / (0.04 * H);
			for (const sgn of [-1, 1]) {
				const lx = fx * w + tx * w * sgn, lz = fz * w + tz * w * sgn;
				pos.push(cx + lx * c - lz * s, y0 + k * H, cz + lx * s + lz * c);
				const nl = Math.hypot(1, dw);
				const nx = fx / nl, ny = -dw / nl, nz = fz / nl;
				nor.push(nx * c - nz * s, ny, nx * s + nz * c);
				uv.push((sgn * w) / hw0, k);
			}
			if (r < rings) {
				const b = n + r * 2;
				idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
			}
		}
		n += (rings + 1) * 2;
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
	g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
	g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
	g.setIndex(idx);
	g.computeBoundingSphere();
	const mat = new THREE.ShaderMaterial({
		uniforms: U as any,
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `
			varying vec3 vW; varying vec3 vN; varying vec2 vUv;
			void main() { vW = position; vN = normal; vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
		fragmentShader: /* glsl */ `
			${COMMON_PARS}
			varying vec3 vW; varying vec3 vN; varying vec2 vUv;
			void main() {
				vec3 N = normalize(vN);
				if (!gl_FrontFacing) N = -N;
				vec3 V = normalize(uCamPos - vW);
				vec2 p = vUv;
				float rib = 0.0, win = 0.0, seam = 0.0;
				// seven terraced arches following the crown's silhouette, each ringed with triangular windows
				for (int k = 0; k < 7; k++) {
					float fk = float(k);
					float c = fk * 0.105;
					float wk = pow(1.0 - c, 0.55) * (1.0 - 0.22 * c) * 0.98;
					float hk = 0.31 - fk * 0.012;
					vec2 q = vec2(p.x / wk, (p.y - c) / hk);
					float d = length(q);
					float inside = 1.0 - d;
					float t = inside / 0.24;
					if (q.y > 0.0 && t > 0.0 && t < 1.0) {
						float ang = atan(q.x, q.y);
						float nW = 8.0 - fk * 0.7;
						float a = fract((ang / 3.14159 + 0.5) * nW);
						float tri = step(abs(a - 0.5) * 2.0, (1.0 - t) * 0.72) * step(0.12, t);
						win = max(win, tri);
						seam = max(seam, 1.0 - smoothstep(0.0, 0.06, 1.0 - abs(a - 0.5) * 2.0));
					}
					if (q.y > -0.05) rib = max(rib, 1.0 - smoothstep(0.012, 0.05, abs(inside)));
				}
				// radial sunburst seams above the arches
				vec3 R = reflect(-V, N);
				R = normalize(R + (hash32(floor(p * vec2(26.0, 44.0))) - 0.5) * 0.09);
				vec3 sky = mix(uSkyHor * 0.6 + uAmbGround * 0.4, mix(uSkyHor, uSkyZen, sat(R.y * 1.3)), smoothstep(-0.15, 0.1, R.y));
				float sh = cloudShadow(vW);
				float ndl = sat(dot(N, uKeyDir));
				vec3 steel = vec3(0.62, 0.65, 0.69);
				vec3 col = steel * (sky * 0.85 + uSunColor * (0.18 + 0.5 * ndl) * sh);
				float glint = pow(max(dot(R, uKeyDir), 0.0), 90.0) * 7.0 + pow(max(dot(R, uKeyDir), 0.0), 12.0) * 0.6;
				col += uSunColor * glint * sh * uSunUp;
				col *= 1.0 - 0.45 * rib - 0.2 * seam;
				vec3 glass = mix(vec3(0.02, 0.03, 0.05), sky, 0.35);
				col = mix(col, glass, win * 0.9);
				// crown lighting: every triangular window glows white at night
				col += vec3(1.0, 0.93, 0.8) * win * uNight * 6.0;
				col += steel * uNight * vec3(0.5, 0.48, 0.42) * 0.5 * (1.0 - win);
				col = applyFog(col, vW);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
	const mesh = new THREE.Mesh(g, mat);
	mesh.layers.enable(1);
	return mesh;
};

// ---------------------------------------------------------------- bridges
type Axis = {cx: number; cz: number; dx: number; dz: number};
const bridgeMatrix = (a: Axis) => new THREE.Matrix4().makeBasis(new THREE.Vector3(a.dx, 0, a.dz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-a.dz, 0, a.dx)).setPosition(a.cx, 0, a.cz);

// panel with a pointed gothic arch cut out; lies in the (t,y) plane, extruded along s
const archPanel = (g: Geo, t0: number, t1: number, ySpring: number, rise: number, yTop: number, s0: number, s1: number, col: RGB) => {
	const w = t1 - t0, R = (w * w * 0.25 + rise * rise) / w;
	const pts: number[][] = [];
	const N = 9;
	for (let i = 0; i <= N; i++) {
		// left arc centred at (t0 + R, ySpring)
		const a = Math.PI - (i / N) * Math.acos((R - w / 2) / R);
		pts.push([t0 + R + Math.cos(a) * R, ySpring + Math.sin(a) * R]);
	}
	for (let i = N - 1; i >= 0; i--) {
		const a = (i / N) * Math.acos((R - w / 2) / R);
		pts.push([t1 - R + Math.cos(a) * R, ySpring + Math.sin(a) * R]);
	}
	const arch = pts.slice();
	pts.push([t1, yTop], [t0, yTop]);
	const tris = earcut(pts.flat());
	for (const s of [s0, s1]) {
		const nrm = s === s0 ? -1 : 1;
		const base = g.n;
		for (const p of pts) g.vert(s, p[1], p[0], nrm, 0, 0, col);
		for (let i = 0; i < tris.length; i += 3) {
			const p0 = pts[tris[i]], p1 = pts[tris[i + 1]], p2 = pts[tris[i + 2]];
			// positive area in (t,y) faces -s; flip for the +s face
			const ccw = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]) > 0;
			if (ccw === nrm < 0) g.idx.push(base + tris[i], base + tris[i + 1], base + tris[i + 2]);
			else g.idx.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]);
		}
	}
	// soffit
	for (let i = 0; i + 1 < arch.length; i++) {
		const a = arch[i], b = arch[i + 1];
		g.quad([s0, a[1], a[0]], [s1, a[1], a[0]], [s1, b[1], b[0]], [s0, b[1], b[0]], [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8]);
	}
};

export const brooklynDeckY = (s: number) => {
	const a = Math.abs(s);
	if (a < 243) return 41 - 5 * (a / 243) ** 2;
	if (a < 527) return 36 - ((a - 243) / 284) * 15;
	return Math.max(0, 21 * (1 - (a - 527) / 430));
};
export const manhattanDeckY = (s: number) => {
	const a = Math.abs(s);
	if (a < 224) return 42 - 3.5 * (a / 224) ** 2;
	if (a < 445) return 38.5 - ((a - 224) / 221) * 13;
	return Math.max(0, 25.5 * (1 - (a - 445) / 470));
};

const buildBrooklynBridge = (ax: Axis) => {
	const stone = new Geo(), steel = new Geo(), wood = new Geo(), cable = new Geo(), truss = new Geo(), lamps = new Geo();
	const M = bridgeMatrix(ax);
	for (const g of [stone, steel, wood, cable, truss, lamps]) g.m.copy(M);
	const granite = srgb('#93897b'), graniteD = srgb('#7a7166');
	const TOW = [-243, 243];
	for (const ts of TOW) {
		const dk = brooklynDeckY(ts);
		// massive base up to the roadway
		stone.box(ts, (dk - 5) / 2, 0, 19, dk + 5, 43, granite);
		stone.box(ts, -1.5, 0, 22, 5, 47, graniteD);
		// three piers and two gothic arches above the roadway
		const piers: [number, number][] = [[-20.5, -13.4], [-3.3, 3.3], [13.4, 20.5]];
		for (const [a, b] of piers) stone.box(ts, (dk - 1 + 84) / 2, (a + b) / 2, 15, 85 - dk, b - a, granite);
		for (const [a, b] of [[-13.4, -3.3], [3.3, 13.4]]) archPanel(stone, a, b, dk + 22, 14.5, 84, ts - 7.5, ts + 7.5, granite);
		// buttress strips + cornices
		for (const t of [-20.5, 20.5, -3.3, 3.3, -13.4, 13.4]) stone.box(ts, (dk + 80) / 2, t, 17, 80 - dk, 1.6, graniteD);
		stone.box(ts, 80.6, 0, 17.4, 1.2, 43.4, srgb('#a89e8f'));
		stone.box(ts, 84.4, 0, 18.2, 1.6, 44.2, srgb('#a89e8f'));
		stone.box(ts, 85.8, 0, 15, 1.4, 41, granite);
	}
	// anchorages + approach piers
	for (const sg of [-1, 1]) {
		stone.box(sg * 545, brooklynDeckY(545) / 2, 0, 44, brooklynDeckY(545) + 1, 36, granite);
		for (let a = 600; a < 930; a += 46) stone.box(sg * a, brooklynDeckY(a) / 2 - 0.4, 0, 5, Math.max(1, brooklynDeckY(a) - 0.6), 27, graniteD);
	}
	// deck: roadway slabs, edge girders, steel floor beams
	const asphalt = srgb('#2b2c30'), girder = srgb('#6f6558');
	const STEP = 12;
	for (let s = -950; s < 950; s += STEP) {
		const y0 = brooklynDeckY(s), y1 = brooklynDeckY(s + STEP);
		if (y0 < 0.4 && y1 < 0.4) continue;
		const top = (t0: number, t1: number, dy: number, col: RGB, gg: Geo, th = 1.0) => {
			gg.quad([s, y0 + dy, t1], [s + STEP, y1 + dy, t1], [s + STEP, y1 + dy, t0], [s, y0 + dy, t0], col, 0, [[0, s / 0.3], [0, (s + STEP) / 0.3], [1, (s + STEP) / 0.3], [1, s / 0.3]]);
			gg.quad([s, y0 + dy - th, t0], [s + STEP, y1 + dy - th, t0], [s + STEP, y1 + dy - th, t1], [s, y0 + dy - th, t1], [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6]);
			gg.quad([s, y0 + dy - th, t1], [s + STEP, y1 + dy - th, t1], [s + STEP, y1 + dy, t1], [s, y0 + dy, t1], girder);
			gg.quad([s + STEP, y1 + dy - th, t0], [s, y0 + dy - th, t0], [s, y0 + dy, t0], [s + STEP, y1 + dy, t0], girder);
		};
		top(-13, -3.2, 0, asphalt, steel, 1.4);
		top(3.2, 13, 0, asphalt, steel, 1.4);
		if (Math.abs(s) < 540) {
			top(-2.4, 2.4, 3.6, srgb('#8a6a48'), wood, 0.35); // elevated wooden promenade
			for (const t of [-13, -3.3, 3.3, 13]) truss.quad([s, y0, t], [s + STEP, y1, t], [s + STEP, y1 + 2.8, t], [s, y0 + 2.8, t], srgb('#5f574c'), 0, [[0, 0], [4, 0], [4, 1], [0, 1]]);
			for (const t of [-2.4, 2.4]) {
				cable.beam([s, y0 + 4.7, t], [s + STEP, y1 + 4.7, t], 0.09, srgb('#3c3a38'));
				cable.beam([s, y0 + 4.15, t], [s + STEP, y1 + 4.15, t], 0.06, srgb('#3c3a38'));
				for (let k = 0; k < 4; k++) cable.beam([s + k * 3, y0 + 3.6 + ((y1 - y0) * k) / 4, t], [s + k * 3, y0 + 4.7 + ((y1 - y0) * k) / 4, t], 0.07, srgb('#3c3a38'));
			}
			steel.box(s, y0 + 1.6, 0, 0.5, 3.4, 6.4, girder); // promenade supports
			if (Math.round(s / STEP) % 3 === 0) {
				for (const t of [-2.2, 2.2]) {
					cable.beam([s, y0 + 3.6, t], [s, y0 + 7.4, t], 0.12, srgb('#2c2c2c'));
					lamps.sphere(s, y0 + 7.6, t, 0.3, 6, [1, 0.82, 0.55], 1);
				}
			}
		}
	}
	// main cables, suspenders and the diagonal stay web
	const cc = srgb('#55504a');
	const cableY = (s: number) => {
		const a = Math.abs(s);
		if (a <= 243) return 43.2 + (86.4 - 43.2) * (a / 243) ** 2;
		const u = (a - 243) / 284;
		return 86.4 + (22 - 86.4) * u - 26 * u * (1 - u);
	};
	for (const t of [-15.2, -4.6, 4.6, 15.2]) {
		const pts: number[][] = [];
		for (let s = -527; s <= 527; s += 6.5) pts.push([s, cableY(s), t]);
		pts.push([527, cableY(527), t]);
		cable.tube(pts, 0.42, cc);
		for (let s = -520; s <= 520; s += 6) {
			const cy = cableY(s), dy = brooklynDeckY(s) + 0.5;
			if (cy - dy > 1.5 && Math.abs(Math.abs(s) - 243) > 9) cable.beam([s, dy, t], [s, cy, t], 0.085, cc);
		}
		for (const ts of TOW) for (const dir of [-1, 1]) for (let k = 1; k <= 12; k++) {
			const s = ts + dir * (10 + k * 9.5);
			cable.beam([ts + dir * 7.6, 85.5, t], [s, brooklynDeckY(s) + 0.6, t], 0.075, cc);
		}
	}
	return {stone: stone.build(), steel: steel.build(), wood: wood.build(), cable: cable.build(), truss: truss.build(), lamps: lamps.build()};
};

const buildManhattanBridge = (ax: Axis) => {
	const steel = new Geo(), cable = new Geo(), truss = new Geo(), stone = new Geo(), lamps = new Geo();
	const M = bridgeMatrix(ax);
	for (const g of [steel, cable, truss, stone, lamps]) g.m.copy(M);
	const blue = srgb('#44688f'), blueD = srgb('#35527a'), blueL = srgb('#5d83ad');
	const TOW = [-224, 224];
	for (const ts of TOW) {
		const dk = manhattanDeckY(ts);
		stone.box(ts, 2, 0, 16, 10, 48, srgb('#8f8a80')); // granite pier at the waterline
		for (const t of [-13.5, 13.5]) {
			// each leg: four corner columns laced together
			for (const ds of [-2.6, 2.6]) for (const dt of [-2.2, 2.2]) steel.beam([ts + ds, 7, t + dt], [ts + ds * 0.72, 100, t + dt * 0.8], 1.0, blue);
			for (let y = 9; y < 98; y += 6.5) {
				const k = (y - 7) / 93, w = 2.6 * (1 - 0.28 * k), v = 2.2 * (1 - 0.2 * k);
				steel.box(ts, y, t, w * 2 + 0.6, 0.5, v * 2 + 0.6, blueD);
				cable.beam([ts - w, y, t + v], [ts + w, y + 6.5, t + v], 0.22, blueL);
				cable.beam([ts - w, y, t - v], [ts + w, y + 6.5, t - v], 0.22, blueL);
				cable.beam([ts + w, y, t - v], [ts + w, y + 6.5, t + v], 0.22, blueL);
				cable.beam([ts - w, y, t + v], [ts - w, y + 6.5, t - v], 0.22, blueL);
			}
			steel.sphere(ts, 103.2, t, 2.3, 10, blueL);
			steel.cyl(ts, 100, t, 2.9, 2.2, 2.2, 10, blueD);
		}
		// portal arch above the roadway + cross bracing
		const N = 14;
		for (let i = 0; i < N; i++) {
			const a0 = (i / N) * Math.PI, a1 = ((i + 1) / N) * Math.PI;
			steel.beam([ts, 86 + Math.sin(a0) * 9, Math.cos(a0) * 11.3], [ts, 86 + Math.sin(a1) * 9, Math.cos(a1) * 11.3], 1.2, blue, 0, 4.2);
		}
		steel.box(ts, 97.5, 0, 4.6, 3.2, 27, blue);
		steel.box(ts, 84.5, 0, 4.2, 1.6, 27, blueD);
		for (const [ya, yb] of [[8, 19]]) {
			truss.quad([ts - 1.5, ya, -11.3], [ts - 1.5, ya, 11.3], [ts - 1.5, yb, 11.3], [ts - 1.5, yb, -11.3], blue, 0, [[0, 0], [2, 0], [2, Math.max(1, Math.round((yb - ya) / 11))], [0, Math.max(1, Math.round((yb - ya) / 11))]]);
			truss.quad([ts + 1.5, ya, -11.3], [ts + 1.5, ya, 11.3], [ts + 1.5, yb, 11.3], [ts + 1.5, yb, -11.3], blue, 0, [[0, 0], [2, 0], [2, Math.max(1, Math.round((yb - ya) / 11))], [0, Math.max(1, Math.round((yb - ya) / 11))]]);
		}
		// leave the famous opening beneath the roadway clear (10 m .. deck-4 is laced only near the legs)
	}
	for (const sg of [-1, 1]) {
		stone.box(sg * 470, manhattanDeckY(470) / 2, 0, 52, manhattanDeckY(470) + 8, 44, srgb('#8f8a80'));
		for (let a = 520; a < 900; a += 42) stone.box(sg * a, manhattanDeckY(a) / 2 - 0.4, 0, 4, Math.max(1, manhattanDeckY(a) - 0.6), 34, srgb('#7d786f'));
	}
	const asphalt = srgb('#2b2c30');
	const STEP = 8;
	for (let s = -912; s < 912; s += STEP) {
		const y0 = manhattanDeckY(s), y1 = manhattanDeckY(s + STEP);
		if (y0 < 0.4 && y1 < 0.4) continue;
		const slab = (t0: number, t1: number, dy: number, th: number, col: RGB) => {
			steel.quad([s, y0 + dy, t1], [s + STEP, y1 + dy, t1], [s + STEP, y1 + dy, t0], [s, y0 + dy, t0], col);
			steel.quad([s, y0 + dy - th, t0], [s + STEP, y1 + dy - th, t0], [s + STEP, y1 + dy - th, t1], [s, y0 + dy - th, t1], blueD);
			steel.quad([s, y0 + dy - th, t1], [s + STEP, y1 + dy - th, t1], [s + STEP, y1 + dy, t1], [s, y0 + dy, t1], blue);
			steel.quad([s + STEP, y1 + dy - th, t0], [s, y0 + dy - th, t0], [s, y0 + dy, t0], [s + STEP, y1 + dy, t0], blue);
		};
		slab(-18, 18, 0, 1.2, asphalt); // lower deck: roadway + subway tracks
		if (Math.abs(s) < 470) {
			slab(-18, -7, 7.6, 0.8, asphalt); // upper roadways
			slab(7, 18, 7.6, 0.8, asphalt);
			for (const t of [-18, -7, 7, 18]) truss.quad([s, y0, t], [s + STEP, y1, t], [s + STEP, y1 + 7.6, t], [s, y0 + 7.6, t], blue, 0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
			if (Math.round(s / STEP) % 4 === 0) for (const t of [-17.5, 17.5]) {
				cable.beam([s, y0 + 7.6, t], [s, y0 + 12.5, t], 0.14, blueD);
				lamps.sphere(s, y0 + 12.8, t, 0.36, 6, [1, 0.84, 0.6], 1);
			}
		}
	}
	const cableY = (s: number) => {
		const a = Math.abs(s);
		if (a <= 224) return 46.5 + (101 - 46.5) * (a / 224) ** 2;
		const u = (a - 224) / 221;
		return 101 + (manhattanDeckY(445) + 9 - 101) * u - 16 * u * (1 - u);
	};
	for (const t of [-17.6, -7.4, 7.4, 17.6]) {
		const pts: number[][] = [];
		for (let s = -445; s <= 445; s += 6) pts.push([s, cableY(s), t]);
		pts.push([445, cableY(445), t]);
		cable.tube(pts, 0.55, blueL);
		for (let s = -440; s <= 440; s += 8) {
			const cy = cableY(s), dy = manhattanDeckY(s) + 7.6;
			if (cy - dy > 1.2 && Math.abs(Math.abs(s) - 224) > 5) cable.beam([s, dy, t], [s, cy, t], 0.1, blueL);
		}
	}
	return {steel: steel.build(), cable: cable.build(), truss: truss.build(), stone: stone.build(), lamps: lamps.build()};
};

// generic background bridges (Williamsburg suspension, Queensboro cantilever)
const buildSimpleBridge = (ax: Axis, t0: number, t1: number, c: number, kind: 'suspension' | 'cantilever') => {
	const steel = new Geo(), truss = new Geo(), cable = new Geo();
	const M = bridgeMatrix(ax);
	for (const g of [steel, truss, cable]) g.m.copy(M);
	const col = kind === 'suspension' ? srgb('#6d7682') : srgb('#8a7f6c');
	const deckY = (s: number) => Math.min(41, Math.max(0, Math.min(s - t0, t1 - s) / 9));
	const piers = kind === 'suspension' ? [c - 244, c + 244] : [c - 456, c - 96, c + 96, c + 396];
	const topY = (s: number) => {
		if (kind === 'suspension') return 9;
		let d = 1e9;
		for (const p of piers) d = Math.min(d, Math.abs(s - p));
		return 12 + 28 * Math.max(0, 1 - d / 150) ** 1.5;
	};
	const STEP = 12;
	for (let s = t0; s < t1; s += STEP) {
		const y0 = deckY(s), y1 = deckY(s + STEP);
		if (y0 < 0.5 && y1 < 0.5) continue;
		steel.quad([s, y0, 13], [s + STEP, y1, 13], [s + STEP, y1, -13], [s, y0, -13], srgb('#2b2c30'));
		steel.quad([s, y0 - 1.5, -13], [s + STEP, y1 - 1.5, -13], [s + STEP, y1 - 1.5, 13], [s, y0 - 1.5, 13], col);
		if (y0 > 30) for (const t of [-13, 13]) truss.quad([s, y0 - (kind === 'suspension' ? 6 : 0), t], [s + STEP, y1 - (kind === 'suspension' ? 6 : 0), t], [s + STEP, y1 + topY(s + STEP), t], [s, y0 + topY(s), t], col, 0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
	}
	for (const p of piers) {
		if (kind === 'suspension') {
			for (const t of [-12, 12]) { steel.box(p, 48, t, 5, 96, 4.5, col); }
			steel.box(p, 92, 0, 5, 5, 24, col);
			truss.quad([p, 46, -12], [p, 46, 12], [p, 90, 12], [p, 90, -12], col, 0, [[0, 0], [2, 0], [2, 4], [0, 4]]);
			steel.box(p, 3, 0, 14, 12, 40, srgb('#8f8a80'));
		} else {
			steel.box(p, 20, 0, 9, 40, 30, srgb('#9a9287'));
			for (const t of [-13, 13]) steel.beam([p, 41, t], [p, 41 + 44, t], 1.6, col);
		}
	}
	if (kind === 'suspension') {
		for (const t of [-12.5, 12.5]) {
			const pts: number[][] = [];
			for (let s = c - 244; s <= c + 244; s += 8) pts.push([s, 46 + 50 * ((s - c) / 244) ** 2, t]);
			cable.tube(pts, 0.5, col);
			cable.beam([c - 244, 96, t], [c - 244 - 180, 41, t], 0.5, col);
			cable.beam([c + 244, 96, t], [c + 244 + 180, 41, t], 0.5, col);
			for (let s = c - 236; s <= c + 236; s += 12) cable.beam([s, 50, t], [s, 46 + 50 * ((s - c) / 244) ** 2, t], 0.1, col);
		}
	}
	return {steel: steel.build(), truss: truss.build(), cable: cable.build()};
};

// subway train crossing the Manhattan Bridge
const buildTrain = () => {
	const g = new Geo();
	const silver = srgb('#aab0b6'), dark = srgb('#2a2d33');
	const L = 18.4;
	for (let c = 0; c < 8; c++) {
		const s = c * (L + 0.6);
		g.box(s + L / 2, 2.25, 0, L, 3.1, 3.0, silver, 0, srgb('#8d9298'));
		g.box(s + L / 2, 0.45, 0, L - 1, 0.6, 2.6, dark);
		for (const t of [-1.52, 1.52]) {
			g.box(s + L / 2, 2.75, t, L - 1.6, 0.95, 0.04, [1.0, 0.9, 0.68], 1); // window band
			g.box(s + L / 2, 1.75, t, L, 0.25, 0.05, srgb('#2f5fb0'));
		}
	}
	g.box(-0.02, 2.2, 0, 0.05, 1.2, 2.2, [1, 0.95, 0.8], 1.5);
	return g.build();
};

export const makeLandmarks = (world: World): System => {
	const city = world.city;
	const group = new THREE.Group();
	const add = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
		const m = new THREE.Mesh(geo, mat);
		if (shadow) m.layers.enable(1);
		m.matrixAutoUpdate = false;
		group.add(m);
		return m;
	};
	{
		const towers = new THREE.Mesh(buildTowers(city), world.gMat);
		towers.layers.set(1);
		towers.layers.enable(2);
		towers.matrixAutoUpdate = false;
		group.add(towers);
	}
	const steelMat = makePropMaterial({});
	const stoneMat = makePropMaterial({pattern: 'stone'});
	const woodMat = makePropMaterial({pattern: 'planks'});
	const trussMat = makePropMaterial({pattern: 'truss'});
	const cableMat = makePropMaterial({noShadow: true});
	const lampMat = makePropMaterial({emitDay: 0.0, emitNight: 9});
	const beaconMat = makePropMaterial({emitDay: 2.5, emitNight: 14});
	const blinkMat = makePropMaterial({emitDay: 4, emitNight: 22, blink: true});
	add(buildSpires(city), steelMat);
	add(buildBeacons(city, true), beaconMat, false);
	add(buildBeacons(city, false), blinkMat, false);
	group.add(buildChryslerCrown(city));

	const br = city.misc.bridges;
	// main-span centres from the known river crossings, axes from the OSM bridge ways
	const centre = (b: {cx: number; cz: number; dx: number; dz: number}, p: [number, number]): Axis => {
		const t = (p[0] - b.cx) * b.dx + (p[1] - b.cz) * b.dz;
		return {cx: b.cx + b.dx * t, cz: b.cz + b.dz * t, dx: b.dx, dz: b.dz};
	};
	const bbAxis = centre(br.brooklyn, P.bbridge);
	const mbAxis = centre(br.manhattan, P.mbridge);
	const bb = buildBrooklynBridge(bbAxis);
	add(bb.stone, stoneMat); add(bb.steel, steelMat); add(bb.wood, woodMat); add(bb.cable, cableMat, false); add(bb.truss, trussMat, false); add(bb.lamps, lampMat, false);
	const mb = buildManhattanBridge(mbAxis);
	add(mb.steel, steelMat); add(mb.cable, cableMat, false); add(mb.truss, trussMat, false); add(mb.stone, stoneMat); add(mb.lamps, lampMat, false);
	if (br.williamsburg) {
		const w = br.williamsburg;
		const c = (1140 - w.cx) * w.dx + (3876 - w.cz) * w.dz;
		const g = buildSimpleBridge(w, w.tmin, w.tmax, c, 'suspension');
		add(g.steel, steelMat); add(g.truss, trussMat, false); add(g.cable, cableMat, false);
	}
	if (br.queensboro) {
		const q = br.queensboro;
		const c = (2635 - q.cx) * q.dx + (-955 - q.cz) * q.dz;
		const g = buildSimpleBridge(q, q.tmin, q.tmax, c, 'cantilever');
		add(g.steel, steelMat); add(g.truss, trussMat, false); add(g.cable, cableMat, false);
	}
	// subway trains on the Manhattan Bridge (one each way)
	const trainMat = makePropMaterial({emitDay: 0.35, emitNight: 5});
	const trainGeo = buildTrain();
	const trains = [0, 1].map(() => {
		const m = new THREE.Mesh(trainGeo, trainMat);
		m.matrixAutoUpdate = false;
		m.frustumCulled = false;
		group.add(m);
		return m;
	});
	const mbM = bridgeMatrix(mbAxis);
	const local = new THREE.Matrix4();
	world.landmarks = {bbAxis, mbAxis};
	return {
		object: group,
		update(_frame, env) {
			const t = env.time;
			trains.forEach((m, i) => {
				const dir = i === 0 ? -1 : 1;
				// one train is mid-span during the DUMBO shot (5-10 s); both loop over the bridge
				const span = 1500;
				const s0 = i === 0 ? 150 + 7.5 * 15 : -420;
				let s = s0 + dir * t * 15;
				s = ((((s + span / 2) % span) + span) % span) - span / 2;
				const y = manhattanDeckY(s) + 0.3;
				const slope = (manhattanDeckY(s + 4) - manhattanDeckY(s - 4)) / 8;
				local.makeRotationZ(Math.atan(slope) * 1);
				if (dir > 0) local.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
				local.setPosition(s, y, i === 0 ? 13.2 : -13.2);
				m.matrix.multiplyMatrices(mbM, local);
				m.matrixWorld.copy(m.matrix);
				m.visible = y > 3;
			});
		},
	};
};
