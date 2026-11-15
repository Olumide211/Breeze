# Lagos 2090 by BreezeOg

A 30-second, 1920×1080, 24 fps anime-style 3D montage of an original solarpunk Lagos, built entirely in code
(Vite + TypeScript + Three.js — no Blender, no audio). Final film: [`output/lagos-2090.mp4`](output/lagos-2090.mp4).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173/?play  (real-time preview)
                     # ?f=123 renders one frame, ?shot=3&lf=40 builds a single shot
npm run render       # build → step all 720 frames in headless Chromium → frames/*.png → output/lagos-2090.mp4
```

`npm run render` accepts `--from N --to N` (re-render a range), `--workers N`, `--no-build`, `--no-encode`.
Rendering is deterministic: every motion is a pure function of the frame number (`window.__render(frame)`).

## Shots (hard cuts)

| # | Frames | Shot | Title |
|---|--------|------|-------|
| 1 | 0–83 | Low angle: yellow hover-danfo glides under a vine-covered overpass, lens flare | CREATED BY BREEZEOG |
| 2 | 84–167 | Rooftop garden: solar panels, planters, washing lines, skyline | CONCEPT AND DESIGN BREEZEOG |
| 3 | 168–251 | Market street: umbrellas, fruit stalls, lanterns, glowing signs, dust motes | — |
| 4 | 252–335 | Electric okada by a red kiosk, blurred palm fronds in front | 3D ANIMATION BREEZEOG |
| 5 | 336–419 | Third Mainland Bridge wrapped in greenery over the lagoon at sunset | — |
| 6 | 420–503 | Roadside corner: vending kiosk, crates, bicycle on a fence, dappled shade, butterflies | — |
| 7 | 504–587 | Inside a danfo: the city passes the window, rainbow light leaks | STORYLINE BREEZEOG |
| 8 | 588–719 | Top-down lagoon-side park, two egrets, pollen → "Lagos 2090 by BreezeOg" card | title card |

## How it is built

- `src/assets.ts` — reads `assets-manifest.json`, loads every GLB in `./models`, and bakes each into one
  vertex-coloured geometry (atlas colours sampled per vertex) so models can be recoloured and drawn with the custom shader.
  Loads the six ambientCG colour maps and both HDRIs (sun azimuth + sky colours are measured from the HDR data).
- `src/core.ts` — the toon/cel `ShaderMaterial`: banded sun term with brushy wobble, shadow maps, hemisphere ambient,
  triplanar painterly noise, PBR maps used only as tonal "wash" input, foliage dabs/back-light, painted dappled light,
  wind sway / cloth / wing-flap vertex modes, stripes, self-glow, aerial perspective. Also dust/pollen motes and glows.
- `src/sky.ts` — painted sky dome driven by the HDRI (posterised, brush-jittered) plus puffy cel-shaded cloud geometry.
- `src/build.ts` — procedural pieces the pack lacks: foliage masses, hanging vines, washing/cloth, palm fronds,
  water (ripples, glitter, shoreline foam), glowing signs (Montserrat Light), light shafts, wires.
- `src/kit.ts` — hover-danfo (Kenney van: wheels removed, yellow + black stripes, hover pods and glow), trees, skyline, scatter, parasols.
- `src/post.ts` — post pipeline: 4× MSAA HDR scene → Kuwahara painterly filter → blurred foreground layer →
  bloom → lens flare, light leaks (incl. rainbow), grade, vignette, paper tooth, film grain, title-card fade.
- `src/shots/*` — the eight fixed-camera shots. Titles are DOM text in `./fonts/Montserrat-Light.ttf` over the canvas.
- `scripts/render.mjs` — Playwright frame stepping + ffmpeg-static encode (H.264 High, yuv420p, ~20 Mbps).

## Assets and licences

Only the supplied starter pack is used — no extra models, textures or fonts were added. See `CREDITS.md` and
`assets-manifest.json` for per-file details: Kenney kits (CC0), Quaternius bird (CC0), AliceCassie motorcycle (CC0),
jeremy bicycle (CC-BY 3.0), Poly by Google butterfly (CC-BY 3.0), Kyle Li school bus (CC-BY 3.0, loaded but not shown —
the danfo is the Kenney van), ambientCG textures (CC0), Poly Haven HDRIs by Greg Zaal (CC0), Montserrat (SIL OFL 1.1).
