# AstraReveal — 12 s vertical launch film (Remotion)

1080×1920, 60 fps, 720 frames. Composition id `AstraReveal`.

Change the name in `src/title.ts` (`TITLE_LEFT`, `TITLE_RIGHT`).

```bash
npm install
npx remotion studio            # preview
# H.264 master
npx remotion render AstraReveal out/astra.mp4 --codec=h264 --crf=14 --pixel-format=yuv420p
# ProRes 4444 (10-bit, alpha-capable container)
npx remotion render AstraReveal out/astra-4444.mov --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le
```

The film uses WebGL. On a machine with no GPU (CI, cloud Linux), add `--gl=swangle`.
QA stills: `node scripts/stills.mjs 0 60 96 …` → `out/stills/`.

## Layout
- `src/timeline.ts` — frames, layout, palette, easing
- `src/scenes/` — blossom, ChatGPT message box + typing, bubble/dot/spark, titles, space/grain
- `src/galaxy/` — 60,000-star shader points (`GalaxyPoints`), shared camera maths, icon ring, additive FX canvas
- `public/icons-line/` — six matched line icons (Heroicons 2.2 outline, MIT), made by `scripts/make-line-icons.mjs`
- `SOUND.md` — cue sheet with exact times

All randomness is `random(seed)` from remotion: renders are frame-identical.
