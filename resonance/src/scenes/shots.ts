// Fills in the camera paths that depend on the real OSM layout:
// the 5th Avenue canyon run, the Chrysler orbit, the rooftop push and the Times Square dive.
import type {Building, City} from '../city/data';
import {hs} from '../lib/rng';
import {CROSS, P, resetPaths, SHOTS, UP, type V3} from '../timeline';

// mean crosstown offset (relative to the origin) of a named avenue
export const avenueOffset = (city: City, name: RegExp, fallback: number, upMin = -1e9, upMax = 1e9): number => {
	let sum = 0, n = 0;
	for (const r of city.roads) {
		if (!name.test(r.name)) continue;
		for (let i = 0; i < r.n; i++) {
			const x = r.pts[i * 2], z = r.pts[i * 2 + 1];
			const up = x * UP[0] + z * UP[1];
			if (up < upMin || up > upMax) continue;
			sum += x * CROSS[0] + z * CROSS[1];
			n++;
		}
	}
	return n > 3 ? sum / n : fallback;
};
const at = (up: number, cross: number, y: number): V3 => [UP[0] * up + CROSS[0] * cross, y, UP[1] * up + CROSS[1] * cross];

export type Hero = {roof: Building | null; figure: V3; towers: V3[]; dir: [number, number]};
export const hero: Hero = {roof: null, figure: [0, 0, 0], towers: [], dir: [-1, 0]};

export const buildShots = (city: City) => {
	const byId = Object.fromEntries(SHOTS.map((s) => [s.id, s]));
	// --- 03: down the 5th Avenue canyon towards the Empire State ---
	const c5 = avenueOffset(city, /^5th Avenue$/i, 75, 300, 1900);
	{
		const s = byId['03-fifth'];
		s.pos = [at(1560, c5 + 3, 92), at(1240, c5 - 2, 70), at(930, c5 + 2, 52), at(640, c5 - 1, 44), at(400, c5 + 1, 46)];
		s.look = [at(1160, c5, 62), at(840, c5, 50), at(540, c5, 46), at(260, c5 - 6, 70), at(60, c5 - 30, 150)];
	}
	// --- 02: over DUMBO on the line Empire State -> Manhattan Bridge tower (the classic framing) ---
	{
		const s = byId['02-dumbo'];
		const b = city.misc.bridges.manhattan;
		const t0 = (P.mbridge[0] - b.cx) * b.dx + (P.mbridge[1] - b.cz) * b.dz + 224;
		const T: [number, number] = [b.cx + b.dx * t0, b.cz + b.dz * t0]; // Brooklyn tower
		const E = city.misc.sites.esb ?? P.esb;
		const l = Math.hypot(T[0] - E[0], T[1] - E[1]);
		const d: [number, number] = [(T[0] - E[0]) / l, (T[1] - E[1]) / l];
		// skim the rooftops: clear the tallest roof in the flight corridor by a safe margin
		let roof = 0;
		for (let k = 250; k <= 520; k += 6) for (const off of [-14, 0, 14]) roof = Math.max(roof, city.heightAt(T[0] + d[0] * k - d[1] * off, T[1] + d[1] * k + d[0] * off, 6));
		const base = Math.min(Math.max(roof + 9, 40), 82);
		const H = [base + 5, base + 3, base + 1, base];
		s.pos = [500, 440, 385, 335].map((k, i) => [T[0] + d[0] * k, H[i], T[1] + d[1] * k] as V3);
		s.look = [0, 1, 2, 3].map((i) => [E[0], 250 + i * 6, E[1]] as V3);
	}
	// --- 04: orbit around the Chrysler crown ---
	{
		const s = byId['04-chrysler'];
		const [cx, cz] = P.chrysler;
		s.pos = []; s.look = [];
		for (let i = 0; i < 6; i++) {
			const k = i / 5;
			const a = ((118 + k * 62) * Math.PI) / 180; // bearing of the camera from the tower
			const r = 250 - k * 22;
			s.pos.push([cx + Math.sin(a) * r, 262 + k * 16, cz - Math.cos(a) * r]);
			s.look.push([cx, 268 + k * 4, cz]);
		}
	}
	// --- 06: rooftop push past water towers to a lone figure ---
	{
		const s = byId['06-rooftop'];
		// find a broad pre-war roof east of the Empire State with an open view to the west
		let best: Building | null = null, bestScore = -1e9;
		for (const b of city.buildings) {
			if (b.minH > 1 || b.kind > 1 || b.h < 46 || b.h > 80 || b.area < 700 || b.area > 3000) continue;
			if (b.cx < 380 || b.cx > 1150 || b.cz < -150 || b.cz > 650) continue;
			let block = 0;
			for (const o of city.near(b.cx - 120, b.cz + 30, 130)) if (o !== b && o.h > b.h + 2) block += o.h - b.h;
			const score = -block + b.area * 0.01 + hs(b.seed, 5) * 3;
			if (score > bestScore) { bestScore = score; best = b; }
		}
		hero.roof = best;
		const b = best!;
		const y = b.roofY;
		// push along the sunset direction (sun azimuth ~257 degrees)
		const d: [number, number] = [-0.974, 0.225];
		const n: [number, number] = [-d[1], d[0]];
		const ext = (dir: [number, number]) => {
			let mn = 1e9, mx = -1e9;
			for (let i = 0; i < b.n; i++) { const t = (b.ring[i * 2] - b.cx) * dir[0] + (b.ring[i * 2 + 1] - b.cz) * dir[1]; mn = Math.min(mn, t); mx = Math.max(mx, t); }
			return [mn, mx];
		};
		const [t0, t1] = ext(d);
		const L = t1 - t0;
		const pt = (t: number, side: number, h: number): V3 => [b.cx + d[0] * (t0 + t) + n[0] * side, y + h, b.cz + d[1] * (t0 + t) + n[1] * side];
		hero.dir = d;
		const run0 = Math.min(L * 0.5, 16);
		hero.figure = pt(Math.min(L - 1.5, L * 0.08 + run0 + 7.5), 1.5, 0);
		hero.towers = [pt(L * 0.42, -6.5, 0), pt(L * 0.55, 7.5, 0), pt(L * 0.2, 5.0, 0)];
		const run = Math.min(L * 0.5, 16);
		s.pos = [pt(L * 0.08, 0.4, 3.3), pt(L * 0.08 + run * 0.35, 0.2, 2.9), pt(L * 0.08 + run * 0.7, 0.0, 2.6), pt(L * 0.08 + run, -0.2, 2.4)];
		s.look = [pt(L + 60, 3, 4), pt(L + 60, 2.5, 3.6), pt(L + 60, 2, 3.2), pt(L + 60, 1.6, 3.0)];
	}
	// --- 08: dive into Times Square ---
	{
		const s = byId['08-timessquare'];
		const upTS = P.timesSq[0] * UP[0] + P.timesSq[1] * UP[1];
		const c7 = avenueOffset(city, /^7th Avenue$/i, P.timesSq[0] * CROSS[0] + P.timesSq[1] * CROSS[1], upTS - 300, upTS + 400);
		s.pos = [at(upTS + 420, c7 + 6, 210), at(upTS + 300, c7 + 3, 120), at(upTS + 190, c7, 52), at(upTS + 90, c7 - 2, 20), at(upTS - 10, c7 - 1, 10), at(upTS - 110, c7 + 1, 8.5)];
		s.look = [at(upTS + 180, c7, 20), at(upTS + 90, c7, 16), at(upTS - 10, c7, 16), at(upTS - 110, c7, 15), at(upTS - 210, c7, 14), at(upTS - 320, c7, 14)];
	}
	resetPaths();
};
