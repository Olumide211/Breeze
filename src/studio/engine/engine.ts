import { Mode, Project, STEPS_PER_BAR, songSteps, stepDuration } from "../types";
import { MixGraph } from "./graph";
import { playDrum, playSynth, Voice } from "./voices";

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

/** Schedules everything that starts inside one sixteenth-note step. */
function scheduleStep(
  ctx: BaseAudioContext,
  graph: MixGraph,
  p: Project,
  mode: Mode,
  patternId: string,
  step: number,
  time: number,
  sd: number,
  voices?: Set<Voice>
) {
  const hits: { patternId: string; local: number }[] = [];
  if (mode === "pattern") {
    hits.push({ patternId, local: step });
  } else {
    for (const clip of p.clips) {
      hits.push({ patternId: clip.patternId, local: step - clip.start * STEPS_PER_BAR });
    }
  }
  for (const h of hits) {
    const pat = p.patterns.find((x) => x.id === h.patternId);
    if (!pat || h.local < 0 || h.local >= pat.length) continue;
    for (const ch of p.channels) {
      const dest = graph.input(ch.id);
      if (!dest) continue;
      if (ch.kind === "drum") {
        const row = pat.steps[ch.id];
        const v = row ? row[h.local] : 0;
        if (v) playDrum(ctx, dest, time, ch.drum, v);
      } else {
        const notes = pat.notes[ch.id];
        if (!notes) continue;
        for (const n of notes) {
          if (n.start < h.local || n.start >= h.local + 1) continue;
          const t = time + (n.start - h.local) * sd;
          const voice: Voice = playSynth(ctx, dest, t, n.pitch, ch.synth, n.velocity, n.length * sd, () => {
            if (voices) voices.delete(voice);
          });
          if (voices) voices.add(voice);
        }
      }
    }
  }
}

const swingOffset = (p: Project, step: number, sd: number) => (step % 2 === 1 ? p.swing * sd * 0.5 : 0);

export class Engine {
  ctx: AudioContext | null = null;
  private graph: MixGraph | null = null;
  playing = false;
  mode: Mode = "pattern";
  patternId: string;
  /** where song playback starts, in steps */
  songStart = 0;
  onChange: () => void = () => undefined;

  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;
  private marks: { step: number; time: number }[] = [];
  private voices = new Set<Voice>();

  constructor(private project: Project) {
    this.patternId = project.patterns[0].id;
  }

  /** Must first be called from a user gesture so the browser allows audio. */
  private ensure(): { ctx: AudioContext; graph: MixGraph } {
    if (!this.ctx) {
      const Ctor: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.graph = new MixGraph(this.ctx, this.project);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return { ctx: this.ctx, graph: this.graph! };
  }

  setProject(p: Project) {
    this.project = p;
    if (this.graph) this.graph.sync(p);
  }

  private loopLength(): number {
    if (this.mode === "song") return songSteps(this.project);
    const pat = this.project.patterns.find((x) => x.id === this.patternId);
    return pat ? pat.length : STEPS_PER_BAR;
  }

  private tick = () => {
    const { ctx, graph } = this.ensure();
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.step >= this.loopLength()) this.step = 0;
      const p = this.project;
      const sd = stepDuration(p.bpm);
      const t = this.nextTime + swingOffset(p, this.step, sd);
      scheduleStep(ctx, graph, p, this.mode, this.patternId, this.step, t, sd, this.voices);
      this.marks.push({ step: this.step, time: this.nextTime });
      if (this.marks.length > 64) this.marks.shift();
      this.nextTime += sd;
      this.step++;
    }
  };

  play() {
    const { ctx } = this.ensure();
    if (this.playing) return;
    this.playing = true;
    this.step = this.mode === "song" ? this.songStart : 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.marks = [];
    this.tick();
    this.timer = window.setInterval(this.tick, TICK_MS);
    this.onChange();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    window.clearInterval(this.timer);
    this.marks = [];
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.voices.forEach((v) => v.release(now));
    }
    this.voices.clear();
    this.onChange();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.play();
  }

  /** Restart from the top if playing (used when the mode or the start point changes). */
  restart() {
    if (!this.playing) return;
    this.stop();
    this.play();
  }

  /** Playback position in steps within the current loop, or null when stopped. */
  position(): number | null {
    if (!this.playing || !this.ctx) return null;
    const now = this.ctx.currentTime;
    let mark: { step: number; time: number } | undefined;
    for (const m of this.marks) {
      if (m.time <= now) mark = m;
      else break;
    }
    if (!mark) return null;
    const sd = stepDuration(this.project.bpm);
    return mark.step + Math.min(0.999, (now - mark.time) / sd);
  }

  /** Position inside one pattern, whether it is looping alone or playing as a clip in the song. */
  patternPosition(patternId: string): number | null {
    const pos = this.position();
    if (pos === null) return null;
    if (this.mode === "pattern") return patternId === this.patternId ? pos : null;
    const pat = this.project.patterns.find((x) => x.id === patternId);
    if (!pat) return null;
    for (const c of this.project.clips) {
      if (c.patternId !== patternId) continue;
      const local = pos - c.start * STEPS_PER_BAR;
      if (local >= 0 && local < pat.length) return local;
    }
    return null;
  }

  /** Play a channel now. Synth notes sound until the returned voice is released. */
  noteOn(channelId: string, pitch: number, velocity = 0.85): Voice | null {
    const { ctx, graph } = this.ensure();
    const ch = this.project.channels.find((c) => c.id === channelId);
    const dest = graph.input(channelId);
    if (!ch || !dest) return null;
    const t = ctx.currentTime + 0.005;
    if (ch.kind === "drum") {
      playDrum(ctx, dest, t, ch.drum, velocity);
      return null;
    }
    return playSynth(ctx, dest, t, pitch, ch.synth, velocity);
  }

  /** A short audition of a channel. */
  preview(channelId: string, pitch = 60) {
    const voice = this.noteOn(channelId, pitch);
    if (voice && this.ctx) voice.release(this.ctx.currentTime + 0.22);
  }

  level(channelId?: string): number {
    return this.graph ? this.graph.level(channelId) : 0;
  }
}

/** Render the song (or one pass of a pattern) to an AudioBuffer, faster than real time. */
export function renderProject(p: Project, mode: Mode, patternId: string): Promise<AudioBuffer> {
  const sd = stepDuration(p.bpm);
  const pat = p.patterns.find((x) => x.id === patternId);
  const steps = mode === "song" ? songSteps(p) : pat ? pat.length : STEPS_PER_BAR;
  const tail = Math.min(6, 1.5 + p.master.reverbSize);
  const rate = 44100;
  const Ctor: typeof OfflineAudioContext =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx = new Ctor(2, Math.ceil((steps * sd + tail) * rate), rate);
  const graph = new MixGraph(ctx, p);
  for (let s = 0; s < steps; s++) {
    scheduleStep(ctx, graph, p, mode, patternId, s, 0.01 + s * sd + swingOffset(p, s, sd), sd);
  }
  return ctx.startRendering();
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = frames * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, bytes, true);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}
