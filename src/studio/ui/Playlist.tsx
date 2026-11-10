import React, { useRef, useState } from "react";
import { Copy, Eraser, Pencil, Plus, Trash2 } from "lucide-react";
import { Engine } from "../engine/engine";
import { duplicatePattern, editPattern, newPattern, removePattern, uid } from "../project";
import { useFrame, Update } from "../store";
import { Clip, Pattern, Project, songSteps, STEPS_PER_BAR } from "../types";

const BAR = 56;
const TRACK = 46;

interface Props {
  project: Project;
  patternId: string;
  engine: Engine;
  update: Update;
  onPattern: (id: string) => void;
  onSeek: (step: number) => void;
  songStart: number;
}

interface Drag {
  id: string;
  x: number;
  y: number;
  orig: Clip;
}

/** A thumbnail of everything a pattern plays. */
function Thumb({ pattern, project }: { pattern: Pattern; project: Project }) {
  const marks: React.ReactNode[] = [];
  const rows = project.channels.length;
  project.channels.forEach((ch, r) => {
    const top = `${8 + (r / Math.max(1, rows)) * 84}%`;
    if (ch.kind === "drum") {
      (pattern.steps[ch.id] || []).forEach((v, i) => {
        if (v) marks.push(<i key={ch.id + i} style={{ left: `${(i / pattern.length) * 100}%`, top, width: 2 }} />);
      });
    } else {
      (pattern.notes[ch.id] || []).forEach((n) => {
        marks.push(
          <i
            key={n.id}
            style={{ left: `${(n.start / pattern.length) * 100}%`, top, width: `${(n.length / pattern.length) * 100}%` }}
          />
        );
      });
    }
  });
  return <div className="clip-thumb">{marks}</div>;
}

