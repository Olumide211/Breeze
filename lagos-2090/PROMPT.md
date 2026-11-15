Create a 30-second, 1920x1080, 24 fps anime-style 3D montage called "Lagos 2090 by BreezeOg": an original solarpunk Lagos that looks like a hand-painted anime background film. VIDEO ONLY, no audio. NO Blender: build everything in code with Vite + TypeScript + Three.js. Work fully autonomously: install everything you need first (Node packages, Playwright + Chromium, ffmpeg via ffmpeg-static), fix every error yourself, never stop to ask, and finish only when the MP4 is rendered and verified.

ASSETS (do this first)
This project folder already contains a ready-to-use asset pack. Before you model anything:
- Read ./assets-manifest.json end to end. It lists every file, what it is, which shots it suits, and its license.
- Load models from ./models (vehicles, city, props, nature, animals, boats). All .glb files are self-contained.
- Use PBR textures from ./textures (concrete, plaster-wall, asphalt, grass, wood, corrugated-metal) as painterly/toon inputs — not as photoreal materials.
- Use HDRIs in ./hdri for lighting and sky (the_sky_is_on_fire_2k.hdr for golden-hour/sunset, spruit_sunrise_2k.hdr for brighter morning/park).
- Use ./fonts/Montserrat-Light.ttf for every on-screen title (thin, clean, OFL-licensed).
Restyle every model with custom toon/cel shaders. Recolor freely: make the van or school bus a yellow hover-danfo with black stripes; make the motorcycle a glowing electric okada; make parasols bright market colours; make the kiosk red for shot 4. If a shot still needs something the pack does not have (washing lines, vines on an overpass, water, clouds, dust, pollen, light leaks, a hover glow under the danfo, egrets posed from the bird mesh, etc.), build that missing piece procedurally. Do not download random paid/copyrighted assets. If you add any extra free models, record them in the summary with author and license.

LOOK
Custom toon/cel shaders with soft painted gradients, painterly noise textures on walls and foliage, puffy stylized clouds, golden-hour warmth. Post-processing: bloom, lens flares, light leaks, subtle film grain, slight vignette. Rich greens, sunset pinks and oranges, deep blues.

SHOTS (8 static shots, ~3.5 s each, hard cuts):
1. Low angle: a yellow hover-danfo bus glides under a vine-covered overpass at golden hour, lens flare. Text fades in: "CREATED BY BREEZEOG".
2. Rooftop garden on a Lagos apartment block: solar panels, plants, washing lines swaying, skyline behind. "CONCEPT AND DESIGN BREEZEOG".
3. Market street: colorful umbrellas, fruit stalls, hanging lanterns, glowing signs, dust motes in the light.
4. An okada rider's glowing electric bike parked by a red kiosk, blurred palm leaves swaying in front. "3D ANIMATION BREEZEOG".
5. Third Mainland Bridge wrapped in greenery over the lagoon at sunset, small boats drifting, water rippling.
6. Roadside corner: a vending kiosk, stacked crates, a bicycle against a fence, dappled tree shadows, butterflies.
7. Inside a danfo looking out the window: the city passes, rainbow light leaks wash over the lens. "STORYLINE BREEZEOG".
8. Top-down view of a lush lagoon-side park, grass swaying, two egrets flying across, pollen drifting; fade to a "Lagos 2090 by BreezeOg" title card.

MOTION
Fixed cameras; only ambient motion (swaying grass, leaves and cloth, drifting clouds, birds, butterflies, dust, water ripples, flickering lights). Thin clean font for text, smooth fades.

RENDER
Deterministic animation (time driven by frame number). Use Playwright to step through all 720 frames, screenshot each at 1920x1080, encode with ffmpeg to H.264 MP4 (high bitrate, yuv420p).

QUALITY GATES
Zero build errors. Extract one frame per shot and view them yourself; if anything looks flat, plain or broken, improve and re-render. Text crisp; exactly 30 s.

DELIVER
./output/lagos-2090.mp4, the source code, and a short summary.
