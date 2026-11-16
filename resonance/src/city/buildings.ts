// Extrudes every OSM footprint with its real height and merges the result per city tile.
// Tiles are the unit of frustum culling and of the per-shot (locked) LOD selection.
import earcut from 'earcut';
import * as THREE from 'three';
import {BAY_W, FLOOR_H, type Building, type City} from './data';

export const TILE = 400;
export type Tile = {key: string; cx: number; cz: number; mesh: THREE.Mesh; buildings: Building[]; radius: number};

class Builder {
	pos: number[] = [];
	nor: number[] = [];
	uv: number[] = [];
	ab: number[] = [];
	idx: number[] = [];
	count = 0;
	vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, seed: number, kind: number, floors: number, surf: number) {
		this.pos.push(x, y, z);
		this.nor.push(nx, ny, nz);
		this.uv.push(u, v);
		this.ab.push(seed, kind, floors, surf);
		return this.count++;
	}
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
		g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
		g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
		g.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(this.ab), 4));
		g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.idx), 1));
		g.computeBoundingSphere();
		g.computeBoundingBox();
		return g;
	}
}

// Generic prism: walls with facade UVs (bays x floors) plus a flat cap.
export const addPrism = (
	B: Builder,
	ring: ArrayLike<number>,
	n: number,
	y0: number,
	y1: number,
	seed: number,
	kind: number,
	opts: {roofY?: number; surf?: number; bottom?: boolean; floorsOverride?: number; topRing?: ArrayLike<number>; noRoof?: boolean; bayW?: number} = {},
) => {
	const bayW = opts.bayW ?? BAY_W[Math.min(kind, 4)];
	const floors = opts.floorsOverride ?? Math.max(1, Math.round((y1 - y0) / FLOOR_H));
	const surf = opts.surf ?? 0;
	const top = opts.topRing ?? ring;
	// orientation: positive shoelace area in (x,z) -> outward normal is (dz,-dx)
	let area = 0;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		area += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1];
	}
	const sgn = area >= 0 ? 1 : -1;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
		const tax = top[i * 2], taz = top[i * 2 + 1], tbx = top[j * 2], tbz = top[j * 2 + 1];
		const dx = bx - ax, dz = bz - az;
		const len = Math.hypot(dx, dz);
		if (len < 0.05) continue;
		let nx = (dz / len) * sgn, nz = (-dx / len) * sgn, ny = 0;
		if (opts.topRing) {
			// tapered wall: tilt the normal
			const mx = (tax + tbx - ax - bx) / 2, mz = (taz + tbz - az - bz) / 2;
			const run = mx * nx + mz * nz;
			ny = -run / (y1 - y0);
			const l = Math.hypot(nx, ny, nz);
			nx /= l; ny /= l; nz /= l;
		}
		const bays = len < 1.4 ? 0 : Math.max(1, Math.round(len / bayW));
		const u0 = i * 16;
		const a = B.vert(ax, y0, az, nx, ny, nz, u0, 0, seed, kind, floors, surf);
		const b = B.vert(bx, y0, bz, nx, ny, nz, u0 + bays, 0, seed, kind, floors, surf);
		const c = B.vert(tbx, y1, tbz, nx, ny, nz, u0 + bays, floors, seed, kind, floors, surf);
		const d = B.vert(tax, y1, taz, nx, ny, nz, u0, floors, seed, kind, floors, surf);
		if (sgn > 0) B.idx.push(a, c, b, a, d, c);
		else B.idx.push(a, b, c, a, c, d);
	}
	if (!opts.noRoof) {
		const ry = opts.roofY ?? y1;
		const flat: number[] = [];
		for (let i = 0; i < n; i++) flat.push(top[i * 2], top[i * 2 + 1]);
		const tris = earcut(flat);
		const base = B.count;
		for (let i = 0; i < n; i++) B.vert(top[i * 2], ry, top[i * 2 + 1], 0, 1, 0, top[i * 2], top[i * 2 + 1], seed, kind, floors, 1);
		const up = (i: number) => {
			const x0 = top[tris[i] * 2], z0 = top[tris[i] * 2 + 1];
			return (top[tris[i + 1] * 2] - x0) * (top[tris[i + 2] * 2 + 1] - z0) - (top[tris[i + 2] * 2] - x0) * (top[tris[i + 1] * 2 + 1] - z0) < 0;
		};
		for (let i = 0; i < tris.length; i += 3) {
			if (up(i)) B.idx.push(base + tris[i], base + tris[i + 1], base + tris[i + 2]);
			else B.idx.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]);
		}
		if (opts.bottom) {
			const b2 = B.count;
			for (let i = 0; i < n; i++) B.vert(ring[i * 2], y0, ring[i * 2 + 1], 0, -1, 0, ring[i * 2], ring[i * 2 + 1], seed, kind, floors, 1);
			for (let i = 0; i < tris.length; i += 3) {
				if (up(i)) B.idx.push(b2 + tris[i], b2 + tris[i + 2], b2 + tris[i + 1]);
				else B.idx.push(b2 + tris[i], b2 + tris[i + 1], b2 + tris[i + 2]);
			}
		}
	}
};

export const newBuilder = () => new Builder();
export type {Builder};

export const buildTiles = (city: City, matFar: THREE.Material): Tile[] => {
	const groups = new Map<string, Building[]>();
	for (const b of city.buildings) {
		const k = `${Math.floor(b.cx / TILE)},${Math.floor(b.cz / TILE)}`;
		let a = groups.get(k);
		if (!a) groups.set(k, (a = []));
		a.push(b);
	}
	const tiles: Tile[] = [];
	for (const [key, list] of groups) {
		const B = new Builder();
		for (const b of list) addPrism(B, b.ring, b.n, b.minH, b.h, b.seed, b.kind, {roofY: b.roofY, bottom: b.minH > 1});
		const g = B.geometry();
		const mesh = new THREE.Mesh(g, matFar);
		mesh.matrixAutoUpdate = false;
		mesh.layers.set(1); // shadow caster
		mesh.layers.enable(2); // G-buffer pass (never forward-rendered)
		const [tx, tz] = key.split(',').map(Number);
		tiles.push({key, cx: (tx + 0.5) * TILE, cz: (tz + 0.5) * TILE, mesh, buildings: list, radius: g.boundingSphere!.radius});
	}
	return tiles;
};
