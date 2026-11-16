// Shot list, camera splines and the dawn -> night colour script.
// Everything is a pure function of the (fractional) frame number.
import * as THREE from 'three';
import {clamp, lerp, smooth} from './lib/rng';

export const FPS = 60;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const DURATION = 48 * FPS;

// Manhattan street grid: avenues run 29 degrees east of north.
const GA = (29 * Math.PI) / 180;
export const UP: [number, number] = [Math.sin(GA), -Math.cos(GA)]; // uptown (x,z)
export const CROSS: [number, number] = [Math.cos(GA), Math.sin(GA)]; // towards the East River
// helper: position from a base point plus (uptown, crosstown) metres
export const grid = (bx: number, bz: number, up: number, cross: number): [number, number] => [bx + UP[0] * up + CROSS[0] * cross, bz + UP[1] * up + CROSS[1] * cross];

export type V3 = [number, number, number];
export type Shot = {
	id: string;
	start: number; // seconds
	end: number;
	tod: [number, number];
	pos: V3[];
	look: V3[];
	fov: [number, number];
	ease?: number; // 0 = linear travel, 1 = full ease in/out
	roll?: [number, number];
	sunAz?: [number, number]; // degrees clockwise from north, overrides the colour script
	sunEl?: [number, number];
	near: number;
	far: number;
	shadowRange: number;
	lodNear: number; // radius (m) around the camera path that gets full-detail facades
	propRange: number; // radius around the path where street/roof props exist
	reflect?: boolean; // planar reflections (water / wet streets)
	rain?: number;
	wet?: number;
	mist?: number;
	fogMul?: number;
	cloudCover?: number;
	focus?: [number, number]; // focus distance metres
	dof?: number; // bokeh scale
	grade: {sat: number; contrast: number; lift: V3; gain: V3; bloom: number; leak: number; exposure: number};
	flashIn?: number; // seconds of white flash at the head of the shot
	whipOut?: number; // seconds of whip-pan at the tail
	whipIn?: number;
};

const G = (sat: number, contrast: number, lift: V3, gain: V3, bloom: number, leak: number, exposure: number) => ({sat, contrast, lift, gain, bloom, leak, exposure});

// Key places in local metres (x east, z south). Derived from lat/lon in scripts/build-city.mjs.
export const P = {
	esb: [0, 0] as [number, number],
	chrysler: [872, -356] as [number, number],
	wtc: [-2321, 3931] as [number, number],
	flatiron: [-338, 815] as [number, number],
	timesSq: [17, -1066] as [number, number],
	bbridge: [-946, 4697] as [number, number],
	mbridge: [-431, 4542] as [number, number],
	cpSouth: [777, -1943] as [number, number],
};

