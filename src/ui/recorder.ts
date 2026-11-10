// Timelapse encoder. Preference order:
//   1. WebCodecs H.264 -> MP4          (frame-exact, faster than real time)
//   2. WebCodecs VP9 / VP8 -> WebM     (when H.264 encoding is unavailable)
//   3. MediaRecorder on a canvas stream (real-time fallback)

import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer';

export interface Recorder {
  /** human readable description, e.g. "MP4 (H.264, WebCodecs)" */
  kind: string;
  ext: 'mp4' | 'webm';
  /** Encode the canvas' current contents as frame `index`. */
  addFrame(index: number): Promise<void>;
  finish(): Promise<Blob>;
  abort(): void;
}

interface Candidate {
  container: 'mp4' | 'webm';
  codec: string;
  label: string;
}

const CANDIDATES: Candidate[] = [
  { container: 'mp4', codec: 'avc1.640028', label: 'MP4 (H.264 High, WebCodecs)' },
  { container: 'mp4', codec: 'avc1.4d0028', label: 'MP4 (H.264 Main, WebCodecs)' },
  { container: 'mp4', codec: 'avc1.42e028', label: 'MP4 (H.264 Baseline, WebCodecs)' },
  { container: 'webm', codec: 'vp09.00.40.08', label: 'WebM (VP9, WebCodecs)' },
  { container: 'webm', codec: 'vp8', label: 'WebM (VP8, WebCodecs)' },
];

function configFor(c: Candidate, w: number, h: number, fps: number): VideoEncoderConfig {
  const cfg: VideoEncoderConfig = {
    codec: c.codec,
    width: w,
    height: h,
    framerate: fps,
    bitrate: Math.round(w * h * fps * 0.14),
    latencyMode: c.container === 'mp4' ? 'quality' : 'realtime',
  };
  if (c.container === 'mp4') cfg.avc = { format: 'avc' };
  return cfg;
}

/** Really encode two frames so we do not trust isConfigSupported blindly. */
async function probe(cfg: VideoEncoderConfig, canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const s = await VideoEncoder.isConfigSupported(cfg);
    if (!s.supported) return false;
    let chunks = 0;
    let failed = false;
    const enc = new VideoEncoder({ output: () => chunks++, error: () => (failed = true) });
    enc.configure(cfg);
    for (let i = 0; i < 2; i++) {
      const f = new VideoFrame(canvas, { timestamp: i * 33333, duration: 33333 });
      enc.encode(f, { keyFrame: i === 0 });
      f.close();
    }
    await Promise.race([enc.flush(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    if (enc.state !== 'closed') enc.close();
    return !failed && chunks > 0;
  } catch {
    return false;
  }
}

async function webCodecsRecorder(canvas: HTMLCanvasElement, w: number, h: number, fps: number): Promise<Recorder | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  // ?codec=webm (or mp4) in the URL restricts the container, handy for testing the fallback
  const want = new URLSearchParams(location.search).get('codec');
  for (const c of CANDIDATES) {
    if (want && c.container !== want) continue;
    const cfg = configFor(c, w, h, fps);
    if (!(await probe(cfg, canvas))) continue;
    let error: Error | null = null;
    const mp4 = c.container === 'mp4' ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' }) : null;
    const webm =
      c.container === 'webm'
        ? new WebmMuxer({ target: new WebmTarget(), video: { codec: c.codec === 'vp8' ? 'V_VP8' : 'V_VP9', width: w, height: h, frameRate: fps } })
        : null;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (mp4) mp4.addVideoChunk(chunk, meta);
        else if (webm) webm.addVideoChunk(chunk, meta);
      },
      error: (e) => (error = e),
    });
    enc.configure(cfg);
    const frameUs = 1e6 / fps;
    return {
      kind: c.label,
      ext: c.container,
      async addFrame(index) {
        if (error) throw error;
        const f = new VideoFrame(canvas, { timestamp: Math.round(index * frameUs), duration: Math.round(frameUs) });
        enc.encode(f, { keyFrame: index % (fps * 2) === 0 });
        f.close();
        while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 2));
      },
      async finish() {
        await enc.flush();
        enc.close();
        if (error) throw error;
        if (mp4) {
          mp4.finalize();
          return new Blob([mp4.target.buffer], { type: 'video/mp4' });
        }
        (webm as WebmMuxer<WebmTarget>).finalize();
        return new Blob([(webm as WebmMuxer<WebmTarget>).target.buffer], { type: 'video/webm' });
      },
      abort() {
        if (enc.state !== 'closed') enc.close();
      },
    };
  }
  return null;
}

function mediaRecorderRecorder(canvas: HTMLCanvasElement, w: number, h: number, fps: number): Recorder | null {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) return null;
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) return null;
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(w * h * fps * 0.14) });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) parts.push(e.data);
  };
  let t0 = 0;
  let last = 0;
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return {
    kind: `${ext.toUpperCase()} (MediaRecorder, real time)`,
    ext,
    async addFrame(index) {
      if (!t0) {
        rec.start(1000);
        t0 = performance.now();
      }
      last = index;
      // real-time capture: hold each frame on the canvas for its slot
      const due = t0 + ((index + 1) * 1000) / fps;
      const wait = due - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    },
    finish() {
      return new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(parts, { type: mime.split(';')[0] }));
        };
        const due = t0 + ((last + 1) * 1000) / fps;
        setTimeout(() => rec.stop(), Math.max(0, due - performance.now()));
      });
    },
    abort() {
      if (rec.state !== 'inactive') rec.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export async function createRecorder(canvas: HTMLCanvasElement, w: number, h: number, fps: number): Promise<Recorder> {
  const rec = (await webCodecsRecorder(canvas, w, h, fps)) || mediaRecorderRecorder(canvas, w, h, fps);
  if (!rec) throw new Error('This browser cannot encode video (no WebCodecs or MediaRecorder support).');
  return rec;
}
