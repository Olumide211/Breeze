// STAGE 1b: turn the cached Overpass tiles into compact, render-ready city data.
//  - converts OSM JSON to GeoJSON (osmtogeojson)
//  - projects lat/lon to local metres centred on the Empire State Building
//  - writes public/city/{buildings.bin, roads.bin, misc.json, mask.png}
// Everything downstream (geometry, props, traffic) is generated deterministically
// in the browser from these files, so renders are offline and reproducible.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import osmtogeojson from 'osmtogeojson';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'public', 'city');
fs.mkdirSync(OUT, {recursive: true});

// ---------- projection (local tangent plane, metres) ----------
const LAT0 = 40.7484;
const LON0 = -73.9857;
const phi = (LAT0 * Math.PI) / 180;
const M_LAT = 111132.954 - 559.822 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const M_LON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
// x = east, z = south (so -z is north), y = up
const proj = (lon, lat) => [(lon - LON0) * M_LON, -(lat - LAT0) * M_LAT];

const BBOX = {south: 40.686, north: 40.788, west: -74.04, east: -73.938};
const [X0, Z1] = proj(BBOX.west, BBOX.south);
const [X1, Z0] = proj(BBOX.east, BBOX.north);

// ---------- load + dedupe tiles ----------
const seen = new Set();
const elements = [];
for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.json')).sort()) {
	const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
	for (const el of j.elements) {
		const k = el.type[0] + el.id;
		if (seen.has(k)) continue;
		seen.add(k);
		elements.push(el);
	}
}
console.log(`elements: ${elements.length}`);
const gj = osmtogeojson({elements}, {flatProperties: false});
console.log(`features: ${gj.features.length}`);

// ---------- helpers ----------
const hash = (n) => {
	let h = (n ^ 0x9e3779b9) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const parseLen = (v) => {
	if (v == null) return NaN;
	const s = String(v).trim();
	const m = s.match(/^(-?[\d.]+)\s*(m|ft|'|feet)?/i);
	if (!m) return NaN;
	const n = parseFloat(m[1]);
	return m[2] && /ft|'|feet/i.test(m[2]) ? n * 0.3048 : n;
};
const ringArea = (r) => {
	let a = 0;
	for (let i = 0, n = r.length; i < n; i++) {
		const p = r[i], q = r[(i + 1) % n];
		a += p[0] * q[1] - q[0] * p[1];
	}
	return a / 2;
};
const centroid = (r) => {
	let x = 0, z = 0;
	for (const p of r) { x += p[0]; z += p[1]; }
	return [x / r.length, z / r.length];
};
const simplify = (ring, tol) => {
	// drop closing duplicate + near-collinear points
	let r = ring.slice();
	if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 0.01) r.pop();
	let changed = true;
	while (changed && r.length > 4) {
		changed = false;
		for (let i = 0; i < r.length && r.length > 4; i++) {
			const a = r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length];
			const dx = c[0] - a[0], dz = c[1] - a[1];
			const len = Math.hypot(dx, dz);
			const d = len < 1e-6 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / len;
			if (d < tol || Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.25) { r.splice(i, 1); changed = true; i--; }
		}
	}
	return r;
};
const pointInRing = (x, z, r) => {
	let inside = false;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
		const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1];
		if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
	}
	return inside;
};
const outerRings = (geom) => {
	if (geom.type === 'Polygon') return [geom.coordinates[0]];
	if (geom.type === 'MultiPolygon') return geom.coordinates.map((p) => p[0]);
	return [];
};
const projRing = (ring) => ring.map(([lon, lat]) => proj(lon, lat));

// ---------- classify ----------
const buildings = []; // {ring,h,minH,seed,kind,isPart}
const parts = [];
const roads = []; // {pts,cls,width,oneway,bridge,name,nodes}
const rails = [];
const parks = [];
const waters = [];
const piers = [];
const trees = [];
const signals = [];
const crossings = [];
const subways = [];
const bridgePts = {};
const BRIDGES = [
	['brooklyn', /brooklyn bridge/i],
	['manhattan', /manhattan bridge/i],
	['williamsburg', /williamsburg bridge/i],
	['queensboro', /queensboro bridge/i],
];
const ROAD_W = {motorway: 15, motorway_link: 7, trunk: 15, trunk_link: 7, primary: 17, primary_link: 7, secondary: 14, secondary_link: 6, tertiary: 11, tertiary_link: 6, residential: 9, unclassified: 8, living_street: 6, pedestrian: 9};
const ROAD_CLS = {motorway: 0, motorway_link: 0, trunk: 0, trunk_link: 0, primary: 1, primary_link: 1, secondary: 2, secondary_link: 2, tertiary: 3, tertiary_link: 3, residential: 4, unclassified: 4, living_street: 4, pedestrian: 5};
const wayNodes = new Map();
for (const el of elements) if (el.type === 'way' && el.nodes) wayNodes.set(el.id, el.nodes);

