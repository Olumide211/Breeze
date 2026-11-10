import { Channel, Clip, DrumKind, DRUM_KINDS, Note, Pattern, Project, SynthParams, WAVES } from "./types";

let counter = 0;
export const uid = (prefix: string) =>
  prefix + Date.now().toString(36) + (counter++).toString(36) + Math.floor(Math.random() * 1296).toString(36);

export const COLORS = ["#4fd1c5", "#f6ad55", "#fc8181", "#b794f4", "#63b3ed", "#68d391", "#f687b3", "#ecc94b"];

export const SYNTH_PRESETS: Record<string, SynthParams> = {
  Bass: {
    wave1: "sawtooth", wave2: "square", osc2Octave: -1, detune: 6, mix: 0.4, octave: 0,
    cutoff: 260, resonance: 5, envAmount: 0.55, attack: 0.003, decay: 0.22, sustain: 0.55, release: 0.08,
  },
  Pluck: {
    wave1: "sawtooth", wave2: "triangle", osc2Octave: 1, detune: 8, mix: 0.3, octave: 0,
    cutoff: 700, resonance: 3, envAmount: 0.6, attack: 0.003, decay: 0.18, sustain: 0.12, release: 0.2,
  },
  Keys: {
    wave1: "triangle", wave2: "sine", osc2Octave: 1, detune: 4, mix: 0.3, octave: 0,
    cutoff: 2400, resonance: 0.8, envAmount: 0.25, attack: 0.004, decay: 0.5, sustain: 0.35, release: 0.3,
  },
  Lead: {
    wave1: "square", wave2: "sawtooth", osc2Octave: 0, detune: 14, mix: 0.5, octave: 0,
    cutoff: 1800, resonance: 4, envAmount: 0.3, attack: 0.008, decay: 0.3, sustain: 0.7, release: 0.18,
  },
  Pad: {
    wave1: "sawtooth", wave2: "sawtooth", osc2Octave: 0, detune: 22, mix: 0.5, octave: 0,
    cutoff: 900, resonance: 1, envAmount: 0.15, attack: 0.35, decay: 0.8, sustain: 0.8, release: 0.9,
  },
  Organ: {
    wave1: "sine", wave2: "sine", osc2Octave: 1, detune: 0, mix: 0.4, octave: 0,
    cutoff: 6000, resonance: 0.5, envAmount: 0, attack: 0.005, decay: 0.1, sustain: 1, release: 0.06,
  },
};

export function newChannel(kind: "drum" | "synth", name: string, index: number, drumKind: DrumKind = "kick"): Channel {
  const preset = SYNTH_PRESETS[name] || SYNTH_PRESETS.Keys;
  return {
    id: uid("c"),
    name,
    color: COLORS[index % COLORS.length],
    kind,
    drum: { kind: drumKind, tune: 0, decay: 1 },
    synth: { ...preset },
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    lowpass: 20000,
    highpass: 20,
    reverb: 0,
    delay: 0,
  };
}

export function newPattern(name: string, index: number, length = 16): Pattern {
  return { id: uid("p"), name, color: COLORS[index % COLORS.length], length, steps: {}, notes: {} };
}

export function emptyProject(): Project {
  const channels = [
    newChannel("drum", "Kick", 0, "kick"),
    newChannel("drum", "Snare", 1, "snare"),
    newChannel("drum", "Hat", 2, "hat"),
    newChannel("synth", "Bass", 3),
    newChannel("synth", "Keys", 4),
  ];
  return {
    version: 1,
    name: "Untitled",
    bpm: 120,
    swing: 0,
    channels,
    patterns: [newPattern("Pattern 1", 0)],
    clips: [],
    tracks: 8,
    master: { volume: 0.9, limiter: true, reverbSize: 2.2, delaySteps: 3, delayFeedback: 0.35 },
  };
}

