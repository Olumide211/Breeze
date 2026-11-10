import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Pencil, ZoomIn, ZoomOut } from "lucide-react";
import { Engine } from "../engine/engine";
import { editNotes, uid } from "../project";
import { useFrame, Update } from "../store";
import { Channel, isBlackKey, Note, noteName, Pattern } from "../types";

const ROW = 16;
const TOP = 96; // C7
const BOTTOM = 24; // C1
const ROWS = TOP - BOTTOM + 1;
const ZOOMS = [18, 28, 40, 56];

interface Props {
  pattern: Pattern;
  channel: Channel;
  engine: Engine;
  update: Update;
}

interface Drag {
  kind: "move" | "resize" | "erase";
  id: string;
  x: number;
  y: number;
  orig: Note;
}

export function PianoRoll({ pattern, channel, engine, update }: Props) {
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(1);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const lastLength = useRef(2);
  const drag = useRef<Drag | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const stepW = ZOOMS[zoom];
  const notes = pattern.notes[channel.id] || [];

  // open centred on the existing notes, or around middle C
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const list = pattern.notes[channel.id] || [];
    const mid = list.length ? list.reduce((a, n) => a + n.pitch, 0) / list.length : 62;
    el.scrollTop = (TOP - mid) * ROW - el.clientHeight / 2;
  }, [channel.id, pattern.id]);

  useFrame(() => {
    const el = playhead.current;
    if (!el) return;
    const pos = engine.patternPosition(pattern.id);
    el.style.display = pos === null ? "none" : "block";
    if (pos !== null) el.style.transform = `translateX(${pos * stepW}px)`;
  });

  const background = useMemo(() => {
    // one octave of row shading, repeated; rows run from high pitch to low
    const stops: string[] = [];
    for (let i = 0; i < 12; i++) {
      const c = isBlackKey(TOP - i) ? "var(--row-dark)" : "var(--row-light)";
      stops.push(`${c} ${i * ROW}px`, `${c} ${(i + 1) * ROW - 1}px`, `var(--line) ${(i + 1) * ROW - 1}px`, `var(--line) ${(i + 1) * ROW}px`);
    }
    const v = (color: string, every: number) =>
      `repeating-linear-gradient(90deg, ${color} 0, ${color} 1px, transparent 1px, transparent ${every * stepW}px)`;
    return {
      backgroundImage: [v("var(--bar-line)", 16), v("var(--beat-line)", 4), v("var(--line)", 1), `linear-gradient(${stops.join(",")})`].join(","),
      backgroundSize: `auto, auto, auto, 100% ${12 * ROW}px`,
    };
  }, [stepW]);

  const point = (e: React.PointerEvent) => {
    const rect = grid.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const remove = (id: string) => update((p) => editNotes(p, pattern.id, channel.id, (list) => list.filter((n) => n.id !== id)));

  const down = (e: React.PointerEvent) => {
    const { x, y } = point(e);
    const el = (e.target as HTMLElement).closest("[data-note]") as HTMLElement | null;
    const hit = el ? notes.find((n) => n.id === el.dataset.note) : undefined;
    grid.current!.setPointerCapture(e.pointerId);
    if (tool === "erase" || e.button === 2) {
      if (hit) remove(hit.id);
      drag.current = { kind: "erase", id: "", x, y, orig: hit || { id: "", pitch: 0, start: 0, length: 0, velocity: 0 } };
      return;
    }
    if (hit) {
      const right = (hit.start + hit.length) * stepW;
      drag.current = { kind: x > right - 7 ? "resize" : "move", id: hit.id, x, y, orig: hit };
      engine.preview(channel.id, hit.pitch);
      return;
    }
    const start = Math.floor(x / stepW / snap) * snap;
    const pitch = TOP - Math.floor(y / ROW);
    if (start < 0 || start >= pattern.length || pitch < BOTTOM || pitch > TOP) return;
    const note: Note = { id: uid("n"), pitch, start, length: Math.min(lastLength.current, pattern.length - start), velocity: 0.8 };
    update((p) => editNotes(p, pattern.id, channel.id, (list) => list.concat([note])));
    drag.current = { kind: "move", id: note.id, x, y, orig: note };
    engine.preview(channel.id, pitch);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = point(e);
    if (d.kind === "erase") {
      const step = x / stepW;
      const pitch = TOP - Math.floor(y / ROW);
      const hit = notes.find((n) => n.pitch === pitch && step >= n.start && step < n.start + n.length);
      if (hit) remove(hit.id);
      return;
    }
    const dx = Math.round((x - d.x) / stepW / snap) * snap;
    let next: Note;
    if (d.kind === "resize") {
      const length = Math.max(snap, Math.min(pattern.length - d.orig.start, d.orig.length + dx));
      next = { ...d.orig, length };
      lastLength.current = length;
    } else {
      const dy = Math.round((y - d.y) / ROW);
      const start = Math.max(0, Math.min(pattern.length - Math.min(d.orig.length, pattern.length), d.orig.start + dx));
      const pitch = Math.max(BOTTOM, Math.min(TOP, d.orig.pitch - dy));
      next = { ...d.orig, start, pitch };
    }
    const cur = notes.find((n) => n.id === d.id);
    if (!cur || (cur.start === next.start && cur.pitch === next.pitch && cur.length === next.length)) return;
    if (cur.pitch !== next.pitch) engine.preview(channel.id, next.pitch);
    update((p) => editNotes(p, pattern.id, channel.id, (list) => list.map((n) => (n.id === d.id ? next : n))));
  };

  const up = () => {
    drag.current = null;
  };

  const keys = [];
  for (let pitch = TOP; pitch >= BOTTOM; pitch--) {
    keys.push(
      <button
        key={pitch}
        tabIndex={-1}
        className={"pr-key" + (isBlackKey(pitch) ? " black" : "")}
        onPointerDown={() => engine.preview(channel.id, pitch)}
      >
        {pitch % 12 === 0 ? noteName(pitch) : ""}
      </button>
    );
  }

  return (
    <div className="pr">
      <div className="pr-bar">
        <strong style={{ color: channel.color }}>{channel.name}</strong>
        <div className="seg" role="group" aria-label="Tool">
          <button className={tool === "draw" ? "on" : ""} onClick={() => setTool("draw")} title="Draw: click to add, drag to move, drag the right edge to resize">
            <Pencil size={13} /> Draw
          </button>
          <button className={tool === "erase" ? "on" : ""} onClick={() => setTool("erase")} title="Erase: click or drag over notes (right-click also erases)">
            <Eraser size={13} /> Erase
          </button>
        </div>
        <label className="field inline">
          Snap
          <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
            <option value={4}>1/4</option>
            <option value={2}>1/8</option>
            <option value={1}>1/16</option>
            <option value={0.5}>1/32</option>
            <option value={0.25}>1/64</option>
          </select>
        </label>
        <button className="btn icon" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>
          <ZoomOut size={14} />
        </button>
        <button className="btn icon" aria-label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)}>
          <ZoomIn size={14} />
        </button>
        <span className="hint">{notes.length} notes</span>
      </div>
      <div className="pr-scroll" ref={scroller}>
        <div className="pr-inner" style={{ height: ROWS * ROW }}>
          <div className="pr-keys">{keys}</div>
          <div
            className={"pr-grid" + (tool === "erase" ? " erasing" : "")}
            ref={grid}
            style={{ width: pattern.length * stepW, height: ROWS * ROW, ...background }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onContextMenu={(e) => e.preventDefault()}
          >
            {notes.map((n) => (
              <div
                key={n.id}
                data-note={n.id}
                className="pr-note"
                style={{
                  left: n.start * stepW,
                  top: (TOP - n.pitch) * ROW,
                  width: Math.max(4, n.length * stepW - 1),
                  background: channel.color,
                  opacity: 0.55 + n.velocity * 0.45,
                }}
              >
                {n.length * stepW > 34 ? noteName(n.pitch) : ""}
              </div>
            ))}
            <div className="pr-playhead" ref={playhead} />
          </div>
        </div>
      </div>
    </div>
  );
}
