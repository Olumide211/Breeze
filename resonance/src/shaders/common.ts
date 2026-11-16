// Shared uniforms + GLSL chunks: painted sky gradient, aerial perspective,
// soft anime ramp lighting, cascaded shadow lookup and cloud shadows.
import * as THREE from 'three';

const v3 = () => ({value: new THREE.Vector3()});
const m4 = () => ({value: new THREE.Matrix4()});

// One uniform object shared by reference across every material in the film.
export const U = {
	uTime: {value: 0},
	uCamPos: v3(),
	uSunDir: v3(), // true sun direction (sky)
	uKeyDir: v3(), // key light direction (sun or moon)
	uSunColor: v3(),
	uSkyZen: v3(),
	uSkyMid: v3(),
	uSkyHor: v3(),
	uSkyGlow: v3(),
	uAmbSky: v3(),
	uAmbGround: v3(),
	uRim: v3(),
	uCloudLit: v3(),
	uCloudShade: v3(),
	uWaterCol: v3(),
	uFog: {value: 1e-4},
	uMist: {value: 0},
	uNight: {value: 0},
	uStars: {value: 0},
	uSunUp: {value: 1},
	uWet: {value: 0},
	uRain: {value: 0},
	uTod: {value: 0},
	uCloudCover: {value: 0.5},
	uCloudOffset: {value: new THREE.Vector2()},
	uNoise: {value: null as THREE.Texture | null},
	uShadowMap: {value: null as THREE.Texture | null},
	uShadowMat0: m4(),
	uShadowMat1: m4(),
	uShadowMat2: m4(),
	uShadowOn: {value: 0},
	uShadowTexel: {value: new THREE.Vector3(0.5, 2, 8)},
	uReflTex: {value: null as THREE.Texture | null},
	uReflMat: m4(),
	uReflOn: {value: 0},
	uLandmarkGlow: v3(), // Empire State floodlight colour
	uLandmarkOn: {value: 0},
	uWindowWave: {value: 0}, // blue-hour "windows switching on" wave front
};

