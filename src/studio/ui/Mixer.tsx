import React, { useRef } from "react";
import { Engine } from "../engine/engine";
import { editChannel } from "../project";
import { useFrame, Update } from "../store";
import { Master, Project } from "../types";
import { dB, Fader, hz, Knob, panText, pct, secs } from "./controls";

interface Props {
  project: Project;
  channelId: string;
  engine: Engine;
  update: Update;
  onSelect: (id: string) => void;
}

const DELAY_TIMES = [
  { steps: 1, label: "1/16" },
  { steps: 2, label: "1/8" },
  { steps: 3, label: "1/8 dotted" },
  { steps: 4, label: "1/4" },
  { steps: 6, label: "1/4 dotted" },
  { steps: 8, label: "1/2" },
];

export function Mixer({ project, channelId, engine, update, onSelect }: Props) {
  const meters = useRef<Record<string, HTMLDivElement | null>>({});
  const held = useRef<Record<string, number>>({});

  useFrame(() => {
    Object.keys(meters.current).forEach((id) => {
      const el = meters.current[id];
      if (!el) return;
      const peak = engine.level(id === "master" ? undefined : id);
      // -54 dB..0 dB mapped to the meter height, with a slow fall
      const now = peak > 0.0005 ? Math.max(0, Math.min(1, (20 * Math.log10(peak) + 54) / 54)) : 0;
      const shown = Math.max(now, (held.current[id] || 0) - 0.02);
      held.current[id] = shown;
      el.style.height = shown * 100 + "%";
      el.classList.toggle("hot", peak >= 1);
    });
  });

  const master = (patch: Partial<Master>) => update((p) => ({ ...p, master: { ...p.master, ...patch } }));
  const m = project.master;

  return (
    <div className="mixer">
      {project.channels.map((ch) => {
        const set = (patch: Partial<typeof ch>) => update((p) => editChannel(p, ch.id, patch));
        return (
          <div key={ch.id} className={"strip" + (ch.id === channelId ? " selected" : "")} onPointerDown={() => onSelect(ch.id)}>
            <div className="strip-name" style={{ borderTopColor: ch.color }} title={ch.name}>
              {ch.name}
            </div>
            <div className="strip-knobs">
              <Knob label="Reverb" value={ch.reverb} min={0} max={1} reset={0} format={pct} onChange={(v) => set({ reverb: v })} />
              <Knob label="Delay" value={ch.delay} min={0} max={1} reset={0} format={pct} onChange={(v) => set({ delay: v })} />
              <Knob label="Low cut" value={ch.highpass} min={20} max={8000} reset={20} log format={hz} onChange={(v) => set({ highpass: v })} />
              <Knob label="High cut" value={ch.lowpass} min={200} max={20000} reset={20000} log format={hz} onChange={(v) => set({ lowpass: v })} />
              <Knob label="Pan" value={ch.pan} min={-1} max={1} reset={0} format={panText} onChange={(v) => set({ pan: v })} />
            </div>
            <div className="strip-buttons">
              <button className={"mini" + (ch.mute ? " on warn" : "")} aria-pressed={ch.mute} title="Mute" onClick={() => set({ mute: !ch.mute })}>
                M
              </button>
              <button className={"mini" + (ch.solo ? " on" : "")} aria-pressed={ch.solo} title="Solo" onClick={() => set({ solo: !ch.solo })}>
                S
              </button>
            </div>
            <Fader
              label={ch.name + " volume"}
              value={ch.volume}
              min={0}
              max={1.25}
              reset={0.8}
              format={dB}
              onChange={(v) => set({ volume: v })}
              meterRef={(el) => (meters.current[ch.id] = el)}
            />
            <div className="strip-value">{dB(ch.volume)}</div>
          </div>
        );
      })}

      <div className="strip master">
        <div className="strip-name" title="Master">
          Master
        </div>
        <div className="strip-knobs">
          <Knob label="Rev size" value={m.reverbSize} min={0.3} max={6} reset={2.2} log format={secs} onChange={(v) => master({ reverbSize: Math.round(v * 10) / 10 })} />
          <Knob label="Dly fdbk" value={m.delayFeedback} min={0} max={0.9} reset={0.35} format={pct} onChange={(v) => master({ delayFeedback: v })} />
          <label className="field stacked">
            Delay time
            <select value={m.delaySteps} onChange={(e) => master({ delaySteps: Number(e.target.value) })}>
              {DELAY_TIMES.map((d) => (
                <option key={d.steps} value={d.steps}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="strip-buttons">
          <button
            className={"mini wide" + (m.limiter ? " on" : "")}
            aria-pressed={m.limiter}
            title="Limiter on the master bus"
            onClick={() => master({ limiter: !m.limiter })}
          >
            Limit
          </button>
        </div>
        <Fader
          label="Master volume"
          value={m.volume}
          min={0}
          max={1.25}
          reset={0.9}
          format={dB}
          onChange={(v) => master({ volume: v })}
          meterRef={(el) => (meters.current.master = el)}
        />
        <div className="strip-value">{dB(m.volume)}</div>
      </div>
    </div>
  );
}
