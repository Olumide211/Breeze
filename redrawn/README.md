# REDRAWN

A 42-second original 2D animated short, drawn entirely in code with [Remotion](https://www.remotion.dev).
1024×576, 12 fps, 504 frames, H.264, no audio.

| Output | What |
| --- | --- |
| `out/redrawn.mp4` | the film |
| `out/contact.png` | contact sheet, every 6th frame |
| `out/cast.png` | model sheet: Boy at boil 0.2 / 1.0, erased, redrawn, plus props |

## Commands

```bash
npm install
npm run dev        # Remotion Studio, scrub the film live
npm run render     # out/redrawn.mp4 + out/contact.png
npm run cast       # out/cast.png
npm run stills -- s3 84 100 118   # review stills → out/stills/s3.png
```

## Where to tweak

- **`src/scenes.ts`** — the one config file: scene frame ranges, each scene's boil `[start, end]`,
  the boil → jitter/hold table (`BOIL_LEVELS`), camera shots (`CAM`), story beat timings (`T`),
  line weight over time, and every scribble bubble's path.
- `src/direction.ts` — the acting: poses, expressions and prop motion per scene, reading timings from `scenes.ts`.
- `src/components/` — `SketchPath` (the pencil line + boil), `Erasable` (SVG-mask eraser + ghost),
  `Boy`, `ScribbleBubble`, `Parent`, `Paper`, `Pencil`, `Room`, `Camera`.
