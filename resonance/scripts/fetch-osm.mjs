// STAGE 1a: download real OpenStreetMap data through the Overpass API.
// The area is split into small bbox tiles; every tile is cached in data/raw/
// so later builds and renders work fully offline. Failed tiles are retried
// with exponential backoff across several Overpass mirrors.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
fs.mkdirSync(RAW, {recursive: true});

// Battery Park -> Central Park (south half), Hudson -> Brooklyn / LIC waterfront
export const BBOX = {south: 40.686, north: 40.788, west: -74.04, east: -73.938};
export const TILES_X = 6;
export const TILES_Y = 7;

const MIRRORS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.openstreetmap.fr/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const query = (s, w, n, e) => `[out:json][timeout:120][maxsize:536870912];
(
  way["building"](${s},${w},${n},${e});
  relation["building"](${s},${w},${n},${e});
  way["building:part"](${s},${w},${n},${e});
  relation["building:part"](${s},${w},${n},${e});
  way["highway"](${s},${w},${n},${e});
  way["railway"~"^(subway|rail|light_rail)$"](${s},${w},${n},${e});
  way["leisure"~"^(park|garden|pitch|playground)$"](${s},${w},${n},${e});
  relation["leisure"~"^(park|garden)$"](${s},${w},${n},${e});
  way["landuse"~"^(grass|forest|meadow|recreation_ground|cemetery)$"](${s},${w},${n},${e});
  way["natural"~"^(water|wood|coastline|scrub)$"](${s},${w},${n},${e});
  relation["natural"="water"](${s},${w},${n},${e});
  way["man_made"~"^(pier|bridge)$"](${s},${w},${n},${e});
  way["waterway"](${s},${w},${n},${e});
  node["natural"="tree"](${s},${w},${n},${e});
  node["highway"~"^(traffic_signals|crossing)$"](${s},${w},${n},${e});
  node["railway"="subway_entrance"](${s},${w},${n},${e});
);
out body geom qt;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTile(tx, ty) {
	const file = path.join(RAW, `tile_${tx}_${ty}.json`);
	if (fs.existsSync(file) && fs.statSync(file).size > 200) {
		return 'cached';
	}
	const dLat = (BBOX.north - BBOX.south) / TILES_Y;
	const dLon = (BBOX.east - BBOX.west) / TILES_X;
	const s = BBOX.south + ty * dLat;
	const w = BBOX.west + tx * dLon;
	const q = query(s.toFixed(6), w.toFixed(6), (s + dLat).toFixed(6), (w + dLon).toFixed(6));
	let lastErr;
	for (let attempt = 0; attempt < 10; attempt++) {
		const url = MIRRORS[attempt % MIRRORS.length];
		try {
			const ctrl = new AbortController();
			const t = setTimeout(() => ctrl.abort(), 150000);
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent': 'resonance-city-builder/1.0',
				},
				body: 'data=' + encodeURIComponent(q),
				signal: ctrl.signal,
			});
			clearTimeout(t);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const text = await res.text();
			const json = JSON.parse(text);
			if (!Array.isArray(json.elements)) throw new Error('no elements');
			if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
			fs.writeFileSync(file, JSON.stringify(json));
			return `${json.elements.length} elements via ${new URL(url).host}`;
		} catch (err) {
			lastErr = err;
			const wait = Math.min(60000, 2000 * 2 ** Math.floor(attempt / MIRRORS.length)) + attempt * 500;
			console.log(`  tile ${tx},${ty} attempt ${attempt + 1} failed on ${new URL(url).host}: ${err.message}; retrying in ${wait} ms`);
			await sleep(wait);
		}
	}
	throw new Error(`tile ${tx},${ty} failed: ${lastErr}`);
}

const failed = [];
for (let ty = 0; ty < TILES_Y; ty++) {
	for (let tx = 0; tx < TILES_X; tx++) {
		try {
			const r = await fetchTile(tx, ty);
			console.log(`tile ${tx},${ty}: ${r}`);
			if (r !== 'cached') await sleep(1500);
		} catch (err) {
			console.log(String(err));
			failed.push([tx, ty]);
		}
	}
}
if (failed.length) {
	console.log(`FAILED tiles: ${JSON.stringify(failed)} (run again to resume)`);
	process.exit(1);
}
console.log('All tiles cached in data/raw');
