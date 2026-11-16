// Motion blur by sub-frame accumulation. For every output frame the scene is rendered
// N times across the shutter interval (with sub-pixel jitter, so it also supersamples)
// and averaged in a half-float HDR buffer before the rest of the post chain runs.
import {Pass} from 'postprocessing';
import * as THREE from 'three';
import type {World} from '../scenes/world';

const halton = (i: number, b: number) => {
	let f = 1, r = 0;
	while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
	return r;
};

export class AccumulationPass extends Pass {
	world: World;
	frame = 0;
	subframes = 8;
	shutter = 0.55; // fraction of the frame interval the shutter stays open
	private accum: THREE.WebGLRenderTarget;
	private quad: THREE.Mesh;
	private quadScene = new THREE.Scene();
	private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	private mat: THREE.ShaderMaterial;
	private clearColor = new THREE.Color(0, 0, 0);
	constructor(world: World) {
		super('AccumulationPass');
		this.world = world;
		this.needsSwap = false;
		this.accum = new THREE.WebGLRenderTarget(8, 8, {type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
		this.mat = new THREE.ShaderMaterial({
			uniforms: {tMap: {value: null}, uW: {value: 1}},
			vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
			fragmentShader: 'uniform sampler2D tMap; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tMap, vUv).rgb * uW, 1.0); }',
			depthTest: false,
			depthWrite: false,
			blending: THREE.CustomBlending,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.OneFactor,
			blendEquation: THREE.AddEquation,
		});
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
		this.quad.frustumCulled = false;
		this.quadScene.add(this.quad);
	}

	render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
		const w = inputBuffer.width, h = inputBuffer.height;
		if (this.accum.width !== w || this.accum.height !== h) this.accum.setSize(w, h);
		const world = this.world;
		world.size.set(w, h);
		const N = Math.max(1, this.subframes);
		const prevAuto = renderer.autoClear;
		renderer.autoClear = false;
		const gl = renderer.getContext();
		const prof = (globalThis as any).__PROF as boolean;
		const t0 = performance.now();
		world.prepass(renderer, this.frame + this.shutter * 0.5);
		const sync = () => { const px = new Uint8Array(4); renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
		if (prof) sync();
		const t1 = performance.now();
		let tUpd = 0;
		renderer.setClearColor(this.clearColor, 0);
		renderer.setRenderTarget(this.accum);
		renderer.clear(true, false, false);
		for (let k = 0; k < N; k++) {
			const jx = N > 1 ? halton(k + 1, 2) - 0.5 : 0;
			const jy = N > 1 ? halton(k + 1, 3) - 0.5 : 0;
			const tu = performance.now();
			world.update(this.frame + (N > 1 ? (this.shutter * (k + 0.5)) / N : 0), jx, jy);
			tUpd += performance.now() - tu;
			world.renderView(renderer, world.camera, inputBuffer, 'main');
			if (N === 1) break;
			this.mat.uniforms.tMap.value = inputBuffer.texture;
			this.mat.uniforms.uW.value = 1 / N;
			this.mat.blending = THREE.CustomBlending;
			renderer.setRenderTarget(this.accum);
			renderer.render(this.quadScene, this.quadCam);
		}
		// write the average back into the composer's input buffer (depth stays from the last sub-frame)
		if (N > 1) {
		this.mat.uniforms.tMap.value = this.accum.texture;
		this.mat.uniforms.uW.value = 1;
		this.mat.blending = THREE.NoBlending;
		renderer.setRenderTarget(inputBuffer);
		renderer.render(this.quadScene, this.quadCam);
		}
		renderer.autoClear = prevAuto;
		if (prof) {
			sync();
			const t2 = performance.now();
			console.warn(`[perf] ${w}x${h} dpr ${window.devicePixelRatio} frame ${this.frame}: prepass ${(t1 - t0).toFixed(0)} ms, ${N} subframes ${(t2 - t1).toFixed(0)} ms (js update ${tUpd.toFixed(0)} ms), tris last pass ${renderer.info.render.triangles}`);
		}
	}
}
