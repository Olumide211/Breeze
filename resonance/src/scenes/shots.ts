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
		// push along the sunset direction (sun azimuth ~257 degrees)
		const d: [number, number] = [-0.974, 0.225];
		const n: [number, number] = [-d[1], d[0]];
		const inRing = (b: Building, x: number, z: number) => {
			let inside = false;
			for (let i = 0, j = b.n - 1; i < b.n; j = i++) {
				const xi = b.ring[i * 2], zi = b.ring[i * 2 + 1], xj = b.ring[j * 2], zj = b.ring[j * 2 + 1];
				if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
			}
			return inside;
		};
		// A usable roof has a clear strip (17 m wide) of solid roof running along the push direction,
		// ending at the roof edge that faces the sunset: camera, water towers and figure all stand on it.
		let HALF = 8.5;
		const strip = (b: Building): [number, number] | null => {
			const ok = (t: number) => {
				for (let l = -HALF; l <= HALF; l += 2.125) if (!inRing(b, b.cx + d[0] * t + n[0] * l, b.cz + d[1] * t + n[1] * l)) return false;
				return true;
			};
			let best: [number, number] | null = null;
			let start: number | null = null;
			for (let t = -b.r; t <= b.r + 0.5; t += 0.5) {
				const o = t <= b.r && ok(t);
				if (o && start === null) start = t;
				if (!o && start !== null) {
					if (!best || t - 0.5 - start > best[1] - best[0]) best = [start, t - 0.5];
					start = null;
				}
			}
			return best;
		};
		let best: Building | null = null, bestScore = -1e9, bestStrip: [number, number] = [0, 0];
		// relax the strip width / region step by step until a real roof qualifies
		for (const [half, minLen, grow] of [[8.5, 24, 0], [7, 22, 0], [6, 20, 200], [5.5, 18, 500]] as const) {
			HALF = half;
			for (const b of city.buildings) {
				if (b.minH > 1 || b.kind > 1 || b.h < 40 || b.h > 90 || b.area < 500 || b.area > 6000) continue;
				if (b.cx < 380 - grow || b.cx > 1250 + grow || b.cz < -250 - grow || b.cz > 750 + grow) continue;
				const st = strip(b);
				if (!st || st[1] - st[0] < minLen) continue;
				// the far end of the strip must be the real roof edge with open air beyond it
				const ex = b.cx + d[0] * (st[1] + 6), ez = b.cz + d[1] * (st[1] + 6);
				if (city.heightAt(ex, ez, 2) > b.h - 6) continue;
				let block = 0;
				for (const o of city.near(b.cx + d[0] * 130, b.cz + d[1] * 130, 140)) if (o !== b && o.h > b.h + 2) block += o.h - b.h;
				const score = -block + Math.min(st[1] - st[0], 40) * 2 + hs(b.seed, 5) * 3;
				if (score > bestScore) { bestScore = score; best = b; bestStrip = st; }
			}
			if (best) break;
		}
		console.warn(`[hero roof] ${best ? `h=${best.h.toFixed(0)} m, strip ${(bestStrip[1] - bestStrip[0]).toFixed(0)} m x ${HALF * 2} m, score ${bestScore.toFixed(0)}` : 'none found'}`);
		hero.roof = best;
		if (best) {
			const b = best;
			const y = b.roofY;
			const [t0, t1] = bestStrip;
			const L = t1 - t0;
			const pt = (t: number, side: number, h: number): V3 => [b.cx + d[0] * (t0 + t) + n[0] * side, y + h, b.cz + d[1] * (t0 + t) + n[1] * side];
			hero.dir = d;
			const run = Math.min(L * 0.5, 15);
			const startT = Math.max(1.5, L - run - 13);
			hero.figure = pt(L - 1.3, 1.3, 0);
			const off = HALF - 2.4;
			hero.towers = [pt(startT + run * 0.5, -off - 0.4, 0), pt(startT + run + 4.5, off + 0.2, 0)];
			s.pos = [pt(startT, 0.5, 3.2), pt(startT + run * 0.35, 0.3, 2.9), pt(startT + run * 0.7, 0.1, 2.7), pt(startT + run, -0.1, 2.5)];
			s.look = [pt(L + 70, 2.4, 5), pt(L + 70, 2.0, 4.4), pt(L + 70, 1.6, 3.8), pt(L + 70, 1.3, 3.4)];
		}
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
