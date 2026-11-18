# Gemini 4 Neon: 12-second launch film (Remotion)

Two compositions on one timeline (60fps, 720 frames):

| id | size | output |
|---|---|---|
| `NeonVertical` | 1080×1920 | `out/neon-9x16.mp4` |
| `NeonSquare` | 1080×1080 | `out/neon-1x1.mp4` |

The name lives in one place: `MODEL_FAMILY` / `MODEL_NAME` at the top of `src/NeonFilm.tsx`.

## Run

```bash
npm install
npm run studio          # preview
npm run render          # both films: h264, crf 14, yuv420p
node scripts/stills.mjs both 0,50,110,140,260,330,380,420,470,500,540,600,719   # check stills -> stills/
```

Rendering uses `--gl=swangle` (software WebGL), so it runs on machines without a GPU. On a machine with a GPU, `--gl=angle` is faster.

## How it's built

- `src/World.tsx`: one `@remotion/three` canvas with an orthographic camera (1 unit = 1px).
  - A full-screen shader draws the whole backdrop: black, then the app's navy glow, then the thinking aurora, then Google's key-art blues.
  - The glass neon "4" is a `TubeGeometry` with a custom shader. Its electrode caps are separate meshes.
- `src/shaders.ts`: the glass shader calls the same background function at refracted coordinates, so the world seen through the tube is the real backdrop, slightly bent.
  - The shader also draws the rims, the darker inner band, iridescence, the refraction sweep, the plasma column, the hot core and the electrode glow.
- `src/fourPath.ts`: the tube's centre line, traced from the Google Sans Flex 500 "4" glyph.
  - The same curve, projected, drives the 2D bloom halo and the warm tint on the particles, so the halo sits exactly on the tube.
- `src/AppUI.tsx`: the Gemini app UI (measurements from `reference/gemini-app/`), the typing, the bubble and the thinking dots.
- `src/Neon.tsx`: the neon halo, the six neon icons and the floating "4" particles.
- `src/timing.ts`: every cue. It holds the seeded typing schedule and the ignition curve, which is synced to `neon-ignition-flicker.wav`.
- Deterministic: Remotion's `random(seed)` only. There is no `Math.random` and no `Date`. Grain is an `feTurbulence` seeded by the frame number.

Sound is not in the render; see `SOUND.md` for the cue sheet.
