import React, {useMemo} from 'react';
import * as THREE from 'three';
import {ThreeCanvas} from '@remotion/three';
import {useCurrentFrame} from 'remotion';
import {Layout} from './layout';
import {BG_FRAG, BG_VERT, METAL_FRAG, TUBE_FRAG, TUBE_VERT} from './shaders';
import {CAP_LEN, TUBE_R, fourCurve, fourTransform, projectedBBox} from './fourPath';
import {easeInOutCubic, easeOutQuart, electrodeLevel, flickerUneven, neonLevel, tween} from './timing';

/** Background state for frame f (shared by the backdrop and the glass refraction). */
export const bgState = (f: number) => ({
	uNavyRise: tween(f, 54, 84, 0, 1, easeInOutCubic),
	uNavyAmt: 1 - tween(f, 334, 374, 0, 1, easeInOutCubic),
	uAurora: tween(f, 334, 374, 0, 1, easeOutQuart),
	uSpread: tween(f, 396, 414, 0, 1, easeInOutCubic),
	uWorld: tween(f, 402, 420, 0, 1, easeInOutCubic),
	uTime: f / 60,
});

const makeUniforms = (L: Layout) => ({
	uRes: {value: new THREE.Vector2(L.W, L.H)},
	uDpr: {value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1},
	uTime: {value: 0},
	uNavyRise: {value: 0},
	uNavyAmt: {value: 0},
	uAurora: {value: 0},
	uSpread: {value: 0},
	uWorld: {value: 0},
	uReveal: {value: 0},
	uBox: {value: new THREE.Vector4(0, 0, 1, 1)},
	uGas: {value: 0},
	uElectrode: {value: 0},
	uUneven: {value: 0},
	uFlickT: {value: 0},
	uPx: {value: 23},
	uGlow: {value: 0},
});

type U = ReturnType<typeof makeUniforms>;

const setBg = (u: U, f: number) => {
	const s = bgState(f);
	(Object.keys(s) as (keyof typeof s)[]).forEach((k) => {
		u[k].value = s[k];
	});
};

const quatAlong = (dir: THREE.Vector3) =>
	new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

const Scene: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	const bgU = useMemo(() => makeUniforms(L), [L]);
	const tubeU = useMemo(() => makeUniforms(L), [L]);
	const metalU = useMemo(() => makeUniforms(L), [L]);

	const bgMat = useMemo(
		() => new THREE.ShaderMaterial({uniforms: bgU, vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthWrite: false, depthTest: false}),
		[bgU],
	);
	const tubeMat = useMemo(
		() => new THREE.ShaderMaterial({uniforms: tubeU, vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG, transparent: true, depthWrite: true}),
		[tubeU],
	);
	const metalMat = useMemo(
		() => new THREE.ShaderMaterial({uniforms: metalU, vertexShader: TUBE_VERT, fragmentShader: METAL_FRAG, transparent: true}),
		[metalU],
	);

	const {tubeGeo, caps} = useMemo(() => {
		const c = fourCurve();
		const tubeGeo = new THREE.TubeGeometry(c.path, 700, TUBE_R, 48, false);
		const capGeo = new THREE.CylinderGeometry(TUBE_R * 1.12, TUBE_R * 1.12, CAP_LEN, 40, 1, false);
		const wireGeo = new THREE.CylinderGeometry(TUBE_R * 0.13, TUBE_R * 0.13, CAP_LEN * 0.7, 12, 1, false);
		const sDir = c.startTangent.clone().negate();
		const eDir = c.endTangent.clone();
		const caps = [
			{geo: capGeo, pos: c.start.clone().add(sDir.clone().multiplyScalar(CAP_LEN / 2 - 0.004)), q: quatAlong(sDir)},
			{geo: capGeo, pos: c.end.clone().add(eDir.clone().multiplyScalar(CAP_LEN / 2 - 0.004)), q: quatAlong(eDir)},
			{geo: wireGeo, pos: c.start.clone().add(sDir.clone().multiplyScalar(CAP_LEN * 1.3)), q: quatAlong(sDir)},
			{geo: wireGeo, pos: c.end.clone().add(eDir.clone().multiplyScalar(CAP_LEN * 1.3)), q: quatAlong(eDir)},
		];
		return {tubeGeo, caps};
	}, []);

	// ---- per-frame uniforms
	setBg(bgU, f);
	const showFour = f >= 428;
	const t = fourTransform(L, f);
	if (showFour) {
		const bb = projectedBBox(t);
		const reveal = tween(f, 430, 478, -0.05, 1.25, easeInOutCubic);
		for (const u of [tubeU, metalU]) {
			setBg(u, f);
			u.uReveal.value = reveal;
			u.uBox.value.set(bb.x0, bb.y0, bb.x1, bb.y1);
		}
		tubeU.uGas.value = neonLevel(f);
		tubeU.uElectrode.value = electrodeLevel(f);
		tubeU.uUneven.value = flickerUneven(f);
		tubeU.uFlickT.value = f;
		tubeU.uPx.value = TUBE_R * t.h;
		metalU.uGlow.value = Math.max(neonLevel(f), electrodeLevel(f));
	}

	return (
		<>
			<mesh material={bgMat} renderOrder={-10} position={[0, 0, -2000]}>
				<planeGeometry args={[L.W, L.H]} />
			</mesh>
			{showFour ? (
				<group position={[t.x - L.W / 2, L.H / 2 - t.y, 0]} scale={[t.h, t.h, t.h]} rotation={[0, t.rotY, 0]}>
					<mesh geometry={tubeGeo} material={tubeMat} />
					{caps.map((c, i) => (
						<mesh key={i} geometry={c.geo} material={metalMat} position={c.pos} quaternion={c.q} />
					))}
				</group>
			) : null}
		</>
	);
};

export const World: React.FC<{L: Layout}> = ({L}) => {
	return (
		<ThreeCanvas
			width={L.W}
			height={L.H}
			orthographic
			linear
			flat
			dpr={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
			camera={{position: [0, 0, 1000], zoom: 1, near: 1, far: 5000}}
			gl={{antialias: true, preserveDrawingBuffer: true}}
			style={{position: 'absolute', left: 0, top: 0}}
		>
			<Scene L={L} />
		</ThreeCanvas>
	);
};
