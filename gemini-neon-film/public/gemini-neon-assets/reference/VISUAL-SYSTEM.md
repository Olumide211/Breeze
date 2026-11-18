# Gemini 4 visual system: notes from the official key art

Source: the three official Gemini 4 launch images in this folder, taken from Google's announcement posts on blog.google:
- Argon: announced 30 Sep 2026
- Carbon: announced 28 Oct 2026
- Hydrogen: announced 12 Nov 2026

## The pattern (all three follow it)

1. **Background:** a soft blue gradient with fine grain. It runs dark navy at the bottom-left/bottom to bright, almost white-blue at the top-right, like light from the top-right corner. No black, no other hues.
   Colours sampled from the images:
   - bottom-left: #08183b (Argon), #0a3c95 (Hydrogen), #0e5c98 (Carbon)
   - mid-left: #1b499f to #2b64b4
   - centre: #1d489c to #529cee
   - top-left: #2653ba to #3c72db
   - top-right glow: #91d2f5 to #d3f5fc
2. **Lockup on the left:** the full-colour Gemini spark plus "Gemini 4 <Element>" in white Google Sans.
   - text vertically centred (~50% of the height)
   - spark starts ~10% in from the left edge
   - text cap height ≈ 7% of the image height
   - lockup width ≈ 35–40% of the image width
   - spark height ≈ the text cap height plus a little
   - one line, single spaces, normal tracking, no effects on the type
3. **Element object on the right:** one large 3D object that embodies the element, rendered as frosted or translucent glass with iridescent refraction (cyan, violet and a touch of pink in the glass). It's soft-focus at the edges with real depth of field.
   - Argon: a huge "4" in frosted glass, partly blurred
   - Carbon: a rough faceted crystal (diamond), iridescent inside
   - Hydrogen: a translucent liquid/gas bubble with swirling internal light
4. **Particles:** tiny white "4" glyphs float like dust or bubbles around the object (Carbon, Hydrogen), with depth of field (some sharp, most soft).
5. **Mood:** calm, airy, luminous, premium. No harsh glows, no hard shadows, no dark-mode UI.

## What this means for Neon

Neon should be the 4th object in the same family. Suggested object: **a hand-bent glass neon tube in the shape of a "4"** (a nod to Argon's 4), frosted at the edges like the others.
- it starts unlit (clear glass, catching the blue light), then **ignites**
- the colour of real neon gas discharge is a warm **red-orange**. In a tube the core is a hot near-white orange (#ffd2b0), the body is red-orange (#ff4a1c to #ff5a2a) and the outer halo is pink-red (#ff2d55 at low opacity)
- the warm glow against Google's blue gradient is the visual hook: it's the first Gemini 4 key art with warm light in it

## Neon realism checklist (for the renderer)

- the tube is round glass about 12–15mm on the scale of a real sign, with a visible glass wall: a thin bright rim on both edges and a slightly darker inner band
- the glow is strongest at the tube's centre line and falls off smoothly. The halo is wide and soft (a large bloom radius), not a hard outline
- ignition: 3–5 irregular flickers over ~0.6s (on 2–4 frames, off 1–3 frames, uneven brightness), then a final surge to full brightness with a tiny overshoot. The two ends (electrodes) light a split second before the middle.
- electrodes: short dark metal caps at both tube ends, with a thin wire going "behind"
- a faint 100–120Hz shimmer at full brightness (±2% brightness)
- the light spills onto the surroundings: it tints nearby floating "4" particles and the background warm within ~300px
- the glass stays visible where the gas is dim: refraction and the blue background seen through the tube

## Gemini app UI (needs real screenshots for an exact match)

Take these from your phone, Gemini app, dark mode:
1. the home screen with an empty "Ask Gemini" box
2. the box with text typed
3. the moment after send, while Gemini is thinking (the spark animation)
