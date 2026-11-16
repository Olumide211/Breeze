// Small procedural modelling toolkit: boxes, cylinders, tubes and quads merged into one
// vertex-coloured BufferGeometry. Colour alpha carries an emissive factor.
import * as THREE from 'three';

export type RGB = [number, number, number];
export const srgb = (hex: string, m = 1): RGB => {
	const c = new THREE.Color(hex);
	return [c.r * m, c.g * m, c.b * m];
};

export class Geo {
	pos: number[] = [];
	nor: number[] = [];
	col: number[] = [];
	uv: number[] = [];
	idx: number[] = [];
	n = 0;
	m = new THREE.Matrix4();
	private nm = new THREE.Matrix3();
	private v = new THREE.Vector3();
	private stack: THREE.Matrix4[] = [];

	push() { this.stack.push(this.m.clone()); return this; }
	pop() { this.m.copy(this.stack.pop()!); return this; }
	translate(x: number, y: number, z: number) { this.m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)); return this; }
	rotY(a: number) { this.m.multiply(new THREE.Matrix4().makeRotationY(a)); return this; }
	rotX(a: number) { this.m.multiply(new THREE.Matrix4().makeRotationX(a)); return this; }
	rotZ(a: number) { this.m.multiply(new THREE.Matrix4().makeRotationZ(a)); return this; }
	scale(x: number, y: number, z: number) { this.m.multiply(new THREE.Matrix4().makeScale(x, y, z)); return this; }

	vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: RGB, e = 0, u = 0, v = 0) {
		this.v.set(x, y, z).applyMatrix4(this.m);
		this.pos.push(this.v.x, this.v.y, this.v.z);
		this.nm.getNormalMatrix(this.m);
		this.v.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
		this.nor.push(this.v.x, this.v.y, this.v.z);
		this.col.push(c[0], c[1], c[2], e);
		this.uv.push(u, v);
		return this.n++;
	}
	// quad a,b,c,d (counter-clockwise seen from the normal side)
	quad(a: number[], b: number[], c: number[], d: number[], col: RGB, e = 0, uvs?: number[][]) {
		const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
		const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const l = Math.hypot(nx, ny, nz) || 1;
		nx /= l; ny /= l; nz /= l;
		const u = uvs ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
		const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, col, e, u[0][0], u[0][1]);
		const i1 = this.vert(b[0], b[1], b[2], nx, ny, nz, col, e, u[1][0], u[1][1]);
		const i2 = this.vert(c[0], c[1], c[2], nx, ny, nz, col, e, u[2][0], u[2][1]);
		const i3 = this.vert(d[0], d[1], d[2], nx, ny, nz, col, e, u[3][0], u[3][1]);
		this.idx.push(i0, i1, i2, i0, i2, i3);
		return this;
	}
	tri(a: number[], b: number[], c: number[], col: RGB, e = 0) {
		const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
		const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const l = Math.hypot(nx, ny, nz) || 1;
		nx /= l; ny /= l; nz /= l;
		const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, col, e);
		this.idx.push(i0, this.vert(b[0], b[1], b[2], nx, ny, nz, col, e), this.vert(c[0], c[1], c[2], nx, ny, nz, col, e));
		return this;
	}
	// axis-aligned box centred at (cx, cy, cz); optional per-face colours via top/bottom
	box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: RGB, e = 0, top?: RGB) {
		const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
		this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, e);
		this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, e);
		this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, e);
		this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, e);
		this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top ?? col, e);
		this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, e);
		return this;
	}
	// vertical cylinder / cone from y0 to y1
	cyl(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, seg: number, col: RGB, e = 0, caps = true, colTop?: RGB) {
		const y1 = y0 + h;
		const slope = (r0 - r1) / h;
		for (let i = 0; i < seg; i++) {
			const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
			const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
			const ia = this.vert(cx + c0 * r0, y0, cz + s0 * r0, c0, slope, s0, col, e, i / seg, 0);
			const ib = this.vert(cx + c1 * r0, y0, cz + s1 * r0, c1, slope, s1, col, e, (i + 1) / seg, 0);
			const ic = this.vert(cx + c1 * r1, y1, cz + s1 * r1, c1, slope, s1, colTop ?? col, e, (i + 1) / seg, 1);
			const id = this.vert(cx + c0 * r1, y1, cz + s0 * r1, c0, slope, s0, colTop ?? col, e, i / seg, 1);
			this.idx.push(ia, ic, ib, ia, id, ic);
			if (caps) {
				if (r1 > 0.001) this.tri([cx, y1, cz], [cx + c1 * r1, y1, cz + s1 * r1], [cx + c0 * r1, y1, cz + s0 * r1], colTop ?? col, e);
				if (r0 > 0.001) this.tri([cx, y0, cz], [cx + c0 * r0, y0, cz + s0 * r0], [cx + c1 * r0, y0, cz + s1 * r0], col, e);
			}
		}
		return this;
	}
	// square-section beam between two arbitrary points
	beam(a: number[], b: number[], w: number, col: RGB, e = 0, w2 = w) {
		const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
		const len = d.length();
		if (len < 1e-4) return this;
		d.normalize();
		const up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
		const s = new THREE.Vector3().crossVectors(d, up).normalize();
		const t = new THREE.Vector3().crossVectors(s, d).normalize();
		const corner = (p: number[], i: number, hw: number, ht: number) => {
			const sx = i === 0 || i === 3 ? -1 : 1, sy = i < 2 ? -1 : 1;
			return [p[0] + s.x * sx * hw + t.x * sy * ht, p[1] + s.y * sx * hw + t.y * sy * ht, p[2] + s.z * sx * hw + t.z * sy * ht];
		};
		for (let i = 0; i < 4; i++) {
			const j = (i + 1) % 4;
			this.quad(corner(a, j, w / 2, w2 / 2), corner(a, i, w / 2, w2 / 2), corner(b, i, w / 2, w2 / 2), corner(b, j, w / 2, w2 / 2), col, e, [[0, 0], [1, 0], [1, len], [0, len]]);
		}
		return this;
	}
	// poly-line of beams
	tube(pts: number[][], w: number, col: RGB, e = 0) {
		for (let i = 0; i + 1 < pts.length; i++) this.beam(pts[i], pts[i + 1], w, col, e);
		return this;
	}
	sphere(cx: number, cy: number, cz: number, r: number, seg: number, col: RGB, e = 0, sy = 1, colTop?: RGB) {
		const rings = Math.max(3, Math.floor(seg / 2));
		for (let j = 0; j < rings; j++) {
			const t0 = (j / rings) * Math.PI, t1 = ((j + 1) / rings) * Math.PI;
			for (let i = 0; i < seg; i++) {
				const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
				const p = (t: number, a: number) => [Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a)];
				const q = [p(t0, a0), p(t0, a1), p(t1, a1), p(t1, a0)];
				const ids = q.map((n) => this.vert(cx + n[0] * r, cy + n[1] * r * sy, cz + n[2] * r, n[0], n[1], n[2], colTop && n[1] > 0.1 ? colTop : col, e));
				this.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
			}
		}
		return this;
	}
	build() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
		g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
		g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 4));
		g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
		g.setIndex(this.n > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1) : new THREE.BufferAttribute(new Uint16Array(this.idx), 1));
		g.computeBoundingSphere();
		g.computeBoundingBox();
		return g;
	}
}
