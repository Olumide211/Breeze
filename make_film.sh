#!/usr/bin/env bash
# Build "TWO ROADS" end to end. Run from the repository root after setup (see README.md).
set -euo pipefail
cd "$(dirname "$0")"
. .venv/bin/activate
python src_film/narration.py      # TTS per line -> measured timeline + word-timed caption cues
python src_film/audio.py          # synthesized score + SFX + ducked voice mix (-16 LUFS)
python src_film/render.py         # cairo frames -> build/video.mp4
python src_film/finalize.py       # mux -> out/two-roads.mp4, export out/two-roads.srt
python src_film/qa.py             # quality gates
