ROLE
you are a senior motion designer and creative technologist. build a 12-second launch film for "Gemini 4 Neon" in remotion (react + @remotion/three). the bar is google's own gemini 4 launch art: airy, luminous, glassy, calm and precise. every frame should look like it came from google's own design team.

NAME CONSTANTS (top of the file, so the name can change in one place)
const MODEL_FAMILY = "Gemini 4"; const MODEL_NAME = "Neon";

STEP 0: SETUP (do this before anything else)
- the asset pack is gemini-neon-assets.zip in this folder. unzip it here (unzip gemini-neon-assets.zip). that creates ./gemini-neon-assets/.
- check node is 18 or newer (node -v). if it isn't, stop and tell me.
- create the remotion project in this folder, install @remotion/three, three, @remotion/fonts and @remotion/motion-blur, then copy ./gemini-neon-assets into public/gemini-neon-assets/.
- confirm these exist before you continue: public/gemini-neon-assets/logos/gemini-spark-color.svg, fonts/, icons/, reference/ (including reference/gemini-app/) and sound/. if anything is missing, stop and tell me what.

PROJECT + ASSETS
- remotion project with TWO compositions, same timeline:
  · "NeonVertical": 1080x1920, 60fps, 720 frames
  · "NeonSquare": 1080x1080, 60fps, 720 frames
