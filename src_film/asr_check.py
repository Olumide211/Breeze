"""Transcribe wav files with faster-whisper to verify TTS intelligibility."""
import sys, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
m = WhisperModel("base.en", device="cpu", compute_type="int8")
def load16k(p):
    a, sr = sf.read(p, dtype="float32")
    if a.ndim > 1: a = a.mean(1)
    if sr != 16000:
        from math import gcd
        g = gcd(sr, 16000); a = resample_poly(a, 16000//g, sr//g).astype("float32")
    return a
if __name__ == "__main__":
    for p in sys.argv[1:]:
        a = load16k(p)
        segs, _ = m.transcribe(a, word_timestamps=True)
        segs = list(segs)
        print(p, "peak=%.2f" % abs(a).max(), "|", " ".join(s.text.strip() for s in segs))