export function demoProject(): Project {
  const p = emptyProject();
  p.name = "First Light";
  p.bpm = 118;
  p.swing = 0.12;

  const kick = newChannel("drum", "Kick", 0, "kick");
  const snare = newChannel("drum", "Snare", 1, "snare");
  const clap = newChannel("drum", "Clap", 2, "clap");
  const hat = newChannel("drum", "Hat", 3, "hat");
  const open = newChannel("drum", "Open hat", 4, "openhat");
  const shaker = newChannel("drum", "Shaker", 5, "shaker");
  const bass = newChannel("synth", "Bass", 6);
  const keys = newChannel("synth", "Pluck", 7);
  const pad = newChannel("synth", "Pad", 0);
  const lead = newChannel("synth", "Lead", 1);
  kick.volume = 0.95;
  snare.reverb = 0.12;
  clap.reverb = 0.3;
  clap.volume = 0.6;
  hat.volume = 0.55;
  hat.pan = 0.25;
  open.volume = 0.45;
  open.pan = -0.25;
  shaker.volume = 0.4;
  shaker.pan = -0.4;
  bass.volume = 0.85;
  keys.volume = 0.6;
  keys.delay = 0.4;
  keys.reverb = 0.2;
  keys.pan = 0.2;
  pad.volume = 0.42;
  pad.reverb = 0.55;
  pad.highpass = 180;
  lead.volume = 0.5;
  lead.delay = 0.35;
  lead.reverb = 0.3;
  lead.pan = -0.15;
  p.channels = [kick, snare, clap, hat, open, shaker, bass, keys, pad, lead];

  const row = (length: number, at: number[], velocity = 0.85) => {
    const out: number[] = [];
    for (let i = 0; i < length; i++) out.push(0);
    at.forEach((i) => (out[i] = velocity));
    return out;
  };
  const every = (length: number, period: number, offset = 0) => {
    const out: number[] = [];
    for (let i = offset; i < length; i += period) out.push(i);
    return out;
  };
  const note = (start: number, pitch: number, length: number, velocity = 0.8): Note => ({
    id: uid("n"), pitch, start, length, velocity,
  });

  const drums = newPattern("Drums", 0, 32);
  drums.steps[kick.id] = row(32, [0, 4, 8, 12, 16, 20, 24, 28, 30]);
  drums.steps[snare.id] = row(32, [4, 12, 20, 28]);
  drums.steps[clap.id] = row(32, [12, 28, 31], 0.7);
  drums.steps[hat.id] = row(32, every(32, 2), 0.7);
  [3, 11, 19, 27].forEach((i) => (drums.steps[hat.id][i] = 0.45));
  drums.steps[open.id] = row(32, every(32, 8, 6), 0.7);
  drums.steps[shaker.id] = row(32, every(32, 4, 2), 0.6);

  const light = newPattern("Hats only", 4, 16);
  light.steps[hat.id] = row(16, every(16, 2), 0.6);
  light.steps[shaker.id] = row(16, every(16, 4, 2), 0.6);
  light.steps[kick.id] = row(16, [0, 8]);

  // A minor: Am - F - C - G, one bar each
  const roots = [33, 29, 36, 31];
  const chords = [
    [57, 60, 64],
    [53, 57, 60],
    [55, 60, 64],
    [55, 59, 62],
  ];

  const bassline = newPattern("Bass", 1, 64);
  bassline.notes[bass.id] = [];
  roots.forEach((root, bar) => {
    [0, 3, 6, 8, 11, 14].forEach((s, i) => {
      const pitch = i === 5 ? root + 12 : root;
      bassline.notes[bass.id].push(note(bar * 16 + s, pitch + 12, i === 5 ? 1 : 2, i === 0 ? 0.95 : 0.75));
    });
  });

  const harmony = newPattern("Chords", 2, 64);
  harmony.notes[keys.id] = [];
  harmony.notes[pad.id] = [];
  chords.forEach((chord, bar) => {
    chord.forEach((pitch) => harmony.notes[pad.id].push(note(bar * 16, pitch, 15.5, 0.7)));
    // arpeggiate the same chord on the pluck
    for (let s = 0; s < 16; s += 2) {
      const pitch = chord[(s / 2) % 3] + (s % 8 === 6 ? 24 : 12);
      harmony.notes[keys.id].push(note(bar * 16 + s, pitch, 1, s % 4 === 0 ? 0.85 : 0.6));
    }
  });

  const melody = newPattern("Lead", 3, 64);
  melody.notes[lead.id] = [
    [0, 76, 3], [4, 74, 2], [6, 72, 2], [8, 69, 6],
    [16, 72, 4], [20, 69, 2], [22, 72, 2], [24, 77, 6],
    [32, 79, 3], [36, 76, 2], [38, 72, 2], [40, 76, 6],
    [48, 74, 4], [52, 71, 2], [54, 74, 2], [56, 79, 2], [58, 74, 2], [60, 71, 4],
  ].map(([start, pitch, length]) => note(start, pitch, length));

  p.patterns = [drums, light, bassline, harmony, melody];

  const clip = (pattern: Pattern, track: number, start: number): Clip => ({
    id: uid("k"), patternId: pattern.id, track, start,
  });
  p.clips = [
    clip(harmony, 2, 0), clip(harmony, 2, 4), clip(harmony, 2, 8), clip(harmony, 2, 12),
    clip(light, 0, 2), clip(light, 0, 3),
    clip(drums, 0, 4), clip(drums, 0, 6), clip(drums, 0, 8), clip(drums, 0, 10), clip(drums, 0, 12), clip(drums, 0, 14),
    clip(bassline, 1, 4), clip(bassline, 1, 8), clip(bassline, 1, 12),
    clip(melody, 3, 8), clip(melody, 3, 12),
  ];
  return p;
}

