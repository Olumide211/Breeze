// The World owns every three.js object in the film. Its state is a pure function of the
// (fractional) frame number: update(frame) can be called for any frame in any order and
// always produces identical pixels.
import * as THREE from 'three';
import {buildTiles, type Tile} from '../city/buildings';
import type {City} from '../city/data';
import {makeFacadeMaterial, makeGBufferMaterial} from '../shaders/facade';
import {U} from '../shaders/common';
import {cameraAt, envAt, FPS, getPath, pathU, SHOTS, type CamState, type Env, type Shot} from '../timeline';
export type WorldLike = {renderView(renderer: THREE.WebGLRenderer, camera: THREE.Camera, target: THREE.WebGLRenderTarget, id: string): void};
import {makeGround, makeWater} from './ground';
import {Reflection, Shadows} from './lighting';
import {cloudLayout, makeCloudAtlas, makeClouds, makeNoiseTexture, makeSkyDome, makeWaterNormals} from './sky';

export type PathSample = {x: number; y: number; z: number};
export interface System {
	object?: THREE.Object3D;
	setShot?(shot: Shot, samples: PathSample[], world: World): void;
	update?(frame: number, env: Env, cam: CamState, world: World): void;
	hideInReflection?: boolean;
}

// distance from a point to the camera path of a shot (horizontal)
export const pathDist = (samples: PathSample[], x: number, z: number) => {
	let d = 1e9;
	for (const s of samples) d = Math.min(d, Math.hypot(s.x - x, s.z - z));
	return d;
};

