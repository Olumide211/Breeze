# Fungo Labs × Zama — 30s launch film (Remotion)

1920×1080 · 30fps · 900 frames · H.264 + AAC (SFX) → `out/fungo-30s.mp4`

```bash
npm install
npm run studio     # live preview / scrub
npm run stills     # mid-scene stills → out/stills/
npm run render     # full video → out/fungo-30s.mp4
npm run sfx        # regenerate the synthesized sound effects
```

**Tweak everything in `src/config.ts`**: scene durations, colors, all copy, trait values, auction numbers, music.

| Scene | Time | Component |
|---|---|---|
| 1 · The old way | 0–5.5s | `src/scenes/Scene1OldWay.tsx` |
| 2 · The shift | 5.5–11.5s | `src/scenes/Scene2Shift.tsx` |
| 2b · Computed, never revealed (FHE) | 11.5–16.5s | `src/scenes/Scene2bCompute.tsx` |
| 3 · Beyond the artwork | 16.5–24s | `src/scenes/Scene3Beyond.tsx` (3a private traits, 3b encrypted bids) |
| 4 · The bigger picture | 24–30s | `src/scenes/Scene4BiggerPicture.tsx` (4a line + riser, 4b flood + lockup) |

- The 8-tile grid (`src/components/TileGrid.tsx`) is built in code: radius 22% and gap 8% of tile width.
- The Genesis character (`src/components/CharacterArt.tsx`) is original and drawn across the 8 tiles. Its face is the empty centre.
- Zama logos in `assets/` are the official files from zama.org (not redrawn).
- Final frame carries a small "MADE BY TIFE" credit (`CREDIT` in config).
- Sound effects are synthesized from code (`scripts/make-sfx.mjs`, no samples or licences) and cued inside each scene on the same frame as their motion. Levels are in `SFX` in the config.
- Music: drop `assets/music.mp3` in, run `npm run find-hit`, and set `MUSIC.hitAt` so the hit lands on the yellow flood.