/* ---------- immutable edit helpers ---------- */

export const editChannel = (p: Project, id: string, patch: Partial<Channel>): Project => ({
  ...p,
  channels: p.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});

export const editPattern = (p: Project, id: string, fn: (pat: Pattern) => Pattern): Project => ({
  ...p,
  patterns: p.patterns.map((x) => (x.id === id ? fn(x) : x)),
});

export const editNotes = (p: Project, patternId: string, channelId: string, fn: (notes: Note[]) => Note[]): Project =>
  editPattern(p, patternId, (pat) => ({
    ...pat,
    notes: { ...pat.notes, [channelId]: fn(pat.notes[channelId] || []) },
  }));

export const setStep = (p: Project, patternId: string, channelId: string, step: number, value: number): Project =>
  editPattern(p, patternId, (pat) => {
    const row = (pat.steps[channelId] || []).slice();
    while (row.length < pat.length) row.push(0);
    if (row[step] === value) return pat;
    row[step] = value;
    return { ...pat, steps: { ...pat.steps, [channelId]: row } };
  });

export function removeChannel(p: Project, id: string): Project {
  if (p.channels.length <= 1) return p;
  return {
    ...p,
    channels: p.channels.filter((c) => c.id !== id),
    patterns: p.patterns.map((pat) => {
      const steps = { ...pat.steps };
      const notes = { ...pat.notes };
      delete steps[id];
      delete notes[id];
      return { ...pat, steps, notes };
    }),
  };
}

export function duplicateChannel(p: Project, id: string): Project {
  const src = p.channels.find((c) => c.id === id);
  if (!src) return p;
  const copy: Channel = { ...src, id: uid("c"), name: src.name + " 2", drum: { ...src.drum }, synth: { ...src.synth } };
  const at = p.channels.indexOf(src) + 1;
  return {
    ...p,
    channels: [...p.channels.slice(0, at), copy, ...p.channels.slice(at)],
    patterns: p.patterns.map((pat) => ({
      ...pat,
      steps: pat.steps[id] ? { ...pat.steps, [copy.id]: pat.steps[id].slice() } : pat.steps,
      notes: pat.notes[id]
        ? { ...pat.notes, [copy.id]: pat.notes[id].map((n) => ({ ...n, id: uid("n") })) }
        : pat.notes,
    })),
  };
}

export function removePattern(p: Project, id: string): Project {
  if (p.patterns.length <= 1) return p;
  return {
    ...p,
    patterns: p.patterns.filter((x) => x.id !== id),
    clips: p.clips.filter((c) => c.patternId !== id),
  };
}

export function duplicatePattern(p: Project, id: string): { project: Project; id: string } {
  const src = p.patterns.find((x) => x.id === id);
  if (!src) return { project: p, id };
  const notes: Record<string, Note[]> = {};
  Object.keys(src.notes).forEach((k) => (notes[k] = src.notes[k].map((n) => ({ ...n, id: uid("n") }))));
  const steps: Record<string, number[]> = {};
  Object.keys(src.steps).forEach((k) => (steps[k] = src.steps[k].slice()));
  const copy: Pattern = {
    ...src,
    id: uid("p"),
    name: src.name + " copy",
    color: COLORS[p.patterns.length % COLORS.length],
    notes,
    steps,
  };
  return { project: { ...p, patterns: [...p.patterns, copy] }, id: copy.id };
}

/* ---------- loading untrusted data (files, share links, storage) ---------- */

const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v.slice(0, 80) : fallback);
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
const wave = (v: unknown, fallback: SynthParams["wave1"]) =>
  WAVES.indexOf(v as any) >= 0 ? (v as SynthParams["wave1"]) : fallback;

