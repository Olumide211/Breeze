// Synthesizes every sound effect from scratch → assets/sfx/*.wav (48kHz, 16-bit, stereo).
// No samples, no licences. Run: npm run sfx
import fs from 'node:fs';
import path from 'node:path';

const SR = 48000;
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../assets/sfx');
fs.mkdirSync(OUT, {recursive: true});

// ───────── deterministic noise ─────────
let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const TAU = Math.PI * 2;

// ───────── filters ─────────
const biquad = (type, f, q = 0.707) => {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2;
  const set = (freq) => {
    const w = (TAU * Math.min(freq, SR * 0.45)) / SR;
    const c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let n0, n1, n2;
    if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = (1 - c) / 2; }
    else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = (1 + c) / 2; }
    else { n0 = al; n1 = 0; n2 = -al; } // bandpass
    const a0 = 1 + al;
    b0 = n0 / a0; b1 = n1 / a0; b2 = n2 / a0; a1 = (-2 * c) / a0; a2 = (1 - al) / a0;
  };
  set(f);
  const fn = (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  fn.set = set;
  return fn;
};

// Schroeder/Freeverb-lite reverb, returns stereo [L, R]
const reverb = (dry, {mix = 0.25, room = 0.82, damp = 0.35, tail = 1.2} = {}) => {
  const n = dry.length + Math.floor(tail * SR);
  const make = (offset) => {
    const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({d: d + offset, b: new Float32Array(d + offset), i: 0, s: 0}));
    const aps = [556, 441, 341].map((d) => ({d: d + offset, b: new Float32Array(d + offset), i: 0}));
    const out = new Float32Array(n);
    for (let t = 0; t < n; t++) {
      const x = (dry[t] ?? 0) * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.b[c.i];
        c.s = o * (1 - damp) + c.s * damp;
        c.b[c.i] = x + c.s * room;
        c.i = (c.i + 1) % c.d;
        y += o;
      }
      for (const a of aps) {
        const o = a.b[a.i];
        a.b[a.i] = y + o * 0.5; // freeverb allpass
        a.i = (a.i + 1) % a.d;
        y = o - y;
      }
      out[t] = y;
    }
    return out;
  };
  const wl = make(0), wr = make(23);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    const d = dry[t] ?? 0;
    L[t] = d * (1 - mix) + wl[t] * mix * 9;
    R[t] = d * (1 - mix) + wr[t] * mix * 9;
  }
  return [L, R];
};

const write = (name, L, R = L, peak = 0.9) => {
  // normalise + trim trailing silence + short fade-out
  let m = 0;
  for (let i = 0; i < L.length; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
  const g = m > 0 ? peak / m : 1;
  let end = L.length;
  while (end > 1 && Math.abs(L[end - 1] * g) < 0.0008 && Math.abs(R[end - 1] * g) < 0.0008) end--;
  end = Math.min(L.length, end + 200);
  const fade = Math.min(end, Math.floor(SR * 0.01));
  const data = Buffer.alloc(end * 4);
  for (let i = 0; i < end; i++) {
    const f = i > end - fade ? (end - i) / fade : 1;
    const l = Math.max(-1, Math.min(1, L[i] * g * f));
    const r = Math.max(-1, Math.min(1, R[i] * g * f));
    data.writeInt16LE(Math.round(l * 32767), i * 4);
    data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([h, data]));
  console.log(`✓ sfx/${name}.wav  ${(end / SR).toFixed(2)}s`);
};

const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ───────── sounds ─────────

// tile snap: soft woody "thock" with a crisp transient
{
  const b = buf(0.4); const bp = biquad('bp', 3200, 1.2); let ph = 0, ph2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 95 + 120 * Math.exp(-t / 0.018);
    ph += (TAU * f) / SR; ph2 += (TAU * 640) / SR;
    b[i] = Math.sin(ph) * env(t, 0.001, 0.07) * 0.9 + Math.sin(ph2) * env(t, 0.0005, 0.025) * 0.25 + bp(noise()) * env(t, 0.0003, 0.006) * 1.2;
  }
  const [L, R] = reverb(b, {mix: 0.12, tail: 0.5});
  write('snap', L, R, 0.85);
}

// logo tile land: tighter, slightly higher thock
{
  const b = buf(0.3); const bp = biquad('bp', 4200, 1.4); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * (140 + 160 * Math.exp(-t / 0.012))) / SR;
    b[i] = Math.sin(ph) * env(t, 0.0008, 0.05) + bp(noise()) * env(t, 0.0002, 0.004) * 1.3;
  }
  const [L, R] = reverb(b, {mix: 0.1, tail: 0.3});
  write('land', L, R, 0.8);
}

// UI tick
{
  const b = buf(0.08); const hp = biquad('hp', 3000); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; ph += (TAU * 2600) / SR;
    b[i] = Math.sin(ph) * env(t, 0.0005, 0.012) * 0.6 + hp(noise()) * env(t, 0.0002, 0.003);
  }
  write('tick', b, b, 0.7);
}

