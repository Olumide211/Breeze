import * as THREE from 'three';
import {Layout} from './layout';
import {easeInOutCubic, easeOutCubic, lerp, tween} from './timing';

/*
 * Centre line of a hand-bent glass "4", traced from the Google Sans Flex 500
 * "4" glyph (cap height 1432 units, normalised to height 1, y down):
 *   stem centre x = 842/1432 = 0.588, bar centre y = 1 - 396/1432 = 0.723,
 *   bar right end ≈ 0.735, diagonal centre line meets the bar at x ≈ 0.095.
 * One continuous tube: stem bottom (electrode) -> up the stem -> hairpin bend
 * at the apex -> down the diagonal -> bend -> along the crossbar (electrode).
 * The crossbar sits slightly in front of the stem (z) so the glass never
 * intersects itself, the way a real bender would cross a tube.
 */
const CX = 0.415; // bbox centre of the centre line
const CY = 0.495;
export const TUBE_RADIUS_PX = 23; // ~46px tube diameter on screen at 640px tall
export const REF_HEIGHT = 640;
export const TUBE_R = TUBE_RADIUS_PX / REF_HEIGHT; // in local units (height = 1)
export const BAR_Z = 0.085;
export const CAP_LEN = 0.058;

const g = (x: number, y: number, z = 0) => new THREE.Vector3(x - CX, -(y - CY), z);

const corner = (prev: THREE.Vector3, c: THREE.Vector3, next: THREE.Vector3, d: number) => {
	const a = c.clone().add(prev.clone().sub(c).normalize().multiplyScalar(d));
	const b = c.clone().add(next.clone().sub(c).normalize().multiplyScalar(d));
	return [a, b] as const;
};

export const buildFourCurve = () => {
	const S0 = g(0.588, 1.0);
	const A = g(0.588, -0.035); // apex (slightly above glyph top; the bend rounds it down)
	const B = g(0.095, 0.723, BAR_Z);
	const E = g(0.735, 0.723, BAR_Z);
	const [aIn, aOut] = corner(S0, A, B, 0.1);
	const [bIn, bOut] = corner(A, B, E, 0.085);
	aOut.z = 0;
	bIn.z = BAR_Z * 0.8;
	const path = new THREE.CurvePath<THREE.Vector3>();
	path.add(new THREE.LineCurve3(S0, aIn));
	path.add(new THREE.QuadraticBezierCurve3(aIn, A, aOut));
	path.add(new THREE.LineCurve3(aOut, bIn));
	path.add(new THREE.QuadraticBezierCurve3(bIn, B, bOut));
	path.add(new THREE.LineCurve3(bOut, E));
	return {path, start: S0, end: E, startTangent: new THREE.Vector3(0, 1, 0), endTangent: new THREE.Vector3(1, 0, 0)};
};

let cached: ReturnType<typeof buildFourCurve> | null = null;
export const fourCurve = () => (cached ??= buildFourCurve());

let cachedPts: THREE.Vector3[] | null = null;
export const fourSamples = () => (cachedPts ??= fourCurve().path.getSpacedPoints(260));

export type FourTransform = {x: number; y: number; h: number; rotY: number};

/** Where the hero "4" is at frame f (screen px, y down). */
export const fourTransform = (L: Layout, f: number): FourTransform => {
	const settle = tween(f, 564, 600, 0, 1, easeInOutCubic);
	const x = lerp(L.fourForm.x, L.fourFinal.x, settle);
	const y = lerp(L.fourForm.y, L.fourFinal.y, settle);
	const h = lerp(L.fourForm.h, L.fourFinal.h, settle) * lerp(0.965, 1, tween(f, 430, 520, 0, 1, easeOutCubic));
	// slow turn as it forms, settling to face camera; tiny calm sway in the hold
	const turn = lerp(-0.2, -0.07, tween(f, 430, 560, 0, 1, easeOutCubic));
	const rotY = lerp(turn, 0, settle) + 0.012 * Math.sin((f - 600) / 60) * tween(f, 600, 640);
	return {x, y, h, rotY};
};

/** Project a local point to screen px (orthographic camera, 1 unit = 1px). */
export const project = (p: THREE.Vector3, t: FourTransform): [number, number] => {
	const c = Math.cos(t.rotY);
	const s = Math.sin(t.rotY);
	const lx = p.x * c + p.z * s;
	return [t.x + lx * t.h, t.y - p.y * t.h];
};

export const projectedPolyline = (t: FourTransform) => fourSamples().map((p) => project(p, t));

/** Screen bbox of the tube (for the refraction-sweep mask). */
export const projectedBBox = (t: FourTransform) => {
	const pts = projectedPolyline(t);
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const [x, y] of pts) {
		x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
	}
	const r = TUBE_R * t.h + CAP_LEN * t.h;
	return {x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r};
};

/** Distance from a screen point to the projected centre line. */
export const distToFour = (px: number, py: number, pts: [number, number][]) => {
	let best = Infinity;
	for (let i = 0; i < pts.length; i += 2) {
		const dx = pts[i][0] - px;
		const dy = pts[i][1] - py;
		const d = dx * dx + dy * dy;
		if (d < best) best = d;
	}
	return Math.sqrt(best);
};