for (const f of gj.features) {
	const t = f.properties.tags || {};
	const g = f.geometry;
	const idNum = parseInt(String(f.id || f.properties.id).replace(/\D/g, ''), 10) || 0;
	if (g.type === 'Point') {
		const p = proj(g.coordinates[0], g.coordinates[1]);
		if (t.natural === 'tree') trees.push(p);
		else if (t.highway === 'traffic_signals') signals.push(p);
		else if (t.highway === 'crossing') crossings.push(p);
		else if (t.railway === 'subway_entrance') subways.push(p);
		continue;
	}
	if (t.building || t['building:part']) {
		if (t.building === 'no' || t['building:part'] === 'no') continue;
		if (t.location === 'underground' || t.tunnel) continue;
		for (const ringLL of outerRings(g)) {
			let ring = simplify(projRing(ringLL), 0.35);
			if (ring.length < 3) continue;
			let area = ringArea(ring);
			if (Math.abs(area) < 12) continue;
			if (area < 0) { ring.reverse(); area = -area; } // CCW in (x,z)
			let h = parseLen(t.height);
			const lv = parseFloat(t['building:levels']);
			if (!(h > 0)) h = lv > 0 ? lv * 3.4 + 1 : NaN;
			let minH = parseLen(t.min_height);
			if (!(minH >= 0)) {
				const ml = parseFloat(t['building:min_level']);
				minH = ml > 0 ? ml * 3.4 : 0;
			}
			const seed = hash(idNum);
			if (!(h > 0)) h = 11 + Math.floor(seed * 5) * 3.4; // sensible low-rise default
			if (h <= minH) h = minH + 3.4;
			h = Math.min(h, 480);
			const c = centroid(ring);
			const rec = {ring, h, minH, seed, area, c, name: t.name || '', type: t.building || t['building:part']};
			if (t['building:part'] && !t.building) parts.push(rec);
			else buildings.push(rec);
		}
		continue;
	}
	if (t.highway && g.type === 'LineString') {
		const name = t.name || '';
		const bname = `${name} ${t['bridge:name'] || ''}`;
		let bridgeKey = null;
		if (t.bridge && t.bridge !== 'no') for (const [k, re] of BRIDGES) if (re.test(bname)) bridgeKey = k;
		const pts = g.coordinates.map(([lon, lat]) => proj(lon, lat));
		if (bridgeKey) {
			(bridgePts[bridgeKey] ||= []).push(...pts);
			continue;
		}
		if (t.tunnel && t.tunnel !== 'no') continue;
		if (!(t.highway in ROAD_CLS)) continue;
		if (t.area === 'yes') continue;
		const lanes = parseFloat(t.lanes);
		let width = ROAD_W[t.highway];
		if (lanes > 0) width = Math.max(width * 0.7, Math.min(24, lanes * 3.3 + 1));
		roads.push({pts, cls: ROAD_CLS[t.highway], width, oneway: t.oneway === 'yes' ? 1 : 0, name, nodes: wayNodes.get(idNum) || null, id: idNum});
		continue;
	}
	if (t.railway && g.type === 'LineString') {
		const name = `${t.name || ''} ${t['bridge:name'] || ''}`;
		if (t.bridge && /manhattan bridge/i.test(name)) (bridgePts.manhattanRail ||= []).push(...g.coordinates.map(([lon, lat]) => proj(lon, lat)));
		continue;
	}
	const isPark = t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'pitch' || t.leisure === 'playground' || t.landuse || t.natural === 'wood' || t.natural === 'scrub';
	if (t.natural === 'water' || t.waterway === 'riverbank' || t.waterway === 'dock') {
		if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
			const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
			for (const poly of polys) waters.push(poly.map(projRing));
		}
		continue;
	}
	if (t.man_made === 'pier') {
		if (g.type === 'Polygon') piers.push({ring: projRing(g.coordinates[0])});
		else if (g.type === 'LineString') piers.push({line: g.coordinates.map(([lon, lat]) => proj(lon, lat))});
		continue;
	}
	if (isPark && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
		for (const r of outerRings(g)) parks.push(projRing(r));
	}
}
console.log(`buildings ${buildings.length}, parts ${parts.length}, roads ${roads.length}, parks ${parks.length}, waters ${waters.length}, piers ${piers.length}, trees ${trees.length}, signals ${signals.length}`);