// label pop: quick rising blip
{
  const b = buf(0.25); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 760 + 700 * Math.min(1, t / 0.05);
    ph += (TAU * f) / SR;
    b[i] = (Math.sin(ph) + 0.25 * Math.sin(ph * 2)) * env(t, 0.003, 0.05);
  }
  const [L, R] = reverb(b, {mix: 0.2, tail: 0.5});
  write('pop', L, R, 0.7);
}

// scan: band-passed noise sweeping up + shimmer
{
  const D = 1.3; const b = buf(D); const bp = biquad('bp', 400, 4); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; const p = t / D;
    bp.set(350 * Math.pow(18, p));
    ph += (TAU * (1100 + 900 * p)) / SR;
    const e = Math.sin(Math.PI * Math.min(1, p * 1.05)) ** 1.5;
    b[i] = bp(noise()) * e * 2.2 + Math.sin(ph) * e * 0.06;
  }
  const [L, R] = reverb(b, {mix: 0.3, tail: 0.8});
  write('scan', L, R, 0.7);
}

// seal: soft vault-like thud
{
  const b = buf(0.9); const lp = biquad('lp', 380); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * (52 + 50 * Math.exp(-t / 0.05))) / SR;
    b[i] = Math.sin(ph) * env(t, 0.004, 0.18) + lp(noise()) * env(t, 0.002, 0.05) * 1.8;
  }
  const [L, R] = reverb(b, {mix: 0.3, room: 0.86, tail: 1.2});
  write('seal', L, R, 0.85);
}

// scramble: digital chatter, many tiny random tones
{
  const D = 0.9; const b = buf(D); const hp = biquad('hp', 700);
  let next = 0, f = 2000, ph = 0, start = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    if (t >= next) { f = 1200 + rnd() * 3400; start = t; next = t + 0.018 + rnd() * 0.02; }
    ph += (TAU * f) / SR;
    const sq = Math.sign(Math.sin(ph)) * 0.4 + Math.sin(ph) * 0.6;
    const e = env(t - start, 0.001, 0.008) * (1 - t / D) ** 0.6;
    b[i] = hp(sq * e);
  }
  const [L, R] = reverb(b, {mix: 0.15, tail: 0.3});
  write('scramble', L, R, 0.5);
}

// lock: two-stage mechanical click
{
  const b = buf(0.25); const bp = biquad('bp', 5200, 2); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * 1900) / SR;
    const c1 = env(t, 0.0002, 0.004), c2 = t > 0.035 ? env(t - 0.035, 0.0002, 0.006) : 0;
    b[i] = bp(noise()) * (c1 + c2 * 1.3) * 1.5 + Math.sin(ph) * (t > 0.035 ? env(t - 0.035, 0.001, 0.03) : 0) * 0.35;
  }
  const [L, R] = reverb(b, {mix: 0.15, tail: 0.3});
  write('lock', L, R, 0.75);
}

// whoosh: low-passed noise swell
{
  const D = 0.75; const b = buf(D); const lp = biquad('lp', 300, 1.2);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; const p = t / D;
    const e = p < 0.6 ? (p / 0.6) ** 2 : Math.exp(-(p - 0.6) / 0.12);
    lp.set(250 + 3200 * e);
    b[i] = lp(noise()) * e;
  }
  const [L, R] = reverb(b, {mix: 0.25, tail: 0.6});
  write('whoosh', L, R, 0.7);
}

// toggle: click + upward blip
{
  const b = buf(0.3); const bp = biquad('bp', 4000, 1.5); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * (900 + 900 * Math.min(1, t / 0.04))) / SR;
    b[i] = bp(noise()) * env(t, 0.0002, 0.005) * 1.5 + Math.sin(ph) * env(t, 0.004, 0.05) * 0.5;
  }
  const [L, R] = reverb(b, {mix: 0.2, tail: 0.5});
  write('toggle', L, R, 0.75);
}

// shimmer: bright airy chord for the unseal
{
  const D = 1.6; const b = buf(D); const notes = [1046.5, 1568, 2093, 2637, 3136];
  const phs = notes.map(() => 0);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; let v = 0;
    notes.forEach((f, k) => {
      phs[k] += (TAU * f * (1 + 0.002 * Math.sin(t * 6 + k))) / SR;
      v += Math.sin(phs[k]) * env(t - k * 0.035, 0.01, 0.35 - k * 0.03) * (t > k * 0.035 ? 1 : 0) / (1 + k * 0.4);
    });
    b[i] = v;
  }
  const [L, R] = reverb(b, {mix: 0.4, room: 0.88, tail: 1.5});
  write('shimmer', L, R, 0.55);
}

// pulse: soft data beep (FHE packets)
{
  const b = buf(0.3); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; ph += (TAU * 1320) / SR;
    b[i] = (Math.sin(ph) + 0.15 * Math.sin(ph * 3)) * env(t, 0.006, 0.045);
  }
  const [L, R] = reverb(b, {mix: 0.3, tail: 0.6});
  write('pulse', L, R, 0.55);
}

