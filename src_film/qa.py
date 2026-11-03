"""Quality gates for out/two-roads.mp4:
 1. ffprobe: 1920x1080, 30 fps, 75-90 s, H.264 + AAC
 2. extract frames at 10 timestamps -> build/qa/
 3. loudness / true peak (ffmpeg ebur128) and caption <-> voice sync (ASR on the final audio)
"""
import json, os, re, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from events import ROOT

MP4 = os.path.join(ROOT, "out/two-roads.mp4")
ok = True


def check(cond, msg):
    global ok
    print(("PASS " if cond else "FAIL ") + msg)
    ok &= bool(cond)


p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", MP4],
                              capture_output=True, text=True).stdout)
v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
a = [s for s in p["streams"] if s["codec_type"] == "audio"]
dur = float(p["format"]["duration"])
check(v["codec_name"] == "h264", f"video codec {v['codec_name']}")
check((v["width"], v["height"]) == (1920, 1080), f"resolution {v['width']}x{v['height']}")
check(v["r_frame_rate"] == "30/1", f"frame rate {v['r_frame_rate']}")
check(75 <= dur <= 90, f"duration {dur:.2f} s")
check(len(a) == 1 and a[0]["codec_name"] == "aac", f"audio {[s['codec_name'] for s in a]} {a[0].get('sample_rate')} Hz {a[0].get('channels')} ch")

# frames
qa = os.path.join(ROOT, "build/qa"); os.makedirs(qa, exist_ok=True)
times = [2.0, 6.0, 12.0, 24.0, 30.0, 38.0, 50.0, 58.5, 69.0, 82.0]
for t in times:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", MP4, "-frames:v", "1",
                    os.path.join(qa, f"f{t:05.1f}.png")], check=True)
print("frames ->", qa)

# loudness
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", MP4, "-map", "0:a", "-af", "ebur128=peak=true",
                    "-f", "null", "-"], capture_output=True, text=True).stderr
summ = r[r.rfind("Summary:"):]
I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
TP = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
LRA = float(re.search(r"LRA:\s+(-?[\d.]+) LU", summ).group(1))
check(-17.0 <= I <= -15.0, f"integrated loudness {I} LUFS (target -16)")
check(TP <= -1.0, f"true peak {TP} dBTP (no clipping)")
print(f"     loudness range {LRA} LU")

# caption sync: transcribe the final mix and compare each cue's first word time
wav = os.path.join(qa, "final.wav")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", MP4, "-ac", "1", "-ar", "16000", wav], check=True)
import soundfile as sf
from asr_check import m
audio, _ = sf.read(wav, dtype="float32")
segs, _ = m.transcribe(audio, word_timestamps=True)
words = [(w.start, w.end, re.sub(r"[^a-z0-9]", "", w.word.lower())) for s in segs for w in s.words]
tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))
num = {"1987": "1987", "1985": "1985", "2000": "2000"}
offs = []
for c in tl["cues"]:
    first = re.sub(r"[^a-z0-9]", "", c["text"].split()[0].lower())
    cands = [w for w in words if abs(w[0] - c["start"]) < 1.5 and (w[2] == first or w[2].startswith(first[:4]))]
    if cands:
        w = min(cands, key=lambda w: abs(w[0] - c["start"]))
        offs.append(w[0] - c["start"])
        if abs(w[0] - c["start"]) > 0.35:
            print(f"     cue '{c['text'][:40]}' starts {c['start']:.2f}, voice at {w[0]:.2f}")
    else:
        print(f"     (no ASR match for cue start '{c['text'][:30]}')")
offs = np.array(offs)
check(len(offs) >= 0.8 * len(tl["cues"]) and np.abs(offs).max() < 1.0,
      f"captions vs ASR (coarse, +/-1 s): {len(offs)}/{len(tl['cues'])} cue texts heard, max |offset| {np.abs(offs).max()*1000:.0f} ms")
# precise: locate every voice line inside the final mix by cross-correlation
from scipy.signal import correlate, resample_poly
lag_ms = []
for l in tl["lines"]:
    x, sr = sf.read(l["file"], dtype="float32")
    x = resample_poly(x, 1, 3)                          # 48k -> 16k
    c0 = int((l["start"] - 1.0) * 16000)
    seg = audio[max(0, c0): c0 + len(x) + 32000]
    r = correlate(seg, x, mode="valid", method="fft")
    lag = (np.argmax(r) + max(0, c0)) / 16000 - l["start"]
    lag_ms.append(lag * 1000)
lag_ms = np.array(lag_ms)
# caption cue starts relative to their line start come from word timestamps on the isolated line
first_cues = {c["line"]: c["start"] for c in reversed(tl["cues"])}
cue_vs_line = max(abs(first_cues[l["id"]] - l["start"]) for l in tl["lines"]) * 1000
check(np.abs(lag_ms).max() < 40 and cue_vs_line < 40,
      f"voice placement vs captions: max |lag| {np.abs(lag_ms).max():.1f} ms over {len(lag_ms)} lines; first-cue vs line start {cue_vs_line:.0f} ms")
offs = lag_ms / 1000
print("\nALL GATES PASSED" if ok else "\nSOME GATES FAILED")
json.dump(dict(duration=dur, lufs=I, true_peak=TP, lra=LRA, sync_mean_ms=float(offs.mean() * 1000),
               sync_max_ms=float(np.abs(offs).max() * 1000)), open(os.path.join(qa, "report.json"), "w"), indent=1)
sys.exit(0 if ok else 1)
