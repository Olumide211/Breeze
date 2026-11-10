import React, { useRef } from "react";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface RangeProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** value restored by a double-click */
  reset?: number;
  /** exponential mapping, for frequencies and times */
  log?: boolean;
  /** round to whole numbers */
  integer?: boolean;
  label: string;
  format?: (v: number) => string;
}

function useDrag(p: RangeProps, pixels: number) {
  const start = useRef<{ y: number; norm: number } | null>(null);
  const toNorm = (v: number) =>
    p.log ? Math.log(v / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min);
  const fromNorm = (n: number) => {
    const v = p.log ? p.min * Math.pow(p.max / p.min, n) : p.min + n * (p.max - p.min);
    return p.integer ? Math.round(v) : v;
  };
  const norm = clamp(toNorm(p.value), 0, 1);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      start.current = { y: e.clientY, norm };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      const fine = e.shiftKey ? 4 : 1;
      const n = clamp(start.current.norm + (start.current.y - e.clientY) / (pixels * fine), 0, 1);
      const v = fromNorm(n);
      if (v !== p.value) p.onChange(v);
    },
    onPointerUp: () => {
      start.current = null;
    },
    onPointerCancel: () => {
      start.current = null;
    },
    onDoubleClick: () => {
      if (p.reset !== undefined) p.onChange(p.reset);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const dir = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      p.onChange(p.integer ? clamp(p.value + dir, p.min, p.max) : fromNorm(clamp(norm + dir * 0.02, 0, 1)));
    },
  };
  return { norm, handlers };
}

const defaultFormat = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

export function Knob(p: RangeProps) {
  const { norm, handlers } = useDrag(p, 140);
  const text = (p.format || defaultFormat)(p.value);
  // 270 degree sweep starting at 7:30
  const angle = (-135 + norm * 270) * (Math.PI / 180);
  const arc = (to: number) => {
    const a0 = -135 * (Math.PI / 180);
    const a1 = (-135 + to * 270) * (Math.PI / 180);
    const pt = (a: number) => `${16 + 12 * Math.sin(a)} ${16 - 12 * Math.cos(a)}`;
    return `M ${pt(a0)} A 12 12 0 ${to * 270 > 180 ? 1 : 0} 1 ${pt(a1)}`;
  };
  return (
    <div className="knob" title={`${p.label}: ${text} (drag, shift for fine, double-click to reset)`}>
      <svg
        viewBox="0 0 32 32"
        role="slider"
        tabIndex={0}
        aria-label={p.label}
        aria-valuemin={p.min}
        aria-valuemax={p.max}
        aria-valuenow={p.value}
        aria-valuetext={text}
        {...handlers}
      >
        <path d={arc(1)} className="knob-track" />
        {norm > 0.005 && <path d={arc(norm)} className="knob-value" />}
        <circle cx="16" cy="16" r="8" className="knob-cap" />
        <line
          x1={16 + 3 * Math.sin(angle)}
          y1={16 - 3 * Math.cos(angle)}
          x2={16 + 7.5 * Math.sin(angle)}
          y2={16 - 7.5 * Math.cos(angle)}
          className="knob-mark"
        />
      </svg>
      <span className="knob-label">{p.label}</span>
      <span className="knob-text">{text}</span>
    </div>
  );
}

export function Fader(p: RangeProps & { meterRef?: React.Ref<HTMLDivElement> }) {
  const { norm, handlers } = useDrag(p, 130);
  const text = (p.format || defaultFormat)(p.value);
  return (
    <div
      className="fader"
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-orientation="vertical"
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={p.value}
      aria-valuetext={text}
      title={`${p.label}: ${text}`}
      {...handlers}
    >
      <div className="fader-meter">
        <div className="fader-level" ref={p.meterRef} />
      </div>
      <div className="fader-slot" />
      <div className="fader-cap" style={{ bottom: `calc(${norm * 100}% - ${norm * 14}px)` }} />
    </div>
  );
}

export const pct = (v: number) => Math.round(v * 100) + "%";
export const hz = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : Math.round(v) + "");
export const secs = (v: number) => (v < 1 ? Math.round(v * 1000) + "ms" : v.toFixed(1) + "s");
export const panText = (v: number) => (Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100));
export const dB = (v: number) => (v <= 0.001 ? "-inf" : (20 * Math.log10(v)).toFixed(1) + " dB");