// The camera paths below were tuned against the real OSM layout during the QA loop.
export const SHOTS: Shot[] = [
	{
		id: '01-dawn', start: 0, end: 5, tod: [0.0, 0.075],
		// rising off the East River, Brooklyn Bridge towers against the sunrise
		pos: [[-1302, 3.5, 4612], [-1296, 13, 4613], [-1287, 27, 4616], [-1276, 41, 4620]],
		look: [[-900, 34, 4690], [-900, 42, 4692], [-900, 50, 4695], [-900, 57, 4698]],
		fov: [46, 43], ease: 0.5, sunAz: [117, 118], sunEl: [-1.2, 4.2],
		near: 1, far: 30000, shadowRange: 2500, lodNear: 500, propRange: 700, reflect: true, mist: 1, fogMul: 1.5, cloudCover: 0.33,
		focus: [420, 420], dof: 1.0,
		grade: G(1.12, 1.04, [0.012, 0.0, 0.03], [1.04, 0.98, 1.0], 1.15, 0.5, 1.0),
	},
	{
		id: '02-dumbo', start: 5, end: 10, tod: [0.12, 0.16],
		// low glide up Washington Street, Manhattan Bridge framing the Empire State
		pos: [], look: [], // on the Empire State -> bridge tower line, see buildShots()
		fov: [21, 18], ease: 0.2,
		near: 0.6, far: 30000, shadowRange: 1800, lodNear: 600, propRange: 700, reflect: false, cloudCover: 0.35,
		focus: [600, 600], dof: 0.0,
		grade: G(1.14, 1.05, [0.0, 0.005, 0.015], [1.02, 1.0, 0.98], 0.9, 0.25, 1.0),
	},
	{
		id: '03-fifth', start: 10, end: 16, tod: [0.3, 0.34],
		// filled in by buildFifthAvenuePath() from the real 5th Avenue centreline
		pos: [], look: [],
		fov: [62, 58], ease: 0.0,
		near: 0.8, far: 30000, shadowRange: 2200, lodNear: 420, propRange: 520, cloudCover: 0.39,
		focus: [400, 400], dof: 0.0,
		grade: G(1.2, 1.06, [0.0, 0.004, 0.012], [1.0, 1.0, 1.02], 0.8, 0.12, 1.0),
		whipOut: 0.22,
	},
	{
		id: '04-chrysler', start: 16, end: 21, tod: [0.4, 0.44],
		pos: [], look: [], // orbit generated in buildShots()
		fov: [34, 32], ease: 0.0,
		near: 2, far: 40000, shadowRange: 3000, lodNear: 500, propRange: 500, cloudCover: 0.43,
		focus: [230, 230], dof: 1.0, sunAz: [150, 153], sunEl: [52, 50],
		grade: G(1.22, 1.05, [0.0, 0.003, 0.012], [1.0, 1.0, 1.03], 0.95, 0.15, 1.0),
		whipIn: 0.22,
	},
	{
		id: '05-park', start: 21, end: 26, tod: [0.565, 0.6],
		// over Central Park's autumn canopy toward Billionaires' Row
		pos: [[1560, 150, -3520], [1420, 132, -3260], [1270, 118, -2990], [1130, 108, -2740]],
		look: [[640, 180, -1700], [640, 185, -1700], [650, 190, -1700], [660, 196, -1700]],
		fov: [44, 40], ease: 0.15, sunAz: [248, 250], sunEl: [10.5, 8.5],
		near: 2, far: 40000, shadowRange: 3500, lodNear: 500, propRange: 900, cloudCover: 0.39,
		focus: [900, 800], dof: 0.6,
		grade: G(1.18, 1.06, [0.02, 0.006, 0.0], [1.06, 1.0, 0.94], 1.2, 0.6, 1.0), flashIn: 0.2,
	},
	{
		id: '06-rooftop', start: 26, end: 31, tod: [0.645, 0.69],
		pos: [], look: [], // placed on a real rooftop by buildShots()
		fov: [40, 36], ease: 0.3, sunAz: [257, 258], sunEl: [4.6, 1.2],
		near: 0.4, far: 40000, shadowRange: 1600, lodNear: 500, propRange: 600, cloudCover: 0.39,
		focus: [30, 46], dof: 2.2,
		grade: G(1.16, 1.08, [0.03, 0.004, 0.012], [1.08, 0.98, 0.92], 1.35, 0.8, 1.0),
	},
	{
		id: '07-bluehour', start: 31, end: 36, tod: [0.715, 0.86],
		// wide skyline time-lapse from across the East River
		pos: [[2950, 46, 1250], [2990, 50, 1120], [3030, 55, 990], [3070, 60, 860]],
		look: [[300, 130, 150], [300, 132, 120], [300, 134, 90], [300, 136, 60]],
		fov: [36, 34], ease: 0.2, sunAz: [262, 268], sunEl: [-2.5, -16],
		near: 3, far: 40000, shadowRange: 6000, lodNear: 0, propRange: 0, reflect: true, cloudCover: 0.37,
		focus: [2800, 2800], dof: 0.0,
		grade: G(1.2, 1.05, [0.0, 0.004, 0.03], [0.98, 1.0, 1.06], 1.25, 0.2, 1.0),
	},
	{
		id: '08-timessquare', start: 36, end: 42, tod: [0.93, 0.94],
		pos: [], look: [], // dive generated in buildShots()
		fov: [52, 46], ease: 0.35,
		near: 0.4, far: 20000, shadowRange: 0, lodNear: 520, propRange: 620, reflect: true, rain: 1, wet: 1, fogMul: 2.2, cloudCover: 0.58,
		focus: [260, 45], dof: 1.0,
		grade: G(1.25, 1.08, [0.012, 0.0, 0.03], [1.02, 0.98, 1.06], 1.5, 0.35, 1.05),
		flashIn: 0.18,
	},
	{
		id: '09-aerial', start: 42, end: 48, tod: [0.96, 1.0],
		pos: [[-700, 300, 2300], [-560, 520, 1900], [-380, 820, 1380], [-160, 1180, 760], [60, 1500, 200]],
		look: [[-1500, 200, 3600], [-1560, 180, 3650], [-1640, 150, 3700], [-1700, 120, 3740], [-1760, 90, 3780]],
		fov: [42, 46], ease: 0.3,
		near: 5, far: 50000, shadowRange: 0, lodNear: 0, propRange: 0, reflect: false, cloudCover: 0.33, fogMul: 0.8,
		focus: [3000, 3000], dof: 0.0,
		grade: G(1.22, 1.06, [0.004, 0.0, 0.03], [1.0, 1.0, 1.08], 1.3, 0.2, 1.05),
	},
];

