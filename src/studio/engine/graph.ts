import { Project, stepDuration } from "../types";

interface Strip {
  input: GainNode;
  highpass: BiquadFilterNode;
  lowpass: BiquadFilterNode;
  pan: StereoPannerNode;
  gain: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  meter: AnalyserNode;
}

function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
  }
  return buf;
}

/**
 * The mixer: one strip per channel, two shared send effects and a master bus.
 * It is built against a BaseAudioContext so the same code renders offline for export.
 */
export class MixGraph {
  private strips = new Map<string, Strip>();
  private masterIn: GainNode;
  private limiter: DynamicsCompressorNode;
  private masterOut: GainNode;
  private masterMeter: AnalyserNode;
  private reverb: ConvolverNode;
  private reverbSize = -1;
  private delay: DelayNode;
  private feedback: GainNode;
  private scratch = new Float32Array(512);

  constructor(private ctx: BaseAudioContext, project: Project) {
    this.masterIn = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    this.masterOut = ctx.createGain();
    this.masterMeter = ctx.createAnalyser();
    this.masterMeter.fftSize = 512;
    this.masterIn.connect(this.limiter);
    this.limiter.connect(this.masterOut);
    this.masterOut.connect(ctx.destination);
    this.masterOut.connect(this.masterMeter);

    this.reverb = ctx.createConvolver();
    this.reverb.connect(this.masterIn);

    this.delay = ctx.createDelay(2);
    this.feedback = ctx.createGain();
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3800;
    this.delay.connect(damp);
    damp.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.masterIn);

    this.sync(project, true);
  }

  private set(param: AudioParam, value: number, immediate: boolean) {
    if (immediate) param.value = value;
    else param.setTargetAtTime(value, this.ctx.currentTime, 0.012);
  }

  input(channelId: string): AudioNode | undefined {
    const s = this.strips.get(channelId);
    return s && s.input;
  }

  sync(p: Project, immediate = false) {
    const ctx = this.ctx;
    const top = ctx.sampleRate / 2 - 100;
    const anySolo = p.channels.some((c) => c.solo);
    const seen = new Set<string>();

    for (const ch of p.channels) {
      seen.add(ch.id);
      let s = this.strips.get(ch.id);
      const fresh = !s;
      if (!s) {
        s = {
          input: ctx.createGain(),
          highpass: ctx.createBiquadFilter(),
          lowpass: ctx.createBiquadFilter(),
          pan: ctx.createStereoPanner(),
          gain: ctx.createGain(),
          reverbSend: ctx.createGain(),
          delaySend: ctx.createGain(),
          meter: ctx.createAnalyser(),
        };
        s.highpass.type = "highpass";
        s.lowpass.type = "lowpass";
        s.meter.fftSize = 512;
        s.input.connect(s.highpass);
        s.highpass.connect(s.lowpass);
        s.lowpass.connect(s.pan);
        s.pan.connect(s.gain);
        s.gain.connect(this.masterIn);
        s.gain.connect(s.meter);
        s.gain.connect(s.reverbSend);
        s.gain.connect(s.delaySend);
        s.reverbSend.connect(this.reverb);
        s.delaySend.connect(this.delay);
        this.strips.set(ch.id, s);
      }
      const now = immediate || fresh;
      const audible = !ch.mute && (!anySolo || ch.solo);
      this.set(s.gain.gain, audible ? ch.volume : 0, now);
      this.set(s.pan.pan, ch.pan, now);
      this.set(s.highpass.frequency, Math.min(ch.highpass, top), now);
      this.set(s.lowpass.frequency, Math.min(ch.lowpass, top), now);
      this.set(s.reverbSend.gain, ch.reverb, now);
      this.set(s.delaySend.gain, ch.delay, now);
    }

    this.strips.forEach((s, id) => {
      if (seen.has(id)) return;
      s.gain.disconnect();
      s.reverbSend.disconnect();
      s.delaySend.disconnect();
      this.strips.delete(id);
    });

    const m = p.master;
    this.set(this.masterOut.gain, m.volume, immediate);
    this.set(this.limiter.threshold, m.limiter ? -9 : 0, immediate);
    this.set(this.limiter.ratio, m.limiter ? 12 : 1, immediate);
    this.set(this.limiter.knee, m.limiter ? 6 : 0, immediate);
    this.set(this.delay.delayTime, Math.min(1.95, m.delaySteps * stepDuration(p.bpm)), immediate);
    this.set(this.feedback.gain, Math.min(0.9, m.delayFeedback), immediate);
    if (m.reverbSize !== this.reverbSize) {
      this.reverbSize = m.reverbSize;
      this.reverb.buffer = impulse(ctx, m.reverbSize);
    }
  }

  /** Peak level 0..1+ of a channel, or of the master when no id is given. */
  level(channelId?: string): number {
    const strip = channelId ? this.strips.get(channelId) : undefined;
    const node = channelId ? strip && strip.meter : this.masterMeter;
    if (!node) return 0;
    node.getFloatTimeDomainData(this.scratch);
    let peak = 0;
    for (let i = 0; i < this.scratch.length; i++) {
      const a = Math.abs(this.scratch[i]);
      if (a > peak) peak = a;
    }
    return peak;
  }
}
