// Procedural prop models (all built from the Geo toolkit, base at y = 0, forward = +x).
import {Geo, srgb, type RGB} from './geo';

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export const waterTower = () => {
	const g = new Geo();
	const iron = srgb('#3b3d42'), wood = srgb('#6a4a31'), woodD = srgb('#503522'), roof = srgb('#4a4640');
	for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) g.beam([x * 1.15, 0, z * 1.15], [x, 3.4, z], 0.16, iron);
	for (const y of [1.2, 2.5]) {
		g.beam([-1.6, y, -1.6], [1.6, y, -1.6], 0.09, iron); g.beam([1.6, y, -1.6], [1.6, y, 1.6], 0.09, iron);
		g.beam([1.6, y, 1.6], [-1.6, y, 1.6], 0.09, iron); g.beam([-1.6, y, 1.6], [-1.6, y, -1.6], 0.09, iron);
	}
	g.beam([-1.7, 0.1, -1.7], [1.5, 3.3, -1.5], 0.07, iron); g.beam([1.7, 0.1, 1.7], [-1.5, 3.3, 1.5], 0.07, iron);
	g.box(0, 3.5, 0, 4.0, 0.22, 4.0, iron);
	// staved wooden tank: alternating plank tones
	const seg = 14;
	for (let i = 0; i < seg; i++) {
		const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
		const c = i % 3 === 0 ? woodD : i % 3 === 1 ? wood : shade(wood, 1.15);
		g.quad([Math.cos(a1) * 1.95, 3.6, Math.sin(a1) * 1.95], [Math.cos(a0) * 1.95, 3.6, Math.sin(a0) * 1.95], [Math.cos(a0) * 1.85, 7.3, Math.sin(a0) * 1.85], [Math.cos(a1) * 1.85, 7.3, Math.sin(a1) * 1.85], c);
	}
	for (const y of [4.0, 4.9, 5.8, 6.7]) g.cyl(0, y, 0, 1.99, 1.97, 0.07, seg, iron, 0, false);
	g.cyl(0, 7.3, 0, 2.15, 0.05, 1.35, seg, roof);
	g.cyl(0, 8.65, 0, 0.12, 0.05, 0.4, 5, iron);
	g.beam([2.0, 0.2, 0.3], [2.0, 7.2, 0.3], 0.05, iron); g.beam([2.0, 0.2, -0.3], [2.0, 7.2, -0.3], 0.05, iron);
	return g.build();
};
export const acUnit = () => {
	const g = new Geo();
	g.box(0, 0.55, 0, 1.7, 1.0, 1.2, srgb('#9a9c9e'), 0, srgb('#7c7e80'));
	g.cyl(0, 1.05, 0, 0.42, 0.42, 0.05, 8, srgb('#2c2e30'));
	g.box(0, 0.08, 0, 1.9, 0.14, 1.4, srgb('#4a4a4a'));
	return g.build();
};
export const mechUnit = () => {
	const g = new Geo();
	g.box(0, 2.0, 0, 7, 4, 4.5, srgb('#8d9094'), 0, srgb('#6e7074'));
	for (let i = 0; i < 6; i++) g.box(0, 0.6 + i * 0.55, 2.27, 6.4, 0.25, 0.05, srgb('#4c4f54'));
	g.cyl(-1.8, 4, 0, 0.9, 0.9, 0.5, 10, srgb('#55585c'));
	g.cyl(1.8, 4, 0, 0.9, 0.9, 0.5, 10, srgb('#55585c'));
	return g.build();
};
export const vent = () => {
	const g = new Geo();
	g.cyl(0, 0, 0, 0.22, 0.22, 1.1, 7, srgb('#8a8c8e'));
	g.cyl(0, 1.1, 0, 0.4, 0.3, 0.35, 7, srgb('#a8aaac'));
	return g.build();
};
export const bulkhead = () => {
	const g = new Geo();
	g.box(0, 1.6, 0, 3.6, 3.2, 3.0, srgb('#7a6a5c'), 0, srgb('#3c3c40'));
	g.box(1.81, 1.05, 0.3, 0.05, 2.1, 1.0, srgb('#2e2a28'));
	g.box(0, 3.3, 0, 3.9, 0.2, 3.3, srgb('#505055'));
	return g.build();
};
export const antenna = () => {
	const g = new Geo();
	const c = srgb('#b8b8b8');
	g.beam([0, 0, 0], [0, 10, 0], 0.14, c);
	for (const y of [5, 6.5, 8]) { g.beam([-0.9, y, 0], [0.9, y, 0], 0.05, c); g.beam([0, y + 0.4, -0.7], [0, y + 0.4, 0.7], 0.05, c); }
	g.sphere(0, 10.15, 0, 0.16, 6, [1, 0.1, 0.06], 1);
	return g.build();
};
export const dish = () => {
	const g = new Geo();
	g.beam([0, 0, 0], [0, 1.1, 0], 0.1, srgb('#777'));
	g.push().translate(0, 1.3, 0).rotZ(0.9);
	g.cyl(0, 0, 0, 0.75, 0.75, 0.08, 10, srgb('#d8d8d8'));
	g.pop();
	return g.build();
};
export const roofGarden = () => {
	const g = new Geo();
	g.box(0, 0.12, 0, 7, 0.24, 5, srgb('#8a6a4a'));
	for (const [x, z] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8], [0, -2]]) {
		g.box(x, 0.55, z, 1.3, 0.6, 0.9, srgb('#5a4636'));
		g.sphere(x, 1.25, z, 0.75, 6, srgb('#2f6a2c'), 0, 0.8, srgb('#58a04a'));
	}
	g.box(0.4, 0.62, 0.6, 1.6, 0.08, 0.8, srgb('#d8d0c0'));
	g.box(-1.2, 0.5, 0.6, 0.5, 0.5, 0.5, srgb('#b04a3a'));
	return g.build();
};
// one storey of a zig-zag fire escape; local x along the wall, z out from the wall
export const fireEscape = () => {
	const g = new Geo();
	const iron = srgb('#1f1f22');
	const W = 3.4, D = 1.0, H = 3.4;
	g.box(0, 0, D / 2 + 0.05, W, 0.06, D, srgb('#2a2a2e'));
	for (const y of [0.55, 1.05]) {
		g.beam([-W / 2, y, D + 0.05], [W / 2, y, D + 0.05], 0.045, iron);
		g.beam([-W / 2, y, 0.05], [-W / 2, y, D + 0.05], 0.045, iron);
		g.beam([W / 2, y, 0.05], [W / 2, y, D + 0.05], 0.045, iron);
	}
	for (let i = 0; i <= 8; i++) g.beam([-W / 2 + (i * W) / 8, 0, D + 0.05], [-W / 2 + (i * W) / 8, 1.05, D + 0.05], 0.03, iron);
	// stair to the next landing
	g.beam([-1.3, 0.03, 0.75], [1.2, H, 0.75], 0.06, iron);
	g.beam([-1.3, 0.03, 0.3], [1.2, H, 0.3], 0.06, iron);
	for (let i = 1; i < 9; i++) {
		const k = i / 9;
		g.box(-1.3 + 2.5 * k, 0.03 + H * k, 0.525, 0.24, 0.03, 0.5, iron);
	}
	g.beam([-1.3, 1.0, 0.8], [1.2, H + 1.0, 0.8], 0.035, iron);
	// brackets
	g.beam([-W / 2, 0, 0.05], [-W / 2, -0.7, 0.0], 0.05, iron);
	g.beam([W / 2, 0, 0.05], [W / 2, -0.7, 0.0], 0.05, iron);
	return g.build();
};
export const dropLadder = () => {
	const g = new Geo();
	const iron = srgb('#1f1f22');
	g.beam([-0.25, 0, 0.95], [-0.25, -3.0, 0.95], 0.04, iron);
	g.beam([0.25, 0, 0.95], [0.25, -3.0, 0.95], 0.04, iron);
	for (let i = 1; i < 9; i++) g.beam([-0.25, -i * 0.33, 0.95], [0.25, -i * 0.33, 0.95], 0.03, iron);
	return g.build();
};
// 2.4 m module of a sidewalk shed (scaffolding); x along the wall, z out
export const scaffold = () => {
	const g = new Geo();
	const steel = srgb('#8a8d90'), green = srgb('#1c4a3c');
	for (const x of [-1.15, 1.15]) for (const z of [0.25, 2.4]) g.beam([x, 0, z], [x, 3.0, z], 0.07, steel);
	g.beam([-1.15, 1.2, 2.4], [1.15, 2.6, 2.4], 0.04, steel);
	g.beam([-1.15, 2.6, 2.4], [1.15, 1.2, 2.4], 0.04, steel);
	g.box(0, 3.05, 1.35, 2.4, 0.12, 2.5, srgb('#5a4a38'));
	g.box(0, 3.7, 2.55, 2.4, 1.2, 0.06, green);
	g.box(0, 2.95, 1.35, 2.2, 0.04, 0.12, [1.0, 0.95, 0.8], 0.6);
	return g.build();
};
export const bladeSign = () => {
	const g = new Geo();
	g.box(0, 1.6, 0.55, 0.22, 3.2, 0.9, [1, 1, 1], 1);
	g.box(0, 1.6, 0.05, 0.1, 0.1, 0.3, srgb('#222'));
	g.box(0, 3.25, 0.55, 0.3, 0.1, 1.0, srgb('#222'));
	g.box(0, -0.05, 0.55, 0.3, 0.1, 1.0, srgb('#222'));
	return g.build();
};
export const streetLamp = () => {
	const g = new Geo();
	const c = srgb('#4a4f52');
	g.cyl(0, 0, 0, 0.14, 0.08, 8.6, 6, c);
	g.cyl(0, 0, 0, 0.24, 0.2, 0.9, 6, srgb('#3a3d40'));
	g.beam([0, 8.5, 0], [0, 8.9, 2.4], 0.09, c);
	g.box(0, 8.82, 2.6, 0.34, 0.14, 0.75, srgb('#6a6d70'));
	g.box(0, 8.73, 2.6, 0.26, 0.05, 0.6, [1.0, 0.8, 0.5], 1);
	return g.build();
};
// alpha encodes the lamp: 0.25 red, 0.5 amber, 0.75 green (material: signal)
export const trafficSignal = () => {
	const g = new Geo();
	const c = srgb('#2f3336');
	g.cyl(0, 0, 0, 0.13, 0.1, 6.4, 6, c);
	g.beam([0, 6.2, 0], [0, 6.5, 5.2], 0.11, c);
	for (const z of [2.6, 5.0]) {
		g.box(0, 5.75, z, 0.34, 1.15, 0.36, srgb('#c9a21a'));
		g.box(0.18, 6.12, z, 0.02, 0.24, 0.24, [1, 0.12, 0.08], 0.25);
		g.box(0.18, 5.76, z, 0.02, 0.24, 0.24, [1, 0.7, 0.1], 0.5);
		g.box(0.18, 5.4, z, 0.02, 0.24, 0.24, [0.15, 1, 0.45], 0.75);
	}
	g.box(0.16, 2.9, 0, 0.3, 0.45, 0.4, srgb('#c9a21a'));
	g.box(0.32, 2.9, 0, 0.02, 0.3, 0.26, [1, 0.5, 0.15], 0.25);
	return g.build();
};
export const tree = (low: boolean) => {
	const g = new Geo();
	const bark = srgb('#3a2a20');
	g.cyl(0, 0, 0, 0.2, 0.12, 3.4, 5, bark);
	// colours are near-white: the per-instance colour supplies the season
	const a: RGB = [0.62, 0.62, 0.62], b: RGB = [1.0, 1.0, 1.0];
	if (low) {
		g.sphere(0, 5.6, 0, 2.6, 6, a, 0, 0.95, b);
	} else {
		g.sphere(0.2, 5.3, 0.1, 2.3, 7, a, 0, 0.9, b);
		g.sphere(-0.9, 4.5, 0.6, 1.6, 6, shade(a, 0.9), 0, 0.85, shade(b, 0.92));
		g.sphere(0.9, 4.4, -0.7, 1.5, 6, shade(a, 0.85), 0, 0.85, shade(b, 0.88));
		g.beam([0, 3.0, 0], [-0.8, 4.2, 0.5], 0.09, bark);
		g.beam([0, 3.0, 0], [0.8, 4.1, -0.6], 0.09, bark);
	}
	return g.build();
};
export const treePit = () => {
	const g = new Geo();
	g.box(0, 0.03, 0, 1.7, 0.06, 1.7, srgb('#4e4a44'));
	for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0 && !(i > 0 && i < 3 && j > 0 && j < 3)) g.box(-0.63 + i * 0.42, 0.07, -0.63 + j * 0.42, 0.38, 0.04, 0.38, srgb('#6a655e'));
	return g.build();
};
export const subwayEntrance = () => {
	const g = new Geo();
	const green = srgb('#1f5a38'), dark = srgb('#1a2a22');
	for (const z of [-1.0, 1.0]) {
		g.box(0, 0.55, z, 4.4, 1.1, 0.08, green);
		for (let i = 0; i < 9; i++) g.beam([-2.2 + i * 0.55, 0, z], [-2.2 + i * 0.55, 1.1, z], 0.04, dark);
	}
	g.box(2.2, 0.55, 0, 0.08, 1.1, 2.0, green);
	g.box(0.4, -0.02, 0, 3.6, 0.04, 1.9, srgb('#111'));
	for (const z of [-1.0, 1.0]) {
		g.cyl(-2.2, 0, z, 0.07, 0.06, 2.6, 6, dark);
		g.sphere(-2.2, 2.8, z, 0.26, 8, [0.2, 1.0, 0.45], 1);
	}
	g.box(-2.2, 2.2, 0, 0.08, 0.4, 1.9, [0.9, 0.9, 0.85], 0.35);
	return g.build();
};
export const hotdogCart = () => {
	const g = new Geo();
	g.box(0, 0.75, 0, 2.0, 0.9, 1.0, srgb('#b8bcc0'), 0, srgb('#8a8e92'));
	g.box(0, 1.3, 0, 2.1, 0.06, 1.1, srgb('#d8dade'));
	for (const x of [-0.7, 0.7]) g.cyl(x, 0, 0.52, 0.28, 0.28, 0.08, 8, srgb('#222'));
	g.beam([0, 1.3, 0], [0, 3.1, 0], 0.05, srgb('#aaa'));
	const seg = 8;
	for (let i = 0; i < seg; i++) {
		const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
		const c: RGB = i % 2 ? srgb('#e8c21a') : srgb('#c8281e');
		g.tri([0, 3.25, 0], [Math.cos(a1) * 1.5, 2.7, Math.sin(a1) * 1.5], [Math.cos(a0) * 1.5, 2.7, Math.sin(a0) * 1.5], c);
		g.tri([0, 3.2, 0], [Math.cos(a0) * 1.5, 2.68, Math.sin(a0) * 1.5], [Math.cos(a1) * 1.5, 2.68, Math.sin(a1) * 1.5], shade(c, 0.6));
	}
	g.box(0.3, 1.55, 0, 0.5, 0.4, 0.3, srgb('#e04a2a'));
	// vendor
	g.cyl(-1.4, 0, 0.2, 0.2, 0.24, 1.3, 6, srgb('#2a3a5a'));
	g.sphere(-1.4, 1.52, 0.2, 0.16, 6, srgb('#c89a78'));
	return g.build();
};
export const figure = () => {
	// lone figure: long coat, scarf, hair; forward = +x
	const g = new Geo();
	const coat = srgb('#1a1d2a'), skin = srgb('#c89a78');
	g.cyl(-0.02, 0, 0.11, 0.085, 0.1, 0.88, 6, srgb('#14161c'));
	g.cyl(-0.02, 0, -0.11, 0.085, 0.1, 0.88, 6, srgb('#14161c'));
	g.cyl(0, 0.62, 0, 0.3, 0.2, 0.86, 8, coat);
	g.cyl(0, 1.48, 0, 0.06, 0.06, 0.1, 6, skin);
	g.sphere(0, 1.67, 0, 0.115, 8, skin);
	g.sphere(-0.02, 1.7, 0, 0.125, 8, srgb('#1a1412'), 0, 0.95);
	for (const z of [-0.26, 0.26]) g.beam([0, 1.42, z * 0.85], [0.04, 0.9, z], 0.09, coat);
	g.box(-0.02, 1.47, 0, 0.3, 0.09, 0.34, srgb('#a8322a'));
	g.beam([-0.12, 1.45, 0.08], [-0.42, 1.2, 0.2], 0.07, srgb('#a8322a'));
	return g.build();
};
export const car = (taxi: boolean) => {
	const g = new Geo();
	const w: RGB = [1, 1, 1];
	g.box(0, 0.52, 0, 4.5, 0.62, 1.82, w);
	g.box(-0.25, 1.05, 0, 2.5, 0.52, 1.6, [0.06, 0.08, 0.1]);
	g.box(-0.25, 1.33, 0, 2.3, 0.05, 1.5, w);
	for (const x of [-1.4, 1.4]) for (const z of [-0.85, 0.85]) g.cyl(x, 0.0, z - 0.09, 0.33, 0.33, 0.18, 8, [0.02, 0.02, 0.02]);
	for (const z of [-0.62, 0.62]) {
		g.box(2.26, 0.6, z, 0.03, 0.16, 0.36, [1.0, 0.95, 0.8], 1);
		g.box(-2.26, 0.62, z, 0.03, 0.14, 0.4, [1.0, 0.06, 0.03], 0.8);
	}
	if (taxi) {
		g.box(-0.25, 1.45, 0, 0.5, 0.18, 0.9, [1.0, 0.85, 0.35], 0.6);
		g.box(0, 0.5, 0.915, 2.0, 0.2, 0.01, [0.05, 0.05, 0.05]);
		g.box(0, 0.5, -0.915, 2.0, 0.2, 0.01, [0.05, 0.05, 0.05]);
	}
	return g.build();
};
export const bus = () => {
	const g = new Geo();
	g.box(0, 1.75, 0, 12, 2.9, 2.55, [1, 1, 1]);
	g.box(0, 2.15, 0, 11.4, 1.0, 2.58, [0.08, 0.1, 0.12]);
	g.box(0, 2.15, 1.3, 11.0, 0.8, 0.02, [0.9, 0.95, 1.0], 0.3);
	g.box(0, 2.15, -1.3, 11.0, 0.8, 0.02, [0.9, 0.95, 1.0], 0.3);
	g.box(0, 0.9, 0, 12.02, 0.5, 2.57, [0.12, 0.3, 0.6]);
	for (const x of [-4, 3.8]) for (const z of [-1.15, 1.15]) g.cyl(x, 0.0, z - 0.12, 0.5, 0.5, 0.24, 8, [0.02, 0.02, 0.02]);
	for (const z of [-0.9, 0.9]) {
		g.box(6.02, 0.75, z, 0.03, 0.2, 0.4, [1.0, 0.95, 0.8], 1);
		g.box(-6.02, 0.9, z, 0.03, 0.3, 0.3, [1.0, 0.06, 0.03], 0.8);
	}
	g.box(6.02, 3.0, 0, 0.03, 0.3, 1.8, [1.0, 0.6, 0.15], 0.7);
	return g.build();
};
export const ferry = () => {
	const g = new Geo();
	const hull = srgb('#e8e4da');
	g.box(0, 1.2, 0, 44, 2.6, 11, srgb('#1f3a5a'));
	g.box(0, 4.2, 0, 40, 3.2, 10.4, hull);
	g.box(0, 7.0, 0, 34, 2.6, 9.6, hull);
	g.box(0, 5.2, 5.22, 37, 1.0, 0.03, [1.0, 0.9, 0.65], 0.5);
	g.box(0, 5.2, -5.22, 37, 1.0, 0.03, [1.0, 0.9, 0.65], 0.5);
	g.box(0, 7.4, 4.82, 31, 0.9, 0.03, [1.0, 0.9, 0.65], 0.5);
	g.box(0, 7.4, -4.82, 31, 0.9, 0.03, [1.0, 0.9, 0.65], 0.5);
	g.box(6, 9.3, 0, 8, 2.0, 6, srgb('#d8d4ca'));
	g.cyl(-4, 8.3, 0, 1.1, 0.9, 3.4, 8, srgb('#d87a1a'));
	g.tri([22, 0, 5.5], [29, 2.4, 0], [22, 2.5, 5.5], srgb('#1f3a5a'));
	g.tri([22, 0, -5.5], [22, 2.5, -5.5], [29, 2.4, 0], srgb('#1f3a5a'));
	g.tri([22, 2.5, 5.5], [29, 2.4, 0], [22, 2.5, -5.5], srgb('#3a3a3a'));
	g.tri([22, 0, 5.5], [22, 0, -5.5], [29, 2.4, 0], srgb('#1f3a5a'));
	return g.build();
};
export const helicopter = () => {
	const g = new Geo();
	const body = srgb('#22262e');
	g.sphere(0, 0, 0, 1.5, 8, body, 0, 0.85);
	g.beam([-1, 0.2, 0], [-6.5, 0.6, 0], 0.4, body);
	g.box(-6.6, 1.1, 0, 0.9, 1.4, 0.1, body);
	g.box(0.9, -0.1, 0, 1.2, 0.9, 1.6, [0.3, 0.45, 0.6]);
	g.beam([-1.2, -1.5, 0.9], [1.4, -1.5, 0.9], 0.1, body); g.beam([-1.2, -1.5, -0.9], [1.4, -1.5, -0.9], 0.1, body);
	g.cyl(0, 1.3, 0, 0.15, 0.15, 0.5, 6, body);
	g.sphere(0, -1.2, 0, 0.2, 6, [1, 0.1, 0.05], 1);
	g.sphere(1.6, -0.6, 0, 0.22, 6, [1, 1, 0.9], 1);
	return g.build();
};
export const rotor = () => {
	const g = new Geo();
	g.box(0, 1.85, 0, 11, 0.05, 0.4, srgb('#1a1a1a'));
	g.box(0, 1.85, 0, 0.4, 0.05, 11, srgb('#1a1a1a'));
	return g.build();
};
export const plane = () => {
	const g = new Geo();
	const w = srgb('#e8eaee');
	g.push().rotZ(-Math.PI / 2);
	g.cyl(0, -18, 0, 1.9, 1.9, 34, 10, w);
	g.cyl(0, 16, 0, 1.9, 0.3, 4, 10, w);
	g.cyl(0, -22, 0, 0.5, 1.9, 4, 10, w);
	g.pop();
	g.box(0, -0.3, 0, 7, 0.4, 34, w);
	g.box(-17, 0.6, 0, 3.5, 0.3, 12, w);
	g.box(-17.5, 3, 0, 4, 5, 0.35, srgb('#2a4a8a'));
	for (const z of [-6, 6]) g.cyl(1.5, -1.6, z, 0.9, 0.9, 0.01, 8, w);
	g.sphere(0, -0.2, 17.2, 0.5, 6, [0.1, 1, 0.2], 1);
	g.sphere(0, -0.2, -17.2, 0.5, 6, [1, 0.1, 0.1], 1);
	g.sphere(0, -2.1, 0, 0.6, 6, [1, 1, 1], 1.5);
	g.sphere(-18, 5.7, 0, 0.4, 6, [1, 1, 1], 1.5);
	return g.build();
};