export const TITLE_START = 45.6 * FPS; // title overlays the tail of the aerial

export const shotIndexAt = (frame: number): number => {
	const s = frame / FPS;
	for (let i = SHOTS.length - 1; i >= 0; i--) if (s >= SHOTS[i].start) return i;
	return 0;
};

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------
type Path = {pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3};
const paths = new Map<string, Path>();
const curve = (pts: V3[]) => {
	const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
	c.arcLengthDivisions = 600;
	return c;
};
export const getPath = (shot: Shot): Path => {
	let p = paths.get(shot.id);
	if (!p) {
		p = {pos: curve(shot.pos), look: curve(shot.look)};
		paths.set(shot.id, p);
	}
	return p;
};
export const resetPaths = () => paths.clear();

export type CamState = {pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number};
const easeU = (u: number, k: number) => lerp(u, u * u * (3 - 2 * u), k);

export const cameraAt = (frame: number, out?: CamState): CamState => {
	const si = shotIndexAt(frame);
	const shot = SHOTS[si];
	const u0 = clamp((frame / FPS - shot.start) / (shot.end - shot.start));
	const u = easeU(u0, shot.ease ?? 0.2);
	const path = getPath(shot);
	const o = out ?? {pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0};
	path.pos.getPointAt(u, o.pos);
	path.look.getPointAt(u, o.look);
	o.fov = lerp(shot.fov[0], shot.fov[1], u);
	o.roll = shot.roll ? lerp(shot.roll[0], shot.roll[1], u) : 0;
	// whip-pan transitions: a fast eased yaw swing that the motion blur smears
	const tIn = frame / FPS - shot.start;
	const tOut = shot.end - frame / FPS;
	let yaw = 0;
	if (shot.whipOut && tOut < shot.whipOut) {
		const k = 1 - tOut / shot.whipOut;
		yaw = k * k * k * 1.15;
	}
	if (shot.whipIn && tIn < shot.whipIn) {
		const k = 1 - tIn / shot.whipIn;
		yaw = -k * k * k * 1.15;
	}
	if (yaw !== 0) {
		const dx = o.look.x - o.pos.x, dz = o.look.z - o.pos.z;
		const c = Math.cos(yaw), s = Math.sin(yaw);
		o.look.x = o.pos.x + dx * c - dz * s;
		o.look.z = o.pos.z + dx * s + dz * c;
	}
	return o;
};