export function Playlist({ project, patternId, engine, update, onPattern, onSeek, songStart }: Props) {
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const drag = useRef<Drag | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const bars = Math.max(32, songSteps(project) / STEPS_PER_BAR + 8);
  const current = project.patterns.find((x) => x.id === patternId) || project.patterns[0];

  useFrame(() => {
    const el = playhead.current;
    if (!el) return;
    const pos = engine.mode === "song" ? engine.position() : null;
    el.style.display = pos === null ? "none" : "block";
    if (pos !== null) el.style.transform = `translateX(${(pos / STEPS_PER_BAR) * BAR}px)`;
  });

  const point = (e: React.PointerEvent) => {
    const rect = grid.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const removeClip = (id: string) => update((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== id) }));

  const down = (e: React.PointerEvent) => {
    const { x, y } = point(e);
    const el = (e.target as HTMLElement).closest("[data-clip]") as HTMLElement | null;
    const hit = el ? project.clips.find((c) => c.id === el.dataset.clip) : undefined;
    grid.current!.setPointerCapture(e.pointerId);
    if (tool === "erase" || e.button === 2) {
      if (hit) removeClip(hit.id);
      return;
    }
    if (hit) {
      onPattern(hit.patternId);
      drag.current = { id: hit.id, x, y, orig: hit };
      return;
    }
    const track = Math.floor(y / TRACK);
    const start = Math.floor(x / BAR);
    if (track < 0 || track >= project.tracks || start < 0) return;
    const clip: Clip = { id: uid("k"), patternId: current.id, track, start };
    update((p) => ({ ...p, clips: p.clips.concat([clip]) }));
    drag.current = { id: clip.id, x, y, orig: clip };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = point(e);
    const start = Math.max(0, d.orig.start + Math.round((x - d.x) / BAR));
    const track = Math.max(0, Math.min(project.tracks - 1, d.orig.track + Math.round((y - d.y) / TRACK)));
    const cur = project.clips.find((c) => c.id === d.id);
    if (!cur || (cur.start === start && cur.track === track)) return;
    update((p) => ({ ...p, clips: p.clips.map((c) => (c.id === d.id ? { ...c, start, track } : c)) }));
  };

  const up = () => {
    drag.current = null;
  };

  const addPattern = () => {
    const pat = newPattern("Pattern " + (project.patterns.length + 1), project.patterns.length);
    update((p) => ({ ...p, patterns: p.patterns.concat([pat]) }));
    onPattern(pat.id);
  };

  return (
    <div className="playlist">
      <aside className="pl-side">
        <div className="pl-side-title">Patterns</div>
        <div className="pl-patterns">
          {project.patterns.map((pat) => (
            <button
              key={pat.id}
              className={"pl-pattern" + (pat.id === current.id ? " on" : "")}
              style={{ borderLeftColor: pat.color }}
              onClick={() => onPattern(pat.id)}
            >
              {pat.name}
              <small>{pat.length / STEPS_PER_BAR} bar{pat.length === STEPS_PER_BAR ? "" : "s"}</small>
            </button>
          ))}
        </div>
        <input
          className="text"
          aria-label="Pattern name"
          value={current.name}
          maxLength={40}
          onChange={(e) => update((p) => editPattern(p, current.id, (x) => ({ ...x, name: e.target.value })))}
        />
        <div className="pl-side-actions">
          <button className="btn icon" title="New pattern" aria-label="New pattern" onClick={addPattern}>
            <Plus size={14} />
          </button>
          <button
            className="btn icon"
            title="Duplicate pattern"
            aria-label="Duplicate pattern"
            onClick={() => {
              const r = duplicatePattern(project, current.id);
              update(() => r.project);
              onPattern(r.id);
            }}
          >
            <Copy size={14} />
          </button>
          <button
            className="btn icon danger"
            title="Delete pattern and its clips"
            aria-label="Delete pattern"
            disabled={project.patterns.length <= 1}
            onClick={() => update((p) => removePattern(p, current.id))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </aside>

      <div className="pl-main">
        <div className="pr-bar">
          <div className="seg" role="group" aria-label="Tool">
            <button className={tool === "draw" ? "on" : ""} onClick={() => setTool("draw")}>
              <Pencil size={13} /> Place
            </button>
            <button className={tool === "erase" ? "on" : ""} onClick={() => setTool("erase")}>
              <Eraser size={13} /> Erase
            </button>
          </div>
          <span className="hint">
            Click a track to place <b style={{ color: current.color }}>{current.name}</b>, drag clips to move them, right-click
            to remove. Click the ruler to choose where the song starts.
          </span>
        </div>
        <div className="pl-scroll">
          <div className="pl-inner" style={{ width: bars * BAR + 64 }}>
            <div
              className="pl-ruler"
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(Math.max(0, Math.floor((e.clientX - rect.left - 64) / BAR)) * STEPS_PER_BAR);
              }}
            >
              <span className="pl-corner" />
              {Array.from({ length: bars }, (_, i) => (
                <span key={i} className={"pl-bar-no" + (i * STEPS_PER_BAR === songStart ? " start" : "")} style={{ width: BAR }}>
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="pl-rows">
              <div className="pl-labels">
                {Array.from({ length: project.tracks }, (_, i) => (
                  <div key={i} className="pl-label" style={{ height: TRACK }}>
                    Track {i + 1}
                  </div>
                ))}
              </div>
              <div
                className={"pl-grid" + (tool === "erase" ? " erasing" : "")}
                ref={grid}
                style={{
                  width: bars * BAR,
                  height: project.tracks * TRACK,
                  backgroundSize: `${BAR * 4}px ${TRACK}px, ${BAR}px ${TRACK}px, ${BAR}px ${TRACK}px`,
                }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onContextMenu={(e) => e.preventDefault()}
              >
                {project.clips.map((c) => {
                  const pat = project.patterns.find((x) => x.id === c.patternId);
                  if (!pat) return null;
                  return (
                    <div
                      key={c.id}
                      data-clip={c.id}
                      className={"clip" + (pat.id === current.id ? " current" : "")}
                      style={{
                        left: c.start * BAR,
                        top: c.track * TRACK + 2,
                        width: (pat.length / STEPS_PER_BAR) * BAR - 1,
                        height: TRACK - 5,
                        borderColor: pat.color,
                        color: pat.color,
                      }}
                    >
                      <span>{pat.name}</span>
                      <Thumb pattern={pat} project={project} />
                    </div>
                  );
                })}
                <div className="pr-playhead" ref={playhead} />
              </div>
            </div>
          </div>
        </div>
        <div className="rack-foot">
          <button className="btn" disabled={project.tracks >= 32} onClick={() => update((p) => ({ ...p, tracks: p.tracks + 1 }))}>
            <Plus size={14} /> Add track
          </button>
          <span className="hint">Song length: {songSteps(project) / STEPS_PER_BAR} bars</span>
        </div>
      </div>
    </div>
  );
}
