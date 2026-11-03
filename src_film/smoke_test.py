"""2-second smoke test: cairo-drawn frames + numpy audio -> H.264/AAC mp4."""
import subprocess, numpy as np, cairo, soundfile as sf
W, H, FPS, SR = 1920, 1080, 30, 48000
t = np.arange(2 * SR) / SR
sf.write("build/smoke.wav", (0.3 * np.sin(2*np.pi*440*t) * np.exp(-t)).astype("float32").repeat(2).reshape(-1, 2), SR)
p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}",
                      "-r", str(FPS), "-i", "-", "-i", "build/smoke.wav", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                      "-c:a", "aac", "-shortest", "build/smoke.mp4"], stdin=subprocess.PIPE)
surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
for i in range(2 * FPS):
    c = cairo.Context(surf); c.set_source_rgb(0.1, 0.1, 0.2); c.paint()
    c.set_source_rgb(1, 0.8, 0.3); c.arc(200 + i * 25, 540, 60, 0, 6.3); c.fill()
    p.stdin.write(surf.get_data())
p.stdin.close(); p.wait()
