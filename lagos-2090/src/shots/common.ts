import * as THREE from 'three';
import { type Env, sunVector } from '../core';
import { makeSky } from '../sky';

export interface Shot {
  name: string;
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; env: Env; light: THREE.DirectionalLight;
  update(t: number, frame: number): void;
  fg?: boolean;
  title?: [string, string];
  sunVis?: (t: number) => number;
}
export interface StageOpts { cam: [number, number, number]; look: [number, number, number]; fov: number; shadow: { center: [number, number, number]; size: number; depth?: number; res?: number }; near?: number; far?: number; roll?: number; up?: [number, number, number] }

export function stage(env: Env, o: StageOpts) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov, 16 / 9, o.near ?? 0.1, o.far ?? 3000);
  camera.position.set(...o.cam); if (o.up) camera.up.set(...o.up); camera.lookAt(...o.look);
  if (o.roll) camera.rotateZ(o.roll);
  camera.updateMatrixWorld();
  scene.add(makeSky(env));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  const c = new THREE.Vector3(...o.shadow.center); const d = o.shadow.depth ?? 200;
  light.position.copy(c).addScaledVector(sunVector(env.sunAz, env.sunEl), d * 0.5);
  light.target.position.copy(c); scene.add(light.target);
  light.castShadow = true;
  const s = o.shadow.size; const sc = light.shadow.camera;
  sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 0.5; sc.far = d; sc.updateProjectionMatrix();
  light.shadow.mapSize.set(o.shadow.res ?? 2048, o.shadow.res ?? 2048);
  light.shadow.bias = -0.0006; light.shadow.normalBias = 0.04; light.shadow.radius = 2.5;
  light.shadow.autoUpdate = false;
  light.layers.enable(1);
  scene.add(light);
  return { scene, camera, light };
}
