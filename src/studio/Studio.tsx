import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Music,
  Play,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import { encodeWav, Engine, renderProject } from "./engine/engine";
import { Voice } from "./engine/voices";
import {
  decodeShare,
  demoProject,
  duplicatePattern,
  editPattern,
  emptyProject,
  encodeShare,
  loadStored,
  newPattern,
  removePattern,
  sanitizeProject,
  store,
} from "./project";
import { useFrame, useProjectStore } from "./store";
import { Mode, Project, STEPS_PER_BAR } from "./types";
import { ChannelEditor } from "./ui/ChannelEditor";
import { ChannelRack } from "./ui/ChannelRack";
import { Knob, pct } from "./ui/controls";
import { Mixer } from "./ui/Mixer";
import { PianoRoll } from "./ui/PianoRoll";
import { Playlist } from "./ui/Playlist";
import "./studio.css";

type View = "pattern" | "song" | "mixer";

/** Two rows of the computer keyboard laid out like piano keys, by physical key position. */
const KEY_NOTES: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24,
};

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const fileName = (p: Project) => (p.name.replace(/[^\w\- ]+/g, "").trim() || "breeze") + "";

/** A number box that only commits a valid value when you leave it or press Enter. */
function NumberBox(props: { value: number; min: number; max: number; label: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    if (draft.trim() !== "" && isFinite(v)) props.onCommit(Math.min(props.max, Math.max(props.min, Math.round(v))));
    setDraft(null);
  };
  return (
    <input
      className="text number"
      type="number"
      aria-label={props.label}
      min={props.min}
      max={props.max}
      value={draft === null ? props.value : draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function MasterMeter({ engine }: { engine: Engine }) {
  const bar = useRef<HTMLDivElement>(null);
  const held = useRef(0);
  useFrame(() => {
    if (!bar.current) return;
    const peak = engine.level();
    const now = peak > 0.0005 ? Math.max(0, Math.min(1, (20 * Math.log10(peak) + 54) / 54)) : 0;
    held.current = Math.max(now, held.current - 0.02);
    bar.current.style.width = held.current * 100 + "%";
    bar.current.classList.toggle("hot", peak >= 1);
  });
  return (
    <div className="master-meter" title="Master level" aria-hidden="true">
      <div ref={bar} />
    </div>
  );
}

export default function Studio() {
  const { project, update, undo, redo, replace, canUndo, canRedo } = useProjectStore(() => loadStored() || demoProject());
  const engineRef = useRef<Engine | null>(null);
  if (!engineRef.current) engineRef.current = new Engine(project);
  const engine = engineRef.current;

  const [playing, setPlaying] = useState(false);
  const [mode, setModeState] = useState<Mode>("pattern");
  const [view, setView] = useState<View>("pattern");
  const [patternId, setPatternId] = useState(project.patterns[0].id);
  const [channelId, setChannelId] = useState(project.channels[0].id);
  const [songStart, setSongStart] = useState(0);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // undo, delete and load can remove whatever was selected: fall back to the first one
  const pattern = project.patterns.find((x) => x.id === patternId) || project.patterns[0];
  const channel = project.channels.find((c) => c.id === channelId) || project.channels[0];

  const say = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((cur) => (cur === text ? "" : cur)), 3500);
  }, []);

  useEffect(() => {
    engine.onChange = () => setPlaying(engine.playing);
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    engine.setProject(project);
    const id = window.setTimeout(() => store(project), 400);
    return () => window.clearTimeout(id);
  }, [engine, project]);

  useEffect(() => {
    engine.patternId = pattern.id;
  }, [engine, pattern.id]);

  // a project arriving in the URL fragment (a share link) replaces the stored one
  useEffect(() => {
    const match = /^#p=(.+)$/.exec(window.location.hash);
    if (!match) return;
    decodeShare(match[1])
      .then((p) => {
        replace(p);
        say(`Opened shared project "${p.name}"`);
      })
      .catch(() => say("That share link could not be read"));
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [replace, say]);

  const setMode = (next: Mode) => {
    engine.mode = next;
    setModeState(next);
    engine.restart();
  };

  const seek = (step: number) => {
    engine.songStart = step;
    setSongStart(step);
    if (engine.mode === "song") engine.restart();
  };

  const openProject = (p: Project, message: string) => {
    engine.stop();
    seek(0);
    replace(p);
    say(message);
  };

  const saveFile = () => {
    download(new Blob([JSON.stringify(project, null, 1)], { type: "application/json" }), fileName(project) + ".breeze.json");
  };

  const openFile = (file: File) => {
    file
      .text()
      .then((text) => openProject(sanitizeProject(JSON.parse(text)), `Opened ${file.name}`))
      .catch(() => say("That file is not a Breeze project"));
  };

  const exportWav = () => {
    say("Rendering...");
    renderProject(project, mode, pattern.id)
      .then((buffer) => {
        download(encodeWav(buffer), fileName(project) + (mode === "song" ? "" : " - " + pattern.name) + ".wav");
        say(`Exported ${mode === "song" ? "the song" : "the pattern"} as WAV (${buffer.duration.toFixed(1)} s)`);
      })
      .catch(() => say("Export failed in this browser"));
  };

  const share = () => {
    encodeShare(project).then((code) => {
      const url = window.location.origin + window.location.pathname + "#p=" + code;
      const done = () => say("Share link copied: the whole song is inside the link");
      const fallback = () => {
        window.prompt("Copy this link", url);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, fallback);
      else fallback();
    });
  };

  // keyboard: transport, undo, and playing the selected channel from the typing keys
  const held = useRef<Record<string, Voice | null>>({});
  const latest = useRef({ channelId: channel.id, undo, redo, saveFile });
  latest.current = { channelId: channel.id, undo, redo, saveFile };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) latest.current.redo();
        else latest.current.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        latest.current.redo();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        latest.current.saveFile();
        return;
      }
      if (mod || e.altKey || isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        const active = document.activeElement as HTMLElement | null;
        if (active && active.tagName === "BUTTON") active.blur();
        engine.toggle();
        return;
      }
      const offset = KEY_NOTES[e.code];
      if (offset !== undefined && !e.repeat && !(e.code in held.current)) {
        held.current[e.code] = engine.noteOn(latest.current.channelId, 48 + offset);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (!(e.code in held.current)) return;
      const voice = held.current[e.code];
      delete held.current[e.code];
      if (voice && engine.ctx) voice.release(engine.ctx.currentTime);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [engine]);

  const addPattern = () => {
    const pat = newPattern("Pattern " + (project.patterns.length + 1), project.patterns.length);
    update((p) => ({ ...p, patterns: p.patterns.concat([pat]) }));
    setPatternId(pat.id);
  };

  return (
    <div className="studio" onPointerDown={(e) => {
      if (menu && !(e.target as HTMLElement).closest(".menu-wrap")) setMenu(false);
    }}>
      <header className="top">
        <div className="brand">
          <Music size={18} /> Breeze
        </div>

        <div className="group">
          <button className={"btn play" + (playing ? " on" : "")} onClick={() => engine.toggle()} title="Play / stop (Space)">
            {playing ? <Square size={15} /> : <Play size={15} />}
            {playing ? "Stop" : "Play"}
          </button>
          <div className="seg" role="group" aria-label="What Play plays">
            <button className={mode === "pattern" ? "on" : ""} onClick={() => setMode("pattern")} title="Loop the current pattern">
              Pattern
            </button>
            <button className={mode === "song" ? "on" : ""} onClick={() => setMode("song")} title="Play the arrangement">
              Song
            </button>
          </div>
        </div>

        <div className="group">
          <label className="field inline">
            BPM
            <NumberBox label="Tempo in BPM" value={Math.round(project.bpm)} min={40} max={240} onCommit={(v) => update((p) => ({ ...p, bpm: v }))} />
          </label>
          <Knob label="Swing" value={project.swing} min={0} max={0.6} reset={0} format={pct} onChange={(v) => update((p) => ({ ...p, swing: v }))} />
          <MasterMeter engine={engine} />
        </div>

        <nav className="seg tabs" aria-label="View">
          <button className={view === "pattern" ? "on" : ""} onClick={() => setView("pattern")}>
            Pattern
          </button>
          <button className={view === "song" ? "on" : ""} onClick={() => setView("song")}>
            Playlist
          </button>
          <button className={view === "mixer" ? "on" : ""} onClick={() => setView("mixer")}>
            Mixer
          </button>
        </nav>

        <div className="group end">
          <input
            className="text title"
            aria-label="Project name"
            value={project.name}
            maxLength={60}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
          <button className="btn icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
            <Undo2 size={15} />
          </button>
          <button className="btn icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
            <Redo2 size={15} />
          </button>
          <button className="btn" onClick={exportWav} title="Render to a WAV file">
            <Download size={14} /> WAV
          </button>
          <div className="menu-wrap">
            <button className="btn" onClick={() => setMenu(!menu)} aria-expanded={menu}>
              File
            </button>
            {menu && (
              <div className="menu right" onClick={() => setMenu(false)}>
                <button onClick={() => openProject(emptyProject(), "New project")}>
                  <FilePlus size={14} /> New project
                </button>
                <button onClick={() => openProject(demoProject(), "Loaded the demo song")}>
                  <Sparkles size={14} /> Demo song
                </button>
                <button onClick={() => fileInput.current && fileInput.current.click()}>
                  <FolderOpen size={14} /> Open file...
                </button>
                <button onClick={saveFile}>
                  <Save size={14} /> Save file (Ctrl+S)
                </button>
                <button onClick={share}>
                  <LinkIcon size={14} /> Copy share link
                </button>
                <button onClick={() => (window.location.hash = "#editor")}>
                  <ImageIcon size={14} /> Image editor
                </button>
              </div>
            )}
          </div>
          <button className="btn icon" aria-label="Help" aria-expanded={help} onClick={() => setHelp(!help)}>
            <HelpCircle size={15} />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            if (file) openFile(file);
            e.target.value = "";
          }}
        />
      </header>

      {help && (
        <section className="help">
          <div>
            <h3>Make a beat</h3>
            <p>
              <b>Pattern</b>: click steps for drums, pick a synth channel and draw notes in the piano roll. <b>Playlist</b>:
              place patterns on tracks, then switch Play to <b>Song</b>. <b>Mixer</b>: levels, filters, reverb and delay.
            </p>
          </div>
          <div>
            <h3>Keys</h3>
            <p>
              <kbd>Space</kbd> play / stop. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redo.{" "}
              <kbd>Ctrl</kbd>+<kbd>S</kbd> save a file. The bottom two letter rows (<kbd>Z</kbd> <kbd>S</kbd> <kbd>X</kbd> ... and{" "}
              <kbd>Q</kbd> <kbd>2</kbd> <kbd>W</kbd> ...) play the selected channel like a piano.
            </p>
          </div>
          <div>
            <h3>Good to know</h3>
            <p>
              Every sound is synthesised in your browser. Your project is saved in this browser automatically; use File to keep
              a copy or to copy a link that contains the whole song. Drag knobs up and down; double-click resets them.
            </p>
          </div>
        </section>
      )}

      <main className="main">
        {view === "pattern" && (
          <>
            <div className="pattern-bar">
              <label className="field inline">
                Pattern
                <select value={pattern.id} onChange={(e) => setPatternId(e.target.value)}>
                  {project.patterns.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className="text"
                aria-label="Pattern name"
                value={pattern.name}
                maxLength={40}
                onChange={(e) => update((p) => editPattern(p, pattern.id, (x) => ({ ...x, name: e.target.value })))}
              />
              <label className="field inline">
                Length
                <select
                  value={pattern.length}
                  onChange={(e) => update((p) => editPattern(p, pattern.id, (x) => ({ ...x, length: Number(e.target.value) })))}
                >
                  {[16, 32, 48, 64, 128].map((n) => (
                    <option key={n} value={n}>
                      {n / STEPS_PER_BAR} bar{n === 16 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" onClick={addPattern}>
                <Plus size={14} /> New
              </button>
              <button
                className="btn"
                onClick={() => {
                  const r = duplicatePattern(project, pattern.id);
                  update(() => r.project);
                  setPatternId(r.id);
                }}
              >
                <Copy size={14} /> Duplicate
              </button>
              <button className="btn danger" disabled={project.patterns.length <= 1} onClick={() => update((p) => removePattern(p, pattern.id))}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
            <ChannelRack project={project} pattern={pattern} channelId={channel.id} engine={engine} update={update} onSelect={setChannelId} />
            <div className="lower">
              <ChannelEditor project={project} channel={channel} update={update} />
              {channel.kind === "synth" ? (
                <PianoRoll pattern={pattern} channel={channel} engine={engine} update={update} />
              ) : (
                <div className="empty">
                  <p>
                    <b>{channel.name}</b> is a drum channel: program it on the steps above.
                  </p>
                  <p>Select a synth channel to open the piano roll, or switch this channel to Synth.</p>
                </div>
              )}
            </div>
          </>
        )}
        {view === "song" && (
          <Playlist
            project={project}
            patternId={pattern.id}
            engine={engine}
            update={update}
            onPattern={setPatternId}
            onSeek={seek}
            songStart={songStart}
          />
        )}
        {view === "mixer" && <Mixer project={project} channelId={channel.id} engine={engine} update={update} onSelect={setChannelId} />}
      </main>

      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>
    </div>
  );
}
