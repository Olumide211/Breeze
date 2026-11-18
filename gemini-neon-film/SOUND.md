# Gemini 4 Neon: sound map

The renders have no audio. This is the edit list for laying the score in an NLE or DAW.
Every file is in `public/gemini-neon-assets/sound/` (48 kHz WAV). The film is 12.000s, 720 frames at 60fps.
Times are from the first frame (f0 = 0.000s).

## Cue list

| time (s) | frame | file | what it hits | level / notes |
|---|---|---|---|---|
| 0.000 | 0 | `airy-pad-12s.wav` | whole film, under everything | bed, about −18 dBFS. Runs 0–12.0s exactly; fade out the last 0.5s |
| 0.300 | 18 | `sparkle-shimmer.wav` | the spark fades in (f12–54), twinkle peaks at f55 | about −14 dB |
| 1.400 | 84 | `soft-whoosh.wav` | the spark spins away and the line of light opens (f84–126) | about −12 dB |
| 2.800–5.300 | 168–318 | `soft-key-clicks-x4.wav` | one click per keystroke (45 keys, table below), rotating variants A→B→C→D | about −16 dB, ±1 dB random is fine |
| 5.400 | 324 | `send-pop.wav` | the send button presses (f324–330) | about −10 dB |
| 5.600 | 336 | `soft-whoosh.wav` | the message lifts into the bubble and rises (f330–354) | about −14 dB |
| 6.600 | 396 | `sparkle-shimmer.wav` | the aurora floods the frame and turns to Gemini 4 blue | about −14 dB |
| 6.600 | 396 | `soft-whoosh.wav` | same moment (UI blurs out with motion blur f398–422) | about −12 dB |
| 7.200 | 432 | `glass-tink.wav` | the refraction sweep starts across the glass "4" (f430–478) | about −12 dB |
| 8.000 | 480 | `electric-spark-zap.wav` | the electrodes catch | about −10 dB |
| 8.000 | 480 | `neon-ignition-flicker.wav` | its built-in flickers at +0.09, 0.17, 0.31, 0.40s and full on at +0.55s land on picture flickers f485, f490, f499, f504 and the surge at f513 | about −8 dB. Start exactly at 8.000s |
| 8.600 | 516 | `neon-hum-loop-4s.wav` | the tube at full brightness | about −24 dB. Set it to loop and run it to 12.0s. 8.6→12.0 is 3.4s, so one pass of the 4.0s file covers it: trim the last 0.6s. Use a 50 ms fade-in |
| 8.667 | 520 | `glass-tink.wav` | icon 1 (deep research) ignites | low, about −24 dB |
| 8.783 | 527 | `glass-tink.wav` | icon 2 (canvas) | about −24 dB |
| 8.900 | 534 | `glass-tink.wav` | icon 3 (video) | about −24 dB |
| 9.017 | 541 | `glass-tink.wav` | icon 4 (image) | about −24 dB |
| 9.133 | 548 | `glass-tink.wav` | icon 5 (live / voice) | about −24 dB |
| 9.250 | 555 | `glass-tink.wav` | icon 6 (code) | about −24 dB |
| 9.800 | 588 | `deep-sub-hit.wav` | the lockup lands (the wipe runs f590–614) | about −10 dB |
| 12.000 | 720 | (end) | everything out; the pad has faded | |

The film's twinkle on the lockup spark is at 11.0s (f660–700). It has no cue in the spec; a very quiet `sparkle-shimmer.wav` at about −26 dB at 11.0s works if you want one.

## Keystroke clicks

`soft-key-clicks-x4.wav` holds four variants, 0.25s apart: A = 0.00s, B = 0.25s, C = 0.50s, D = 0.75s. Slice the file at those points and rotate A, B, C, D in order.
Keystroke times come from the film's seeded typing schedule (`KEY_FRAMES` in `src/timing.ts`), so they match the picture exactly. The box grows to two lines on keystroke 15 (`c` of "can", f224).

