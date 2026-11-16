// Deterministic randomness. Nothing in this project may call Math.random or Date.now:
// every value is derived from seedrandom streams or integer hashes of object ids / frame numbers.
import seedrandom from 'seedrandom';

export type Rng = () => number;
export const rng = (seed: string | number): Rng => seedrandom(String(seed));

// stateless 32-bit integer hash -> [0,1)
export const hash1 = (n: number): number => {
	let h = (n | 0) ^ 0x9e3779b9;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const hash2 = (a: number, b: number): number => hash1((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) | 0);
export const hash3 = (a: number, b: number, c: number): number => hash1((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) | 0);
// hash of a float seed in [0,1) plus a channel index
export const hs = (seed: number, k: number): number => hash2(Math.floor(seed * 16777216), k);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a));
	return t * t * (3 - 2 * t);
};