// ---------- landmark sites: remove OSM geometry where hero models go ----------
const LANDMARK_SITES = [
	['esb', 40.74844, -73.98566, 62],
	['chrysler', 40.75161, -73.97537, 36],
	['wtc1', 40.71300, -74.01318, 52],
	['flatiron', 40.74106, -73.98970, 38],
	['cpt', 40.76631, -73.98101, 34], // Central Park Tower
	['steinway', 40.76480, -73.97765, 26], // 111 West 57th
	['park432', 40.76165, -73.97187, 26],
	['one57', 40.76546, -73.97905, 30],
];
const sites = LANDMARK_SITES.map(([name, lat, lon, r]) => ({name, p: proj(lon, lat), r}));
const inSite = (c) => sites.some((s) => Math.hypot(c[0] - s.p[0], c[1] - s.p[1]) < s.r);

// ---------- building parts: if an outline contains parts, draw the parts instead ----------
const CELL = 60;
const grid = new Map();
const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
for (const p of parts) (grid.get(key(p.c[0], p.c[1])) || grid.set(key(p.c[0], p.c[1]), []).get(key(p.c[0], p.c[1]))).push(p);
const finalB = [];
let replaced = 0;
for (const b of buildings) {
	if (inSite(b.c)) continue;
	let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
	for (const p of b.ring) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
	let partArea = 0;
	for (let gx = Math.floor(minx / CELL); gx <= Math.floor(maxx / CELL); gx++)
		for (let gz = Math.floor(minz / CELL); gz <= Math.floor(maxz / CELL); gz++)
			for (const p of grid.get(`${gx},${gz}`) || []) if (p.minH < 1 && pointInRing(p.c[0], p.c[1], b.ring)) partArea += p.area;
	if (partArea > b.area * 0.5) { replaced++; continue; }
	finalB.push(b);
}
for (const p of parts) if (!inSite(p.c)) finalB.push(p);
console.log(`outlines replaced by parts: ${replaced}; final building solids: ${finalB.length}`);

// ---------- join road ways into long chains (for traffic splines) ----------
const byName = new Map();
for (const r of roads) {
	if (!r.name || !r.nodes || r.cls > 4) continue;
	const k = `${r.name}|${r.cls}|${r.oneway}`;
	(byName.get(k) || byName.set(k, []).get(k)).push(r);
}
const dead = new Set();
for (const list of byName.values()) {
	let merged = true;
	while (merged) {
		merged = false;
		const starts = new Map();
		for (const r of list) if (!dead.has(r)) starts.set(r.nodes[0], r);
		for (const a of list) {
			if (dead.has(a)) continue;
			const b = starts.get(a.nodes[a.nodes.length - 1]);
			if (b && b !== a && !dead.has(b)) {
				a.pts = a.pts.concat(b.pts.slice(1));
				a.nodes = a.nodes.concat(b.nodes.slice(1));
				a.width = Math.max(a.width, b.width);
				dead.add(b);
				merged = true;
				break;
			}
		}
	}
}
const finalRoads = roads.filter((r) => !dead.has(r));
// intersection parameters: nodes shared by two or more ways -> crosswalk sites
const nodeUse = new Map();
for (const r of finalRoads) if (r.nodes && r.cls <= 4) for (const n of new Set(r.nodes)) nodeUse.set(n, (nodeUse.get(n) || 0) + 1);
for (const r of finalRoads) {
	r.inter = [];
	if (!r.nodes || r.cls > 4) continue;
	for (let i = 0; i < r.nodes.length; i++) if (nodeUse.get(r.nodes[i]) > 1) r.inter.push(i);
}
console.log(`road chains: ${finalRoads.length}`);

