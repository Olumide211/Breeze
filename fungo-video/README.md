# Fungo Labs × Zama — 20s launch film (Remotion)

1920×1080 · 30fps · 600 frames · H.264 → `out/fungo-20s.mp4`

```bash
npm install
npm run studio     # live preview / scrub
npm run stills     # mid-scene stills → out/stills/
npm run render     # full video → out/fungo-20s.mp4
```

**Tweak everything in `src/config.ts`**: scene durations, colors, all copy, trait values, auction numbers, music.

| Scene | Time | Component |
|---|---|---|
| 1 · The old way | 0–4s | `src/scenes/Scene1OldWay.tsx` |
| 2 · The shift | 4–9s | `src/scenes/Scene2Shift.tsx` |
| 3 · Beyond the artwork | 9–15s | `src/scenes/Scene3Beyond.tsx` (3a private traits, 3b encrypted bids) |
| 4 · The bigger picture | 15–20s | `src/scenes/Scene4BiggerPicture.tsx` (4a line, 4b flood + lockup) |

- The 8-tile grid (`src/components/TileGrid.tsx`) is built in code: radius 22% and gap 8% of tile width.
- The Genesis character (`src/components/CharacterArt.tsx`) is original and drawn across the 8 tiles. Its face is the empty centre.
- Zama logos in `assets/` are the official files from zama.org (not redrawn).
- Music: drop `assets/music.mp3` in, run `npm run find-hit`, and set `MUSIC.hitAt` so the hit lands on the yellow flood.