// hum: processing drone
{
  const D = 2.0; const b = buf(D); const lp = biquad('lp', 900); let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; const p = t / D;
    p1 += (TAU * 110) / SR; p2 += (TAU * 220.6) / SR; p3 += (TAU * 330 * (1 + 0.004 * Math.sin(t * 9))) / SR;
    const e = Math.sin(Math.PI * p) ** 0.8;
    const lfo = 0.75 + 0.25 * Math.sin(t * TAU * 6);
    b[i] = lp(Math.sin(p1) * 0.6 + Math.sin(p2) * 0.35 + Math.sin(p3) * 0.2 * lfo + noise() * 0.03) * e;
  }
  const [L, R] = reverb(b, {mix: 0.25, tail: 0.6});
  write('hum', L, R, 0.5);
}

// odometer: ticks that start fast and decelerate (matches the count-up ease)
{
  const D = 1.1; const b = buf(D + 0.1); const hp = biquad('hp', 2500);
  const ticks = [];
  for (let k = 0; k < 26; k++) ticks.push(D * (1 - Math.pow(1 - k / 26, 0.33)) * 0.95);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; let v = 0;
    for (const tk of ticks) if (t >= tk && t < tk + 0.02) v += env(t - tk, 0.0002, 0.003);
    ph += (TAU * 3400) / SR;
    b[i] = hp(noise()) * v * 0.9 + Math.sin(ph) * v * 0.2;
  }
  write('odometer', b, b, 0.5);
}

// button press
{
  const b = buf(0.3); const bp = biquad('bp', 2400, 1.2); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; ph += (TAU * (180 + 120 * Math.exp(-t / 0.01))) / SR;
    b[i] = Math.sin(ph) * env(t, 0.001, 0.04) * 0.8 + bp(noise()) * env(t, 0.0002, 0.006) * 1.3;
  }
  const [L, R] = reverb(b, {mix: 0.12, tail: 0.3});
  write('press', L, R, 0.75);
}

// glitch: bit-crushed stutter burst
{
  const D = 0.38; const b = buf(D); let ph = 0, hold = 0, held = 0, f = 300, seg = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    if (t >= seg) { f = [180, 420, 960, 2400, 75][Math.floor(rnd() * 5)]; seg = t + 0.02 + rnd() * 0.03; }
    ph += (TAU * f) / SR;
    const raw = Math.sign(Math.sin(ph)) * 0.5 + noise() * 0.5;
    if (hold-- <= 0) { held = Math.round(raw * 6) / 6; hold = 6 + Math.floor(rnd() * 20); }
    const gate = Math.sin(t * TAU * 38) > -0.3 ? 1 : 0.15;
    b[i] = held * gate * (1 - t / D) ** 0.5;
  }
  write('glitch', b, b, 0.6);
}

// riser: builds tension into the flood
{
  const D = 2.6; const b = buf(D); const bp = biquad('bp', 300, 2); let ph = 0, ph2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; const p = t / D;
    bp.set(250 * Math.pow(30, p));
    const f = 160 * Math.pow(6, p);
    ph += (TAU * f) / SR; ph2 += (TAU * f * 1.5) / SR;
    const e = p ** 2.2;
    b[i] = bp(noise()) * e * 2.4 + (Math.sin(ph) + 0.5 * Math.sin(ph2)) * e * 0.12;
  }
  const [L, R] = reverb(b, {mix: 0.3, tail: 0.1});
  write('riser', L, R, 0.7);
}

// impact: the yellow flood hit
{
  const D = 3.0; const b = buf(D); const lp = biquad('lp', 2200); const bp = biquad('bp', 3000, 0.8); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * (34 + 70 * Math.exp(-t / 0.08))) / SR;
    const sub = Math.tanh(Math.sin(ph) * 1.6) * env(t, 0.002, 0.7);
    lp.set(300 + 5000 * Math.exp(-t / 0.06));
    b[i] = sub + lp(noise()) * env(t, 0.001, 0.12) * 0.9 + bp(noise()) * env(t, 0.0005, 0.01) * 0.8;
  }
  const [L, R] = reverb(b, {mix: 0.35, room: 0.9, tail: 2.0});
  write('impact', L, R, 0.95);
}

// chime: soft bell for the final lockup
{
  const D = 3.2; const b = buf(D); const partials = [[523.25, 1], [1046.5, 0.5], [1444, 0.3], [2093, 0.22], [2830, 0.1]];
  const phs = partials.map(() => 0);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; let v = 0;
    partials.forEach(([f, a], k) => {
      phs[k] += (TAU * f) / SR;
      v += Math.sin(phs[k]) * a * env(t, 0.004, 1.1 / (1 + k * 0.6));
    });
    b[i] = v;
  }
  const [L, R] = reverb(b, {mix: 0.4, room: 0.88, tail: 2.0});
  write('chime', L, R, 0.6);
}