// ---------- bridges: principal axis from the real OSM bridge ways ----------
const bridges = {};
for (const [k, pts] of Object.entries(bridgePts)) {
	let cx = 0, cz = 0;
	for (const p of pts) { cx += p[0]; cz += p[1]; }
	cx /= pts.length; cz /= pts.length;
	let sxx = 0, szz = 0, sxz = 0;
	for (const p of pts) { const dx = p[0] - cx, dz = p[1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
	const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
	const dx = Math.cos(ang), dz = Math.sin(ang);
	let tmin = 1e9, tmax = -1e9;
	for (const p of pts) { const t = (p[0] - cx) * dx + (p[1] - cz) * dz; tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); }
	bridges[k] = {cx, cz, dx, dz, tmin, tmax, n: pts.length};
}
console.log('bridges', JSON.stringify(bridges));

// ---------- raster mask: R land, G park, B road ----------
const PX = 2.8;
const MW = Math.ceil((X1 - X0) / PX), MH = Math.ceil((Z1 - Z0) / PX);
console.log(`mask ${MW}x${MH}`);
const mk = () => new Float32Array(MW * MH);
const land = mk(), park = mk(), road = mk(), water = mk();
const toPx = (p) => [(p[0] - X0) / PX, (p[1] - Z0) / PX];
const fillRing = (buf, ringW, val = 1) => {
	const r = ringW.map(toPx);
	let minY = 1e9, maxY = -1e9;
	for (const p of r) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
	const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(MH - 1, Math.ceil(maxY));
	for (let y = y0; y <= y1; y++) {
		const yc = y + 0.5;
		const xs = [];
		for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
			const a = r[i], b = r[j];
			if (a[1] > yc !== b[1] > yc) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
		}
		xs.sort((a, b) => a - b);
		for (let k = 0; k + 1 < xs.length; k += 2) {
			const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(MW - 1, Math.round(xs[k + 1]) - 1);
			for (let x = xa; x <= xb; x++) buf[y * MW + x] = val;
		}
	}
};
// distance-field style thick line: value 0.5 at the edge, +-RANGE metres
const RANGE = 5;
const drawLine = (buf, pts, hw, hard = false) => {
	const reach = hw + (hard ? 0 : RANGE);
	for (let i = 0; i + 1 < pts.length; i++) {
		const a = pts[i], b = pts[i + 1];
		const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - reach - X0) / PX)), x1 = Math.min(MW - 1, Math.ceil((Math.max(a[0], b[0]) + reach - X0) / PX));
		const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - reach - Z0) / PX)), y1 = Math.min(MH - 1, Math.ceil((Math.max(a[1], b[1]) + reach - Z0) / PX));
		const dx = b[0] - a[0], dz = b[1] - a[1];
		const l2 = dx * dx + dz * dz || 1e-9;
		for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
			const px = X0 + (x + 0.5) * PX, pz = Z0 + (y + 0.5) * PX;
			let t = ((px - a[0]) * dx + (pz - a[1]) * dz) / l2;
			t = t < 0 ? 0 : t > 1 ? 1 : t;
			const d = Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
			const v = hard ? (d <= hw ? 1 : 0) : Math.max(0, Math.min(1, 0.5 + (hw - d) / (2 * RANGE)));
			const idx = y * MW + x;
			if (v > buf[idx]) buf[idx] = v;
		}
	}
};
for (const b of finalB) if (b.minH < 2) fillRing(land, b.ring);
for (const s of sites) fillRing(land, Array.from({length: 16}, (_, i) => [s.p[0] + Math.cos(i * 0.3927) * s.r, s.p[1] + Math.sin(i * 0.3927) * s.r]));
for (const r of finalRoads) { drawLine(land, r.pts, r.width / 2 + 5, true); if (r.cls <= 5) drawLine(road, r.pts, r.width / 2); }
for (const p of parks) { fillRing(land, p); fillRing(park, p); }
for (const p of piers) { if (p.ring) fillRing(land, p.ring); else drawLine(land, p.line, 5, true); }
for (const w of waters) { fillRing(water, w[0]); for (let i = 1; i < w.length; i++) fillRing(water, w[i], 0); }

