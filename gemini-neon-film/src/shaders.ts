/*
 * One GLSL background function drives the whole film:
 *   black -> app navy glow (01-home-empty) -> thinking aurora (03-thinking)
 *   -> aurora fills the frame -> Google's Gemini 4 key-art blues.
 * The glass shader calls the same function at refracted coordinates, so what
 * you see through the tube is the actual world behind it, slightly bent.
 * All colours are sRGB hex values from the spec; the canvas is rendered flat/linear
 * so they reach the screen unchanged.
 */
export const BG_UNIFORMS = /* glsl */ `
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uNavyRise;
uniform float uNavyAmt;
uniform float uAurora;
uniform float uSpread;
uniform float uWorld;
`;

export const BG_GLSL = /* glsl */ `
vec3 hexc(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }

// 01-home-empty: black through the top 55%, #070c21 at 78%, #122158 at 92%, #16296e at the bottom centre
vec3 navyGlow(vec2 uv) {
  float y = uv.y - (1.0 - uNavyRise) * 0.5;
  vec3 c = vec3(0.0);
  c = mix(c, hexc(7.0, 12.0, 33.0), smoothstep(0.55, 0.78, y));
  c = mix(c, hexc(18.0, 33.0, 88.0), smoothstep(0.78, 0.92, y));
  c = mix(c, hexc(22.0, 41.0, 110.0), smoothstep(0.92, 1.0, y));
  float side = abs(uv.x - 0.5) * 2.0;
  c *= 1.0 - 0.28 * side * side;
  return c;
}

// 03-thinking aurora: #025543 top-left, #0e6d83 top-middle, #11426b top-right,
// through #04251e at ~35% height to black by ~70%
vec3 aurora(vec2 uv) {
  vec3 tl = hexc(2.0, 85.0, 67.0);
  vec3 tm = hexc(14.0, 109.0, 131.0);
  vec3 tr = hexc(17.0, 66.0, 107.0);
  float x = uv.x + 0.05 * (fbm(vec2(uv.x * 2.0, uTime * 0.15)) - 0.5);
  vec3 top = x < 0.5 ? mix(tl, tm, smoothstep(0.0, 0.5, x)) : mix(tm, tr, smoothstep(0.5, 1.0, x));
  float reveal = uAurora;
  float grow = 1.0 + 2.4 * uSpread;
  float e1 = max(0.001, 0.35 * reveal * grow);
  float e2 = max(0.002, 0.70 * reveal * grow);
  float y = uv.y + 0.035 * sin(uv.x * 4.0 + uTime * 0.6) * reveal;
  vec3 mid = hexc(4.0, 37.0, 30.0);
  vec3 c = y < e1 ? mix(top, mid, smoothstep(0.0, e1, y)) : mix(mid, vec3(0.0), smoothstep(e1, e2, y));
  // spreading: everything lifts and brightens toward the top-middle teal
  c = mix(c, mix(tm, tl, 0.3), 0.35 * uSpread * smoothstep(0.0, 1.0, uv.y));
  c *= 1.0 + 0.45 * uSpread;
  return c * smoothstep(0.0, 0.25, reveal + 0.2 * uSpread);
}

// Google's Gemini 4 key art: navy bottom-left -> mid blues -> almost white-blue top-right
vec3 keyart(vec2 p) {
  float m = max(uRes.x, uRes.y);
  vec2 q = p / m;
  vec2 L = vec2(uRes.x / m, 0.0);
  vec2 D = vec2(0.0, uRes.y / m);
  vec2 dl = D - L;
  float warp = (fbm(q * 1.7 + vec2(uTime * 0.012, -uTime * 0.02)) - 0.5) * 0.16;
  float t = 1.0 - clamp(dot(q - L, dl) / dot(dl, dl) + warp, 0.0, 1.0);
  vec3 c = hexc(8.0, 24.0, 59.0);                               // #08183b
  c = mix(c, hexc(10.0, 60.0, 149.0), smoothstep(0.0, 0.24, t)); // #0a3c95
  c = mix(c, hexc(27.0, 73.0, 159.0), smoothstep(0.2, 0.40, t)); // #1b499f
  c = mix(c, hexc(43.0, 100.0, 180.0), smoothstep(0.38, 0.55, t)); // #2b64b4
  c = mix(c, hexc(60.0, 114.0, 219.0), smoothstep(0.52, 0.66, t)); // #3c72db
  c = mix(c, hexc(82.0, 156.0, 238.0), smoothstep(0.64, 0.80, t)); // #529cee
  c = mix(c, hexc(145.0, 210.0, 245.0), smoothstep(0.80, 0.93, t)); // #91d2f5
  c = mix(c, hexc(211.0, 245.0, 252.0), smoothstep(0.93, 1.02, t)); // #d3f5fc
  // soft light bloom from the top-right corner
  vec2 dq = q - L;
  float glow = exp(-dot(dq, dq) / 0.07);
  c = mix(c, hexc(211.0, 245.0, 252.0), 0.55 * glow);
  // deep navy pool at the bottom-left, like Argon / Carbon
  vec2 dd = (q - D) * vec2(1.0, 1.3);
  c = mix(c, hexc(8.0, 24.0, 59.0), 0.55 * exp(-dot(dd, dd) / 0.12));
  return c;
}

vec3 bgColor(vec2 p) {
  vec2 uv = p / uRes;
  vec3 app = navyGlow(uv) * uNavyAmt + aurora(uv);
  if (uWorld <= 0.0) return app;
  return mix(app, keyart(p), uWorld);
}
`;