// ---------------------------------------------------------------------------
// colour script
// ---------------------------------------------------------------------------
const lin = (hex: string, m = 1): V3 => {
	const c = new THREE.Color(hex); // sRGB hex -> linear working space
	return [c.r * m, c.g * m, c.b * m];
};
type Key = {
	t: number; zen: V3; mid: V3; hor: V3; glow: V3; sun: V3; ambS: V3; ambG: V3; rim: V3; cloudL: V3; cloudS: V3; water: V3;
	fog: number; night: number; stars: number; el: number; az: number;
};
const K = (t: number, zen: string, mid: string, hor: string, glow: [string, number], sun: [string, number], ambS: [string, number], ambG: [string, number], rim: [string, number], cloudL: [string, number], cloudS: string, water: string, fog: number, night: number, stars: number, el: number, az: number): Key => ({
	t, zen: lin(zen), mid: lin(mid), hor: lin(hor), glow: lin(...glow), sun: lin(...sun), ambS: lin(...ambS), ambG: lin(...ambG), rim: lin(...rim), cloudL: lin(...cloudL), cloudS: lin(cloudS), water: lin(water), fog, night, stars, el, az,
});
// dawn = pink / lavender, day = vivid blue, golden hour = orange, blue hour = deep blue, night = navy / teal
const KEYS: Key[] = [
	K(0.0, '#2e3c86', '#8f7cc4', '#ffab9c', ['#ff6f4a', 1.1], ['#ff8f66', 0.9], ['#8a86d8', 0.62], ['#7a6488', 0.34], ['#ffb4a8', 0.5], ['#ffb9aa', 1.25], '#5f62a8', '#33405c', 2.4e-4, 0.5, 0.25, -2, 112),
	K(0.07, '#3f63bd', '#c79fd6', '#ffc693', ['#ff9a55', 1.5], ['#ffab78', 2.6], ['#8f95e6', 0.68], ['#8a6c80', 0.36], ['#ffc8a0', 0.6], ['#ffd2b0', 1.4], '#7672b4', '#39506e', 2.2e-4, 0.2, 0.0, 4.5, 117),
	K(0.14, '#2378e6', '#74b6f6', '#eee6dc', ['#fff0d2', 0.6], ['#fff0dc', 3.3], ['#8db4ff', 0.78], ['#8f8a8a', 0.36], ['#dfeeff', 0.5], ['#ffffff', 1.35], '#8ea4d6', '#2a5672', 1.4e-4, 0.0, 0.0, 20, 128),
	K(0.32, '#0d58d8', '#3a92f4', '#b4daff', ['#ffffff', 0.35], ['#fff8ea', 3.7], ['#8fb4f4', 0.8], ['#9a968f', 0.52], ['#cfe6ff', 0.55], ['#ffffff', 1.45], '#869fd8', '#1d4f74', 0.9e-4, 0.0, 0.0, 54, 165),
	K(0.46, '#0d58d8', '#3a92f4', '#b4daff', ['#ffffff', 0.35], ['#fff8ea', 3.7], ['#8fb4f4', 0.8], ['#9a968f', 0.52], ['#cfe6ff', 0.55], ['#ffffff', 1.45], '#869fd8', '#1d4f74', 0.9e-4, 0.0, 0.0, 50, 205),
	K(0.57, '#2456c2', '#7f9fe0', '#ffc878', ['#ff9a2c', 1.5], ['#ffae5c', 3.5], ['#7f8fe6', 0.66], ['#a87a5c', 0.34], ['#ffc27a', 0.9], ['#ffd89c', 1.45], '#8478b6', '#374e6e', 1.7e-4, 0.0, 0.0, 12, 247),
	K(0.66, '#22388c', '#b96a9e', '#ff7c3c', ['#ff5a1e', 2.0], ['#ff7a3e', 2.7], ['#7062c0', 0.58], ['#8a5a66', 0.3], ['#ff9a5a', 1.0], ['#ff9c6e', 1.5], '#564c92', '#363c62', 2.1e-4, 0.12, 0.0, 3, 256),
	K(0.735, '#13246c', '#3f4cae', '#e87c72', ['#ff6a52', 0.9], ['#ff8a6a', 0.35], ['#4058cc', 0.56], ['#4a4878', 0.3], ['#8a8cf0', 0.5], ['#d08a98', 1.0], '#2c3684', '#22335a', 1.9e-4, 0.4, 0.15, -3.5, 262),
	K(0.82, '#081248', '#172a84', '#4458b8', ['#6a58b4', 0.3], ['#8fa8ff', 0.42], ['#2c48b8', 0.5], ['#34306a', 0.3], ['#5a78ff', 0.45], ['#4e60b0', 0.9], '#161e5c', '#142a60', 1.6e-4, 0.86, 0.7, 38, 140),
	K(0.92, '#040820', '#0a1744', '#1f4668', ['#ff50a0', 0.0], ['#9fb8ff', 0.5], ['#1f3890', 0.46], ['#22284a', 0.32], ['#4a6cff', 0.4], ['#5a4470', 0.8], '#0c1232', '#0c2444', 1.4e-4, 1.0, 1.0, 42, 150),
	K(1.0, '#040820', '#0a1744', '#1f4668', ['#ff50a0', 0.0], ['#9fb8ff', 0.5], ['#1f3890', 0.46], ['#22284a', 0.32], ['#4a6cff', 0.4], ['#5a4470', 0.8], '#0c1232', '#0c2444', 1.4e-4, 1.0, 1.0, 42, 150),
];
const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type Env = {
	shot: Shot; shotIndex: number; u: number; tod: number; time: number;
	zen: V3; mid: V3; hor: V3; glow: V3; sun: V3; ambS: V3; ambG: V3; rim: V3; cloudL: V3; cloudS: V3; water: V3;
	fog: number; night: number; stars: number;
	sunDir: THREE.Vector3; // true sun (sky disc, flares, god rays)
	keyDir: THREE.Vector3; // key light: sun by day, moon at night
	sunUp: number; // 1 when the sun is the key light
	rain: number; wet: number; mist: number; cloudCover: number;
};