const morph = (src, rad, isMax) => {
	const tmp = mk(), out = mk();
	const pick = isMax ? Math.max : Math.min;
	for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
		let v = src[y * MW + x];
		for (let k = Math.max(0, x - rad); k <= Math.min(MW - 1, x + rad); k++) v = pick(v, src[y * MW + k]);
		tmp[y * MW + x] = v;
	}
	for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
		let v = tmp[y * MW + x];
		for (let k = Math.max(0, y - rad); k <= Math.min(MH - 1, y + rad); k++) v = pick(v, tmp[k * MW + x]);
		out[y * MW + x] = v;
	}
	return out;
};
const blur = (src, passes) => {
	let a = src;
	for (let p = 0; p < passes; p++) {
		const o = mk();
		for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
			let s = 0, n = 0;
			for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
				const xx = x + dx, yy = y + dy;
				if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
				s += a[yy * MW + xx]; n++;
			}
			o[y * MW + x] = s / n;
		}
		a = o;
	}
	return a;
};
let landC = morph(morph(land, 12, true), 11, false); // close gaps inside blocks
// rivers / ponds: large open water always wins over the closed land estimate
const waterE = morph(water, 1, false);
for (let i = 0; i < landC.length; i++) if (waterE[i] > 0.5 && land[i] < 0.5) landC[i] = 0;
landC = blur(landC, 2);
const parkB = blur(park, 2);
for (let i = 0; i < parkB.length; i++) if (waterE[i] > 0.5) parkB[i] = 0;
let landPx = 0;
for (let i = 0; i < landC.length; i++) if (landC[i] > 0.5) landPx++;
console.log(`land fraction: ${(landPx / landC.length).toFixed(3)}`);

// PNG (RGB8) encoder
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
};
const rawPng = Buffer.alloc((MW * 3 + 1) * MH);
for (let y = 0; y < MH; y++) {
	const o = y * (MW * 3 + 1);
	rawPng[o] = 0;
	for (let x = 0; x < MW; x++) {
		const i = y * MW + x;
		rawPng[o + 1 + x * 3] = Math.round(landC[i] * 255);
		rawPng[o + 2 + x * 3] = Math.round(parkB[i] * 255);
		rawPng[o + 3 + x * 3] = Math.round(road[i] * 255);
	}
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(MW, 0); ihdr.writeUInt32BE(MH, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(path.join(OUT, 'mask.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rawPng, {level: 9})), chunk('IEND', Buffer.alloc(0))]));

// ---------- binary outputs ----------
{
	let n = 1;
	for (const b of finalB) n += 5 + b.ring.length * 2;
	const f = new Float32Array(n);
	let o = 0;
	f[o++] = finalB.length;
	for (const b of finalB) {
		f[o++] = b.ring.length; f[o++] = b.h; f[o++] = b.minH; f[o++] = b.seed; f[o++] = /church|cathedral|chapel|synagogue/.test(b.type) ? 1 : 0;
		for (const p of b.ring) { f[o++] = p[0]; f[o++] = p[1]; }
	}
	fs.writeFileSync(path.join(OUT, 'buildings.bin'), Buffer.from(f.buffer));
}
const names = [];
const nameIdx = new Map();
{
	let n = 1;
	for (const r of finalRoads) n += 6 + r.pts.length * 2 + r.inter.length;
	const f = new Float32Array(n);
	let o = 0;
	f[o++] = finalRoads.length;
	for (const r of finalRoads) {
		let ni = -1;
		if (r.name) { if (!nameIdx.has(r.name)) { nameIdx.set(r.name, names.length); names.push(r.name); } ni = nameIdx.get(r.name); }
		f[o++] = r.pts.length; f[o++] = r.cls; f[o++] = r.width; f[o++] = r.oneway; f[o++] = ni; f[o++] = r.inter.length;
		for (const p of r.pts) { f[o++] = p[0]; f[o++] = p[1]; }
		for (const i of r.inter) f[o++] = i;
	}
	fs.writeFileSync(path.join(OUT, 'roads.bin'), Buffer.from(f.buffer));
}
const r1 = (v) => Math.round(v * 10) / 10;
const flat = (pts) => pts.flatMap((p) => [r1(p[0]), r1(p[1])]);
fs.writeFileSync(path.join(OUT, 'misc.json'), JSON.stringify({
	origin: {lat: LAT0, lon: LON0, mLat: M_LAT, mLon: M_LON},
	mask: {x0: X0, z0: Z0, px: PX, w: MW, h: MH},
	sites: Object.fromEntries(sites.map((s) => [s.name, [r1(s.p[0]), r1(s.p[1])]])),
	bridges,
	roadNames: names,
	trees: flat(trees), signals: flat(signals), crossings: flat(crossings), subways: flat(subways),
	stats: {buildings: finalB.length, roads: finalRoads.length},
}));
for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2), 'MB');
