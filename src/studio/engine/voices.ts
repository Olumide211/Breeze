import { DrumParams, SynthParams } from "../types";

/** Everything here is synthesised from oscillators and noise: no samples. */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function noise(ctx: BaseAudioContext, t: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(t, Math.random());
  src.stop(t + dur);
  return src;
}

/** A gain node with a fast attack and exponential decay to silence. */
function hit(ctx: BaseAudioContext, dest: AudioNode, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(dest);
  return g;
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  type: OscillatorType,
  from: number,
  to: number,
  sweep: number,
  dur: number
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + sweep);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function filtered(
  ctx: BaseAudioContext,
  dest: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q = 0.7
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = Math.min(freq, ctx.sampleRate / 2 - 100);
  f.Q.value = q;
  f.connect(dest);
  return f;
}

export function playDrum(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  p: DrumParams,
  velocity: number
) {
  const k = Math.pow(2, p.tune / 12);
  const d = p.decay;
  const v = velocity;
  switch (p.kind) {
    case "kick": {
      const len = 0.38 * d;
      tone(ctx, hit(ctx, dest, t, v, len), t, "sine", 165 * k, 46 * k, 0.09, len);
      noise(ctx, t, 0.02).connect(filtered(ctx, hit(ctx, dest, t, v * 0.25, 0.02), "lowpass", 3000));
      break;
    }
    case "snare": {
      const len = 0.2 * d;
      tone(ctx, hit(ctx, dest, t, v * 0.5, 0.11 * d), t, "triangle", 240 * k, 170 * k, 0.05, 0.11 * d);
      noise(ctx, t, len).connect(filtered(ctx, hit(ctx, dest, t, v * 0.7, len), "highpass", 1500 * k));
      break;
    }
    case "clap": {
      const len = 0.22 * d;
      const band = filtered(ctx, dest, "bandpass", 1300 * k, 1.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      // three quick bursts, then the tail
      [0, 0.011, 0.023].forEach((o) => {
        g.gain.setValueAtTime(v, t + o);
        g.gain.exponentialRampToValueAtTime(v * 0.15, t + o + 0.009);
      });
      g.gain.setValueAtTime(v * 0.9, t + 0.034);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.034 + len);
      g.connect(band);
      noise(ctx, t, len + 0.06).connect(g);
      break;
    }
    case "hat":
    case "openhat":
    case "shaker": {
      const len = (p.kind === "hat" ? 0.05 : p.kind === "shaker" ? 0.09 : 0.36) * d;
      const freq = (p.kind === "shaker" ? 5200 : 7800) * k;
      const peak = v * (p.kind === "shaker" ? 0.4 : 0.45);
      const g = hit(ctx, dest, t, peak, len);
      if (p.kind === "shaker") {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      }
      noise(ctx, t, len).connect(filtered(ctx, g, "highpass", freq, 0.9));
      break;
    }
    case "tom": {
      const len = 0.3 * d;
      tone(ctx, hit(ctx, dest, t, v * 0.9, len), t, "sine", 210 * k, 110 * k, 0.12, len);
      break;
    }
    case "rim": {
      const len = 0.045 * d;
      const band = filtered(ctx, hit(ctx, dest, t, v * 0.7, len), "bandpass", 1750 * k, 3);
      tone(ctx, band, t, "square", 1750 * k, 1750 * k, 0, len);
      tone(ctx, band, t, "triangle", 480 * k, 480 * k, 0, len);
      break;
    }
    case "cowbell": {
      const len = 0.28 * d;
      const band = filtered(ctx, hit(ctx, dest, t, v * 0.45, len), "bandpass", 800 * k, 2.5);
      tone(ctx, band, t, "square", 540 * k, 540 * k, 0, len);
      tone(ctx, band, t, "square", 800 * k, 800 * k, 0, len);
      break;
    }
    case "crash": {
      const len = 1.4 * d;
      noise(ctx, t, len).connect(filtered(ctx, hit(ctx, dest, t, v * 0.4, len), "highpass", 4200 * k, 0.6));
      break;
    }
  }
}

export interface Voice {
  release(t: number): void;
}

export const midiToHz = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);

/**
 * Two oscillators into a resonant low-pass with its own decay envelope, then an ADSR amp.
 * If `duration` is given the release is scheduled up front, otherwise call `release`.
 */
export function playSynth(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  pitch: number,
  p: SynthParams,
  velocity: number,
  duration?: number,
  onEnded?: () => void
): Voice {
  const freq = midiToHz(pitch) * Math.pow(2, p.octave);
  const level = 0.3 * velocity;
  const attack = Math.max(0.003, p.attack);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(level, t + attack);
  amp.gain.setTargetAtTime(level * p.sustain, t + attack, Math.max(0.01, p.decay / 3));
  amp.connect(dest);

  const top = ctx.sampleRate / 2 - 500;
  const base = Math.min(p.cutoff, top);
  const peak = Math.min(top, base * Math.pow(2, p.envAmount * 6));
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = p.resonance;
  filter.frequency.setValueAtTime(peak, t);
  filter.frequency.setTargetAtTime(base, t + attack, Math.max(0.01, p.decay / 3));
  filter.connect(amp);

  const oscs: OscillatorNode[] = [];
  const addOsc = (type: OscillatorType, f: number, detune: number, gain: number) => {
    if (gain <= 0.001) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(filter);
    o.start(t);
    oscs.push(o);
  };
  addOsc(p.wave1, freq, -p.detune / 2, 1 - p.mix);
  addOsc(p.wave2, freq * Math.pow(2, p.osc2Octave), p.detune / 2, p.mix);
  if (oscs.length && onEnded) oscs[0].onended = onEnded;

  const release = (at: number) => {
    // never release inside the attack ramp: it would leave a ramp event after the release
    const tr = Math.max(at, t + attack + 0.002);
    const rel = Math.max(0.01, p.release);
    amp.gain.setTargetAtTime(0, tr, rel / 4);
    oscs.forEach((o) => {
      try {
        o.stop(tr + rel * 1.6 + 0.05);
      } catch (e) {
        /* already stopped */
      }
    });
  };
  if (duration !== undefined) release(t + duration);
  return { release };
}
