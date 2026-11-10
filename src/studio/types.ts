export type DrumKind =
  | "kick"
  | "snare"
  | "clap"
  | "hat"
  | "openhat"
  | "tom"
  | "rim"
  | "cowbell"
  | "shaker"
  | "crash";

export const DRUM_KINDS: { id: DrumKind; label: string }[] = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "clap", label: "Clap" },
  { id: "hat", label: "Closed hat" },
  { id: "openhat", label: "Open hat" },
  { id: "tom", label: "Tom" },
  { id: "rim", label: "Rimshot" },
  { id: "cowbell", label: "Cowbell" },
  { id: "shaker", label: "Shaker" },
  { id: "crash", label: "Crash" },
];

export interface DrumParams {
  kind: DrumKind;
  /** semitones, -12..12 */
  tune: number;
  /** length multiplier, 0.3..3 */
  decay: number;
}

export type Wave = "sine" | "triangle" | "sawtooth" | "square";
export const WAVES: Wave[] = ["sine", "triangle", "sawtooth", "square"];

export interface SynthParams {
  wave1: Wave;
  wave2: Wave;
  /** octave offset of oscillator 2 relative to oscillator 1, -2..2 */
  osc2Octave: number;
  /** cents, 0..50 */
  detune: number;
  /** 0 = only osc 1, 1 = only osc 2 */
  mix: number;
  /** octave shift of the whole voice, -2..2 */
  octave: number;
  /** Hz */
  cutoff: number;
  /** filter Q, 0.1..20 */
  resonance: number;
  /** how far the envelope opens the filter, 0..1 */
  envAmount: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Channel {
  id: string;
  name: string;
  color: string;
  kind: "drum" | "synth";
  drum: DrumParams;
  synth: SynthParams;
  /** 0..1.25 */
  volume: number;
  /** -1..1 */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** Hz */
  lowpass: number;
  /** Hz */
  highpass: number;
  /** send levels, 0..1 */
  reverb: number;
  delay: number;
}

export interface Note {
  id: string;
  /** MIDI note number */
  pitch: number;
  /** in sixteenth-note steps, may be fractional */
  start: number;
  length: number;
  velocity: number;
}

export interface Pattern {
  id: string;
  name: string;
  color: string;
  /** in steps */
  length: number;
  /** drum hits: velocity per step, keyed by channel id */
  steps: Record<string, number[]>;
  /** synth notes, keyed by channel id */
  notes: Record<string, Note[]>;
}

export interface Clip {
  id: string;
  patternId: string;
  track: number;
  /** in bars */
  start: number;
}

export interface Master {
  volume: number;
  limiter: boolean;
  /** seconds */
  reverbSize: number;
  /** delay time in steps */
  delaySteps: number;
  delayFeedback: number;
}

export interface Project {
  version: 1;
  name: string;
  bpm: number;
  /** 0..0.6 */
  swing: number;
  channels: Channel[];
  patterns: Pattern[];
  clips: Clip[];
  tracks: number;
  master: Master;
}

export type Mode = "pattern" | "song";

export const STEPS_PER_BAR = 16;

export const stepDuration = (bpm: number) => 60 / bpm / 4;

export function songSteps(p: Project): number {
  let end = 0;
  for (const c of p.clips) {
    const pat = p.patterns.find((x) => x.id === c.patternId);
    if (!pat) continue;
    end = Math.max(end, c.start * STEPS_PER_BAR + pat.length);
  }
  if (end === 0) return STEPS_PER_BAR * 4;
  return Math.ceil(end / STEPS_PER_BAR) * STEPS_PER_BAR;
}

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (pitch: number) => NOTE_NAMES[pitch % 12] + (Math.floor(pitch / 12) - 1);
export const isBlackKey = (pitch: number) => [1, 3, 6, 8, 10].indexOf(pitch % 12) >= 0;
