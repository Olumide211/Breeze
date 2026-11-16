import {Bloom, ChromaticAberration, DepthOfField, EffectComposer, GodRays, SMAA} from '@react-three/postprocessing';
import {useFrame, useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import type {EffectComposer as ComposerImpl} from 'postprocessing';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {loadCity} from './city/data';
import {clamp, smooth} from './lib/rng';
import {AccumulationPass} from './post/accum';
import {FlareEffect, GradeEffect, MotionBlurEffect, OutlineEffect} from './post/effects';
import {buildShots} from './scenes/shots';
import {addSystems} from './scenes/systems';
import {World} from './scenes/world';
import {DURATION, envAt, FPS, SHOTS, shotIndexAt} from './timeline';
import {Title} from './Title';

export type FilmProps = {subframes: number; debugCam?: number[] | null; prof?: boolean; hide?: string};

const Stage: React.FC<{world: World; frame: number; subframes: number}> = ({world, frame, subframes}) => {
	const {gl} = useThree();
	const composer = useRef<ComposerImpl>(null);
	const accum = useMemo(() => new AccumulationPass(world), [world]);
	const outline = useMemo(() => new OutlineEffect(), []);
	const flare = useMemo(() => new FlareEffect(), []);
	const grade = useMemo(() => new GradeEffect(), []);
	const mblur = useMemo(() => new MotionBlurEffect(), []);
	const mats = useMemo(() => ({prev: new THREE.Matrix4(), cur: new THREE.Matrix4()}), []);
	const bloom = useRef<any>(null);
	const dof = useRef<any>(null);
	const sunMesh = useMemo(() => {
		const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({color: 0xffe2b0, transparent: true, depthWrite: false, fog: false}));
		m.frustumCulled = false;
		return m;
	}, []);
	const frameRef = useRef(frame);
	frameRef.current = frame;
	const shot = SHOTS[shotIndexAt(frame)];
	const useDof = (shot.dof ?? 0) > 0;
	const useRays = shot.id === '01-dawn' || shot.id === '05-park' || shot.id === '06-rooftop';
	const v = useMemo(() => new THREE.Vector3(), []);

	// SMAA decodes its lookup images asynchronously: hold the first frame until they are in.
	useEffect(() => {
		const h = delayRender('post-processing lookup textures');
		const t = setTimeout(() => continueRender(h), 400);
		return () => { clearTimeout(t); continueRender(h); };
	}, []);

	useFrame(() => {
		const f = frameRef.current;
		const c = composer.current;
		if (!c) return;
		if (c.passes[0] !== accum) {
			c.passes[0]?.dispose?.();
			c.passes[0] = accum;
		}
		gl.setClearColor(0x000000, 0);
		accum.frame = f;
		accum.subframes = subframes;
		// drive the post chain from the same pure-of-frame environment as the scene
		const mid = subframes > 1 ? 0.25 : 0;
		const env = envAt(f + mid);
		const s = env.shot;
		const g = s.grade;
		const size = gl.getDrawingBufferSize(new THREE.Vector2());
		world.size.copy(size);
		world.update(f + mid);
		// reprojection matrix: this frame's clip space -> where it was half a frame earlier
		const sameShot = shotIndexAt(Math.max(0, f - 0.5)) === env.shotIndex;
		world.viewProjAt(f + mid, mats.cur).invert();
		world.viewProjAt(sameShot ? f + mid - 0.5 : f + mid, mats.prev);
		mblur.uniforms.get('uReproj')!.value.multiplyMatrices(mats.prev, mats.cur);
		mblur.uniforms.get('uFrame')!.value = f;
		const whip = (s0: typeof env.shot) => (s0.whipOut && s0.end - f / FPS < s0.whipOut) || (s0.whipIn && f / FPS - s0.start < s0.whipIn);
		mblur.uniforms.get('uMax')!.value = ((globalThis as any).__NOMB ? 0 : 1) * (whip(env.shot) ? 0.14 : 0.011) * (subframes > 1 ? 0.35 : 1);
		const cam = world.camera;
		v.copy(env.sunDir).multiplyScalar(20000).add(cam.position);
		sunMesh.position.copy(v);
		sunMesh.scale.setScalar(20000 * 0.03);
		sunMesh.updateMatrixWorld(true);
		(sunMesh.material as THREE.MeshBasicMaterial).color.setRGB(clamp(env.glow[0] + 0.5), clamp(env.glow[1] + 0.35), clamp(env.glow[2] + 0.2));
		v.project(cam);
		const front = v.z < 1 ? 1 : 0;
		const sx = v.x * 0.5 + 0.5, sy = v.y * 0.5 + 0.5;
		const edge = (1 - smooth(1.0, 1.35, Math.abs(v.x))) * (1 - smooth(1.0, 1.35, Math.abs(v.y)));
		const fu = flare.uniforms;
		fu.get('uSun')!.value.set(sx, sy);
		fu.get('uSunVis')!.value = front * edge * env.sunUp * smooth(-2.5, 1.5, (Math.asin(env.sunDir.y) * 180) / Math.PI);
		fu.get('uSunTint')!.value.set(1.0 + env.glow[0] * 0.5, 0.82 + env.glow[1] * 0.5, 0.6 + env.glow[2] * 0.5);
		fu.get('uLeak')!.value = g.leak;
		fu.get('uT')!.value = f / FPS;
		if (bloom.current) bloom.current.intensity = 0.9 * g.bloom;
		if (dof.current) {
			const u = env.u;
			const fd = s.focus ? s.focus[0] + (s.focus[1] - s.focus[0]) * u : 100;
			dof.current.cocMaterial.focusDistance = fd;
			dof.current.cocMaterial.focusRange = fd * 0.9;
			dof.current.bokehScale = (s.dof ?? 0) * (size.y / 1080);
		}
		const gu = grade.uniforms;
		gu.get('uExposure')!.value = g.exposure;
		gu.get('uSat')!.value = g.sat;
		gu.get('uContrast')!.value = g.contrast;
		gu.get('uLift')!.value.fromArray(g.lift);
		gu.get('uGain')!.value.fromArray(g.gain);
		gu.get('uFrame')!.value = f;
		// light-flash transitions + film fades
		const t = f / FPS;
		let flash = 0;
		if (s.flashIn && t - s.start < s.flashIn) flash = Math.pow(1 - (t - s.start) / s.flashIn, 2);
		const next = SHOTS[env.shotIndex + 1];
		if (next?.flashIn && s.end - t < 0.1) flash = Math.max(flash, Math.pow(1 - (s.end - t) / 0.1, 2) * 0.9);
		gu.get('uFlash')!.value = flash;
		const fadeIn = smooth(0, 0.9, t);
		const titleDim = 1 - 0.62 * smooth(45.6, 46.6, t);
		const fadeOut = 1 - smooth(47.55, 47.95, t);
		gu.get('uFade')!.value = fadeIn * titleDim * fadeOut;
		outline.uniforms.get('uStrength')!.value = 0.5 * (1 - 0.4 * env.night);
	}, 0);

	return (
		<EffectComposer ref={composer} scene={world.scene} camera={world.camera} multisampling={0} frameBufferType={THREE.HalfFloatType} depthBuffer>
			<primitive object={outline} dispose={null} />
			<primitive object={mblur} dispose={null} />
			{useRays ? <GodRays sun={sunMesh} samples={36} density={0.94} decay={0.93} weight={0.34} exposure={0.36} clampMax={1} resolutionScale={0.4} blur /> : <></>}
			<primitive object={flare} dispose={null} />
			<Bloom ref={bloom} mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.25} radius={0.82} levels={7} intensity={1} />
			{useDof ? <DepthOfField ref={dof} focusDistance={100} focusRange={60} bokehScale={1} resolutionScale={0.5} /> : <></>}
			<ChromaticAberration offset={new THREE.Vector2(0.00055, 0.0004)} radialModulation modulationOffset={0.35} />
			<primitive object={grade} dispose={null} />
			<SMAA />
		</EffectComposer>
	);
};