const dirFrom = (azDeg: number, elDeg: number) => {
	const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
	return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
};

export const envAt = (frame: number): Env => {
	const shotIndex = shotIndexAt(frame);
	const shot = SHOTS[shotIndex];
	const u = clamp((frame / FPS - shot.start) / (shot.end - shot.start));
	const tod = lerp(shot.tod[0], shot.tod[1], u);
	let i = 0;
	while (i < KEYS.length - 2 && tod > KEYS[i + 1].t) i++;
	const a = KEYS[i], b = KEYS[i + 1];
	const t = clamp((tod - a.t) / (b.t - a.t));
	const el = shot.sunEl ? lerp(shot.sunEl[0], shot.sunEl[1], u) : lerp(a.el, b.el, t);
	const az = shot.sunAz ? lerp(shot.sunAz[0], shot.sunAz[1], u) : lerp(a.az, b.az, t);
	const night = lerp(a.night, b.night, t);
	const isMoon = tod > 0.78;
	const sunDir = isMoon ? dirFrom(lerp(262, 268, clamp((tod - 0.7) / 0.2)), -18) : dirFrom(az, el);
	const keyDir = isMoon ? dirFrom(lerp(a.az, b.az, t), lerp(a.el, b.el, t)) : dirFrom(az, Math.max(el, 2.5));
	// key light fades through zero between sun and moon so the hand-over never pops
	const fade = isMoon ? smooth(0.78, 0.83, tod) : 1 - smooth(0.745, 0.78, tod);
	const sun = mix3(a.sun, b.sun, t).map((v) => v * fade) as V3;
	return {
		shot, shotIndex, u, tod, time: frame / FPS,
		zen: mix3(a.zen, b.zen, t), mid: mix3(a.mid, b.mid, t), hor: mix3(a.hor, b.hor, t), glow: mix3(a.glow, b.glow, t), sun,
		ambS: mix3(a.ambS, b.ambS, t), ambG: mix3(a.ambG, b.ambG, t), rim: mix3(a.rim, b.rim, t), cloudL: mix3(a.cloudL, b.cloudL, t), cloudS: mix3(a.cloudS, b.cloudS, t), water: mix3(a.water, b.water, t),
		fog: lerp(a.fog, b.fog, t) * (shot.fogMul ?? 1), night, stars: lerp(a.stars, b.stars, t),
		sunDir, keyDir, sunUp: isMoon ? 0 : 1,
		rain: shot.rain ?? 0, wet: shot.wet ?? 0, mist: shot.mist ?? 0, cloudCover: shot.cloudCover ?? 0.5,
	};
};
