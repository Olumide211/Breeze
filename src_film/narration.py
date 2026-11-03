"""Generate narration with Piper TTS, measure every line, and build the film timeline.

Outputs:
  build/voice/<id>.wav   48 kHz mono, trimmed, per line
  build/timeline.json    sections, line start/end times, caption cues (word-timed)
"""
import json, os, re, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

sys.path.insert(0, os.path.dirname(__file__))
from script import LINES, WORDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.path.join(ROOT, "assets/voices/en_US-ryan-high.onnx")
OUT = os.path.join(ROOT, "build/voice")
SR = 48000
LENGTH_SCALE = 1.0       # 1.0 = natural pace for ryan-high


NUM = {"10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen", "15": "fifteen",
       "1987": "nineteen eighty-seven", "1985": "nineteen eighty-five", "2000": "two thousand"}


def norm(t):
    t = re.sub(r"[^a-z0-9 ]", " ", t.lower().replace("-", " "))
    out = []
    for w in t.split():
        out += NUM.get(w, w).replace("-", " ").split()
    return out


def score(path, text):
    import difflib
    from asr_check import m, load16k
    segs, _ = m.transcribe(load16k(path))
    hyp = " ".join(s.text for s in segs)
    return difflib.SequenceMatcher(None, norm(text), norm(hyp)).ratio(), hyp


def synth(line, takes=4):
    best = None
    for k in range(takes):
        path, d = synth_once(line, f"_take{k}")
        sc, hyp = score(path, line["text"])
        if best is None or sc > best[0]:
            best = (sc, path, d, hyp)
        if sc >= 0.97:
            break
    sc, path, d, hyp = best
    final = os.path.join(OUT, line["id"] + ".wav")
    os.replace(path, final)
    for f in os.listdir(OUT):
        if f.startswith(line["id"] + "_take"):
            os.remove(os.path.join(OUT, f))
    print(f"    take score {sc:.2f}: {hyp.strip()}")
    return final, d


def synth_once(line, suffix):
    raw = os.path.join(OUT, line["id"] + suffix + "_raw.wav")
    piper = os.path.join(os.path.dirname(sys.executable), "piper")
    subprocess.run([piper, "-m", VOICE, "-f", raw, "--length-scale", str(LENGTH_SCALE),
                    "--sentence-silence", "0.35"], input=line["tts"].encode(), check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a, sr = sf.read(raw, dtype="float32")
    a = resample_poly(a, 160, 73).astype("float32") if sr == 22050 else a  # 22050 -> 48000
    # trim silence (-45 dB) with 40 ms margins
    env = np.abs(a) > 10 ** (-45 / 20)
    idx = np.flatnonzero(env)
    s = max(0, idx[0] - int(0.04 * SR)); e = min(len(a), idx[-1] + int(0.08 * SR))
    a = a[s:e]
    fade = int(0.01 * SR)
    a[:fade] *= np.linspace(0, 1, fade); a[-fade:] *= np.linspace(1, 0, fade)
    path = os.path.join(OUT, line["id"] + suffix + ".wav")
    sf.write(path, a, SR)
    os.remove(raw)
    return path, len(a) / SR


def word_times(path):
    """Word timestamps from faster-whisper (used only to time caption cues)."""
    from asr_check import m, load16k
    segs, _ = m.transcribe(load16k(path), word_timestamps=True)
    words = [w for s in segs for w in s.words]
    return words


def split_cues(text, max_chars=64):
    """Split a line into caption cues: sentences first, then balanced splits at
    the comma (or word) closest to the middle, recursively."""
    def split(words):
        t = " ".join(words)
        if len(t) <= max_chars or len(words) < 4:
            return [words]
        mid = len(t) / 2
        best, bestscore = None, 1e9
        pos = 0
        for i, w in enumerate(words[:-1]):
            pos += len(w) + 1
            score = abs(pos - mid) - (25 if w[-1] in ",;" else 0)
            if 1 <= i < len(words) - 2 and score < bestscore:
                best, bestscore = i, score
        return split(words[:best + 1]) + split(words[best + 1:])
    sentences = re.findall(r"[^.!?]+[.!?]*", text)
    out, buf = [], []
    for snt in sentences:
        w = snt.split()
        if not w: continue
        if buf and len(" ".join(buf + w)) <= 42:   # merge short sentences
            buf += w; continue
        if buf: out += split(buf)
        buf = w
    if buf: out += split(buf)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    print("script words:", WORDS)
    dur = {}
    files = {}
    for l in LINES:
        files[l["id"]], dur[l["id"]] = synth(l)
        print(f"  {l['id']:4s} {dur[l['id']]:5.2f}s  {l['text']}")

    # ---- timeline -------------------------------------------------------
    T = {}
    starts = {}
    t = 0.0
    T["title"] = [0.0, None]
    starts["t0"] = 2.3
    T["title"][1] = max(8.0, starts["t0"] + dur["t0"] + 0.9)
    t = T["title"][1]
    for b in ("b1", "b2", "b3", "b4"):
        s = t
        starts[b + "L"] = s + 0.5
        starts[b + "R"] = starts[b + "L"] + dur[b + "L"] + 0.55
        e = starts[b + "R"] + dur[b + "R"] + 0.6
        T[b] = [s, e]; t = e
    s = t
    starts["d1"] = s + 1.0
    starts["d2"] = starts["d1"] + dur["d1"] + 1.2
    starts["d3"] = starts["d2"] + dur["d2"] + 1.6
    e = max(starts["d3"] + dur["d3"] + 1.2, s + 14.0)
    T["drift"] = [s, e]; t = e
    s = t
    starts["f1"] = s + 2.8
    e = max(starts["f1"] + dur["f1"] + 7.5, s + 12.0)
    T["final"] = [s, e]
    total = e
    print("sections:", {k: [round(v[0], 2), round(v[1], 2)] for k, v in T.items()})
    print("total: %.2f s" % total)
    if not (75 <= total <= 90):
        print("WARNING: total outside 75-90 s")

    # ---- caption cues timed to words ------------------------------------
    cues = []
    lines_out = []
    for l in LINES:
        st = starts[l["id"]]
        lines_out.append(dict(l, start=st, end=st + dur[l["id"]], file=files[l["id"]]))
        groups = split_cues(l["text"])
        ws = word_times(files[l["id"]])
        n = len(l["text"].split()); m = max(1, len(ws))
        k0 = 0
        for gi, g in enumerate(groups):
            k1 = k0 + len(g)  # my word indices [k0, k1)
            a = min(m - 1, int(round(k0 * m / n)))
            b = min(m - 1, max(a, int(round(k1 * m / n)) - 1))
            cs = st + (0 if gi == 0 else ws[a].start - 0.05)
            ce = st + (dur[l["id"]] if gi == len(groups) - 1 else ws[b].end + 0.05)
            cues.append(dict(line=l["id"], side=l["side"], section=l["section"],
                             text=" ".join(g), start=round(cs, 3), end=round(ce, 3)))
            k0 = k1
    # keep captions slightly longer for readability without overlapping
    for i, c in enumerate(cues):
        nxt = cues[i + 1]["start"] if i + 1 < len(cues) else total
        c["end"] = round(min(c["end"] + 0.35, nxt - 0.05), 3)
        print(f"  cue {c['start']:6.2f}-{c['end']:6.2f} {c['text']}")

    json.dump(dict(total=total, sections=T, lines=lines_out, cues=cues, sr=SR),
              open(os.path.join(ROOT, "build/timeline.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