export const Film: React.FC<FilmProps> = ({subframes, debugCam, prof, hide}) => {
	(globalThis as any).__PROF = !!prof;
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const [world, setWorld] = useState<World | null>(null);
	const [handle] = useState(() => delayRender('Loading OpenStreetMap city + building geometry', {timeoutInMilliseconds: 600000}));
	useEffect(() => {
		let dead = false;
		(async () => {
			await Promise.all([document.fonts.load('700 100px Syncopate'), document.fonts.load('500 40px Inter'), document.fonts.load('400 40px Inter')]);
			await document.fonts.ready;
			const city = await loadCity();
			buildShots(city);
			const w = new World(city);
			addSystems(w);
			w.debugCam = debugCam ?? null;
			for (const h of (hide || '').split(',')) {
				if (h === 'far700') w.debugFar = 700;
				const gd = /^gdbg(\d)$/.exec(h);
				if (gd) { w.facadeMat.defines = {DBG_G: +gd[1]}; w.facadeMat.needsUpdate = true; }
				if (h === 'nomb') (globalThis as any).__NOMB = true;
				if (h === 'ground') w.ground.visible = false;
				if (h === 'water') w.water.visible = false;
				if (h === 'sky') w.sky.visible = false;
				if (h === 'clouds') w.clouds.visible = false;
				if (h === 'tiles') w.tiles.forEach((t) => (t.mesh.visible = false));
				const m = /^sys(\d)$/.exec(h);
				if (m && w.systems[+m[1]]?.object) w.systems[+m[1]].object!.visible = false;
			}
			for (const msg of w.collisionReport()) console.warn('[camera collision]', msg);
			if (dead) return;
			setWorld(w);
			continueRender(handle);
		})().catch((err) => {
			console.error(err);
			throw err;
		});
		return () => { dead = true; };
	}, [handle]);
	const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{world ? (
				<ThreeCanvas width={width} height={height} dpr={dpr} flat gl={{antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true}}>
					<Stage world={world} frame={frame} subframes={subframes} />
				</ThreeCanvas>
			) : null}
			<Title frame={frame} />
		</AbsoluteFill>
	);
};
export const FILM_DURATION = DURATION;
