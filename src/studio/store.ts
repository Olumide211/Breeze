import { useCallback, useEffect, useState } from "react";
import { Project } from "./types";

/**
 * Every pointer press or key press starts a new "gesture". All edits made during one gesture
 * (a knob drag, painting a row of steps, dragging a note) collapse into a single undo step.
 */
let gesture = 0;
if (typeof window !== "undefined") {
  const bump = () => {
    gesture++;
  };
  window.addEventListener("pointerdown", bump, true);
  window.addEventListener("keydown", bump, true);
}

interface History {
  past: Project[];
  present: Project;
  future: Project[];
  gesture: number;
}

export type Update = (fn: (p: Project) => Project) => void;

export function useProjectStore(initial: () => Project) {
  const [h, setH] = useState<History>(() => ({ past: [], present: initial(), future: [], gesture: -1 }));

  const update: Update = useCallback((fn) => {
    setH((cur) => {
      const next = fn(cur.present);
      if (next === cur.present) return cur;
      if (cur.gesture === gesture) return { ...cur, present: next };
      return { past: cur.past.concat([cur.present]).slice(-200), present: next, future: [], gesture };
    });
  }, []);

  const undo = useCallback(() => {
    setH((cur) =>
      cur.past.length
        ? {
            past: cur.past.slice(0, -1),
            present: cur.past[cur.past.length - 1],
            future: [cur.present].concat(cur.future),
            gesture: -1,
          }
        : cur
    );
  }, []);

  const redo = useCallback(() => {
    setH((cur) =>
      cur.future.length
        ? {
            past: cur.past.concat([cur.present]),
            present: cur.future[0],
            future: cur.future.slice(1),
            gesture: -1,
          }
        : cur
    );
  }, []);

  /** Swap in a different project (open, new, demo). Still undoable. */
  const replace = useCallback((p: Project) => {
    setH((cur) => ({ past: cur.past.concat([cur.present]).slice(-200), present: p, future: [], gesture: -1 }));
  }, []);

  return { project: h.present, update, undo, redo, replace, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}

/** Calls `fn` on every animation frame while mounted. */
export function useFrame(fn: () => void) {
  useEffect(() => {
    let id = 0;
    const loop = () => {
      fn();
      id = window.requestAnimationFrame(loop);
    };
    id = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(id);
  });
}
