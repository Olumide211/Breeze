# Breeze

Breeze Studio is a music production app that runs entirely in the browser: a step sequencer, a piano roll,
a playlist for arranging a song, and a mixer. Every sound is synthesised with the Web Audio API, so there
are no samples to download and nothing is uploaded.

It was inspired by the idea of desktop pattern-based DAWs, and written from scratch for the web.

## Run it

```
npm install
npm start
```

`npm run build` makes a static production build in `build/`.

## What it does

- **Channel rack**: ten synthesised drum sounds on a step grid (click or drag to paint, shift-click for an
  accent), with volume, pan, mute and solo per channel. Patterns are 1 to 8 bars long.
- **Synths**: a two-oscillator synth with a resonant filter, filter envelope and ADSR, plus six presets.
- **Piano roll**: click to add a note, drag to move it, drag its right edge to resize, right-click to erase.
  Snap from 1/4 to 1/64.
- **Playlist**: place patterns as clips on tracks and play the arrangement in Song mode. Click the ruler
  to choose where playback starts.
- **Mixer**: fader and level meter per channel, low cut, high cut, reverb and delay sends, a tempo-synced
  delay, and a limiter on the master.
- **Undo / redo** for everything; one drag is one undo step.
- **Export WAV**: renders the song (or the current pattern) faster than real time.
- **Save and share**: the project autosaves in the browser, saves to and opens from a `.breeze.json`
  file, and "Copy share link" packs the whole song into the URL itself.
- **Play it live**: the two lower letter rows of the keyboard play the selected channel like a piano.

Keys: Space plays and stops, Ctrl+Z undoes, Ctrl+Shift+Z redoes, Ctrl+S saves a file.

## Layout

| Path | What is in it |
|------|---------------|
| `src/studio/engine/` | sound: drum and synth voices, the mixer graph, the scheduler, WAV rendering |
| `src/studio/project.ts` | the project model's defaults, the demo song, edits, loading and share links |
| `src/studio/store.ts` | project state with undo history |
| `src/studio/ui/` | channel rack, instrument editor, piano roll, playlist, mixer, knobs and faders |
| `src/ImageEditor.tsx` | the earlier Breeze image editor, unchanged, at `#editor` (File > Image editor) |