/** Rebuild a project from parsed JSON, clamping every value. Throws if it is not a project. */
export function sanitizeProject(raw: any): Project {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.channels) || !Array.isArray(raw.patterns)) {
    throw new Error("Not a Breeze project");
  }
  const base = emptyProject();
  const channels: Channel[] = raw.channels.slice(0, 64).map((c: any, i: number) => {
    const d = newChannel(c && c.kind === "synth" ? "synth" : "drum", "Channel", i);
    const cd = (c && c.drum) || {};
    const cs = (c && c.synth) || {};
    return {
      ...d,
      id: str(c && c.id, d.id),
      name: str(c && c.name, "Channel " + (i + 1)),
      color: color(c && c.color, d.color),
      drum: {
        kind: DRUM_KINDS.some((k) => k.id === cd.kind) ? cd.kind : "kick",
        tune: num(cd.tune, 0, -24, 24),
        decay: num(cd.decay, 1, 0.2, 4),
      },
      synth: {
        wave1: wave(cs.wave1, d.synth.wave1),
        wave2: wave(cs.wave2, d.synth.wave2),
        osc2Octave: Math.round(num(cs.osc2Octave, 0, -2, 2)),
        detune: num(cs.detune, 0, 0, 100),
        mix: num(cs.mix, 0.5, 0, 1),
        octave: Math.round(num(cs.octave, 0, -3, 3)),
        cutoff: num(cs.cutoff, 2000, 40, 20000),
        resonance: num(cs.resonance, 1, 0.1, 25),
        envAmount: num(cs.envAmount, 0, 0, 1),
        attack: num(cs.attack, 0.005, 0, 4),
        decay: num(cs.decay, 0.3, 0.01, 6),
        sustain: num(cs.sustain, 0.5, 0, 1),
        release: num(cs.release, 0.2, 0.01, 8),
      },
      volume: num(c && c.volume, 0.8, 0, 1.25),
      pan: num(c && c.pan, 0, -1, 1),
      mute: !!(c && c.mute),
      solo: !!(c && c.solo),
      lowpass: num(c && c.lowpass, 20000, 40, 20000),
      highpass: num(c && c.highpass, 20, 20, 20000),
      reverb: num(c && c.reverb, 0, 0, 1),
      delay: num(c && c.delay, 0, 0, 1),
    };
  });
  if (!channels.length) throw new Error("Project has no channels");

  const patterns: Pattern[] = raw.patterns.slice(0, 200).map((x: any, i: number) => {
    const length = Math.round(num(x && x.length, 16, 4, 256));
    const steps: Record<string, number[]> = {};
    const notes: Record<string, Note[]> = {};
    channels.forEach((ch) => {
      const row = x && x.steps && x.steps[ch.id];
      if (Array.isArray(row)) steps[ch.id] = row.slice(0, length).map((v: unknown) => num(v, 0, 0, 1));
      const list = x && x.notes && x.notes[ch.id];
      if (Array.isArray(list)) {
        notes[ch.id] = list.slice(0, 4000).map((n: any) => ({
          id: uid("n"),
          pitch: Math.round(num(n && n.pitch, 60, 0, 127)),
          start: num(n && n.start, 0, 0, length),
          length: num(n && n.length, 1, 0.125, 256),
          velocity: num(n && n.velocity, 0.8, 0.05, 1),
        }));
      }
    });
    return {
      id: str(x && x.id, uid("p")),
      name: str(x && x.name, "Pattern " + (i + 1)),
      color: color(x && x.color, COLORS[i % COLORS.length]),
      length,
      steps,
      notes,
    };
  });
  if (!patterns.length) throw new Error("Project has no patterns");

  const tracks = Math.round(num(raw.tracks, 8, 1, 32));
  const clips: Clip[] = (Array.isArray(raw.clips) ? raw.clips : [])
    .slice(0, 2000)
    .filter((c: any) => c && patterns.some((x) => x.id === c.patternId))
    .map((c: any) => ({
      id: uid("k"),
      patternId: c.patternId as string,
      track: Math.round(num(c.track, 0, 0, tracks - 1)),
      start: Math.round(num(c.start, 0, 0, 999)),
    }));

  const m = raw.master || {};
  return {
    version: 1,
    name: str(raw.name, "Untitled"),
    bpm: num(raw.bpm, 120, 40, 240),
    swing: num(raw.swing, 0, 0, 0.6),
    channels,
    patterns,
    clips,
    tracks,
    master: {
      volume: num(m.volume, base.master.volume, 0, 1.25),
      limiter: m.limiter !== false,
      reverbSize: num(m.reverbSize, base.master.reverbSize, 0.3, 6),
      delaySteps: num(m.delaySteps, base.master.delaySteps, 1, 16),
      delayFeedback: num(m.delayFeedback, base.master.delayFeedback, 0, 0.9),
    },
  };
}

/* ---------- storage and share links ---------- */

const STORAGE_KEY = "breeze.studio.project.v1";

export function loadStored(): Project | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeProject(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

export function store(p: Project) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch (e) {
    /* storage unavailable or full: the project still lives in memory */
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: any): Promise<Uint8Array> {
  const body = (new Blob([bytes]) as any).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/** The whole project packed into a URL fragment: nothing is uploaded anywhere. */
export async function encodeShare(p: Project): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  const w = window as any;
  if (w.CompressionStream) {
    try {
      return "z" + toBase64Url(await pipe(bytes, new w.CompressionStream("deflate-raw")));
    } catch (e) {
      /* fall through to the uncompressed form */
    }
  }
  return "j" + toBase64Url(bytes);
}

export async function decodeShare(text: string): Promise<Project> {
  let bytes = fromBase64Url(text.slice(1));
  if (text[0] === "z") bytes = await pipe(bytes, new (window as any).DecompressionStream("deflate-raw"));
  return sanitizeProject(JSON.parse(new TextDecoder().decode(bytes)));
}
