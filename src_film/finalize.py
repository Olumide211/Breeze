"""Mux picture + mix into out/two-roads.mp4 and export out/two-roads.srt."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from events import ROOT

tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))
os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)


def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


with open(os.path.join(ROOT, "out/two-roads.srt"), "w", encoding="utf-8") as f:
    for i, c in enumerate(tl["cues"], 1):
        f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")

# deliverable: 2-pass x264 at ~7.5 Mbps from the CRF-17 master (keeps the file < 100 MB)
src_v, src_a = os.path.join(ROOT, "build/video.mp4"), os.path.join(ROOT, "build/mix.wav")
out = os.path.join(ROOT, "out/two-roads.mp4")
plog = os.path.join(ROOT, "build/x264pass")
venc = ["-c:v", "libx264", "-preset", "slow", "-tune", "film", "-b:v", "7500k", "-maxrate", "12M", "-bufsize", "16M",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", "30", "-passlogfile", plog]
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src_v, *venc, "-pass", "1", "-an", "-f", "mp4", os.devnull], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src_v, "-i", src_a, "-map", "0:v:0", "-map", "1:a:0",
                *venc, "-pass", "2", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
                "-t", f"{tl['total']:.3f}", "-movflags", "+faststart",
                "-metadata", "title=TWO ROADS", "-metadata", "artist=BreezeOg", out], check=True)
print("wrote out/two-roads.mp4 and out/two-roads.srt")