| # | key | frame | time (s) | click variant |
|---|---|---|---|---|
| 1 | `H` | 168 | 2.800 | A (0.00–0.25s of the file) |
| 2 | `i` | 171 | 2.850 | B (0.25–0.50s of the file) |
| 3 | `␣` | 175 | 2.917 | C (0.50–0.75s of the file) |
| 4 | `n` | 179 | 2.983 | D (0.75–1.00s of the file) |
| 5 | `e` | 182 | 3.033 | A (0.00–0.25s of the file) |
| 6 | `o` | 185 | 3.083 | B (0.25–0.50s of the file) |
| 7 | `n` | 189 | 3.150 | C (0.50–0.75s of the file) |
| 8 | `,` | 192 | 3.200 | D (0.75–1.00s of the file) |
| 9 | `␣` | 204 | 3.400 | A (0.00–0.25s of the file) |
| 10 | `w` | 208 | 3.467 | B (0.25–0.50s of the file) |
| 11 | `h` | 210 | 3.500 | C (0.50–0.75s of the file) |
| 12 | `a` | 214 | 3.567 | D (0.75–1.00s of the file) |
| 13 | `t` | 217 | 3.617 | A (0.00–0.25s of the file) |
| 14 | `␣` | 221 | 3.683 | B (0.25–0.50s of the file) |
| 15 | `c` | 224 | 3.733 | C (0.50–0.75s of the file) |
| 16 | `a` | 226 | 3.767 | D (0.75–1.00s of the file) |
| 17 | `n` | 230 | 3.833 | A (0.00–0.25s of the file) |
| 18 | `␣` | 233 | 3.883 | B (0.25–0.50s of the file) |
| 19 | `y` | 236 | 3.933 | C (0.50–0.75s of the file) |
| 20 | `o` | 238 | 3.967 | D (0.75–1.00s of the file) |
| 21 | `u` | 241 | 4.017 | A (0.00–0.25s of the file) |
| 22 | `␣` | 245 | 4.083 | B (0.25–0.50s of the file) |
| 23 | `d` | 247 | 4.117 | C (0.50–0.75s of the file) |
| 24 | `o` | 249 | 4.150 | D (0.75–1.00s of the file) |
| 25 | `␣` | 253 | 4.217 | A (0.00–0.25s of the file) |
| 26 | `t` | 255 | 4.250 | B (0.25–0.50s of the file) |
| 27 | `h` | 257 | 4.283 | C (0.50–0.75s of the file) |
| 28 | `a` | 260 | 4.333 | D (0.75–1.00s of the file) |
| 29 | `t` | 264 | 4.400 | A (0.00–0.25s of the file) |
| 30 | `␣` | 274 | 4.567 | B (0.25–0.50s of the file) |
| 31 | `o` | 277 | 4.617 | C (0.50–0.75s of the file) |
| 32 | `p` | 280 | 4.667 | D (0.75–1.00s of the file) |
| 33 | `u` | 282 | 4.700 | A (0.00–0.25s of the file) |
| 34 | `s` | 284 | 4.733 | B (0.25–0.50s of the file) |
| 35 | `␣` | 287 | 4.783 | C (0.50–0.75s of the file) |
| 36 | `5` | 290 | 4.833 | D (0.75–1.00s of the file) |
| 37 | `.` | 292 | 4.867 | A (0.00–0.25s of the file) |
| 38 | `5` | 296 | 4.933 | B (0.25–0.50s of the file) |
| 39 | `␣` | 299 | 4.983 | C (0.50–0.75s of the file) |
| 40 | `c` | 302 | 5.033 | D (0.75–1.00s of the file) |
| 41 | `a` | 305 | 5.083 | A (0.00–0.25s of the file) |
| 42 | `n` | 308 | 5.133 | B (0.25–0.50s of the file) |
| 43 | `'` | 312 | 5.200 | C (0.50–0.75s of the file) |
| 44 | `t` | 315 | 5.250 | D (0.75–1.00s of the file) |
| 45 | `?` | 318 | 5.300 | A (0.00–0.25s of the file) |
