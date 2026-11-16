// Procedural facade shader: window grids with mullions, interior mapping (fake rooms
// with depth, curtains, plants, lamps), brick / limestone / glass / concrete variants,
// ledges, cornices, storefronts, wall AC units and seeded night lighting.
import * as THREE from 'three';
import {COMMON_PARS, U} from './common';

// G-buffer pass: SwiftShader (software GL) has no early depth rejection and evaluates every
// shader branch, so facades are shaded deferred: geometry writes attributes only, and the
// expensive facade shader below then runs exactly once per visible pixel.
const G_VERT = /* glsl */ `
in vec4 aB; // seed, kind, floors, surface (0 wall, 1 roof, 2 floodlit wall)
out vec3 vW;
out vec3 vN;
out vec2 vUv;
out vec4 vB;
void main() {
	vW = position;
	vN = normal;
	vUv = uv;
	vB = aB;
	gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;
const G_FRAG = /* glsl */ `
in vec3 vW;
in vec3 vN;
in vec2 vUv;
in vec4 vB;
layout(location = 0) out highp vec4 g0;
layout(location = 1) out highp vec4 g1;
layout(location = 2) out highp vec4 g2;
layout(location = 3) out highp vec4 g3;
void main() {
	vec3 N = normalize(vN);
	if (!gl_FrontFacing) N = -N;
	g0 = vec4(vW, vB.w + 1.0);
	g1 = vec4(N, gl_FragCoord.z);
	g2 = vec4(vUv, vB.x, floor(vB.y + 0.5) + vB.z / 512.0);
	g3 = vec4(fwidth(vUv), max(fwidth(vW.x), fwidth(vW.z)), 1.0);
}
`;
export const makeGBufferMaterial = () =>
	new THREE.ShaderMaterial({vertexShader: G_VERT, fragmentShader: G_FRAG, glslVersion: THREE.GLSL3, side: THREE.DoubleSide});

const VERT = /* glsl */ `
void main() {
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
#define DEFERRED
${COMMON_PARS}
uniform sampler2D tG0;
uniform sampler2D tG1;
uniform sampler2D tG2;
uniform sampler2D tG3;

vec3 pal4(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
	t = t * 4.0;
	return t < 1.0 ? a : t < 2.0 ? b : t < 3.0 ? c : d;
}

void main() {
	ivec2 ic = ivec2(gl_FragCoord.xy);
	vec4 G0 = texelFetch(tG0, ic, 0);
	if (G0.w < 0.5) discard;
	vec4 G1 = texelFetch(tG1, ic, 0);
	vec4 G2 = texelFetch(tG2, ic, 0);
	vec4 G3 = texelFetch(tG3, ic, 0);
	vec3 vW = G0.xyz;
	vec3 N = G1.xyz;
	vec2 vUv = G2.xy;
	vec4 vB = vec4(G2.z, floor(G2.w), fract(G2.w) * 512.0, G0.w - 1.0);
	vec2 gFw = G3.xy;
	float gRfw = G3.z;
	gl_FragDepth = G1.w;
	#ifdef DBG_G
	gl_FragColor = DBG_G == 0 ? vec4(fract(G0.xyz * 0.01), 1.0) : DBG_G == 1 ? vec4(G1.xyz * 0.5 + 0.5, 1.0) : DBG_G == 2 ? vec4(fract(G2.xy), G2.z, 1.0) : vec4(vec3(pow(G1.w, 40.0)), 1.0);
	return;
	#endif
	vec3 V = normalize(uCamPos - vW);
	float seed = vB.x;
	float kind = vB.y;
	float floors = vB.z;
	// hero-landmark variants reuse the base material families with fixed colours
	vec3 ov = vec3(-1.0);
	vec2 ovW = vec2(-1.0);
	if (kind > 4.5) {
		if (kind < 5.5) { kind = 1.0; ov = vec3(0.6, 0.6, 0.58); }            // Chrysler: pale brick
		else if (kind < 6.5) { kind = 2.0; ov = vec3(0.1, 0.2, 0.34); }       // One WTC: blue glass
		else if (kind < 7.5) { kind = 1.0; ov = vec3(0.4, 0.27, 0.17); }      // 111 W 57th: terracotta + bronze
		else if (kind < 8.5) { kind = 3.0; ov = vec3(0.6, 0.6, 0.58); ovW = vec2(0.36, 0.36); } // 432 Park grid
		else { kind = 2.0; ov = vec3(0.07, 0.13, 0.2); }                      // dark glass supertall
	}
	vec3 r3 = hash32(vec2(seed * 913.7, seed * 371.3 + 7.0));
	float shadow = sunShadow(vW, N) * cloudShadow(vW);
	vec3 col;
	vec3 emis = vec3(0.0);
	float paint = textureLod(uNoise, vec2(vUv.x * 0.031 + seed * 7.0, vUv.y * 0.017 + seed * 3.0), log2(max(max(gFw.x, gFw.y) * 16.0, 1.0))).g;


	if (vB.w > 0.5 && vB.w < 1.5) {
		// ---------------- roofs ----------------
		vec3 rc = pal4(r3.x, vec3(0.085, 0.085, 0.095), vec3(0.21, 0.2, 0.185), vec3(0.34, 0.345, 0.36), vec3(0.26, 0.225, 0.19));
		float blot = textureLod(uNoise, vW.xz / 37.0 + seed, log2(max(gRfw * 14.0, 1.0))).b;
		rc *= 0.8 + 0.45 * blot;
		#if 1
		vec2 seam = abs(fract((vW.xz + seed * 40.0) / vec2(4.2, 6.5)) - 0.5);
		float sf = gRfw;
		rc *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.012 + sf * 0.2, min(seam.x, seam.y))) * (1.0 - smoothstep(0.15, 0.6, sf));
		#endif
		col = animeShade(rc, N, V, shadow, 1.0);
		// faint city glow on roofs at night
		col += rc * uNight * vec3(0.10, 0.07, 0.09);
	} else {
		// ---------------- walls ----------------
		vec2 cuv = vUv;
		vec2 cell = floor(cuv);
		vec2 f = fract(cuv);
		vec2 fwv = gFw;
		float fw = max(fwv.x, fwv.y);
		float detail = 1.0 - smoothstep(0.2, 0.62, fw);
		bool ground = cell.y < 0.5 && kind < 3.5;
		bool top = cell.y > floors - 1.5;

		vec3 wallCol;
		vec2 hsz;
		float bayW = 2.4;
		float refl = 0.35;
		if (kind < 0.5) { // brick
			wallCol = pal4(r3.x, vec3(0.30, 0.105, 0.075), vec3(0.19, 0.095, 0.07), vec3(0.47, 0.33, 0.21), vec3(0.58, 0.5, 0.4));
			if (r3.y > 0.8) wallCol = vec3(0.085, 0.07, 0.065);
			hsz = vec2(0.25, 0.3); bayW = 2.2;
		} else if (kind < 1.5) { // limestone / terracotta
			wallCol = pal4(r3.x, vec3(0.62, 0.56, 0.46), vec3(0.5, 0.47, 0.42), vec3(0.7, 0.63, 0.5), vec3(0.4, 0.38, 0.36));
			hsz = vec2(0.27, 0.32); bayW = 2.6;
		} else if (kind < 2.5) { // glass curtain wall
			wallCol = pal4(r3.x, vec3(0.10, 0.19, 0.33), vec3(0.08, 0.2, 0.24), vec3(0.16, 0.2, 0.26), vec3(0.2, 0.17, 0.12));
			if (r3.y > 0.75) wallCol = vec3(0.05, 0.09, 0.15);
			hsz = vec2(0.465, 0.41); bayW = 1.6; refl = 0.75;
		} else if (kind < 3.5) { // concrete, ribbon windows
			wallCol = pal4(r3.x, vec3(0.46, 0.45, 0.43), vec3(0.34, 0.35, 0.36), vec3(0.58, 0.55, 0.5), vec3(0.3, 0.29, 0.28));
			hsz = vec2(0.44, 0.27); bayW = 3.0; refl = 0.5;
		} else { // Empire State: limestone piers, dark metal spandrels
			wallCol = vec3(0.6, 0.57, 0.5);
			hsz = vec2(0.27, 0.3); bayW = 2.0;
			if (abs(f.x - 0.5) < 0.29) wallCol = vec3(0.17, 0.17, 0.19);
		}
		if (ov.x >= 0.0) wallCol = ov;
		if (ovW.x >= 0.0) hsz = ovW;

		vec2 wc = vec2(0.5, 0.5);
		if (ground) { hsz = vec2(0.45, 0.36); wc = vec2(0.5, 0.42); }
		if (kind < 1.5 && top && r3.z > 0.3) hsz.y *= 0.8;

		// painterly variation + height gradient
		float hgt = vW.y;
		wallCol *= 0.86 + 0.3 * paint;
		wallCol *= mix(0.8, 1.04, smoothstep(0.0, 30.0, hgt));

		vec2 d = abs(f - wc) - hsz;
		float aa = max(fw * 0.8, 0.004);
		float win = 1.0 - smoothstep(-aa, aa, max(d.x, d.y));
		float winCover = 4.0 * hsz.x * hsz.y;

		// masonry details
		vec3 base = wallCol;
		if (kind < 1.5 || kind > 3.5) {
			float ledge = (1.0 - smoothstep(0.0, 0.05, f.y)) * 0.5 + smoothstep(0.93, 1.0, f.y) * 0.5;
			base = mix(base, base * 1.18, ledge * 0.55 * detail * step(0.5, mod(cell.y, kind < 0.5 ? 6.0 : 1.0) < 0.5 ? 1.0 : 0.35));
			// sills and lintels
			float sill = (1.0 - smoothstep(0.0, aa, abs(d.x + 0.02) - 0.05)) * (1.0 - smoothstep(0.0, aa, abs(f.y - (wc.y - hsz.y - 0.03)) - 0.03));
			float lint = (1.0 - smoothstep(0.0, aa, abs(d.x + 0.02) - 0.05)) * (1.0 - smoothstep(0.0, aa, abs(f.y - (wc.y + hsz.y + 0.035)) - 0.035));
			base = mix(base, wallCol * 1.35 + 0.03, (sill + lint * 0.7) * detail * 0.8);
			if (top && kind < 3.5) {
				// cornice with dentils
				float cz = smoothstep(0.74, 0.76, f.y);
				float dent = step(0.5, fract(cuv.x * 5.0)) * step(f.y, 0.86);
				base = mix(base, wallCol * (1.25 - 0.3 * dent * detail) + 0.02, cz);
				base *= 1.0 - 0.35 * smoothstep(0.66, 0.74, f.y) * (1.0 - cz);
				win *= 1.0 - smoothstep(0.7, 0.74, f.y);
			}
		}
		#if 1
		if (kind < 0.5) {
			// brick courses
			vec2 bm = cuv * vec2(bayW, 3.4) / vec2(0.46, 0.16);
			bm.x += 0.5 * floor(bm.y);
			vec2 bf = fract(bm);
			float bfw = max(gFw.x * bayW / 0.46, gFw.y * 3.4 / 0.16);
			float bd = 1.0 - smoothstep(0.25, 0.8, bfw);
			float mortar = max(1.0 - smoothstep(0.0, 0.07, bf.x), 1.0 - smoothstep(0.0, 0.14, bf.y));
			float bt = hash21(floor(bm) + seed * 91.0);
			base *= 1.0 + bd * ((bt - 0.5) * 0.22 - mortar * 0.2);
		} else if (kind < 1.5 || kind > 3.5) {
			vec2 sm = cuv * vec2(bayW, 3.4) / vec2(1.3, 0.62);
			sm.x += 0.5 * floor(sm.y);
			vec2 sf2 = fract(sm);
			float sfw = max(gFw.x * bayW / 1.3, gFw.y * 3.4 / 0.62);
			float line = max(1.0 - smoothstep(0.0, 0.03, sf2.x), 1.0 - smoothstep(0.0, 0.05, sf2.y));
			base *= 1.0 - line * 0.14 * (1.0 - smoothstep(0.2, 0.7, sfw));
		}
		#endif
		if (kind > 1.5 && kind < 2.5) {
			// spandrel panels + mullion highlights on curtain walls
			float sp = step(f.y, wc.y - hsz.y);
			base = mix(wallCol * 0.7, wallCol * 1.5 + 0.05, (1.0 - sp) * (1.0 - win) * detail);
		}
		if (ground) {
			// storefront: awning + sign band
			float ag = floor(cuv.x / 3.0);
			vec3 ah = hash32(vec2(ag, seed * 77.0));
			vec3 awn = ah.x < 0.25 ? vec3(0.5, 0.06, 0.06) : ah.x < 0.5 ? vec3(0.05, 0.22, 0.12) : ah.x < 0.75 ? vec3(0.06, 0.1, 0.3) : vec3(0.7, 0.6, 0.4);
			float band = smoothstep(0.8, 0.82, f.y);
			base = mix(base * 0.8, awn * (0.75 + 0.25 * step(0.5, fract(cuv.x * 2.0))), band * step(ah.y, 0.7));
			vec3 neon = ah.z < 0.33 ? vec3(1.0, 0.25, 0.5) : ah.z < 0.66 ? vec3(0.2, 0.9, 1.0) : vec3(1.0, 0.75, 0.3);
			emis += neon * band * step(0.7, ah.y) * (0.8 + uNight * 3.0) * (0.92 + 0.08 * sin(uTime * 3.0 + ag * 5.0)) * step(0.35, uNight + ah.x * 0.3);
		}


		// ---------------- windows ----------------
		float rw = hash21(cell + seed * 511.0);
		float rf = hash11(cell.y * 3.7 + seed * 131.0);
		bool office = kind > 1.5 && kind < 3.5;
		float rr = office ? mix(rw, rf, 0.65) : rw;
		float litFrac = ground ? 0.85 : office ? 0.5 : kind > 3.5 ? 0.4 : 0.42;
		litFrac *= 0.75 + 0.5 * r3.z;
		// windows switch on one by one; whole buildings join in waves (blue hour)
		float thr = mix(rr, r3.y, 0.3) / litFrac;
		float lit = smoothstep(thr, thr + 0.04, uNight * 1.04);
		vec3 lcol = rw < 0.55 ? vec3(1.0, 0.72, 0.38) : rw < 0.8 ? vec3(1.0, 0.86, 0.62) : rw < 0.93 ? vec3(0.72, 0.84, 1.0) : vec3(1.0, 0.5, 0.75);
		if (office) lcol = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.7), step(0.6, rf));
		// very slow, very subtle TV-like breathing on a few windows (deterministic, no strobing)
		float flick = 1.0 + 0.06 * sin(uTime * 1.7 + rw * 40.0) * step(0.9, fract(rw * 7.3));
		float lum = (1.6 + 2.2 * fract(rw * 13.7)) * flick;

		vec3 R = reflect(-V, N);
		// tiny per-pane tilt so sun glints sparkle pane by pane
		R = normalize(R + (hash32(cell + seed * 17.0) - 0.5) * 0.045 * detail);
		vec3 skyR = mix(uSkyHor * 0.55 + uAmbGround * 0.3, mix(uSkyHor, uSkyZen, sat(R.y * 1.4)), smoothstep(-0.12, 0.08, R.y));
		float fres = refl * (0.35 + 0.65 * pow(1.0 - sat(dot(N, V)), 3.0));
		float glint = pow(max(dot(R, uKeyDir), 0.0), 220.0) * 9.0 + pow(max(dot(R, uKeyDir), 0.0), 24.0) * 0.35;
		vec3 glassRefl = skyR + uSunColor * glint * shadow * uSunUp;

		vec3 room = vec3(0.02, 0.025, 0.035);
		vec3 roomE = vec3(0.0);
		#if 1
		if (win > 0.01 && detail > 0.05) {
			// interior mapping: intersect the view ray with a box room behind the pane
			vec3 T = normalize(vec3(-N.z, 0.0, N.x));
			vec3 I = -V;
			vec3 ti = vec3(dot(I, T) / bayW, I.y / 3.4, max(-dot(I, N), 1e-3) / (office ? 9.0 : 4.5));
			vec2 p = (f - (wc - hsz)) / (2.0 * hsz);
			p = clamp(p, 0.0, 1.0);
			vec2 scale = 2.0 * hsz; // room is a bit bigger than the pane
			vec3 ro = vec3(mix(0.5 - 0.5 * scale.x, 0.5 + 0.5 * scale.x, p.x), mix(0.5 - 0.5 * scale.y, 0.5 + 0.5 * scale.y, p.y), 0.0);
			float tx = ti.x > 0.0 ? (1.0 - ro.x) / ti.x : -ro.x / min(ti.x, -1e-5);
			float ty = ti.y > 0.0 ? (1.0 - ro.y) / ti.y : -ro.y / min(ti.y, -1e-5);
			float tz = 1.0 / ti.z;
			float t = min(tx, min(ty, tz));
			vec3 hp = ro + ti * t;
			vec3 rh = hash32(cell * 1.31 + seed * 53.0);
			vec3 wallpaper = mix(vec3(0.75, 0.68, 0.56), vec3(0.45, 0.55, 0.62), rh.x);
			if (rh.y > 0.7) wallpaper = vec3(0.7, 0.45, 0.4);
			if (office) wallpaper = vec3(0.72, 0.74, 0.76);
			vec3 sc;
			if (t == tz) {
				sc = wallpaper;
				// picture frame / shelf / doorway on the back wall
				vec2 q = hp.xy;
				float fr = step(abs(q.x - 0.3 - 0.4 * rh.z) , 0.12) * step(abs(q.y - 0.55), 0.14);
				sc = mix(sc, hash32(cell + 9.0) * 0.6 + 0.1, fr * 0.8);
				float door = step(abs(q.x - 0.85 + 0.7 * step(0.5, rh.x)), 0.09) * step(q.y, 0.62);
				sc = mix(sc, vec3(0.16, 0.1, 0.07), door);
				// lamp glow on the back wall
				float lamp = exp(-dot(q - vec2(0.2 + 0.6 * rh.y, 0.45), q - vec2(0.2 + 0.6 * rh.y, 0.45)) * 18.0);
				sc += vec3(1.0, 0.7, 0.4) * lamp * 0.9 * step(rh.z, 0.55);
			} else if (t == ty) {
				sc = ti.y > 0.0 ? vec3(0.9, 0.88, 0.84) : mix(vec3(0.32, 0.2, 0.12), vec3(0.4, 0.4, 0.42), float(office));
				if (ti.y > 0.0) {
					// ceiling light: round fixture at home, strip lights in offices
					float cl = office ? step(abs(fract(hp.z * 3.0) - 0.5), 0.12) * step(abs(hp.x - 0.5), 0.4) : exp(-dot(hp.xz - vec2(0.5), hp.xz - vec2(0.5)) * 30.0);
					sc += vec3(1.0, 0.95, 0.85) * cl * 1.5;
				}
			} else {
				sc = wallpaper * 0.72;
			}
			float depthFade = mix(1.0, 0.45, sat(hp.z));
			sc *= depthFade;
			// curtains and blinds at the pane
			float cur = rh.x * 0.42 * step(rh.y, 0.75);
			float curtain = step(p.x, cur) + step(1.0 - cur * (0.4 + rh.z), p.x);
			vec3 curCol = mix(vec3(0.85, 0.8, 0.7), hash32(cell + 3.0) * 0.5 + 0.3, 0.5) * (0.75 + 0.25 * sin(p.x * 60.0));
			if (office) { curtain = step(1.0 - rh.x * 0.6, p.y) * step(rh.y, 0.6); curCol = vec3(0.8, 0.8, 0.78) * (0.8 + 0.2 * step(0.5, fract(p.y * 24.0))); }
			sc = mix(sc, curCol, sat(curtain));
			// plant on the sill
			vec2 pl = (p - vec2(0.2 + 0.6 * rh.z, 0.1)) / vec2(0.13, 0.2);
			float plant = (1.0 - smoothstep(0.7, 1.0, length(pl) + 0.25 * sin(atan(pl.y, pl.x) * 5.0 + rh.x * 6.0))) * step(0.72, rh.y) * (1.0 - float(office));
			sc = mix(sc, vec3(0.1, 0.32, 0.12), plant);
			// window cross bars on older buildings
			if (kind < 1.5) {
				float bar = max(1.0 - smoothstep(0.0, 0.03, abs(p.x - 0.5)), 1.0 - smoothstep(0.0, 0.025, abs(p.y - 0.5)));
				sc = mix(sc, wallCol * 0.5 + 0.2, bar * 0.9);
			}
			room = sc * (0.05 + 0.1 * (uAmbSky + uSunColor * 0.08));
			roomE = sc * lcol * lum * lit;
		} else {
			roomE = lcol * lum * lit * 0.55;
		}
		// wall AC unit hanging from the window on older buildings
		if (kind < 1.5 && !ground) {
			float ac = step(hash21(cell * 3.3 + seed * 29.0), 0.16);
			vec2 ad = abs(f - vec2(wc.x, wc.y - hsz.y + 0.07)) - vec2(0.15, 0.075);
			float am = (1.0 - smoothstep(-aa, aa, max(ad.x, ad.y))) * ac * detail;
			base = mix(base, vec3(0.55, 0.56, 0.56) * (0.7 + 0.3 * step(0.5, fract(f.y * 60.0))), am);
			win *= 1.0 - am;
		}
		#else
		roomE = lcol * lum * lit * 0.55;
		#endif


		vec3 glass = mix(room, glassRefl, fres) + (kind > 1.5 && kind < 2.5 ? wallCol * 0.25 * (uAmbSky + uSunColor * 0.1 * shadow) : vec3(0.0));
		vec3 wallLit = animeShade(base, N, V, shadow, mix(0.72, 1.0, smoothstep(0.0, 14.0, hgt)));
		// street-level glow at night: storefronts and streetlights wash the lower floors
		wallLit += base * uNight * vec3(1.0, 0.62, 0.34) * 0.5 * exp(-hgt / 9.0);
		wallLit += base * uNight * vec3(0.09, 0.07, 0.13);
		vec3 detailed = mix(wallLit, glass + roomE, win);
		// distant facades: fade the grid into its average so nothing shimmers
		// (only per-building constants here: per-window hashes would shimmer when minified)
		vec3 avgCol = office ? vec3(0.88, 0.92, 1.0) : vec3(1.0, 0.78, 0.5);
		float avgLit = sat((uNight * 1.04 * litFrac - 0.3 * r3.y) / 0.7);
		vec3 avgWin = mix(vec3(0.03), skyR, fres) + avgCol * 2.6 * 0.55 * avgLit;
		vec3 avg = mix(wallLit, avgWin, winCover * (ground ? 0.0 : 1.0));
		col = mix(avg, detailed, detail);


		if (vB.w > 1.5) {
			// floodlit crown (Empire State): washes of light climbing the stone
			float g = smoothstep(0.0, 1.0, fract(cuv.y / max(floors, 1.0)));
			col += (base + 0.25) * uLandmarkGlow * uLandmarkOn * (0.55 + 0.9 * g);
		}
	}
	col += emis;
	col = applyFog(col, vW);
	gl_FragColor = vec4(col, 1.0);
}
`;

export const makeFacadeMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {...(U as any), tG0: {value: null}, tG1: {value: null}, tG2: {value: null}, tG3: {value: null}},
		vertexShader: VERT,
		fragmentShader: FRAG,
		depthFunc: THREE.AlwaysDepth,
		depthWrite: true,
		depthTest: true,
	});
