# RESONANCE · by BreezeOg

A 48-second, 60 fps cinematic montage of present-day New York City from dawn to deep night,
built with **Remotion 4 + React Three Fiber (three.js)** on **real OpenStreetMap data**.
Video only: there is no audio track.

Everything is procedural and deterministic. The same frame always renders to the same pixels:
all randomness comes from `seedrandom` streams and integer hashes of object ids and frame
numbers (`src/lib/rng.ts`); nothing reads `Math.random` or the clock.

## Re-render

```bash
cd resonance
npm install

# 1. (optional) refresh the OpenStreetMap cache. data/raw/*.json is committed, so this step and
#    every later one work offline. Tiles are fetched with retry + backoff across Overpass mirrors.
npm run fetch
npm run build-city          # data/raw -> public/city/{buildings.bin,roads.bin,misc.json,mask.png}

# 2. QA
node scripts/render.mjs overview 72        # one 960x540 still every 72 frames -> out/qa/overview
node scripts/render.mjs stills 150 780     # specific frames -> out/qa
node scripts/render.mjs preview            # one 960x540 mp4 per shot -> out/preview

# 3. final render (resumable: rerun the same command to continue after an interruption)
node scripts/render.mjs final              # software-GL path (no GPU needed)
NATIVE=1 SUBFRAMES=8 node scripts/render.mjs final   # GPU path: native 3840x2160, 8 sub-frames
```

Outputs:

| File | What |
| --- | --- |
| `out/resonance-4k.mp4` | 3840x2160, 60 fps, H.264 yuv420p CRF 16, no audio |
| `out/resonance-1080p.mp4` | 1920x1080, same encode settings |
| `out/resonance-master-prores4444.mov` | ProRes 4444 master the two MP4s are encoded from |

`npm run studio` opens Remotion Studio on the `Resonance` composition.

### GL backend and the two render paths

`scripts/render.mjs` asks Chromium for the `angle` (GPU) renderer and falls back to `swangle`
(software) when no GPU context can be created.

* **`NATIVE=1` (GPU machines):** the 3D film is rendered at native 3840x2160 with motion blur
  by sub-frame accumulation (`SUBFRAMES=8`, with sub-pixel jitter so the sub-frames also
  supersample).
* **Default (software GL):** a CPU rasteriser cannot shade 4K x 8 sub-frames x 2880 frames in a
  practical time, so the 3D film is rendered at native 1920x1080 with one scene pass per frame and
  depth-reprojection motion blur, then lanczos-upscaled to 4K. The title sequence is rendered
  natively at 4K with alpha and composited on top, so the typography is pixel-sharp.

The files shipped in `out/` from the original build were made with the software path (the
build machine had 4 CPU cores and no GPU).

## Layout

```
data/raw/            cached Overpass tiles (42 bbox tiles: buildings, roads, parks, water, bridges)
public/city/         compact projected city: building footprints + heights, road chains, land/park/road mask
scripts/             fetch-osm.mjs, build-city.mjs, render.mjs (stills / preview / final), map.mjs (QA map)
src/timeline.ts      shot list, Catmull-Rom camera paths, dawn -> night colour script
src/city/            data loading, footprint extrusion (per-tile merge), procedural modelling toolkit, prop models
src/shaders/         shared sky/fog/shadow/anime-ramp GLSL, deferred facade shader, prop material
src/scenes/          world orchestration, sky + clouds, ground + water, shadows + reflections, landmarks,
                     props, traffic, birds / aircraft / ferries, rain / steam / mist / billboards, shot builders
src/post/            sub-frame accumulation pass, outline, lens flare + light leaks, motion blur, ACES grade
src/Film.tsx         the Remotion composition (ThreeCanvas + @react-three/postprocessing chain)
src/Title.tsx        "RESONANCE" title + "Edited by BreezeOg" credit
```

## How it works

* **City layout.** Overpass data for Lower + Midtown Manhattan, the south half of Central Park,
  the DUMBO / Brooklyn / Queens waterfronts and the Jersey City shore is projected to local
  metres centred on the Empire State Building (40.7484, -73.9857). About 88,000 building solids
  are extruded with their real `height` (or `building:levels` x 3.4 m) and merged per 400 m tile.
* **Hero landmarks** are modelled procedurally: Empire State (setbacks, cruciform shaft, mast,
  floodlights), Chrysler (sunburst crown with triangular windows), One WTC (tapering chamfered
  glass, blinking beacon), Brooklyn Bridge (gothic arched granite towers, four cables, suspenders
  and diagonal stays, wooden promenade), Manhattan Bridge (blue steel towers, truss deck, subway
  trains), Flatiron, Billionaires' Row, plus Williamsburg and Queensboro in the background.
* **Detail.** A facade shader draws window grids, mullions, sills, cornices, storefronts, wall AC
  units and interior-mapped rooms (curtains, plants, lamps). Instanced props add water towers, AC
  units, vents, antennas, fire escapes, scaffolding, signs, street lamps, cycling traffic signals,
  trees in cobble pits, subway entrances, hot dog carts and crosswalks. Taxis, cars and buses follow
  the real OSM road chains. Birds are a fixed-step boids simulation; helicopters, a plane, ferries
  with wakes, rain, manhole steam and river mist are analytic functions of time.
* **Look.** One `timeOfDay` value drives sun / moon, sky gradient, clouds, fog, window lighting and
  the grade. Shading is a soft two-band ramp with coloured shadows, rim light and depth outlines.
  Post: HDR bloom, god rays, lens flare, light leaks, chromatic aberration, ACES tone map, per-shot
  grade, grain, vignette and SMAA.
* **Stability.** Level of detail and prop sets are chosen once per shot. Sun shadows are two nested
  static maps per shot. Facades are shaded deferred (G-buffer, then one facade pass per pixel).
  `delayRender` holds the first frame until the city, fonts and lookup textures are ready.

## Credits

Edited by BreezeOg. City data © OpenStreetMap contributors (ODbL). All billboard brands are fictional.
