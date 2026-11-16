// Cascaded sun shadows (3 cascades in one atlas, texel-snapped, normal-offset bias)
// and the planar reflection pass used by the river and the wet streets.
import * as THREE from 'three';
import {U} from '../shaders/common';

const S = 4096;
const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

// Sun shadows: two nested orthographic maps (fine around the camera path, coarse over the
// visible city) in one atlas. They are rendered once per shot from the shot's mid-point sun,
// so they cost nothing per frame and can never crawl or flicker.
export class Shadows {
	rt: THREE.WebGLRenderTarget;
	cams = [0, 1].map(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
	depthMat = new THREE.MeshBasicMaterial({colorWrite: false, side: THREE.DoubleSide});
	key = '';
	private m = new THREE.Matrix4();
	private c = new THREE.Vector3();
	constructor() {
		this.rt = new THREE.WebGLRenderTarget(S * 2, S, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true});
		this.rt.depthTexture = new THREE.DepthTexture(S * 2, S, THREE.UnsignedIntType);
		this.rt.depthTexture.minFilter = THREE.NearestFilter;
		this.rt.depthTexture.magFilter = THREE.NearestFilter;
		U.uShadowMap.value = this.rt.depthTexture;
		for (const c of this.cams) c.layers.set(1);
	}
	render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, key: string, lightDir: THREE.Vector3, centre: THREE.Vector3, inner: number, outer: number) {
		if (outer <= 0 || lightDir.y < 0.012) {
			U.uShadowOn.value = 0;
			return;
		}
		U.uShadowOn.value = 1;
		if (key === this.key) return;
		this.key = key;
		const mats = [U.uShadowMat0.value, U.uShadowMat1.value];
		const prevTarget = renderer.getRenderTarget();
		const prevOverride = scene.overrideMaterial;
		this.rt.scissorTest = false;
		this.rt.viewport.set(0, 0, S * 2, S);
		renderer.setRenderTarget(this.rt);
		renderer.clear(true, true, false);
		scene.overrideMaterial = this.depthMat;
		const texel = [0, 0];
		[inner, outer].forEach((r, i) => {
			const cam = this.cams[i];
			const D = 6000;
			this.c.copy(centre);
			cam.position.copy(this.c).addScaledVector(lightDir, D);
			cam.up.set(0, 1, 0);
			cam.lookAt(this.c);
			cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
			cam.near = 1; cam.far = D * 2;
			cam.updateProjectionMatrix();
			cam.updateMatrixWorld(true);
			cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
			this.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
			mats[i].multiplyMatrices(BIAS, this.m);
			texel[i] = ((2 * r) / S) * 1.6;
			this.rt.viewport.set(i * S, 0, S, S);
			this.rt.scissor.set(i * S, 0, S, S);
			this.rt.scissorTest = true;
			renderer.setRenderTarget(this.rt);
			renderer.render(scene, cam);
		});
		U.uShadowTexel.value.set(texel[0], texel[1], 0);
		scene.overrideMaterial = prevOverride;
		renderer.setRenderTarget(prevTarget);
	}
}

export class Reflection {
	rt: THREE.WebGLRenderTarget;
	cam = new THREE.PerspectiveCamera();
	private n = new THREE.Vector3(0, 1, 0);
	private view = new THREE.Vector3();
	private target = new THREE.Vector3();
	private rot = new THREE.Matrix4();
	private look = new THREE.Vector3();
	private saved = new THREE.Vector3();
	constructor() {
		this.rt = new THREE.WebGLRenderTarget(8, 8, {type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true});
		U.uReflTex.value = this.rt.texture;
	}
	render(renderer: THREE.WebGLRenderer, world: {renderView(r: THREE.WebGLRenderer, c: THREE.Camera, t: THREE.WebGLRenderTarget, id: string): void}, camera: THREE.PerspectiveCamera, hide: THREE.Object3D[], on: boolean, w: number, h: number) {
		if (!on) {
			U.uReflOn.value = 0;
			return;
		}
		const rw = Math.max(8, Math.round(w / 2)), rh = Math.max(8, Math.round(h / 2));
		if (this.rt.width !== rw || this.rt.height !== rh) this.rt.setSize(rw, rh);
		const planeY = 0;
		// mirror the camera about y = planeY (same maths as three's Reflector)
		this.view.set(camera.position.x, 2 * planeY - camera.position.y, camera.position.z);
		this.rot.extractRotation(camera.matrixWorld);
		this.look.set(0, 0, -1).applyMatrix4(this.rot).add(camera.position);
		this.target.set(this.look.x, 2 * planeY - this.look.y, this.look.z);
		const cam = this.cam;
		cam.position.copy(this.view);
		cam.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.n);
		cam.lookAt(this.target);
		cam.fov = camera.fov; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = camera.far;
		cam.updateProjectionMatrix();
		cam.updateMatrixWorld(true);
		cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
		U.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
		const vis = hide.map((o) => o.visible);
		hide.forEach((o) => (o.visible = false));
		U.uReflOn.value = 0;
		this.saved.copy(U.uCamPos.value);
		U.uCamPos.value.copy(cam.position);
		const prev = renderer.getRenderTarget();
		world.renderView(renderer, cam, this.rt, 'reflection');
		renderer.setRenderTarget(prev);
		U.uCamPos.value.copy(this.saved);
		hide.forEach((o, i) => (o.visible = vis[i]));
		U.uReflOn.value = 1;
	}
}
