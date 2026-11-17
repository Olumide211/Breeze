# How OpenAI writes model names

Research date: 17 November 2026 (Africa/Lagos). Only official sources are treated as fact. Nothing below is invented.

## Short answer for the title card

- The shipped flagship name is **GPT-6 Astra** (space between `6` and `Astra`, hyphen between `GPT` and `6`, capital A on Astra).
- **GPT-6.1 Astra** was not found on official OpenAI pages fetched for this pack, in the official API model guide, or in posts from the verified @OpenAI account (search `from:OpenAI "GPT-6.1 Astra"` returned 0 results on 17 Nov 2026).
- Official 6.1 point-release names that do exist are **GPT-6.1 Sol** and **GPT-6.1 Terra**, not Astra. Astra remains the GPT-6 flagship code name.
- If the video is meant to look like an official launch, set the title as **GPT-6 Astra**. If it is deliberately a concept / unreleased-model piece using the unofficial "GPT-6.1 Astra" string, that is a creative choice — do not present it as an official product name.

## Official display-name pattern

From OpenAI’s own site and API docs, the pattern is:

`GPT-<generation> <Codename>`

Examples actually used by OpenAI:

| Display name | Role | Source |
|---|---|---|
| GPT-6 Astra | Flagship / most capable | [Announcement](https://openai.com/index/gpt-6-astra/), [API docs](https://developers.openai.com/api/docs/models/gpt-6-astra) |
| GPT-6 Sol | Same generation, lower cost (later upgraded) | [GPT-6.1 Sol post](https://openai.com/index/introducing-gpt-6-1-sol/) |
| GPT-6 Luna | Fast, high-volume | Same page, plus [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model) |
| GPT-6.1 Sol | Point release of Sol, “near-Astra… at one-fifth the price” | [Introducing GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/) |
| GPT-6.1 Terra | Point release of Terra; visual / writing / cost-intelligence | [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model), [X post](https://x.com/OpenAI/status/2114780715086754261) |
| GPT-6 Pro | Chat product powered *by* GPT-6 Astra (not a separate model display name for the title card) | [X post, 4 Sep 2026](https://x.com/OpenAI/status/2095998532692140283) |
| GPT-6 Astra Ultrafast | Speed tier, not a different model name | [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model) |

Previous-generation examples used for comparison on those same pages: **GPT-5.6 Sol**, **GPT-5.6 Terra**. A YouTube title on the official channel also uses **GPT-6 Cyber** (`How Mozilla uses GPT-6 Cyber…`).

Rules that hold across the official examples:

1. **GPT** is always all caps.
2. A hyphen sits between GPT and the version number: `GPT-6`, `GPT-6.1`, `GPT-5.6`. Not `GPT6`, and not `GPT 6` (no hyphen) in official product names.
3. Point releases use a **period**, no spaces: `6.1`, `5.6`. Never `GPT-6 .1` or `GPT 6.1 Astra` as the official form.
4. A **single space** then a capitalised code name: `Astra`, `Sol`, `Luna`, `Terra`. There is no hyphen between the number and the code name (`GPT-6-Astra` is the API style, not the display style).
5. API / model IDs are lowercase with hyphens: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-luna`.

## Hyphen character (weight and typography)

- The official announcement page title, and the official launch post, present the name as **GPT-6 Astra**.
- Official @OpenAI posts mostly use a plain ASCII hyphen-minus (`GPT-6 Astra`). At least one post in the same launch thread also used a typographic hyphen (`GPT‑6 Astra`) in running copy: [3 Sep 2026 post](https://x.com/OpenAI/status/2095595752815030713).
- Body copy on openai.com similarly appears as **GPT‑6 Astra** (a typographic / non-breaking hyphen in the fetched page text). A 403 from this environment blocked a raw-HTML code-point dump of openai.com, so treat “title = GPT-6, body often typographic hyphen” as the observed convention rather than a measured glyph ID.
- For a video title, matching the launch line **“This is GPT-6 Astra.”** (ASCII hyphen, space, capital Astra) is the safest official look. Use the official wordmark SVG for the “OpenAI” letters; set “GPT-6 Astra” in Geist or Inter (see `/fonts/NOTES.md`), because OpenAI Sans is not publicly licensed.

## Launch typography to copy

Official announcement (title as published):

> GPT-6 Astra: A new generation of intelligence  
> https://openai.com/index/gpt-6-astra/

Official launch post from @OpenAI, 3 September 2026, 20:32 Africa/Lagos (19:32 UTC):

> This is GPT-6 Astra.  
> Anything you can do on a computer, Astra can do for you. Fast.  
> https://x.com/OpenAI/status/2095595741528125780

The announcement hero image is saved in this folder as `hero-gpt-6-astra-16x9.png`. The GPT-6.1 Sol hero (`hero-gpt-6-1-sol-16x9.png`) is useful as a comparison: official 6.1 naming uses a different code name (Sol), and the filename itself is `GPT-6-1-Sol_16x9.png`.

Related official pages:

- https://openai.com/index/introducing-gpt-6-1-sol/
- https://openai.com/index/gpt-6-astra-next-generation-work/
- https://openai.com/index/safety-overview-gpt-6-astra/
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/guides/latest-model

## What was not found

No official OpenAI blog post, API model page, or @OpenAI post was found that names a product **GPT-6.1 Astra**. Unofficial social posts do use that string; those are not sources for typography or product status.

## Official hero / stills saved here

| File | What it is | Source |
|---|---|---|
| `hero-gpt-6-astra-16x9.png` | 1920×1080 announcement hero | https://openai.com/index/gpt-6-astra/ (Contentful CDN) |
| `hero-gpt-6-1-sol-16x9.png` | 1920×1080 GPT-6.1 Sol hero (naming comparison) | https://openai.com/index/introducing-gpt-6-1-sol/ |
| `x-launch-this-is-gpt-6-astra-video-thumb.jpg` | Official launch-film frame (1200×675) | Amplify video thumb on [the launch post](https://x.com/OpenAI/status/2095595741528125780) |
| `x-launch-benchmarks-still.png` | Launch-thread still (1200×675) | [X post](https://x.com/OpenAI/status/2095595752815030713) |
| `x-launch-availability-still.jpg` | Launch-thread still (1200×675) | [X post](https://x.com/OpenAI/status/2095595757072191802) |
| `yt-introducing-gpt-6-astra-for-developers.jpg` | Official YouTube thumbnail, 1280×720 | [Introducing GPT-6 Astra for developers](https://www.youtube.com/watch?v=bOC3DisEOfg) on youtube.com/@OpenAI |
| `yt-introducing-sora-2.jpg` | Official YouTube thumbnail, 1280×720 | [Introducing Sora 2](https://www.youtube.com/watch?v=gzneGhpXwjU) on youtube.com/@OpenAI |
| `yt-introducing-gpt-5.jpg` | Older official launch thumb (extra) | [Introducing GPT-5](https://www.youtube.com/watch?v=0Uu_VJeVVfo) on youtube.com/@OpenAI |

These stills are official artwork / thumbnails, used here as colour-grade and layout reference. They remain OpenAI’s copyrighted material.