- copy the whole asset pack into public/gemini-neon-assets/ and use these files:
  · logos/gemini-spark-color.svg (the full-colour gemini spark; use as provided)
  · fonts/google-sans-flex/*.woff2 and fonts/google-sans/*.woff2 (load with @remotion/fonts)
  · icons/01-deep-research.png … 06-code.png (and their .svg versions)
  · reference/: study ALL of it before writing code, especially the three gemini 4 key art images, the three gemini-app screenshots and VISUAL-SYSTEM.md. none of the reference images appear on screen.
- deterministic only: no Math.random, no Date. use remotion's random(seed). every render must be frame-identical.
- render commands: h264, crf 14, yuv420p, to out/neon-9x16.mp4 and out/neon-1x1.mp4.

THE STORY IN ONE LINE
someone opens the gemini app on a phone and asks neon a cheeky question; the screen fills with gemini's thinking glow, the glow opens into google's gemini 4 key-art world, and the answer is a glass neon tube shaped like a "4" that flickers to life and glows warm red-orange: the first warm light in the whole gemini 4 series.

STUDY FIRST: GOOGLE'S GEMINI 4 KEY-ART SYSTEM (from reference/*keyart*)
- background: soft blue gradient with fine grain. dark navy at the bottom-left (#08183b to #0a3c95), mid blues (#1b499f to #2b64b4) through the centre, and bright, almost white-blue light at the top-right (#91d2f5 to #d3f5fc). no black, no other hues.
- lockup: the full-colour spark, then "Gemini 4 <Name>" in white Google Sans at medium weight, normal tracking, one line, with no effects on the type. spark height ≈ the text cap height, plus a little.
- the element object: one large 3D object in frosted, translucent glass with iridescent refraction (cyan, violet, a touch of pink), soft depth of field at its edges (argon = a glass "4", carbon = crystal, hydrogen = liquid bubble).
- particles: tiny white "4" glyphs floating like dust, with depth of field (a few sharp, most soft).
- mood: calm, airy, premium. no harsh glows, no hard shadows.

STUDY FIRST: THE GEMINI APP (from reference/gemini-app/*.jpg, measured and scaled to 1080 wide)
- 01-home-empty: pure black screen with a deep navy glow rising from the bottom (black through the top 55%, #070c21 at 78% height, #122158 at 92%, #16296e at the bottom centre).
  the "Ask Gemini" box: a pill 838x235, corner radius 117, fill #1c1c1c, no border. inside, from the left: a thin "+" (white, ~56px, ~2.5px strokes) centred at 120px in; the placeholder "Ask Gemini" in Google Sans Flex 600 at ~50px, #b0b0b0, starting 220px in; a white outline mic centred at 575px in; and a dark-blue circle button 119px wide, #192968, centred at 719px in, holding a light 3-bar waveform glyph (#d9def1).
- 02-typed: once the text runs past one line, the box grows into a rounded rectangle 957x414 with corner radius ~105. the text sits at the top-left (72px in, 78px down) in Google Sans Flex 700 at ~42px, white, line height ~54px. the + / mic / send buttons move to a bottom row, centred 120px above the box's bottom edge. the send button is the same 119px circle, now a brighter blue #2f45a8 with a white up-arrow.
- 03-thinking: after send, an aurora glow fills the top of the screen: deep green-teal #025543 at the top-left, teal-cyan #0e6d83 at the top-middle, blue #11426b at the top-right, fading through #04251e at ~35% height to black by ~70%. the user's message sits top-right in a bubble 811x234, fully rounded, filled with a translucent frosted teal (reads as #113b39 on the glow), white Google Sans Flex 700 text. gemini's thinking indicator is three small white dots (12px) at the left, about 90px below the bubble, rippling in a wave. the box is back to a single-line pill showing "Ask Gemini", with the send button replaced by a dark circle (#131313) holding a white rounded-square stop icon.

COMPOSITION SETTINGS
- NeonVertical safe area: keep key content inside x 72–1008 and y 260–1600.
- NeonSquare margins: 72px all round.
- bloom: only on the neon glow and the spark's twinkle. ui and type are always crisp.
- grain: 1.5% monochrome, animated per frame (seeded), across the whole film.
- easing: easeInOutCubic / easeOutQuart for moves; heavily damped springs only where noted. google motion is smooth and soft, never bouncy.
- motion blur (remotion CameraMotionBlur or sample-based) only during scene 6's transition.

SCENES (seconds · frames at 60fps). positions below are for NeonVertical; NeonSquare adaptations follow at the end.

1 | THE SPARK · 0.0–1.4s · f0–f84
- f0–f12: pure black.
- f12–f54: the full-colour spark (220px) fades in at the centre (540, 900), scaling 0.85 → 1.0 (easeOutQuart) with a slow 0° → 45° rotation, exactly how the spark animates inside the gemini app. it is never recoloured or distorted; it only scales, rotates and fades.
- f40–f70: a soft white twinkle (a thin four-point glint) blooms and fades at its centre.
- f54–f84: the app's navy glow rises from the bottom of the frame (the 01-home-empty gradient) over 30 frames.

2 | SPARK → ASK GEMINI BOX · 1.4–2.4s · f84–f144
- f84–f104: the spark spins a further 90° while shrinking to 0. as it shrinks, a 2px line of light grows horizontally out of its centre to 838px.
- f100–f126: the line opens vertically into the "Ask Gemini" pill (spec 01), centred at y 900.
- f118–f144: the contents fade in, staggered 3 frames each: +, placeholder, mic, blue voice button.
- f126–f144: the pill glides down to its home position, bottom edge at y 1560 (easeInOutCubic). nothing jumps between frames.

3 | CURSOR · 2.4–2.8s · f144–f168
- a thin white cursor blinks twice at the start of the placeholder.

4 | TYPING · 2.8–5.4s · f168–f324
- the placeholder fades out on the first keystroke (3 frames).
- typed line: "Hi neon, what can you do that opus 5.5 can't?"
- humanised typing at 35–65ms per character (seeded), slightly longer pauses after the comma and after "that".
- when the next word would collide with the mic, the box grows smoothly (10 frames, easeOutCubic) into the two-line layout from spec 02, with the bottom edge fixed at y 1560 and growing upward. the text reflows to the top-left and the buttons settle into the bottom row. text never clips or scrolls sideways.
- on the first keystroke the voice button cross-fades (8 frames) into the brighter send button with the up-arrow.

5 | SEND → GEMINI THINKS · 5.4–6.6s · f324–f396
- f324–f330: the send button presses (scale 0.94) and releases.
- f330–f354: the message lifts into the frosted bubble and rises to the top-right (top edge at y 300, right edge at x 1008). at the same moment the box snaps back to the single-line "Ask Gemini" pill with the stop button (spec 03).
- f334–f374: the aurora from spec 03 blooms down from the top of the frame, and the navy bottom glow fades out.
- f356–f396: the three thinking dots appear below the bubble on the left and ripple in a wave twice (each dot rises 6px in turn, 8 frames apart).

6 | INTO THE GEMINI 4 WORLD · 6.6–8.0s · f396–f480
- f396–f420: the aurora brightens and spreads until it fills the frame, then shifts hue from teal to google's key-art blues (the gradient described above, light from the top-right). the bubble, dots and box blur out (gaussian 0 → 30px) and fade.
- f410–f480: tiny white "4" particles drift in at three depths (sharp near, soft far), rising slowly. use Google Sans Flex 500 for the "4" glyph. ~90 particles, seeded.
- f430–f480: the hero object forms at the centre (540, 820), ~640px tall: a clear glass tube (~46px diameter on screen) bent into the shape of a "4", based on the Google Sans Flex "4" with the corners rounded the way real bent glass would be, plus small dark metal electrode caps at both tube ends. it appears through a refraction sweep: a band of light passes across it from the top-right, revealing the glass as it goes. the glass is unlit: it catches the blue light, shows thin bright rims on both edges, and the background seen through it is slightly bent.

7 | IGNITION · 8.0–9.4s · f480–f564
- f480–f516: the neon ignites the way real neon does: both electrode ends glow first, then 4 irregular flickers along the whole tube (on 2–4 frames, off 1–3 frames, uneven brightness), then a final surge to full brightness with a small overshoot. this must sync with sound/neon-ignition-flicker.wav (flickers at 0.00, 0.09, 0.17, 0.31 and 0.40s, full on at 0.55s, measured from f480).
- the neon itself: a hot near-white-orange core (#ffd2b0) along the tube's centre line, a red-orange body (#ff4a1c to #ff5a2a) and a wide soft pink-red halo (#ff2d55 at low opacity, large bloom radius). at full brightness there is a faint shimmer (±2% at 2Hz, seeded).
- light spill: the warm glow tints the nearby "4" particles and the background within ~300px of the tube. the blue world stays blue everywhere else, and that contrast is the whole point.
- f520–f564: the six icons (icons/0X-*.svg) light up one after another as small neon glyphs: thin glass tubes following each icon's outline, ~110px, in the same red-orange neon, arranged in a gentle arc below and around the "4" (f520 + 7 frames each), each with its own tiny 2-flicker ignition. they are the answer to the question.

8 | THE KEY ART · 9.4–12.0s · f564–f720
- f564–f600: the six small neon icons fade out (glow first, then glass) as the camera settles. the big neon "4" eases up to its final place.
- final NeonVertical layout:
  · neon "4": centred at (540, 760), ~620px tall.
  · lockup centred horizontally with its baseline at y 1330: full-colour spark (62px) + 20px gap + "Gemini 4 Neon" in Google Sans Flex 500, 70px, white. the lockup reveals with a soft left-to-right mask wipe (24 frames) plus a 6px upward settle, starting at f590.
- f600–f720: hold. particles keep drifting, the neon keeps its faint shimmer, and the spark in the lockup does one slow twinkle at f660. no tagline, no extra text, nothing else enters.

NEONSQUARE (1080x1080) ADAPTATIONS
- scene 1: spark at (540, 540), 200px. scene 2: the line and pill open at y 540, then the pill glides down so its bottom edge sits at y 1000; the two-line box grows upward from there.
- scene 5: bubble top edge at y 120, right edge at x 1008. dots below it on the left.
- scenes 6–7: the "4" forms at (720, 540), ~600px tall. neon icons arc around its left and lower side.
- scene 8 final layout, matching google's 16:9 key art: lockup on the LEFT, left edge at x 72, vertically centred at y 540 (spark 54px, text 60px); the neon "4" on the RIGHT, centred at (760, 540), ~580px tall. the "4" must never touch the text.

SOUND (no audio in the render; write SOUND.md with exact timestamps, using the files in public/gemini-neon-assets/sound/)
0.0s airy-pad-12s (whole film, under everything) · 0.3s sparkle-shimmer as the spark appears · 1.4s soft-whoosh as the line opens · each keystroke one of soft-key-clicks-x4 (rotate the 4 variants) · 5.4s send-pop · 5.6s soft-whoosh (bubble rises) · 6.6s sparkle-shimmer + soft-whoosh into the blue world · 7.2s glass-tink as the refraction sweep crosses the glass · 8.0s electric-spark-zap then neon-ignition-flicker (lined up with the flickers) · 8.6s neon-hum-loop-4s starts, looped to the end at low level · 8.67–9.25s glass-tink at low volume for each small icon igniting · 9.8s deep-sub-hit as the lockup lands · 12.0s end.

DO NOT
- recolour, distort, outline or redraw the gemini spark
- use any colour outside: black, the app greys and blues listed, the aurora colours, google's key-art blue range, white, and the neon red-orange / pink range
- make the neon look like a flat glow filter: it must read as glowing gas inside a glass tube, with a visible glass wall, a hot core and a soft halo
- add a dark, cyberpunk or neon-city look. this is google: airy and luminous
- put any text on screen other than the typed line, "Ask Gemini" and the final lockup
- let the typed text clip, scroll or overlap the buttons
- let anything jump position between frames

BEFORE YOU FINISH
1. render stills of both compositions at frames 0, 50, 110, 140, 260, 330, 380, 420, 470, 500, 540, 600 and 719.
2. check each one against this spec: the spark is untouched, the ui matches the screenshots, the gradients match the references, the glass reads as glass, the neon reads as real neon, the safe area is respected and nothing has jumped.
3. put the frame-719 still of NeonSquare next to reference/gemini-4-carbon-keyart-16x9.png and adjust until it reads as part of the same series.
4. fix everything that fails, re-render, then give me both mp4 paths, SOUND.md and a short list of anything you couldn't fully meet and why.