export const COMMON_PARS = /* glsl */ `
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uKeyDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZen;
uniform vec3 uSkyMid;
uniform vec3 uSkyHor;
uniform vec3 uSkyGlow;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uRim;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uWaterCol;
uniform float uFog;
uniform float uMist;
uniform float uNight;
uniform float uStars;
uniform float uSunUp;
uniform float uWet;
uniform float uRain;
uniform float uTod;
uniform float uCloudCover;
uniform vec2 uCloudOffset;
uniform sampler2D uNoise;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat0;
uniform mat4 uShadowMat1;
uniform mat4 uShadowMat2;
uniform float uShadowOn;
uniform vec3 uShadowTexel;
uniform sampler2D uReflTex;
uniform mat4 uReflMat;
uniform float uReflOn;
uniform vec3 uLandmarkGlow;
uniform float uLandmarkOn;
uniform float uWindowWave;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
float sat(float x) { return clamp(x, 0.0, 1.0); }

// painted sky gradient (no clouds): shared by the dome, fog and reflections
vec3 skyBase(vec3 d) {
	float h = max(d.y, 0.0);
	vec3 c = mix(uSkyHor, uSkyMid, smoothstep(0.0, 0.22, h));
	c = mix(c, uSkyZen, smoothstep(0.12, 0.85, h));
	float sd = max(dot(d, uSunDir), 0.0);
	float band = pow(1.0 - h, 7.0);
	c += uSkyGlow * (pow(sd, 6.0) * 0.35 + pow(sd, 40.0) * 0.6) * uSunUp;
	c += uSkyGlow * band * (0.12 + 0.55 * pow(sd * 0.5 + 0.5, 3.0)) * uSunUp;
	return c;
}

// aerial perspective: exponential fog tinted by the sky in the view direction
vec3 applyFog(vec3 col, vec3 wp) {
	vec3 v = wp - uCamPos;
	float dist = length(v);
	vec3 d = v / max(dist, 1e-3);
	// height falloff: thicker near the ground/river
	float hAvg = max(0.5 * (wp.y + uCamPos.y), 0.0);
	float dens = uFog * mix(1.0, 0.35, sat(hAvg / 600.0));
	float f = 1.0 - exp(-dist * dens);
	// low river mist
	float m = uMist * (1.0 - exp(-dist * 0.0011)) * exp(-max(wp.y, 0.0) / 22.0) * 0.85;
	f = max(f, m);
	vec3 fd = normalize(vec3(d.x, abs(d.y) * 0.25 + 0.03, d.z));
	vec3 fc = skyBase(fd);
	fc = mix(fc, uSkyHor * 1.05 + uSkyGlow * 0.08, uMist * 0.5);
	return mix(col, fc, f);
}

float cloudShadow(vec3 wp) {
	// project along the key light onto the cloud deck (1500 m)
	vec2 p = wp.xz + uKeyDir.xz * ((1500.0 - wp.y) / max(uKeyDir.y, 0.12));
	#ifdef DEFERRED
	float n = textureLod(uNoise, p / 9000.0 + uCloudOffset, 0.0).r;
	#else
	float n = texture2D(uNoise, p / 9000.0 + uCloudOffset).r;
	#endif
	return 1.0 - 0.5 * smoothstep(1.0 - uCloudCover - 0.05, 1.0 - uCloudCover + 0.2, n) * uSunUp;
}

float shadowTap(vec2 uv, float z) {
	return step(z, texture2D(uShadowMap, uv).r);
}
float shadowCascade(vec3 sc, float xo, float bias) {
	vec2 uv = vec2((sc.x + xo) / 2.0, sc.y);
	float z = sc.z - bias;
	vec2 t = vec2(1.0 / 8192.0, 1.0 / 4096.0) * 0.8;
	float s = shadowTap(uv + vec2(-t.x, -t.y), z) + shadowTap(uv + vec2(t.x, -t.y), z) + shadowTap(uv + vec2(-t.x, t.y), z) + shadowTap(uv + vec2(t.x, t.y), z);
	return s * 0.25;
}
float sunShadow(vec3 wp, vec3 n) {
	if (uShadowOn < 0.5) return 1.0;
	float ndl = sat(dot(n, uKeyDir));
	float slope = 1.0 + 3.0 * (1.0 - ndl);
	vec3 s0 = (uShadowMat0 * vec4(wp + n * uShadowTexel.x * slope, 1.0)).xyz;
	if (all(greaterThan(s0.xy, vec2(0.01))) && all(lessThan(s0.xy, vec2(0.99)))) return shadowCascade(s0, 0.0, 0.0004);
	vec3 s1 = (uShadowMat1 * vec4(wp + n * uShadowTexel.y * slope, 1.0)).xyz;
	if (all(greaterThan(s1.xy, vec2(0.01))) && all(lessThan(s1.xy, vec2(0.99)))) return shadowCascade(s1, 1.0, 0.0006);
	return 1.0;
}

// soft two-band anime ramp + coloured shadows + rim light
vec3 animeShade(vec3 albedo, vec3 n, vec3 v, float shadow, float ao) {
	float ndl = dot(n, uKeyDir);
	float ramp = smoothstep(-0.08, 0.30, ndl) * 0.72 + smoothstep(0.5, 0.78, ndl) * 0.28;
	float lit = ramp * shadow;
	vec3 amb = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5) * ao;
	// a touch of bounced key light keeps shadow sides painterly instead of flat
	amb += uSunColor * 0.045 * (1.0 - lit) * (0.6 + 0.4 * sat(-ndl));
	vec3 c = albedo * (amb + uSunColor * lit);
	float rim = pow(1.0 - sat(dot(n, v)), 3.0);
	c += albedo * uRim * rim * (0.25 + 0.75 * lit);
	return c;
}
`;

// vertex chunk for instanced + plain meshes
export const WORLD_VERT = /* glsl */ `
vec4 worldPos4(vec3 p) {
	#ifdef USE_INSTANCING
	return modelMatrix * instanceMatrix * vec4(p, 1.0);
	#else
	return modelMatrix * vec4(p, 1.0);
	#endif
}
vec3 worldNormal(vec3 n) {
	#ifdef USE_INSTANCING
	return normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
	#else
	return normalize(mat3(modelMatrix) * n);
	#endif
}
`;