export const BG_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const BG_FRAG = /* glsl */ `
${BG_UNIFORMS}
${BG_GLSL}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  gl_FragColor = vec4(bgColor(p), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Glass neon tube
// ---------------------------------------------------------------------------
export const TUBE_VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec2 vUv;
void main() {
  vUv = uv;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SWEEP_UNIFORMS = /* glsl */ `
uniform float uReveal;     // 0 -> 1.2 : refraction sweep from the top-right
uniform vec4 uBox;         // screen bbox x0,y0,x1,y1 of the object
`;

export const SWEEP_GLSL = /* glsl */ `
// s = 0 at the top-right corner of the bbox, 1 at the bottom-left
float sweepS(vec2 p) {
  vec2 n = (p - vec2(uBox.z, uBox.y)) / max(vec2(1.0), vec2(uBox.z - uBox.x, uBox.w - uBox.y));
  return clamp((-n.x + n.y) * 0.5, 0.0, 1.0);
}
`;

export const TUBE_FRAG = /* glsl */ `
${BG_UNIFORMS}
${SWEEP_UNIFORMS}
uniform float uGas;        // gas brightness 0..1.15
uniform float uElectrode;  // electrode glow 0..1
uniform float uUneven;     // uneven brightness during flickers
uniform float uFlickT;
uniform float uPx;         // tube radius in px (for refraction strength)
varying vec3 vNormalV;
varying vec2 vUv;
${BG_GLSL}
${SWEEP_GLSL}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  vec3 n = normalize(vNormalV);
  float ndv = clamp(abs(n.z), 0.0, 1.0);
  float edge = 1.0 - ndv;

  // --- unlit glass: the blue world seen through a round tube, slightly bent
  vec2 off = -n.xy * vec2(1.0, -1.0) * uPx * 0.9 * edge;
  vec3 bgA = bgColor(p + off);
  vec3 bgB = bgColor(p + off * 1.7 + vec2(3.0, -2.0));
  vec3 glass = mix(bgA, bgB, 0.5);
  glass = mix(glass, vec3(0.86, 0.94, 1.0), 0.07 + 0.10 * edge); // frosted milkiness
  // thin-film iridescence: cyan / violet / a touch of pink near the walls
  float ph = edge * 1.6 + vUv.x * 2.5 + n.y * 0.4;
  vec3 iri = 0.5 + 0.5 * cos(6.2831 * (ph + vec3(0.52, 0.66, 0.80)));
  iri = mix(vec3(0.55, 0.92, 1.0), iri, 0.65);
  glass = mix(glass, glass * 0.4 + iri * 0.75, 0.22 * smoothstep(0.25, 0.85, edge));
  // slightly darker inner band just inside the walls
  float band = smoothstep(0.5, 0.72, edge) * (1.0 - smoothstep(0.78, 0.9, edge));
  glass *= 1.0 - 0.22 * band;

  // --- gas discharge
  float l = vUv.x;
  float gUneven = 1.0 + uUneven * (vnoise(vec2(l * 16.0, uFlickT * 3.1)) - 0.5) * 1.3;
  float G = uGas * gUneven;
  float E = uElectrode * (smoothstep(0.045, 0.0, l) + smoothstep(0.955, 1.0, l));
  float Gt = max(G, E * 0.9);
  // radial offset across the tube (0 = centre line, 1 = outer wall) for a round tube
  float rx = sqrt(max(0.0, 1.0 - ndv * ndv));
  float column = 1.0 - smoothstep(0.50, 0.66, rx);       // plasma column inside the glass wall
  float core = 1.0 - smoothstep(0.04, 0.4, rx);          // hot centre line
  float wallGlow = smoothstep(0.5, 0.75, rx) * (1.0 - smoothstep(0.9, 1.0, rx)); // light scattered in the glass wall
  vec3 body = mix(hexc(255.0, 74.0, 28.0), hexc(255.0, 90.0, 42.0), 1.0 - rx) * (0.9 + 0.2 * (1.0 - rx)); // #ff4a1c -> #ff5a2a
  vec3 col = glass;
  float Gc = clamp(Gt, 0.0, 1.0);
  col = mix(col, col * 0.55 + body * 0.55, wallGlow * Gc * 0.55); // glass wall lit from inside, still shows the world
  col = mix(col, body, column * Gc * 0.97);
  col = mix(col, hexc(255.0, 210.0, 176.0), core * core * Gc * 0.95);     // #ffd2b0 core
  col += hexc(255.0, 120.0, 70.0) * max(0.0, Gt - 1.0) * column;  // surge overshoot
  // glass walls stay visible: thin bright rims on both edges, warmed when lit
  float rim = smoothstep(0.86, 0.985, rx) * (1.0 - smoothstep(0.995, 1.0, rx) * 0.5);
  vec3 rimCol = mix(vec3(0.86, 0.95, 1.0), hexc(255.0, 196.0, 170.0), clamp(Gt, 0.0, 1.0) * 0.75);
  col = mix(col, rimCol, rim * 0.85);
  // key light from the top-right (the key-art light source)
  vec3 Lt = normalize(vec3(0.55, 0.65, 0.6));
  float spec = pow(max(dot(n, normalize(Lt + vec3(0.0, 0.0, 1.0))), 0.0), 70.0);
  col += vec3(0.95, 0.99, 1.0) * spec * (0.85 - 0.45 * clamp(Gt, 0.0, 1.0));

  // --- refraction sweep reveal
  float s = sweepS(p);
  float vis = smoothstep(uReveal, uReveal - 0.14, s);
  float sweepBand = exp(-pow((s - uReveal) / 0.035, 2.0)) * step(uReveal, 1.1);
  col += vec3(0.82, 0.97, 1.0) * sweepBand * (0.55 + 0.45 * edge);
  float a = clamp(max(vis, sweepBand * 0.9), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(1.0)), a);
}
`;

// Dark metal electrode caps (and their wire)
export const METAL_FRAG = /* glsl */ `
${BG_UNIFORMS}
${SWEEP_UNIFORMS}
uniform float uGlow;
varying vec3 vNormalV;
varying vec2 vUv;
${BG_GLSL}
${SWEEP_GLSL}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  vec3 n = normalize(vNormalV);
  float ndv = clamp(abs(n.z), 0.0, 1.0);
  vec3 base = vec3(0.10, 0.12, 0.16);
  vec3 env = bgColor(p + n.xy * vec2(1.0, -1.0) * 40.0);
  float fres = pow(1.0 - ndv, 2.0);
  vec3 col = base + env * (0.18 + 0.4 * fres);
  vec3 Lt = normalize(vec3(0.55, 0.65, 0.6));
  float spec = pow(max(dot(n, normalize(Lt + vec3(0.0, 0.0, 1.0))), 0.0), 30.0);
  col += vec3(0.8, 0.9, 1.0) * spec * 0.6;
  col += hexc(255.0, 90.0, 42.0) * uGlow * 0.1 * fres;
  float s = sweepS(p);
  float vis = smoothstep(uReveal, uReveal - 0.14, s);
  gl_FragColor = vec4(col, vis);
}
`;
