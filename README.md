# TWO ROADS

An animated short film (≈87 s, 1920×1080, 30 fps) made entirely in code. It compares the childhoods of Lionel Messi and Cristiano Ronaldo side by side in a split screen that merges at the end. The tone is respectful and factual. *Same game. Different roads.*

**Output:** `out/two-roads.mp4` (H.264 + AAC) and `out/two-roads.srt`.

- No image models, stock footage, samples or downloaded music.
- Every frame is drawn with **pycairo**, with typography set in **Pillow**.
- The score and SFX are synthesized with **numpy/scipy**.
- The narration uses offline **Piper TTS** (`en_US-ryan-high`, a stock synthetic voice, not a clone of any real person).
- Characters are faceless, stylized figures and silhouettes, so the film claims no likeness.

## Setup (Linux / macOS)

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install numpy scipy Pillow pycairo soundfile tqdm piper-tts pyloudnorm faster-whisper
# ffmpeg + ffprobe must be on PATH (apt install ffmpeg / brew install ffmpeg)

# Piper voice (downloaded into assets/voices, ~120 MB)
base=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high
curl -L -o assets/voices/en_US-ryan-high.onnx      $base/en_US-ryan-high.onnx
curl -L -o assets/voices/en_US-ryan-high.onnx.json $base/en_US-ryan-high.onnx.json
```

The fonts are bundled in `assets/fonts`: **Montserrat** and **Inter**, both under the SIL Open Font License.

On Windows, install ffmpeg with `winget install Gyan.FFmpeg` and run the same Python steps inside `.venv\Scripts\activate`.

## Build

```bash
./make_film.sh
```

The script runs these steps in order:

| step | script | output |
|---|---|---|
| 1. Narration | `src_film/narration.py` | Synthesizes each line, keeping the best of up to 4 takes by ASR match. It measures the durations, sets every scene's timing from them, and times the caption cues to word timestamps. Writes `build/voice/*.wav` and `build/timeline.json`. |
| 2. Audio | `src_film/audio.py` | Score: piano motif (left / Rosario), pluck motif (right / Madeira), pads, string swell and percussion. SFX: ball bounces, whooshes, street and sea ambience, heartbeat, crowd and roar. The music is normalized to -18 LUFS and ducked 9 dB under the voice. The master is at -16 LUFS with a -1.5 dBTP limiter. Writes `build/mix.wav`. |
| 3. Picture | `src_film/render.py` | Renders all frames in parallel and encodes them to `build/video.mp4`. |
| 4. Finalize | `src_film/finalize.py` | Writes `out/two-roads.mp4` and `out/two-roads.srt`. |
| 5. QA | `src_film/qa.py` | Checks the ffprobe specs, extracts 10 frames, and verifies loudness, true peak, and caption-to-voice sync. |

To render preview stills: `python src_film/render.py --stills 5 20 40 80` writes PNGs to `build/stills/`.

Picture and sound share one timing source, `src_film/events.py`. Ball bounces, heartbeats, stadium lights and transitions therefore land on the same frame as their sounds.

## Facts used

The script (`src_film/script.py`) uses only these facts:

- **Messi:** born in Rosario, Argentina, in 1987. Played football in the streets, with family, and for his local club. Diagnosed at about 10–11 with a growth hormone deficiency, which was costly to treat. In 2000, at 13, FC Barcelona offered to cover the treatment, and he moved to Spain with his father.
- **Ronaldo:** born in Funchal, Madeira, Portugal, in 1985. Grew up in a modest home with little money. Played football in the streets and for a local club. Joined the Sporting CP academy at 12, leaving home. In 2000, at 15, had surgery for a racing-heart condition, then returned to the pitch.
- **Both** became the greatest players of their generation.

By BreezeOg.
