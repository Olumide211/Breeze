// Loads the cached, pre-projected OSM city (public/city) and exposes lookup helpers.
import {staticFile} from 'remotion';
import * as THREE from 'three';
import {hs} from '../lib/rng';

export type Building = {
	ring: Float32Array; // x,z pairs, metres
	n: number;
	h: number;
	minH: number;
	seed: number;
	church: boolean;
	cx: number;
	cz: number;
	area: number;
	kind: number; // 0 brick, 1 limestone, 2 glass, 3 concrete
	roofY: number;
	r: number; // bounding radius
};
export type Road = {
	pts: Float32Array;
	n: number;
	cls: number; // 0 motorway, 1 primary, 2 secondary, 3 tertiary, 4 residential, 5 pedestrian
	width: number;
	oneway: boolean;
	name: string;
	inter: number[];
	cum: Float32Array; // cumulative length per point
	len: number;
};
export type Misc = {
	mask: {x0: number; z0: number; px: number; w: number; h: number};
	sites: Record<string, [number, number]>;
	bridges: Record<string, {cx: number; cz: number; dx: number; dz: number; tmin: number; tmax: number}>;
	roadNames: string[];
	trees: number[];
	signals: number[];
	crossings: number[];
	subways: number[];
};
export type City = {
	buildings: Building[];
	roads: Road[];
	misc: Misc;
	maskData: Uint8ClampedArray;
	maskTex: THREE.Texture;
	maskAt: (x: number, z: number) => [number, number, number];
	heightAt: (x: number, z: number, margin?: number) => number;
	near: (x: number, z: number, r: number) => Building[];
	roadPoint: (r: Road, s: number, out: {x: number; z: number; dx: number; dz: number}) => void;
};

export const BAY_W = [2.2, 2.6, 1.6, 3.0, 2.0];
export const FLOOR_H = 3.4;

const kindOf = (h: number, area: number, seed: number): number => {
	const r = hs(seed, 11);
	if (h < 28) return r < 0.7 ? 0 : r < 0.92 ? 1 : 3;
	if (h < 80) return r < 0.3 ? 0 : r < 0.68 ? 1 : r < 0.84 ? 3 : 2;
	if (h < 160) return r < 0.3 ? 1 : r < 0.5 ? 3 : 2;
	return r < 0.22 ? 1 : 2;
};

const pointInRing = (x: number, z: number, ring: Float32Array, n: number) => {
	let inside = false;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = ring[i * 2], zi = ring[i * 2 + 1], xj = ring[j * 2], zj = ring[j * 2 + 1];
		if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
	}
	return inside;
};

