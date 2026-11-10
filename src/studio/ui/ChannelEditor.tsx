import React from "react";
import { Copy, Trash2 } from "lucide-react";
import { COLORS, duplicateChannel, editChannel, removeChannel, SYNTH_PRESETS } from "../project";
import { Update } from "../store";
import { Channel, DRUM_KINDS, DrumParams, Project, SynthParams, Wave, WAVES } from "../types";
import { hz, Knob, pct, secs } from "./controls";

interface Props {
  project: Project;
  channel: Channel;
  update: Update;
}

const WAVE_LABEL: Record<Wave, string> = { sine: "Sine", triangle: "Triangle", sawtooth: "Saw", square: "Square" };

export function ChannelEditor({ project, channel, update }: Props) {
  const set = (patch: Partial<Channel>) => update((p) => editChannel(p, channel.id, patch));
  const drum = (patch: Partial<DrumParams>) => set({ drum: { ...channel.drum, ...patch } });
  const synth = (patch: Partial<SynthParams>) => set({ synth: { ...channel.synth, ...patch } });
  const s = channel.synth;

  return (
    <div className="editor">
      <div className="editor-row">
        <input
          className="text"
          aria-label="Channel name"
          value={channel.name}
          maxLength={40}
          onChange={(e) => set({ name: e.target.value })}
        />
        <div className="swatches" role="group" aria-label="Channel colour">
          {COLORS.map((c) => (
            <button
              key={c}
              className={"swatch" + (c === channel.color ? " on" : "")}
              style={{ background: c }}
              aria-label={"Colour " + c}
              onClick={() => set({ color: c })}
            />
          ))}
        </div>
      </div>
      <div className="editor-row">
        <div className="seg" role="group" aria-label="Channel type">
          <button className={channel.kind === "drum" ? "on" : ""} onClick={() => set({ kind: "drum" })}>
            Drum
          </button>
          <button className={channel.kind === "synth" ? "on" : ""} onClick={() => set({ kind: "synth" })}>
            Synth
          </button>
        </div>
        <button className="btn" title="Duplicate channel" onClick={() => update((p) => duplicateChannel(p, channel.id))}>
          <Copy size={14} /> Duplicate
        </button>
        <button
          className="btn danger"
          title="Delete channel"
          disabled={project.channels.length <= 1}
          onClick={() => update((p) => removeChannel(p, channel.id))}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {channel.kind === "drum" ? (
        <div className="editor-row">
          <label className="field">
            Sound
            <select value={channel.drum.kind} onChange={(e) => drum({ kind: e.target.value as DrumParams["kind"] })}>
              {DRUM_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <Knob label="Tune" value={channel.drum.tune} min={-12} max={12} reset={0} integer format={(v) => (v > 0 ? "+" : "") + v + " st"} onChange={(v) => drum({ tune: v })} />
          <Knob label="Decay" value={channel.drum.decay} min={0.3} max={3} reset={1} log format={(v) => v.toFixed(2) + "x"} onChange={(v) => drum({ decay: v })} />
        </div>
      ) : (
        <>
          <div className="editor-row">
            <label className="field">
              Preset
              <select
                value=""
                onChange={(e) => {
                  const preset = SYNTH_PRESETS[e.target.value];
                  if (preset) set({ synth: { ...preset } });
                }}
              >
                <option value="">Load...</option>
                {Object.keys(SYNTH_PRESETS).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Osc 1
              <select value={s.wave1} onChange={(e) => synth({ wave1: e.target.value as Wave })}>
                {WAVES.map((w) => (
                  <option key={w} value={w}>
                    {WAVE_LABEL[w]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Osc 2
              <select value={s.wave2} onChange={(e) => synth({ wave2: e.target.value as Wave })}>
                {WAVES.map((w) => (
                  <option key={w} value={w}>
                    {WAVE_LABEL[w]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="editor-knobs">
            <Knob label="Octave" value={s.octave} min={-2} max={2} reset={0} integer format={(v) => (v > 0 ? "+" : "") + v} onChange={(v) => synth({ octave: v })} />
            <Knob label="Osc2 oct" value={s.osc2Octave} min={-2} max={2} reset={0} integer format={(v) => (v > 0 ? "+" : "") + v} onChange={(v) => synth({ osc2Octave: v })} />
            <Knob label="Mix" value={s.mix} min={0} max={1} reset={0.5} format={pct} onChange={(v) => synth({ mix: v })} />
            <Knob label="Detune" value={s.detune} min={0} max={50} reset={0} format={(v) => v.toFixed(0) + " ct"} onChange={(v) => synth({ detune: v })} />
            <Knob label="Cutoff" value={s.cutoff} min={60} max={16000} reset={2000} log format={hz} onChange={(v) => synth({ cutoff: v })} />
            <Knob label="Reso" value={s.resonance} min={0.1} max={20} reset={1} log format={(v) => v.toFixed(1)} onChange={(v) => synth({ resonance: v })} />
            <Knob label="Env" value={s.envAmount} min={0} max={1} reset={0} format={pct} onChange={(v) => synth({ envAmount: v })} />
            <Knob label="Attack" value={s.attack} min={0.003} max={2} reset={0.005} log format={secs} onChange={(v) => synth({ attack: v })} />
            <Knob label="Decay" value={s.decay} min={0.02} max={3} reset={0.3} log format={secs} onChange={(v) => synth({ decay: v })} />
            <Knob label="Sustain" value={s.sustain} min={0} max={1} reset={0.5} format={pct} onChange={(v) => synth({ sustain: v })} />
            <Knob label="Release" value={s.release} min={0.02} max={4} reset={0.2} log format={secs} onChange={(v) => synth({ release: v })} />
          </div>
        </>
      )}
    </div>
  );
}