export class World {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 30000);
	city: City;
	tiles: Tile[];
	gMat = makeGBufferMaterial();
	facadeMat = makeFacadeMaterial();
	private gbufs = new Map<string, THREE.WebGLRenderTarget>();
	private fsScene = new THREE.Scene();
	private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	shadows = new Shadows();
	reflection = new Reflection();
	systems: System[] = [];
	ground: THREE.Mesh;
	water: THREE.Mesh;
	sky: THREE.Mesh;
	clouds: THREE.Mesh;
	noise: THREE.DataTexture;
	shotIndex = -1;
	steamSites: number[] = [];
	landmarks: {bbAxis: {cx: number; cz: number; dx: number; dz: number}; mbAxis: {cx: number; cz: number; dx: number; dz: number}} | null = null;
	env!: Env;
	cam: CamState = {pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0};
	size = new THREE.Vector2(1920, 1080);
	debugFar = 0;
	debugCam: number[] | null = null; // QA override: x,y,z, lookX,lookY,lookZ, fov
	private reflHide: THREE.Object3D[] = [];
	private fwd = new THREE.Vector3();

	constructor(city: City) {
		this.city = city;
		this.noise = makeNoiseTexture(512);
		U.uNoise.value = this.noise;
		this.sky = makeSkyDome();
		this.scene.add(this.sky);
		this.ground = makeGround(city);
		this.scene.add(this.ground);
		this.water = makeWater(city, makeWaterNormals(this.noise));
		this.scene.add(this.water);
		this.tiles = buildTiles(city, this.gMat);
		const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.facadeMat);
		quad.frustumCulled = false;
		this.fsScene.add(quad);
		for (const t of this.tiles) this.scene.add(t.mesh);
		this.clouds = makeClouds(makeCloudAtlas(), cloudLayout());
		this.scene.add(this.clouds);
		this.reflHide = [this.ground, this.water];
	}

	add(sys: System) {
		this.systems.push(sys);
		if (sys.object) {
			this.scene.add(sys.object);
			if (sys.hideInReflection) this.reflHide.push(sys.object);
		}
	}

	pathSamples(shot: Shot): PathSample[] {
		const p = getPath(shot);
		const out: PathSample[] = [];
		const v = new THREE.Vector3();
		for (let i = 0; i <= 60; i++) {
			p.pos.getPointAt(pathU(shot, i / 60), v);
			out.push({x: v.x, y: v.y, z: v.z});
		}
		return out;
	}

	// LOD and prop sets are chosen once per shot and never change inside it.
	setShot(i: number) {
		this.shotIndex = i;
		const shot = SHOTS[i];
		const samples = this.pathSamples(shot);
		for (const s of this.systems) s.setShot?.(shot, samples, this);
	}

	update(frame: number, jx = 0, jy = 0) {
		const env = envAt(frame);
		this.env = env;
		if (env.shotIndex !== this.shotIndex) this.setShot(env.shotIndex);
		const shot = env.shot;
		const cam = cameraAt(frame, this.cam);
		if (this.debugCam) {
			const d = this.debugCam;
			cam.pos.set(d[0], d[1], d[2]); cam.look.set(d[3], d[4], d[5]); cam.fov = d[6] ?? 40; cam.roll = 0;
		}
		const c = this.camera;
		c.position.copy(cam.pos);
		c.up.set(0, 1, 0);
		c.lookAt(cam.look);
		if (cam.roll) c.rotateZ(cam.roll);
		c.fov = cam.fov;
		c.aspect = this.size.x / this.size.y;
		c.near = this.debugCam ? 2 : shot.near;
		c.far = this.debugFar || (this.debugCam ? 60000 : shot.far);
		c.updateProjectionMatrix();
		// sub-pixel jitter: the 8 accumulated sub-frames double as supersampling
		c.projectionMatrix.elements[8] += (2 * jx) / this.size.x;
		c.projectionMatrix.elements[9] += (2 * jy) / this.size.y;
		c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
		c.updateMatrixWorld(true);

		U.uTime.value = env.time;
		U.uCamPos.value.copy(c.position);
		U.uSunDir.value.copy(env.sunDir);
		U.uKeyDir.value.copy(env.keyDir);
		U.uSunColor.value.fromArray(env.sun);
		U.uSkyZen.value.fromArray(env.zen);
		U.uSkyMid.value.fromArray(env.mid);
		U.uSkyHor.value.fromArray(env.hor);
		U.uSkyGlow.value.fromArray(env.glow);
		U.uAmbSky.value.fromArray(env.ambS);
		U.uAmbGround.value.fromArray(env.ambG);
		U.uRim.value.fromArray(env.rim);
		U.uCloudLit.value.fromArray(env.cloudL);
		U.uCloudShade.value.fromArray(env.cloudS);
		U.uWaterCol.value.fromArray(env.water);
		U.uFog.value = env.fog;
		U.uMist.value = env.mist;
		U.uNight.value = env.night;
		U.uFarGrid.value = env.shot.farGrid ?? 0;
		U.uStars.value = env.stars;
		U.uSunUp.value = env.sunUp;
		U.uWet.value = env.wet;
		U.uRain.value = env.rain;
		U.uTod.value = env.tod;
		U.uCloudCover.value = env.cloudCover;
		// wind: the deck drifts ~12 m/s, per-shot offset keeps compositions distinct
		U.uCloudOffset.value.set(env.shotIndex * 0.173 + (env.time * 12) / 9000, env.shotIndex * 0.291 + (env.time * 5) / 9000);
		(this.clouds.material as THREE.ShaderMaterial).uniforms.uWind.value.set(env.time * 12, 0, env.time * 5);
		// Empire State floodlights: white at dusk, colour at night
		const on = THREE.MathUtils.smoothstep(env.tod, 0.775, 0.8);
		const colour = THREE.MathUtils.smoothstep(env.tod, 0.86, 0.93);
		U.uLandmarkOn.value = on;
		U.uLandmarkGlow.value.set(THREE.MathUtils.lerp(1.5, 1.7, colour), THREE.MathUtils.lerp(1.4, 0.25, colour), THREE.MathUtils.lerp(1.25, 1.1, colour));
		for (const s of this.systems) s.update?.(frame, env, cam, this);
	}

	// One full view: G-buffer for the facades, deferred facade shading (colour + depth),
	// then every other object forward-rendered on top, depth-tested against the facades.
	renderView(renderer: THREE.WebGLRenderer, camera: THREE.Camera, target: THREE.WebGLRenderTarget, id: string) {
		let g = this.gbufs.get(id);
		if (!g || g.width !== target.width || g.height !== target.height) {
			g?.dispose();
			g = new THREE.WebGLRenderTarget(target.width, target.height, {count: 4, type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false});
			this.gbufs.set(id, g);
		}
		renderer.setClearColor(0x000000, 0);
		this.scene.overrideMaterial = this.gMat;
		camera.layers.set(2);
		renderer.setRenderTarget(g);
		renderer.clear(true, true, false);
		renderer.render(this.scene, camera);
		this.scene.overrideMaterial = null;
		camera.layers.set(0);
		const u = this.facadeMat.uniforms;
		u.tG0.value = g.textures[0]; u.tG1.value = g.textures[1]; u.tG2.value = g.textures[2]; u.tG3.value = g.textures[3];
		renderer.setRenderTarget(target);
		renderer.clear(true, true, false);
		renderer.render(this.fsScene, this.fsCam);
		renderer.render(this.scene, camera);
	}

	// once per frame (not per sub-frame): planar reflection; shadows only when the shot changes
	prepass(renderer: THREE.WebGLRenderer, frame: number) {
		this.update(frame);
		const shot = this.env.shot;
		const sunOk = shot.shadowRange > 0;
		if (sunOk && this.shadows.key !== shot.id) {
			// fixed mid-shot sun for the shadow maps (the lit/unlit ramp still follows the live sun)
			const mid = envAt(((shot.start + shot.end) / 2) * FPS);
			const samples = this.pathSamples(shot);
			const c = new THREE.Vector3();
			for (const p of samples) c.add(new THREE.Vector3(p.x, 0, p.z));
			c.multiplyScalar(1 / samples.length);
			let ext = 0;
			for (const p of samples) ext = Math.max(ext, Math.hypot(p.x - c.x, p.z - c.z));
			// bias the fine map forward along the view direction
			const cs = cameraAt(((shot.start + shot.end) / 2) * FPS);
			const fwd = new THREE.Vector3().subVectors(cs.look, cs.pos).setY(0).normalize();
			c.addScaledVector(fwd, shot.shadowRange * 0.14);
			this.shadows.render(renderer, this.scene, shot.id, mid.keyDir, c, ext + shot.shadowRange * 0.2, Math.max(ext + shot.shadowRange * 1.2, 3600));
		} else if (!sunOk) {
			this.shadows.render(renderer, this.scene, '', this.env.keyDir, this.camera.position, 0, 0);
		} else {
			U.uShadowOn.value = 1;
		}
		this.reflection.render(renderer, this, this.camera, this.reflHide, !!shot.reflect, this.size.x, this.size.y);
	}

	// view-projection of the film camera at an arbitrary frame (for reprojection motion blur)
	private tmpCam = new THREE.PerspectiveCamera();
	viewProjAt(frame: number, out: THREE.Matrix4) {
		const cs = cameraAt(frame);
		const shot = envAt(frame).shot;
		const c = this.tmpCam;
		if (this.debugCam) { const d = this.debugCam; cs.pos.set(d[0], d[1], d[2]); cs.look.set(d[3], d[4], d[5]); cs.fov = d[6] ?? 40; }
		c.position.copy(cs.pos); c.up.set(0, 1, 0); c.lookAt(cs.look);
		if (cs.roll) c.rotateZ(cs.roll);
		c.fov = cs.fov; c.aspect = this.size.x / this.size.y; c.near = this.debugCam ? 2 : shot.near; c.far = this.debugCam ? 60000 : shot.far;
		c.updateProjectionMatrix(); c.updateMatrixWorld(true);
		c.matrixWorldInverse.copy(c.matrixWorld).invert();
		return out.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
	}

	// camera-path collision report used by the QA loop
	collisionReport(): string[] {
		const out: string[] = [];
		const cs: CamState = {pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, roll: 0};
		for (const shot of SHOTS) {
			let worst = 1e9, at = 0;
			for (let f = shot.start * FPS; f < shot.end * FPS; f += 2) {
				cameraAt(f, cs);
				const h = this.city.heightAt(cs.pos.x, cs.pos.z, 6);
				const clear = cs.pos.y - h;
				if (h > 0 && clear < worst) { worst = clear; at = f; }
			}
			if (worst < 3) out.push(`${shot.id}: camera within ${worst.toFixed(1)} m of a roof/wall at frame ${at}`);
		}
		return out;
	}
}
