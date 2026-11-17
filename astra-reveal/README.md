# Astra — 12 s launch film (Remotion)

Two compositions, same scenes and timing, 60 fps, 720 frames:
- `AstraReveal` — 1080×1920 (9:16)
- `AstraSquare` — 1080×1080 (1:1)

Change the name and tagline in `src/title.ts`. Per-format layout lives in `src/layout.ts`.

```bash
npm install
npx remotion studio            # preview
# H.264 master
npx remotion render AstraReveal out/astra-9x16.mp4 --codec=h264 --crf=14 --pixel-format=yuv420p
npx remotion render AstraSquare out/astra-1x1.mp4 --codec=h264 --crf=14 --pixel-format=yuv420p
# ProRes 4444 (10-bit, alpha-capable container)
npx remotion render AstraReveal out/astra-4444.mov --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le
```

The film uses WebGL. On a machine with no GPU (CI, cloud Linux), add `--gl=swangle`.
QA stills: `node scripts/stills.mjs 0 60 96 …` → `out/stills/` (prefix `COMP=AstraSquare` for the square cut).

## Layout
- `src/timeline.ts` — frames, layout, palette, easing
- `src/scenes/` — blossom, ChatGPT message box + typing, bubble/dot/spark, titles, space/grain
- `src/galaxy/` — 60,000-star shader points (`GalaxyPoints`), shared camera maths, icon ring, additive FX canvas
- `public/icons-line/` — six white ring icons: 01 is the official blossom, 02–06 Heroicons 2.2 outline (MIT), made by `scripts/make-line-icons.mjs`
- `SOUND.md` — cue sheet with exact times

All randomness is `random(seed)` from remotion: renders are frame-identical.
