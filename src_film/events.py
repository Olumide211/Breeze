"""Shared timing for picture and sound (so a ball hits the ground on the same
frame you hear it). Everything derives from build/timeline.json."""
import json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_timeline():
    return json.load(open(os.path.join(ROOT, "build/timeline.json")))


class Events:
    def __init__(self, tl=None):
        tl = tl or load_timeline()
        self.tl = tl
        self.S = {k: tuple(v) for k, v in tl["sections"].items()}
        self.total = tl["total"]
        self.lines = {l["id"]: l for l in tl["lines"]}
        S = self.S
        # --- title: ball rolls across the frame ---------------------------
        self.roll = (0.6, 7.4)
        # --- section boundaries get a whoosh ---------------------------------
        self.whooshes = [S["b1"][0], S["b2"][0], S["b3"][0], S["b4"][0], S["drift"][0], S["final"][0]]
        # --- b2 left: boy keeps the ball up (juggling), period 0.62s ----------
        s, e = S["b2"]
        self.juggle_L = list(np.arange(s + 0.9, e - 0.6, 0.62))
        # --- b2 right: ball kicked against a wall and back --------------------
        self.wall_R = list(np.arange(s + 1.2, e - 0.8, 1.3))  # kick times; wall hit +0.45
        # --- b1 both: a single small ball bounce as the boy appears -----------
        s1 = S["b1"][0]
        self.b1_drop = [s1 + 2.0, s1 + 2.55, s1 + 2.95, s1 + 3.22]
        # --- b4 right: heartbeat that races, then calms ------------------------
        s4, e4 = S["b4"]
        r = self.lines["b4R"]
        race_peak = r["start"] + 2.6
        calm = r["start"] + 4.6      # surgery -> calm, then back to the pitch
        beats, t = [], s4 + 0.6

        def interval(t):
            if t < race_peak - 2.0:
                return 0.85
            if t < race_peak:
                return 0.85 - 0.5 * (t - (race_peak - 2.0)) / 2.0   # speeds up to 0.35
            if t < calm:
                return 0.35 + 0.5 * (t - race_peak) / (calm - race_peak)
            return 0.85
        while t < e4 - 0.4:
            beats.append(t)
            t += interval(t)
        self.heart_R = beats
        self.pitch_R_start = r["start"] + 4.4     # "Then he returned to the pitch."
        # --- b4 left: plane crosses the sky ------------------------------------
        self.plane_L = (s4 + 3.2, e4 - 0.3)
        # --- crowd & stadium ----------------------------------------------------
        self.crowd_start = S["drift"][0] + 4.0
        self.lights_on = [S["drift"][0] + 4.6 + 0.5 * i for i in range(4)]  # stadium lights clunk on
        self.roar_peak = self.lines["f1"]["start"]
        self.end_title = self.lines["f1"]["start"]
        self.credit = self.lines["f1"]["end"] + 1.6

    # focus: 1 -> left panel active, 0 -> right panel active (smoothed)
    def focus(self, t):
        for b in ("b1", "b2", "b3", "b4"):
            s, e = self.S[b]
            if s <= t < e:
                sw = self.lines[b + "R"]["start"] - 0.35
                x = np.clip((t - sw) / 0.6, 0, 1)
                x = x * x * (3 - 2 * x)
                return 1.0 - x
        return 0.5

    def section(self, t):
        for k, (s, e) in self.S.items():
            if s <= t < e:
                return k, t - s, e - s
        return "final", t - self.S["final"][0], self.S["final"][1] - self.S["final"][0]
