import type { BrushParams, Tool } from './brush';
import type { Detail, Style } from './autopaint';

/** What the "hand" is doing right now (auto-paint or timelapse replay). */
export interface AutoUi {
  tool: Tool;
  size: number;
  flow: number;
  hardness: number;
  opacity: number;
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
  phase: number;
  label: string;
  progress: number;
  strokes: number;
}

export interface DirtyPatch {
  x: number;
  y: number;
  w: number;
  h: number;
  buf: ArrayBuffer;
}

export type ToWorker =
  | { type: 'newDoc'; w: number; h: number }
  | { type: 'loadImage'; bitmap: ImageBitmap; maxSide: number }
  | { type: 'strokeBegin'; params: BrushParams }
  | { type: 'strokePoints'; pts: Float32Array }
  | { type: 'strokeEnd' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'pick'; x: number; y: number; withRef: boolean }
  | { type: 'autoStart'; detail: Detail; style: Style; speed: number; seed: number }
  | { type: 'autoPause'; paused: boolean }
  | { type: 'autoStop' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'ack' }
  | { type: 'replayStart'; frames: number }
  | { type: 'replayAck' }
  | { type: 'replayCancel' }
  | { type: 'snapshot' };

export type AutoState = 'idle' | 'running' | 'paused' | 'done';

export type FromWorker =
  | { type: 'doc'; w: number; h: number; ref: ArrayBuffer | null }
  | { type: 'update'; patch: DirtyPatch | null; ui: AutoUi | null; canUndo: boolean; canRedo: boolean; strokes: number; needAck: boolean }
  | { type: 'picked'; r: number; g: number; b: number }
  | { type: 'autoState'; state: AutoState; ssim: number | null; strokes: number }
  | { type: 'replayFrame'; index: number; total: number; patch: DirtyPatch | null; ui: AutoUi | null }
  | { type: 'replayDone'; ok: boolean; patch: DirtyPatch | null }
  | { type: 'snapshot'; w: number; h: number; buf: ArrayBuffer };