export const loadCity = async (): Promise<City> => {
	const [bBuf, rBuf, misc, img] = await Promise.all([
		fetch(staticFile('city/buildings.bin')).then((r) => r.arrayBuffer()),
		fetch(staticFile('city/roads.bin')).then((r) => r.arrayBuffer()),
		fetch(staticFile('city/misc.json')).then((r) => r.json() as Promise<Misc>),
		new Promise<HTMLImageElement>((res, rej) => {
			const im = new Image();
			im.onload = () => res(im);
			im.onerror = rej;
			im.src = staticFile('city/mask.png');
		}),
	]);
	const bf = new Float32Array(bBuf);
	const buildings: Building[] = [];
	let o = 0;
	const nb = bf[o++];
	for (let i = 0; i < nb; i++) {
		const n = bf[o++], h = bf[o++], minH = bf[o++], seed = bf[o++], church = bf[o++] > 0.5;
		const ring = bf.subarray(o, o + n * 2);
		o += n * 2;
		let cx = 0, cz = 0, area = 0;
		for (let k = 0; k < n; k++) {
			cx += ring[k * 2]; cz += ring[k * 2 + 1];
			const j = (k + 1) % n;
			area += ring[k * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[k * 2 + 1];
		}
		cx /= n; cz /= n; area = Math.abs(area / 2);
		let r = 0;
		for (let k = 0; k < n; k++) r = Math.max(r, Math.hypot(ring[k * 2] - cx, ring[k * 2 + 1] - cz));
		let onBridge = false;
		for (const k of ['brooklyn', 'manhattan', 'williamsburg', 'queensboro']) {
			const b = misc.bridges[k];
			if (!b) continue;
			const t = (cx - b.cx) * b.dx + (cz - b.cz) * b.dz, l = Math.abs(-(cx - b.cx) * b.dz + (cz - b.cz) * b.dx);
			if (t > b.tmin && t < b.tmax && l < 30 && h > 40) onBridge = true;
		}
		if (onBridge) continue;
		const kind = minH > 1 ? (h > 120 ? 2 : 1) : kindOf(h, area, seed);
		const parapet = kind < 2 && h - minH > 9 && area > 60 ? 1.0 : 0.0;
		buildings.push({ring, n, h, minH, seed, church, cx, cz, area, kind, roofY: h - parapet, r});
	}
	const rf = new Float32Array(rBuf);
	const roads: Road[] = [];
	o = 0;
	const nr = rf[o++];
	for (let i = 0; i < nr; i++) {
		const n = rf[o++], cls = rf[o++], width = rf[o++], oneway = rf[o++] > 0.5, ni = rf[o++], nInter = rf[o++];
		const pts = rf.subarray(o, o + n * 2);
		o += n * 2;
		const inter = Array.from(rf.subarray(o, o + nInter));
		o += nInter;
		const cum = new Float32Array(n);
		for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
		roads.push({pts, n, cls, width, oneway, name: ni >= 0 ? misc.roadNames[ni] : '', inter, cum, len: cum[n - 1]});
	}
	// mask pixels
	const cv = document.createElement('canvas');
	cv.width = img.width; cv.height = img.height;
	const ctx = cv.getContext('2d', {willReadFrequently: true})!;
	ctx.drawImage(img, 0, 0);
	const maskData = ctx.getImageData(0, 0, img.width, img.height).data;
	const maskTex = new THREE.DataTexture(new Uint8Array(maskData.buffer), img.width, img.height, THREE.RGBAFormat);
	maskTex.minFilter = THREE.LinearFilter;
	maskTex.magFilter = THREE.LinearFilter;
	maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping;
	maskTex.needsUpdate = true;
	const M = misc.mask;
	const maskAt = (x: number, z: number): [number, number, number] => {
		const px = Math.min(M.w - 1, Math.max(0, Math.floor((x - M.x0) / M.px)));
		const py = Math.min(M.h - 1, Math.max(0, Math.floor((z - M.z0) / M.px)));
		const i = (py * M.w + px) * 4;
		return [maskData[i] / 255, maskData[i + 1] / 255, maskData[i + 2] / 255];
	};
	// spatial hash for building queries
	const CELL = 80;
	const gridMap = new Map<number, Building[]>();
	const gk = (gx: number, gz: number) => (gx + 512) * 4096 + (gz + 512);
	for (const b of buildings) {
		const x0 = Math.floor((b.cx - b.r) / CELL), x1 = Math.floor((b.cx + b.r) / CELL), z0 = Math.floor((b.cz - b.r) / CELL), z1 = Math.floor((b.cz + b.r) / CELL);
		for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
			const k = gk(gx, gz);
			let a = gridMap.get(k);
			if (!a) gridMap.set(k, (a = []));
			a.push(b);
		}
	}
	const near = (x: number, z: number, r: number) => {
		const out = new Set<Building>();
		for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
			for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) for (const b of gridMap.get(gk(gx, gz)) || []) if (Math.hypot(b.cx - x, b.cz - z) < r + b.r) out.add(b);
		return [...out];
	};
	const heightAt = (x: number, z: number, margin = 0) => {
		let h = 0;
		for (const b of gridMap.get(gk(Math.floor(x / CELL), Math.floor(z / CELL))) || []) {
			if (b.h <= h || b.minH > 1) continue;
			if (Math.hypot(b.cx - x, b.cz - z) > b.r + margin) continue;
			if (pointInRing(x, z, b.ring, b.n)) h = b.h;
			else if (margin > 0) {
				for (let k = 0; k < 8; k++) {
					const a = (k / 8) * Math.PI * 2;
					if (pointInRing(x + Math.cos(a) * margin, z + Math.sin(a) * margin, b.ring, b.n)) { h = b.h; break; }
				}
			}
		}
		return h;
	};
	const roadPoint = (r: Road, s: number, out: {x: number; z: number; dx: number; dz: number}) => {
		s = Math.min(Math.max(s, 0), r.len);
		let lo = 0, hi = r.n - 1;
		while (hi - lo > 1) {
			const m = (lo + hi) >> 1;
			if (r.cum[m] <= s) lo = m; else hi = m;
		}
		const seg = r.cum[hi] - r.cum[lo] || 1;
		const t = (s - r.cum[lo]) / seg;
		const ax = r.pts[lo * 2], az = r.pts[lo * 2 + 1], bx = r.pts[hi * 2], bz = r.pts[hi * 2 + 1];
		out.x = ax + (bx - ax) * t; out.z = az + (bz - az) * t;
		out.dx = (bx - ax) / seg; out.dz = (bz - az) / seg;
	};
	return {buildings, roads, misc, maskData, maskTex, maskAt, heightAt, near, roadPoint};
};
