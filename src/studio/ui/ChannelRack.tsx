import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Engine } from "../engine/engine";
import { COLORS, editChannel, newChannel, setStep, SYNTH_PRESETS } from "../project";
import { useFrame, Update } from "../store";
import { Channel, DRUM_KINDS, Pattern, Project } from "../types";
import { Knob, panText, pct } from "./controls";

const CELL = 30;
const ROW = 44;

interface Props {
  project: Project;
  pattern: Pattern;
  channelId: string;
  engine: Engine;
  update: Update;
  onSelect: (id: string) => void;
}

function NoteStrip({ pattern, channel }: { pattern: Pattern; channel: Channel }) {
  const notes = pattern.notes[channel.id] || [];
  let lo = 127;
  let hi = 0;
  notes.forEach((n) => {
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
  });
  const span = Math.max(6, hi - lo);
  return (
    <div className="rack-notes" style={{ width: pattern.length * CELL - 4 }}>
      {notes.length === 0 && <span className="rack-notes-hint">Empty: open the piano roll below to add notes</span>}
      {notes.map((n) => (
        <i
          key={n.id}
          style={{
            left: n.start * CELL,
            width: Math.max(3, n.length * CELL - 2),
            bottom: 4 + ((n.pitch - lo) / span) * (ROW - 22),
            background: channel.color,
          }}
        />
      ))}
    </div>
  );
}

export function ChannelRack({ project, pattern, channelId, engine, update, onSelect }: Props) {
  const paint = useRef<number | null>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);

  useFrame(() => {
    const el = playhead.current;
    if (!el) return;
    const pos = engine.patternPosition(pattern.id);
    el.style.display = pos === null ? "none" : "block";
    if (pos !== null) el.style.transform = `translateX(${Math.floor(pos) * CELL}px)`;
  });

  const add = (kind: "drum" | "synth", name: string, drumKind?: Channel["drum"]["kind"]) => {
    const ch = newChannel(kind, name, project.channels.length, drumKind);
    ch.color = COLORS[project.channels.length % COLORS.length];
    update((p) => ({ ...p, channels: p.channels.concat([ch]) }));
    onSelect(ch.id);
    setMenu(false);
  };

  const press = (ch: Channel, step: number, e: React.PointerEvent) => {
    // let the pointer leave this cell so dragging paints across the row
    (e.target as Element).releasePointerCapture(e.pointerId);
    const row = pattern.steps[ch.id] || [];
    const value = e.button === 2 || row[step] ? 0 : e.shiftKey ? 1 : 0.8;
    paint.current = value;
    update((p) => setStep(p, pattern.id, ch.id, step, value));
    if (value) engine.preview(ch.id);
    onSelect(ch.id);
  };

  const enter = (ch: Channel, step: number, e: React.PointerEvent) => {
    if (paint.current === null || e.buttons === 0) return;
    const value = paint.current;
    update((p) => setStep(p, pattern.id, ch.id, step, value));
  };

  return (
    <div className="rack" onPointerUp={() => (paint.current = null)} onContextMenu={(e) => e.preventDefault()}>
      <div className="rack-body">
        <div className="rack-heads">
          {project.channels.map((ch) => (
            <div key={ch.id} className={"rack-head" + (ch.id === channelId ? " selected" : "")}>
              <button
                className={"mini" + (ch.mute ? " on warn" : "")}
                title="Mute"
                aria-pressed={ch.mute}
                onClick={() => update((p) => editChannel(p, ch.id, { mute: !ch.mute }))}
              >
                M
              </button>
              <button
                className={"mini" + (ch.solo ? " on" : "")}
                title="Solo"
                aria-pressed={ch.solo}
                onClick={() => update((p) => editChannel(p, ch.id, { solo: !ch.solo }))}
              >
                S
              </button>
              <Knob
                label="Vol"
                value={ch.volume}
                min={0}
                max={1.25}
                reset={0.8}
                format={pct}
                onChange={(v) => update((p) => editChannel(p, ch.id, { volume: v }))}
              />
              <Knob
                label="Pan"
                value={ch.pan}
                min={-1}
                max={1}
                reset={0}
                format={panText}
                onChange={(v) => update((p) => editChannel(p, ch.id, { pan: v }))}
              />
              <button
                className="rack-name"
                style={{ borderLeftColor: ch.color }}
                title="Select this channel (and hear it)"
                onClick={() => {
                  onSelect(ch.id);
                  engine.preview(ch.id);
                }}
              >
                {ch.name}
              </button>
            </div>
          ))}
        </div>
        <div className="rack-steps">
          <div className="rack-playhead" ref={playhead} style={{ width: CELL, height: project.channels.length * ROW }} />
          {project.channels.map((ch) => {
            const row = pattern.steps[ch.id] || [];
            return (
              <div key={ch.id} className="rack-row" style={{ width: pattern.length * CELL }}>
                {ch.kind === "synth" ? (
                  <button className="rack-notes-btn" onClick={() => onSelect(ch.id)} title="Edit in the piano roll">
                    <NoteStrip pattern={pattern} channel={ch} />
                  </button>
                ) : (
                  Array.from({ length: pattern.length }, (_, i) => (
                    <button
                      key={i}
                      className={
                        "step" + (Math.floor(i / 4) % 2 ? " alt" : "") + (row[i] ? " on" : "") + (row[i] >= 1 ? " accent" : "")
                      }
                      style={row[i] ? { background: ch.color } : undefined}
                      aria-label={`${ch.name} step ${i + 1}`}
                      aria-pressed={!!row[i]}
                      onPointerDown={(e) => press(ch, i, e)}
                      onPointerEnter={(e) => enter(ch, i, e)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        update((p) => setStep(p, pattern.id, ch.id, i, row[i] ? 0 : 0.8));
                      }}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rack-foot">
        <div className="menu-wrap">
          <button className="btn" onClick={() => setMenu(!menu)} aria-expanded={menu}>
            <Plus size={14} /> Add channel
          </button>
          {menu && (
            <div className="menu">
              <div className="menu-title">Drums</div>
              {DRUM_KINDS.map((k) => (
                <button key={k.id} onClick={() => add("drum", k.label, k.id)}>
                  {k.label}
                </button>
              ))}
              <div className="menu-title">Synths</div>
              {Object.keys(SYNTH_PRESETS).map((name) => (
                <button key={name} onClick={() => add("synth", name)}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="hint">Click or drag to set steps, shift-click for an accent, right-click to clear.</span>
      </div>
    </div>
  );
}
