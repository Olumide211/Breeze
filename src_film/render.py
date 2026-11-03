"""Render TWO ROADS frames with cairo (+ Pillow for typography) and encode with ffmpeg.

usage:
  python src_film/render.py --stills 3 15 30 ...   # PNG stills into build/stills
  python src_film/render.py                        # full film -> build/video.mp4
"""
import argparse, math, os, random, subprocess, sys, time
from multiprocessing import Pool
import numpy as np
import cairo
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from events import Events, ROOT
from draw import *  # noqa

W, H, FPS = 1920, 1080, 30
PW = 960
GY = 820          # ground / feet line in the split screen
EV = Events()
FONTS = os.path.join(ROOT, "assets/fonts")

# palette
BLUE_SHIRT = hx("#a9d4f5"); BLUE_STRIPE = hx("#f4f8ff"); NAVY = hx("#1d2a4a")
RED_SHIRT = hx("#cf3b3b"); DARK_GREEN = hx("#1f3d2f")
COOL = hx("#8ec5ff"); WARM = hx("#ffb36b")


# =================================================================== text
def font(name, size, weight=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    if weight is not None:
        f.set_variation_by_axes([weight])
    return f


_cache = {}


def text_layer(key, lines, fnt, color=(255, 255, 255), spacing=0, line_h=None, align="center",
               shadow=True, shadow_blur=7, shadow_alpha=0.85, pad=30):
    """Render text lines to a premultiplied BGR float32 layer + alpha. Cached."""
    if key in _cache:
        return _cache[key]
    asc, desc = fnt.getmetrics()
    lh = line_h or int((asc + desc) * 1.18)

    def width(s):
        if spacing == 0:
            return fnt.getlength(s)
        return sum(fnt.getlength(c) for c in s) + spacing * (len(s) - 1)
    ws = [width(s) for s in lines]
    tw = int(max(ws)) + 2 * pad; th = lh * len(lines) + 2 * pad
    mask = Image.new("L", (tw, th), 0)
    d = ImageDraw.Draw(mask)
    for i, s in enumerate(lines):
        x = pad + (tw - 2 * pad - ws[i]) / 2 if align == "center" else pad
        y = pad + i * lh
        if spacing == 0:
            d.text((x, y), s, font=fnt, fill=255)
        else:
            for c in s:
                d.text((x, y), c, font=fnt, fill=255); x += fnt.getlength(c) + spacing
    a = np.asarray(mask, dtype=np.float32) / 255.0
    col = np.array(color[::-1], dtype=np.float32)  # BGR
    rgb = a[..., None] * col[None, None, :]
    alpha = a
    if shadow:
        sh = mask.filter(ImageFilter.GaussianBlur(shadow_blur))
        sh = np.roll(np.asarray(sh, dtype=np.float32) / 255.0 * shadow_alpha, 3, axis=0)
        sh = np.clip(sh * 1.6, 0, shadow_alpha)
        # shadow under text: out = text over shadow
        alpha = a + sh * (1 - a)
        rgb = rgb  # shadow is black: contributes no color
    _cache[key] = (rgb, alpha, tw, th, pad)
    return _cache[key]


def comp(frame, layer, cx, cy, op=1.0, anchor="center"):
    rgb, a, tw, th, pad = layer
    if op <= 0.003: return
    x0 = int(round(cx - tw / 2)) if anchor == "center" else int(round(cx - pad))
    y0 = int(round(cy - th / 2))
    x1, y1 = x0 + tw, y0 + th
    fx0, fy0, fx1, fy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if fx0 >= fx1 or fy0 >= fy1: return
    sl = (slice(fy0 - y0, fy1 - y0), slice(fx0 - x0, fx1 - x0))
    A = a[sl][..., None] * op
    region = frame[fy0:fy1, fx0:fx1]
    region *= (1 - A)
    region += rgb[sl] * op


def wrap(text, fnt, maxw):
    words = text.split(); lines = [""]
    for w in words:
        t = (lines[-1] + " " + w).strip()
        if fnt.getlength(t) <= maxw or not lines[-1]:
            lines[-1] = t
        else:
            lines.append(w)
    if len(lines) == 2 and len(lines[1].split()) == 1 and len(lines[0].split()) > 3:
        # avoid a single orphan word: rebalance
        a = lines[0].split(); lines = [" ".join(a[:-1]), a[-1] + " " + lines[1]]
    return lines


F_CAP = font("Inter-SemiBold.otf", 44)
F_LABEL = font("Inter-SemiBold.otf", 24)
F_CHAP = font("Montserrat-Variable.ttf", 22, 700)
F_TITLE = font("Montserrat-Variable.ttf", 156, 800)
F_CREDIT = font("Inter-Medium.otf", 28)
F_END = font("Montserrat-Variable.ttf", 92, 700)
F_END2 = font("Inter-Medium.otf", 34)

LABELS = {
    "b1": ("I · BEGINNINGS", "ROSARIO, ARGENTINA · 1987", "FUNCHAL, MADEIRA, PORTUGAL · 1985"),
    "b2": ("II · THE STREETS", "STREETS, FAMILY, LOCAL CLUB", "A MODEST HOME · A LOCAL CLUB"),
    "b3": ("III · TURNING POINTS", "AGE 10–11 · A DIAGNOSIS", "AGE 12 · SPORTING CP ACADEMY"),
    "b4": ("IV · THE SAME YEAR", "2000 · AGE 13 · TO SPAIN", "2000 · AGE 15 · HEART SURGERY"),
}

CAP_Y = 968   # caption block centre (bottom safe area)
SCRIM = np.clip((np.arange(H, dtype=np.float32) - 800) / 280, 0, 1) ** 1.4


# =================================================================== scenes (panel space 960x1080)
def ground_street(ctx, w, top, c1, c2):
    vgrad(ctx, 0, top, w, H - top, [(0, c1), (1, c2)])


def scene_L1(ctx, u, D, t):
    cam = u * 9
    vgrad(ctx, 0, 0, PW, 700, [(0, hx("#0c1b36")), (0.55, hx("#24497c")), (0.9, hx("#79a6d3")), (1, hx("#a9c9e8"))])
    stars(ctx, PW, 420, t, seed=11, n=60, a=0.55)
    glow(ctx, 740, 170, 160, hx("#dbe9ff"), 0.25)
    src(ctx, hx("#eef4ff")); ctx.arc(740, 170, 30, 0, TAU); ctx.fill()
    SKY_FAR.draw(ctx, 650, hx("#33598a"), cam * 0.25, hx("#ffd98f"), 0.25, t)
    SKY_MID.draw(ctx, 712, hx("#1c3961"), cam * 0.5, hx("#ffcf7a"), 0.55, t)
    ground_street(ctx, PW, 700, hx("#1b3050"), hx("#0b1528"))
    src(ctx, hx("#2b4670")); ctx.rectangle(0, GY - 4, PW, 6); ctx.fill()      # curb
    # poles & wires (near layer)
    off = cam * 1.0
    src(ctx, hx("#0b1426")); ctx.set_line_width(2)
    xs = [120 - off, 620 - off, 1120 - off]
    for x in xs:
        ctx.rectangle(x - 6, 300, 12, GY - 300); ctx.fill()
        ctx.rectangle(x - 34, 320, 68, 6); ctx.fill()
    for a, b in zip(xs, xs[1:]):
        for dy in (0, 18):
            ctx.move_to(a - 30, 323 + dy); ctx.curve_to(a + 120, 380 + dy, b - 120, 380 + dy, b - 30, 323 + dy); ctx.stroke()
    streetlamp(ctx, 820 - off * 0.3, GY, 380, hx("#0b1426"), hx("#ffd690"), 0.9)
    # boy + ball
    a = ss((u - 0.5) / 0.9)
    if a > 0:
        figure(ctx, 400, GY, 205, BLUE_SHIRT, NAVY, stripes=BLUE_STRIPE, facing=1, mode="idle", phase=t * 2, alpha=a)
    by = bounce_y(t, EV.b1_drop, 1200)
    if t > EV.b1_drop[0] - 0.75:
        ball(ctx, 470, GY - 14 - by, 14, -by * 0.01, shadow_y=GY + 2)


def scene_R1(ctx, u, D, t):
    cam = u * 9
    hz = 560
    vgrad(ctx, 0, 0, PW, hz, [(0, hx("#3a1f48")), (0.45, hx("#b2505d")), (0.78, hx("#ee8a4e")), (1, hx("#ffcf8f"))])
    glow(ctx, 290, hz - 10, 360, hx("#ffcf7a"), 0.45)
    src(ctx, hx("#ffe6b0")); ctx.arc(290, hz - 10, 62, 0, TAU); ctx.fill()
    vgrad(ctx, 0, hz, PW, 260, [(0, hx("#c46a54")), (0.25, hx("#4a6a86")), (1, hx("#1d4560"))])
    r = random.Random(5)
    for i in range(46):   # sun glints on the sea
        y = hz + 6 + (i / 46) ** 1.6 * 200
        x = 290 + r.uniform(-60, 60) * (1 + (y - hz) / 60) + 30 * math.sin(t * 0.7 + i)
        w = r.uniform(10, 40) * (1 + (y - hz) / 120)
        src(ctx, hx("#ffd9a0"), 0.5 * (0.5 + 0.5 * math.sin(t * 2.3 + i * 1.7)))
        ctx.rectangle(x - w / 2, y, w, 2); ctx.fill()
    # hillside rising to the right with village
    off = cam * 0.4
    ctx.move_to(-10, 900)
    for x in range(-10, PW + 20, 10):
        ctx.line_to(x, madeira_hill(x + off))
    ctx.line_to(PW + 20, 900); ctx.close_path(); src(ctx, hx("#7b3b40")); ctx.fill()
    VILLAGE.draw(ctx, off, hx("#f3e3cf"), hx("#c8553b"), hx("#ffd27a"), 0.6)
    ground_street(ctx, PW, 780, hx("#5a2d2c"), hx("#24120f"))
    src(ctx, hx("#7a4036")); ctx.rectangle(0, GY - 4, PW, 6); ctx.fill()
    palm(ctx, 110 - cam * 0.8, GY, 420, hx("#2a1414"), t)
    a = ss((u - 0.5) / 0.9)
    if a > 0:
        figure(ctx, 560, GY, 210, RED_SHIRT, DARK_GREEN, facing=-1, mode="idle", phase=t * 2 + 1, alpha=a)
    drops = [d + 0.05 for d in EV.b1_drop]
    by = bounce_y(t, drops, 1200)
    if t > drops[0] - 0.75:
        ball(ctx, 490, GY - 14 - by, 14, by * 0.01, shadow_y=GY + 2, light=(1, 0.95, 0.85))


def madeira_hill(x):
    return 780 - 290 * ss(x / 1000) - 18 * math.sin(x * 0.02) - 10 * math.sin(x * 0.051)


def scene_L2(ctx, u, D, t):
    cam = u * 6
    vgrad(ctx, 0, 0, PW, 600, [(0, hx("#1a3560")), (0.7, hx("#5e8fc4")), (1, hx("#9ec1e4"))])
    SKY_FAR.draw(ctx, 470, hx("#3c6596"), 200 + cam * 0.3, hx("#ffd98f"), 0.25, t)
    # back wall with chalk goal
    vgrad(ctx, 0, 470, PW, GY - 470, [(0, hx("#2f4f7c")), (1, hx("#233d63"))])
    src(ctx, hx("#3a5d8c"), 0.5)
    for j in range(8):   # brick courses
        ctx.rectangle(0, 480 + j * 42, PW, 2); ctx.fill()
    src(ctx, hx("#e8f1ff"), 0.75); ctx.set_line_width(5)
    ctx.move_to(560, GY - 4); ctx.line_to(560, 600); ctx.line_to(880, 600); ctx.line_to(880, GY - 4); ctx.stroke()
    # doorway with warm light + family silhouettes
    vgrad(ctx, 70, 560, 150, GY - 560, [(0, hx("#ffcf86")), (1, hx("#e79a52"))])
    glow(ctx, 145, 700, 260, hx("#ffcc80"), 0.25)
    sil = hx("#101c31")
    figure(ctx, 112, GY, 300, sil, sil, silhouette=sil, adult=True, facing=1, mode="idle", phase=t)
    figure(ctx, 178, GY, 280, sil, sil, silhouette=sil, adult=True, facing=1, mode="idle", phase=t + 2)
    # bunting (little club pennants)
    src(ctx, hx("#0e1a2e")); ctx.set_line_width(2)
    ctx.move_to(-10, 440); ctx.curve_to(300, 500, 650, 500, PW + 10, 430); ctx.stroke()
    cols = [hx("#f4f8ff"), hx("#79b6ef"), hx("#e05a4f")]
    for i in range(14):
        p = i / 13
        x = -10 + p * (PW + 20)
        y = (1 - p) ** 3 * 440 + 3 * (1 - p) ** 2 * p * 500 + 3 * (1 - p) * p * p * 500 + p ** 3 * 430
        sw = 4 * math.sin(t * 2 + i)
        src(ctx, cols[i % 3], 0.9); poly(ctx, [(x - 14, y), (x + 14, y), (x + sw, y + 34)]); ctx.fill()
    ground_street(ctx, PW, GY, hx("#1c3150"), hx("#0b1528"))
    src(ctx, hx("#2b4670")); ctx.rectangle(0, GY - 4, PW, 6); ctx.fill()
    # juggling
    imp = EV.juggle_L
    near = min(imp, key=lambda k: abs(k - t))
    kick = math.exp(-((t - near + 0.03) / 0.11) ** 2) if imp[0] - 0.2 <= t <= imp[-1] + 0.2 else 0.0
    bx = 400 + 62
    foot_y = GY - 48
    if t < imp[0]:
        by = foot_y - 13 - bounce_y(t, imp, 220, 2000)
    elif t <= imp[-1]:
        by = foot_y - 13 - bounce_y(t, imp, 220, 2000)
    else:
        by = min(GY - 13, foot_y - 13 + 0.5 * 2000 * (t - imp[-1]) ** 2)
    figure(ctx, 400, GY, 210, BLUE_SHIRT, NAVY, stripes=BLUE_STRIPE, facing=1, mode="juggle", kick=kick, phase=t * 2)
    ball(ctx, bx, by, 13, t * 5, shadow_y=GY + 2)


def scene_R2(ctx, u, D, t):
    cam = u * 6
    vgrad(ctx, 0, 0, PW, 560, [(0, hx("#e9905a")), (0.7, hx("#ffc27f")), (1, hx("#ffe0ad"))])
    vgrad(ctx, 0, 470, PW, 120, [(0, hx("#4f86a3")), (1, hx("#2c5f7f"))])
    ctx.move_to(-10, 900)
    for x in range(-10, PW + 20, 10):
        ctx.line_to(x, 560 - 60 * ss((PW - x) / 900) + 6 * math.sin(x * 0.03))
    ctx.line_to(PW + 20, 900); ctx.close_path(); src(ctx, hx("#8a4a40")); ctx.fill()
    # modest house
    src(ctx, hx("#f5ead9")); ctx.rectangle(70, 560, 300, GY - 560); ctx.fill()
    src(ctx, hx("#c4553a")); poly(ctx, [(50, 565), (220, 470), (390, 565)]); ctx.fill()
    src(ctx, hx("#9b3f2c")); ctx.rectangle(50, 560, 340, 10); ctx.fill()
    src(ctx, hx("#6a3b2a")); ctx.rectangle(110, 660, 70, GY - 660); ctx.fill()        # door
    src(ctx, hx("#3f6f8f")); ctx.rectangle(240, 620, 80, 70); ctx.fill()             # window shutters
    src(ctx, hx("#ffe7b8")); ctx.rectangle(262, 630, 36, 50); ctx.fill()
    # laundry line
    src(ctx, hx("#3a1d18")); ctx.set_line_width(5); ctx.move_to(940, GY); ctx.line_to(940, 520); ctx.stroke()
    ctx.set_line_width(2); ctx.move_to(370, 590); ctx.curve_to(550, 640, 760, 640, 940, 530); ctx.stroke()
    for i, (px, c) in enumerate([(430, "#f2f2ea"), (500, "#7fb0d6"), (585, "#e6c36a"), (690, "#f2f2ea"), (790, "#d06a5a")]):
        p = (px - 370) / 570
        y = (1 - p) ** 3 * 590 + 3 * (1 - p) ** 2 * p * 640 + 3 * (1 - p) * p * p * 640 + p ** 3 * 530
        sw = 6 * math.sin(t * 1.8 + i * 1.3)
        src(ctx, hx(c)); poly(ctx, [(px - 22, y), (px + 22, y), (px + 24 + sw, y + 58), (px - 20 + sw, y + 58)]); ctx.fill()
    # stone wall on the right (the boy's rebound wall)
    src(ctx, hx("#b98a6a")); ctx.rectangle(845, 610, 140, GY - 610); ctx.fill()
    src(ctx, hx("#8f6249"), 0.7)
    rr = random.Random(9)
    for j in range(5):
        for i in range(4):
            ctx.set_line_width(2); ctx.rectangle(850 + i * 34 + (j % 2) * 15, 616 + j * 41, 28, 34); ctx.stroke()
    ground_street(ctx, PW, GY, hx("#6b3a2f"), hx("#2a1511"))
    src(ctx, hx("#8a4b3b")); ctx.rectangle(0, GY - 4, PW, 6); ctx.fill()
    # kick against the wall
    ks = EV.wall_R
    rest_x, wall_x = 590, 832
    kick = 0.0
    for k in ks:
        kick = max(kick, math.exp(-((t - k + 0.04) / 0.13) ** 2))
    bx, by = rest_x, GY - 13
    for k in ks:
        p = t - k
        if 0 <= p < 0.45:
            q = p / 0.45; bx = lerp(rest_x, wall_x, q); by = GY - 13 - 70 * math.sin(math.pi * q * 0.9) - 40 * q
        elif 0.45 <= p < 1.3:
            q = (p - 0.45) / 0.85; bx = lerp(wall_x, rest_x, ss(q) * 0.3 + q * 0.7)
            hy = 110 * (1 - q) * (1 - abs(1 - 2 * ((q * 1.6) % 1.0)) ** 2) if q < 0.625 else 25 * math.sin(math.pi * (q - 0.625) / 0.375)
            by = GY - 13 - max(0, hy)
    figure(ctx, 540, GY, 212, RED_SHIRT, DARK_GREEN, facing=1, mode="kick", kick=kick, phase=t * 2)
    ball(ctx, bx, by, 13, bx * 0.08, shadow_y=GY + 2, light=(1, 0.95, 0.85))


def scene_L3(ctx, u, D, t):
    push = 1 + 0.04 * u / D
    ctx.save(); ctx.translate(PW / 2, 600); ctx.scale(push, push); ctx.translate(-PW / 2, -600)
    vgrad(ctx, -40, -40, PW + 80, GY + 40, [(0, hx("#132643")), (1, hx("#1d355a"))])
    # window with moon
    vgrad(ctx, 560, 170, 250, 300, [(0, hx("#173761")), (1, hx("#3d6c9f"))])
    glow(ctx, 720, 250, 120, hx("#e6f0ff"), 0.5)
    src(ctx, hx("#eef4ff")); ctx.arc(720, 250, 24, 0, TAU); ctx.fill()
    src(ctx, hx("#0c182c")); ctx.set_line_width(10); ctx.rectangle(560, 170, 250, 300); ctx.stroke()
    ctx.set_line_width(6); ctx.move_to(685, 170); ctx.line_to(685, 470); ctx.move_to(560, 320); ctx.line_to(810, 320); ctx.stroke()
    # moonlight beam
    ctx.save(); ctx.set_operator(cairo.OPERATOR_ADD)
    g = cairo.LinearGradient(0, 470, 0, GY + 100)
    g.add_color_stop_rgba(0, 0.55, 0.7, 0.95, 0.14); g.add_color_stop_rgba(1, 0.55, 0.7, 0.95, 0.0)
    poly(ctx, [(560, 470), (810, 470), (640, GY + 120), (290, GY + 120)]); ctx.set_source(g); ctx.fill(); ctx.restore()
    # height chart on the wall
    src(ctx, hx("#e8efe0"), 0.85); rrect(ctx, 250, 330, 54, GY - 330, 6); ctx.fill()
    src(ctx, hx("#38506f"))
    for i in range(0, 22):
        y = GY - 10 - i * 22
        L = 26 if i % 5 == 0 else 13
        ctx.rectangle(254, y, L, 2.5); ctx.fill()
    # pencil marks that barely move
    mark = GY - 205 - 6 * ss(u / D)
    src(ctx, hx("#79b6ef")); ctx.rectangle(244, mark, 66, 4); ctx.fill()
    src(ctx, hx("#79b6ef"), 0.45); ctx.rectangle(244, mark + 9, 66, 3); ctx.fill()
    # shelf with a small medicine bottle and box
    src(ctx, hx("#0f1d33")); ctx.rectangle(470, 560, 160, 8); ctx.fill()
    src(ctx, hx("#d9e6f7"), 0.9); rrect(ctx, 500, 518, 24, 42, 5); ctx.fill()
    src(ctx, hx("#79b6ef")); ctx.rectangle(500, 512, 24, 9); ctx.fill()
    src(ctx, hx("#9fb6d6"), 0.9); ctx.rectangle(545, 528, 46, 32); ctx.fill()
    # floor
    vgrad(ctx, -40, GY, PW + 80, H - GY + 40, [(0, hx("#101e36")), (1, hx("#08101e"))])
    # dust in the beam
    r = random.Random(4)
    for i in range(36):
        x = r.uniform(330, 760) + 10 * math.sin(t * 0.4 + i)
        y = (r.uniform(480, 900) - t * 8 * r.uniform(0.3, 1)) % 440 + 470
        src(ctx, hx("#dbe9ff"), 0.35 * r.random()); ctx.arc(x, y, r.uniform(1, 2.2), 0, TAU); ctx.fill()
    figure(ctx, 380, GY, 200, BLUE_SHIRT, NAVY, stripes=BLUE_STRIPE, facing=-1, mode="idle", phase=t * 1.5)
    ctx.restore()


def scene_R3(ctx, u, D, t):
    vgrad(ctx, 0, 0, PW, 620, [(0, hx("#5d3a66")), (0.55, hx("#e0835e")), (1, hx("#ffd18e"))])
    glow(ctx, 760, 600, 320, hx("#ffd690"), 0.5)
    vgrad(ctx, 0, 600, PW, 80, [(0, hx("#d98a6a")), (1, hx("#3e6b88"))])
    # birds
    for i in range(4):
        bx = (200 + i * 70 + t * 30) % 1100 - 70; byy = 220 + 25 * i + 6 * math.sin(t * 2 + i)
        flap = 8 * math.sin(t * 7 + i)
        src(ctx, hx("#40223a"), 0.7); ctx.set_line_width(3)
        ctx.move_to(bx - 14, byy - flap); ctx.line_to(bx, byy); ctx.line_to(bx + 14, byy - flap); ctx.stroke()
    hill(ctx, PW, 690, 40, hx("#9a5048"), off=u * 4, seed=1.0)
    VILLAGE2.draw(ctx, u * 4, hx("#f3e3cf"), hx("#c8553b"), hx("#ffd27a"), 0.5, 0.8)
    # home on the hill (left), lit window
    hill(ctx, PW, 760, 80, hx("#6e3533"), off=-200, seed=2.0)
    src(ctx, hx("#f5ead9")); ctx.rectangle(80, 610, 130, 90); ctx.fill()
    src(ctx, hx("#c4553a")); poly(ctx, [(68, 614), (145, 565), (222, 614)]); ctx.fill()
    src(ctx, hx("#ffd27a")); ctx.rectangle(160, 640, 30, 32); ctx.fill()
    glow(ctx, 175, 656, 70, hx("#ffd27a"), 0.4)
    # the road leaving home
    road = [(120, 700), (420, 690), (560, 820), (1000, 900)]
    def bez(q):
        return ((1 - q) ** 3 * road[0][0] + 3 * (1 - q) ** 2 * q * road[1][0] + 3 * (1 - q) * q * q * road[2][0] + q ** 3 * road[3][0],
                (1 - q) ** 3 * road[0][1] + 3 * (1 - q) ** 2 * q * road[1][1] + 3 * (1 - q) * q * q * road[2][1] + q ** 3 * road[3][1])
    for extra, col in ((8, hx("#5a2c27")), (0, hx("#c98a5e"))):
        L, R = [], []
        for i in range(41):
            q = i / 40
            x0, y0 = bez(q); x1, y1 = bez(min(1, q + 0.01) if q < 1 else q); 
            if q >= 1: x1, y1 = x0 + (x0 - bez(0.99)[0]), y0 + (y0 - bez(0.99)[1])
            dx, dy = x1 - x0, y1 - y0; n = math.hypot(dx, dy) or 1
            wv = (10 + 70 * q ** 1.3) + extra
            L.append((x0 - dy / n * wv, y0 + dx / n * wv)); R.append((x0 + dy / n * wv, y0 - dx / n * wv))
        poly(ctx, L + R[::-1]); src(ctx, col); ctx.fill()
    ground_street(ctx, PW, 930, hx("#3e1f1b"), hx("#1e0f0c"))
    # boy walks down the road with a bag
    p = ss(clamp((u - 0.4) / (D - 0.6))) * 0.85 + 0.05
    q = p
    bx = (1 - q) ** 3 * road[0][0] + 3 * (1 - q) ** 2 * q * road[1][0] + 3 * (1 - q) * q * q * road[2][0] + q ** 3 * road[3][0]
    byy = (1 - q) ** 3 * road[0][1] + 3 * (1 - q) ** 2 * q * road[1][1] + 3 * (1 - q) * q * q * road[2][1] + q ** 3 * road[3][1]
    hgt = lerp(120, 190, q)
    figure(ctx, bx, byy + 6, hgt, RED_SHIRT, DARK_GREEN, facing=1, mode="walk", phase=u * 6.5, bag=hx("#2f5d46"))


def scene_L4(ctx, u, D, t):
    vgrad(ctx, 0, 0, PW, 720, [(0, hx("#0a1530")), (0.6, hx("#1f3d6b")), (1, hx("#5b86b5"))])
    stars(ctx, PW, 500, t, seed=21, n=80, a=0.7)
    for i, (cx, cy, s) in enumerate(((150, 230, 40), (520, 160, 55), (820, 300, 45), (330, 420, 35))):
        cloud(ctx, (cx - u * (6 + 4 * i)) % (PW + 300) - 150, cy, s, hx("#9ab6d8"), 0.18)
    p0, p1 = EV.plane_L
    if p0 <= t <= p1 + 0.5:
        p = (t - p0) / (p1 - p0)
        x = -160 + 1300 * p; y = 360 - 150 * p
        # contrail
        g = cairo.LinearGradient(x - 420, y + 60, x, y)
        g.add_color_stop_rgba(0, 1, 1, 1, 0); g.add_color_stop_rgba(1, 1, 1, 1, 0.35)
        ctx.set_source(g); ctx.set_line_width(3); ctx.move_to(x - 420, y + 64); ctx.line_to(x - 40, y + 6); ctx.stroke()
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.13)
        src(ctx, hx("#0b1324"))
        ctx.save(); ctx.scale(70, 11); ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.fill()
        poly(ctx, [(-10, 0), (16, 0), (-22, 46), (-36, 46)]); ctx.fill()
        poly(ctx, [(-10, 0), (16, 0), (-14, -30), (-26, -30)]); ctx.fill()
        poly(ctx, [(-58, -2), (-46, -2), (-66, -30), (-74, -30)]); ctx.fill()
        if (t * 1.5) % 1 < 0.25:
            glow(ctx, -20, 40, 14, hx("#ff6a6a"), 0.9)
        ctx.restore()
    vgrad(ctx, 0, 700, PW, H - 700, [(0, hx("#132443")), (1, hx("#08101f"))])
    for i in range(12):   # runway lights in perspective
        x = 40 + i * 82; y = 742 + i * 1.2
        on = 0.4 + 0.6 * (((t * 3 - i * 0.25) % 3) < 0.4)
        glow(ctx, x, y, 14, hx("#9fd0ff"), 0.6 * on)
    # father and son, walking right with a suitcase
    sil = hx("#0a1222")
    px = 250 + 210 * ss(u / D)
    ph = u * 5.6
    figure(ctx, px, GY, 330, sil, sil, silhouette=sil, adult=True, facing=1, mode="walk", phase=ph, rim=hx("#9fcfff"), rim_dx=-3)
    src(ctx, sil); rrect(ctx, px + 46, GY - 104, 62, 92, 8); ctx.fill()
    src(ctx, hx("#9fcfff"), 0.8); ctx.set_line_width(2); rrect(ctx, px + 46, GY - 104, 62, 92, 8); ctx.stroke()
    src(ctx, sil); ctx.set_line_width(4); ctx.move_to(px + 40, GY - 150); ctx.line_to(px + 77, GY - 104); ctx.stroke()
    figure(ctx, px - 80, GY, 205, sil, sil, silhouette=sil, facing=1, mode="walk", phase=ph + 1.2, rim=hx("#9fcfff"), rim_dx=-3)


def ecg_value(tt, beats):
    v = np.zeros_like(tt)
    for b in beats:
        d = tt - b
        v += 0.12 * np.exp(-((d + 0.16) / 0.025) ** 2)       # P
        v -= 0.15 * np.exp(-((d - 0.0) / 0.008) ** 2)
        v += 1.0 * np.exp(-((d - 0.02) / 0.011) ** 2)        # R
        v -= 0.3 * np.exp(-((d - 0.045) / 0.01) ** 2)        # S
        v += 0.22 * np.exp(-((d - 0.24) / 0.045) ** 2)       # T
    return v


def scene_R4_room(ctx, u, D, t):
    vgrad(ctx, 0, 0, PW, H, [(0, hx("#2b1418")), (1, hx("#1a0c0f"))])
    vgrad(ctx, 640, 150, 230, 260, [(0, hx("#f08a4e")), (1, hx("#ffcf8f"))])
    src(ctx, hx("#140809")); ctx.set_line_width(10); ctx.rectangle(640, 150, 230, 260); ctx.stroke()
    ctx.set_line_width(6); ctx.move_to(755, 150); ctx.line_to(755, 410); ctx.stroke()
    glow(ctx, 755, 280, 420, hx("#ff9a5c"), 0.18)
    # monitor grid
    src(ctx, hx("#ff8a5c"), 0.08); ctx.set_line_width(1)
    for gx in range(60, 920, 40):
        ctx.move_to(gx, 380); ctx.line_to(gx, 640); ctx.stroke()
    for gy in range(380, 641, 40):
        ctx.move_to(60, gy); ctx.line_to(900, gy); ctx.stroke()
    xs = np.arange(60, 900, 3, dtype=np.float64)
    speed = 260.0
    tt = t - (900 - xs) / speed
    beats = [b for b in EV.heart_R if b < t + 0.5]
    v = ecg_value(tt, beats[-12:]) if beats else np.zeros_like(xs)
    ys = 540 - v * 130
    for wdt, a in ((14, 0.12), (7, 0.25), (3, 1.0)):
        src(ctx, hx("#ff9a6a"), a); ctx.set_line_width(wdt); ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.move_to(xs[0], ys[0])
        for x, y in zip(xs[1:], ys[1:]): ctx.line_to(x, y)
        ctx.stroke()
    glow(ctx, xs[-1], ys[-1], 30, hx("#ffd0b0"), 0.9)
    # heart symbol pulses on each beat
    last = max([b for b in EV.heart_R if b <= t], default=-9)
    pulse = 1 + 0.25 * math.exp(-(t - last) / 0.12)
    ctx.save(); ctx.translate(120, 250); ctx.scale(pulse, pulse)
    src(ctx, hx("#ff7a5c"), 0.9)
    ctx.arc(-14, -6, 17, 0, TAU); ctx.arc(14, -6, 17, 0, TAU); ctx.fill()
    poly(ctx, [(-30, 0), (30, 0), (0, 34)]); ctx.fill()
    ctx.restore()
    vgrad(ctx, 0, GY, PW, H - GY, [(0, hx("#1d0d10")), (1, hx("#0e0607"))])
    src(ctx, hx("#3a1d20")); rrect(ctx, 260, 700, 600, 70, 14); ctx.fill()              # bed
    src(ctx, hx("#5a3034")); rrect(ctx, 270, 684, 470, 40, 16); ctx.fill()               # blanket
    src(ctx, hx("#e9cdb8"), 0.85); rrect(ctx, 750, 676, 96, 42, 16); ctx.fill()          # pillow
    src(ctx, hx("#24100f")); ctx.rectangle(280, 770, 14, 50); ctx.rectangle(826, 770, 14, 50); ctx.fill()
    glow(ctx, 560, 700, 380, hx("#ff9a5c"), 0.08)


def scene_R4_pitch(ctx, u, D, t):
    v = t - EV.pitch_R_start
    vgrad(ctx, 0, 0, PW, 600, [(0, hx("#e57f55")), (0.7, hx("#ffb46f")), (1, hx("#ffd79a"))])
    glow(ctx, 820, 560, 300, hx("#fff0c0"), 0.5)
    # small local stand and trees
    for i in range(12):
        cloud(ctx, 40 + i * 85, 590, 34 + 8 * math.sin(i * 2.1), hx("#5a3b2a"), 1.0)
    src(ctx, hx("#4a2c24")); ctx.rectangle(500, 560, 300, 70); ctx.fill()
    for j in range(3):
        src(ctx, hx("#7a4a36")); ctx.rectangle(505, 570 + j * 20, 290, 6); ctx.fill()
    # pitch
    vgrad(ctx, 0, 620, PW, H - 620, [(0, hx("#5c8a43")), (1, hx("#2f5b2c"))])
    for i in range(8):
        y0 = 620 + (i / 8) ** 1.5 * 460; y1 = 620 + ((i + 0.5) / 8) ** 1.5 * 460
        src(ctx, hx("#ffffff"), 0.04); ctx.rectangle(0, y0, PW, y1 - y0); ctx.fill()
    src(ctx, hx("#f4f4ea"), 0.8); ctx.set_line_width(5)
    ctx.move_to(0, 680); ctx.line_to(PW, 680); ctx.stroke()
    # boy runs back onto the pitch, ball rolling ahead
    p = clamp(v / 4.0)
    bx = lerp(120, 560, p)
    figure(ctx, bx, GY, 210, RED_SHIRT, DARK_GREEN, facing=1, mode="run", phase=v * 11)
    ball(ctx, bx + 80 + 8 * math.sin(v * 5.5), GY - 13, 13, v * 9, shadow_y=GY + 2, light=(1, 0.95, 0.85))


def scene_R4(ctx, u, D, t):
    a = ss((t - EV.pitch_R_start + 0.4) / 0.8)
    if a < 1:
        scene_R4_room(ctx, u, D, t)
    if a > 0:
        ctx.push_group(); scene_R4_pitch(ctx, u, D, t); ctx.pop_group_to_source(); ctx.paint_with_alpha(a)


SCENES = {"b1": (scene_L1, scene_R1), "b2": (scene_L2, scene_R2), "b3": (scene_L3, scene_R3), "b4": (scene_L4, scene_R4)}


def draw_split(ctx, sec, t):
    s, e = EV.S[sec]
    u, D = t - s, e - s
    f = EV.focus(t)
    for side, x0 in (("L", 0), ("R", PW)):
        ctx.save(); ctx.rectangle(x0, 0, PW, H); ctx.clip(); ctx.translate(x0, 0)
        SCENES[sec][0 if side == "L" else 1](ctx, u, D, t)
        dim = 0.32 * ((1 - f) if side == "L" else f)
        src(ctx, (0.02, 0.03, 0.06), dim); ctx.rectangle(0, 0, PW, H); ctx.fill()
        ctx.restore()
    divider(ctx, 1.0)


def divider(ctx, a):
    if a <= 0: return
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgba(0, 1, 1, 1, 0.0); g.add_color_stop_rgba(0.12, 1, 1, 1, 0.9 * a)
    g.add_color_stop_rgba(0.88, 1, 1, 1, 0.9 * a); g.add_color_stop_rgba(1, 1, 1, 1, 0.0)
    ctx.rectangle(PW - 2, 0, 4, H); ctx.set_source(g); ctx.fill()
    ctx.save(); ctx.set_operator(cairo.OPERATOR_ADD)
    g = cairo.LinearGradient(PW - 30, 0, PW + 30, 0)
    g.add_color_stop_rgba(0, 1, 1, 1, 0); g.add_color_stop_rgba(0.5, 1, 0.95, 0.9, 0.12 * a); g.add_color_stop_rgba(1, 1, 1, 1, 0)
    ctx.rectangle(PW - 30, 0, 60, H); ctx.set_source(g); ctx.fill(); ctx.restore()


# =================================================================== full-frame scenes
def scene_title(ctx, t):
    vgrad(ctx, 0, 0, W, H, [(0, hx("#070b18")), (0.6, hx("#0f1428")), (1, hx("#1a1222"))])
    glow(ctx, 380, 380, 900, hx("#2d5d9c"), 0.28)
    glow(ctx, 1560, 700, 900, hx("#c0662f"), 0.22)
    stars(ctx, W, 560, t, seed=2, n=110, a=0.45)
    hz = 650
    # two roads converging on the horizon
    a = ss((t - 0.3) / 1.5)
    for (x0, c) in ((-200, hx("#6fa8e6")), (2120, hx("#f2a25f"))):
        g = cairo.LinearGradient(x0, H, 960, hz)
        g.add_color_stop_rgba(0, c[0], c[1], c[2], 0.0); g.add_color_stop_rgba(1, c[0], c[1], c[2], 0.55 * a)
        ctx.set_source(g); ctx.set_line_width(3)
        ctx.move_to(x0, H); ctx.curve_to(x0 * 0.6 + 380, 900, 960 + (x0 - 960) * 0.25, 720, 960, hz); ctx.stroke()
    g = cairo.LinearGradient(0, 0, W, 0)
    g.add_color_stop_rgba(0, 0.43, 0.66, 0.9, 0.0); g.add_color_stop_rgba(0.5, 1, 1, 1, 0.35 * a); g.add_color_stop_rgba(1, 0.95, 0.63, 0.37, 0.0)
    ctx.set_source(g); ctx.rectangle(0, hz, W, 2); ctx.fill()
    # rolling football
    r0, r1 = EV.roll
    if r0 - 0.1 <= t <= r1 + 0.2:
        p = clamp((t - r0) / (r1 - r0))
        x = -90 + 2100 * (0.22 * ss(p) + 0.78 * p)
        ball(ctx, x, hz - 30, 30, x / 30, shadow_y=hz + 4, light=(0.95, 0.95, 1))
    # underline: blue to the left, orange to the right
    L = 330 * ss((t - 1.6) / 1.4) * (1 - ss((t - 7.2) / 0.6))
    if L > 1:
        for sgn, c in ((-1, hx("#6fa8e6")), (1, hx("#f2a25f"))):
            src(ctx, c, 0.95); ctx.rectangle(960 if sgn > 0 else 960 - L, 492, L, 4); ctx.fill()


def drift_bg_left(ctx, shift, u, t):
    ctx.save(); ctx.translate(shift, 0)
    vgrad(ctx, -600, 0, W + 1200, 700, [(0, hx("#0c1b36")), (0.6, hx("#294f84")), (1, hx("#8fb4dc"))])
    stars(ctx, 1400, 400, t, seed=11, n=70, a=0.5)
    SKY_FAR.draw(ctx, 640, hx("#33598a"), 300 + u * 8, hx("#ffd98f"), 0.25, t)
    SKY_MID.draw(ctx, 712, hx("#1c3961"), 300 + u * 16, hx("#ffcf7a"), 0.5, t)
    ctx.restore()


def drift_bg_right(ctx, shift, u, t):
    ctx.save(); ctx.translate(-shift, 0)
    vgrad(ctx, -600, 0, W + 1200, 600, [(0, hx("#3a1f48")), (0.5, hx("#c25a58")), (0.85, hx("#f09550")), (1, hx("#ffcf8f"))])
    glow(ctx, 1500, 560, 380, hx("#ffcf7a"), 0.4)
    vgrad(ctx, -600, 580, W + 1200, 200, [(0, hx("#c46a54")), (0.3, hx("#4a6a86")), (1, hx("#1d4560"))])
    ctx.move_to(-600, 900)
    for x in range(-600, W + 620, 12):
        ctx.line_to(x, 700 - 120 * ss((x - 700) / 1400) - 14 * math.sin(x * 0.02))
    ctx.line_to(W + 620, 900); ctx.close_path(); src(ctx, hx("#7b3b40")); ctx.fill()
    ctx.restore()


def stadium(ctx, rise, lit, t, tint=1.0, flash=True, top=300):
    """stands + four light towers; rise in px (0 = in place), lit 0..1 per tower list."""
    top_y = top
    ctx.save(); ctx.translate(0, rise)
    towers = (180, 640, 1280, 1740)
    for i, x in enumerate(towers):
        top = top_y + (40 if i in (1, 2) else 0)
        src(ctx, hx("#0b0f1c")); ctx.set_line_width(10)
        ctx.move_to(x, 640); ctx.line_to(x, top + 40); ctx.stroke()
        rrect(ctx, x - 70, top - 10, 140, 56, 6); ctx.fill()
        on = lit[i]
        for k in range(4):
            for j in range(2):
                src(ctx, hx("#ffe9b0"), 0.25); ctx.rectangle(x - 62 + k * 32, top - 4 + j * 24, 26, 18); ctx.fill()
        if on > 0:
            for k in range(4):
                for j in range(2):
                    src(ctx, hx("#fffbe8"), on); ctx.rectangle(x - 62 + k * 32, top - 4 + j * 24, 26, 18); ctx.fill()
            glow(ctx, x, top + 18, 460, hx("#fff6d8"), 0.36 * on, cairo.OPERATOR_ADD)
            glow(ctx, x, top + 18, 120, hx("#ffffff"), 0.8 * on, cairo.OPERATOR_ADD)
            # beam
            ctx.save(); ctx.set_operator(cairo.OPERATOR_ADD)
            g = cairo.LinearGradient(x, top, 960, 900)
            g.add_color_stop_rgba(0, 1, 0.97, 0.88, 0.10 * on); g.add_color_stop_rgba(1, 1, 0.97, 0.88, 0.0)
            poly(ctx, [(x - 60, top + 30), (x + 60, top + 30), (960 + (x - 960) * 0.2 + 300, 980), (960 + (x - 960) * 0.2 - 300, 980)])
            ctx.set_source(g); ctx.fill(); ctx.restore()
    # stands (bowl)
    ctx.move_to(-20, 700)
    ctx.line_to(-20, 380); ctx.curve_to(500, 470, 1420, 470, W + 20, 380); ctx.line_to(W + 20, 700); ctx.close_path()
    src(ctx, hx("#10142a")); ctx.fill()
    for k in range(5):   # tiers
        yk = 470 + k * 42
        src(ctx, hx("#1b2142"), 0.9); ctx.set_line_width(3)
        ctx.move_to(-20, yk - 70 + k * 8); ctx.curve_to(500, yk + 10, 1420, yk + 10, W + 20, yk - 70 + k * 8); ctx.stroke()
    r = random.Random(77)
    for i in range(520):   # crowd specks
        x = r.uniform(0, W)
        ytop = 380 + 90 * (1 - ((x - 960) / 960) ** 2)
        y = r.uniform(ytop + 10, 660)
        c = r.choice([hx("#8ec5ff"), hx("#ffb36b"), hx("#e8e8f0"), hx("#ff7a7a")])
        tw = 0.5 + 0.5 * math.sin(t * r.uniform(2, 6) + i)
        src(ctx, c, 0.25 * tint * tw + 0.08); ctx.arc(x, y, r.uniform(1.5, 2.8), 0, TAU); ctx.fill()
    if flash:
        rr = random.Random(int(t * 12))
        for i in range(int(6 * tint)):
            x = rr.uniform(0, W); y = rr.uniform(430, 650)
            glow(ctx, x, y, 14, hx("#ffffff"), 0.9, cairo.OPERATOR_ADD)
    ctx.restore()


def scene_drift(ctx, t):
    s, e = EV.S["drift"]
    u, D = t - s, e - s
    shift = 480 * ss(u / (D * 0.85))
    # background: two worlds sliding together, seam widening into a blend
    drift_bg_right(ctx, shift, u, t)
    wseam = 4 + 1600 * ss((u - 1.0) / (D * 0.6))
    ctx.push_group(); drift_bg_left(ctx, shift, u, t); ctx.pop_group_to_source()
    m = cairo.LinearGradient(960 - wseam / 2, 0, 960 + wseam / 2, 0)
    m.add_color_stop_rgba(0, 0, 0, 0, 1); m.add_color_stop_rgba(1, 0, 0, 0, 0)
    ctx.mask(m)
    # night falls over both as the stadium rises
    src(ctx, hx("#050816"), 0.55 * ss((u - 3) / 8)); ctx.rectangle(0, 0, W, H); ctx.fill()
    rise = 760 * (1 - ss((u - 1.0) / 6.5))
    lit = [ss((t - lt) / 0.25) for lt in EV.lights_on]
    ctx.push_group(); stadium(ctx, rise, lit, t, tint=ss((u - 6) / 4), flash=u > 8, top=330)
    ctx.pop_group_to_source(); ctx.paint_with_alpha(ss((u - 1.5) / 3.5))
    # ground: streets turning into grass
    gcol = mixc(hx("#1a2335"), hx("#2c5a33"), ss((u - 4) / 7))
    vgrad(ctx, 0, 760, W, H - 760, [(0, gcol), (1, hx("#0b120f"))])
    src(ctx, hx("#f4f4ea"), 0.5 * ss((u - 6) / 5)); ctx.set_line_width(4); ctx.move_to(0, 800); ctx.line_to(W, 800); ctx.stroke()
    # divider dissolving into particles
    da = 1 - ss((u - 1.0) / 5.0)
    divider(ctx, da)
    r = random.Random(13)
    for i in range(110):
        y0 = r.uniform(0, H); sp = r.uniform(30, 90); st = r.uniform(1.0, 6.0)
        if u < st: continue
        k = u - st
        a = max(0.0, 1 - k / 2.5)
        if a <= 0: continue
        x = 960 + r.choice([-1, 1]) * k * r.uniform(10, 50); y = y0 - k * sp
        src(ctx, (1, 0.96, 0.9), 0.8 * a); ctx.arc(x, y, r.uniform(1.2, 3), 0, TAU); ctx.fill()
    # the boys grow as they run toward each other
    g = ss(u / D)
    hL = lerp(215, 400, g); hR = lerp(220, 406, g)
    xL = lerp(250, 862, ss(u / D)); xR = lerp(1670, 1058, ss(u / D))
    yf = lerp(860, 834, g)
    stop = ss((u - (D - 3.2)) / 2.6)          # ease from running to standing
    amt = 1 - stop
    br = 13 + 0.006 * hL
    bxL = lerp(xL + hL * 0.33, 960, stop); bxR = lerp(xR - hR * 0.33, 960, stop)
    figure(ctx, xL, yf, hL, BLUE_SHIRT, NAVY, stripes=BLUE_STRIPE, facing=1, mode="run", amt=amt, phase=u * 10, rim=COOL, rim_dx=-2 * g)
    figure(ctx, xR, yf, hR, RED_SHIRT, DARK_GREEN, facing=-1, mode="run", amt=amt, phase=u * 10 + 1.5, rim=WARM, rim_dx=2 * g)
    ball(ctx, bxR, yf - br, br, -u * 10 * amt, shadow_y=yf + 2, light=(1, 0.95, 0.85), alpha=1 - 0.999 * ss((stop - 0.85) / 0.15))
    ball(ctx, bxL, yf - br, br, u * 10 * amt, shadow_y=yf + 2)


def scene_final(ctx, t):
    s, e = EV.S["final"]
    u, D = t - s, e - s
    z = 1 + 0.07 * ss(u / D)
    ctx.save(); ctx.translate(960, 620); ctx.scale(z, z); ctx.translate(-960, -620)
    vgrad(ctx, -200, -200, W + 400, 900, [(0, hx("#04070f")), (0.45, hx("#0d1534")), (0.8, hx("#2a2246")), (1, hx("#4a2c3a"))])
    glow(ctx, 260, 520, 900, hx("#2d6bb0"), 0.30)
    glow(ctx, 1660, 520, 900, hx("#d0702f"), 0.26)
    stars(ctx, W, 300, t, seed=5, n=70, a=0.4)
    stadium(ctx, 0, [1, 1, 1, 1], t, tint=1.0, flash=True, top=330)
    # pitch
    vgrad(ctx, -300, 640, W + 600, H - 640 + 300, [(0, hx("#3f7a45")), (1, hx("#1d3f22"))])
    ys = [640 + (i / 10) ** 1.6 * 520 for i in range(11)]
    for i in range(10):
        if i % 2 == 0:
            src(ctx, hx("#ffffff"), 0.045); ctx.rectangle(-300, ys[i], W + 600, ys[i + 1] - ys[i]); ctx.fill()
    src(ctx, hx("#f4f4ea"), 0.75); ctx.set_line_width(4)
    ctx.move_to(-300, 660); ctx.line_to(W + 300, 660); ctx.stroke()
    ctx.move_to(960, 660); ctx.line_to(960, H + 200); ctx.stroke()
    ctx.save(); ctx.translate(960, 830); ctx.scale(380, 95); ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.stroke()
    src(ctx, hx("#f4f4ea"), 0.9); ctx.save(); ctx.translate(960, 830); ctx.scale(10, 3.5); ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.fill()
    # light haze
    glow(ctx, 960, 300, 1100, hx("#fff2d8"), 0.10, cairo.OPERATOR_ADD)
    # two players, one pitch
    sil = hx("#0a0c16")
    for x, c, f, dx, ph in ((862, COOL, 1, -5, 0.0), (1058, WARM, -1, 5, 1.3)):
        glow(ctx, x, 560, 260, c, 0.18, cairo.OPERATOR_ADD)
        ctx.save(); ctx.translate(x, 832); ctx.scale(70, 12); ctx.arc(0, 0, 1, 0, TAU); ctx.restore()
        src(ctx, (0, 0, 0), 0.35); ctx.fill()
        figure(ctx, x, 834, 420, sil, sil, silhouette=sil, adult=True, facing=f, mode="idle", phase=t * 1.6 + ph, rim=c, rim_dx=dx)
    ball(ctx, 960, 830 - 15, 15, 0.3, shadow_y=832, light=(0.9, 0.9, 0.95))
    ctx.restore()
    # fade to black at the very end
    fo = ss((t - (EV.total - 2.2)) / 2.2)
    if fo > 0:
        src(ctx, (0, 0, 0), fo); ctx.rectangle(0, 0, W, H); ctx.fill()


# =================================================================== frame assembly
SKY_FAR = SKY_MID = VILLAGE = VILLAGE2 = None
GRAIN = None
VIG = None


def init_worker():
    global SKY_FAR, SKY_MID, VILLAGE, VILLAGE2, GRAIN, VIG
    SKY_FAR = Skyline(1, 2400, 60, 170, 40, 90)
    SKY_MID = Skyline(2, 2400, 50, 150, 60, 130)
    v = Village.__new__(Village)
    r = random.Random(3); v.h = []
    for _ in range(80):
        x = r.uniform(250, 1300); y = madeira_hill(x) + r.uniform(12, 170)
        v.h.append((x, y, r.uniform(0.7, 1.2), r.random()))
    v.h.sort(key=lambda a: a[1]); VILLAGE = v
    VILLAGE2 = Village(4, 1300, 690, 40, 1.0, n=40, depth=60)
    rng = np.random.default_rng(1)
    GRAIN = [rng.normal(0, 5.5, (H // 2, W // 2)).astype(np.float32) for _ in range(6)]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    VIG = (1 - 0.30 * np.clip(d - 0.45, 0, 1) ** 1.5).astype(np.float32)[..., None]


BLEND = {"b1": 0.5, "final": 0.9}


def draw_section(ctx, sec, t):
    if sec == "title":
        scene_title(ctx, t)
    elif sec in SCENES:
        draw_split(ctx, sec, t)
    elif sec == "drift":
        scene_drift(ctx, t)
    else:
        scene_final(ctx, t)


ORDER = ["title", "b1", "b2", "b3", "b4", "drift", "final"]


def draw_frame(ctx, t):
    sec, u, D = EV.section(t)
    i = ORDER.index(sec)
    # cross-dissolve around each boundary
    for j in range(1, len(ORDER)):
        B = EV.S[ORDER[j]][0]; hw = BLEND.get(ORDER[j], 0.35)
        if abs(t - B) < hw:
            a = ss((t - B + hw) / (2 * hw))
            draw_section(ctx, ORDER[j - 1], t)
            ctx.push_group(); draw_section(ctx, ORDER[j], t); ctx.pop_group_to_source(); ctx.paint_with_alpha(a)
            return
    draw_section(ctx, sec, t)


def overlay_text(fr, t):
    sec, u, D = EV.section(t)
    # ---- title card
    if t < 8.6:
        a = ss((t - 0.9) / 1.2) * (1 - ss((t - 7.0) / 0.9))
        comp(fr, text_layer("title", ["TWO ROADS"], F_TITLE, spacing=22, shadow_blur=12), 960, 400 - 12 * a, a)
        a2 = ss((t - 3.3) / 1.0) * (1 - ss((t - 7.0) / 0.9))
        comp(fr, text_layer("credit", ["by BreezeOg"], F_CREDIT, color=(225, 228, 240), spacing=3), 960, 1012, a2 * 0.9)
    # ---- split-screen labels
    for b in ("b1", "b2", "b3", "b4"):
        s, e = EV.S[b]
        if s - 0.4 <= t <= e + 0.4:
            a = ss((t - s - 0.15) / 0.5) * (1 - ss((t - e + 0.35) / 0.35))
            if a <= 0: continue
            chap, l, r = LABELS[b]
            lay = text_layer("chap" + b, [chap], F_CHAP, spacing=4, shadow_alpha=0.0, pad=22)
            # pill behind chapter
            rgb, al, tw, th, pad = lay
            pw, ph = tw - 2 * pad + 44, 46
            x0, y0 = 960 - pw // 2, 46 - ph // 2 + 4
            reg = fr[y0:y0 + ph, x0:x0 + pw]; reg *= (1 - 0.6 * a)
            comp(fr, lay, 960, 54, a)
            f = EV.focus(t)
            for xx, txt in ((0, l), (PW, r)):
                lw = int(text_layer(("L" if xx == 0 else "R") + b, [txt], F_LABEL, spacing=3)[2]) - 60 + 40
                reg = fr[100:141, xx + 30:xx + 30 + lw]; reg *= (1 - 0.5 * a)
            comp(fr, text_layer("L" + b, [l], F_LABEL, color=(238, 244, 255), spacing=3), 56, 120, a * (0.65 + 0.35 * f), anchor="left")
            comp(fr, text_layer("R" + b, [r], F_LABEL, color=(255, 240, 225), spacing=3), PW + 56, 120, a * (0.65 + 0.35 * (1 - f)), anchor="left")
            # small colour bars before labels
            fr[108:132, 40:44] = fr[108:132, 40:44] * (1 - a) + np.array([230, 190, 120], np.float32) * a
            fr[108:132, PW + 40:PW + 44] = fr[108:132, PW + 40:PW + 44] * (1 - a) + np.array([100, 170, 245], np.float32) * a
    # ---- captions
    for c in EV.tl["cues"]:
        if c["line"] == "f1":
            continue   # shown as the closing title itself
        if c["start"] - 0.15 <= t <= c["end"] + 0.15:
            a = ss((t - c["start"] + 0.15) / 0.25) * (1 - ss((t - c["end"]) / 0.15))
            if a <= 0: continue
            split = c["section"] in SCENES
            cx = {"L": PW / 2, "R": PW + PW / 2}.get(c["side"], 960) if split else 960
            maxw = 860 if split else 1400
            lines = wrap(c["text"], F_CAP, maxw)
            lay = text_layer("cap" + c["text"], lines, F_CAP, shadow_blur=8, shadow_alpha=0.9)
            cy = CAP_Y - (0 if len(lines) > 1 else 0) + (len(lines) - 2) * 0  # block centre
            if len(lines) == 1:
                cy = CAP_Y + 20
            if c["section"] == "title":
                cy = 860
            # soft scrim under the caption half
            xa, xb = (0, PW) if (split and c["side"] == "L") else ((PW, W) if (split and c["side"] == "R") else (0, W))
            fr[:, xa:xb] *= (1 - 0.45 * a * SCRIM[:, None, None])
            comp(fr, lay, cx, cy, a)
    # ---- closing titles
    if sec == "final" or t > EV.S["final"][0]:
        fo = 1 - ss((t - (EV.total - 2.2)) / 2.2)
        a = ss((t - EV.end_title + 0.1) / 0.9) * fo
        fr[:420] *= (1 - 0.35 * a * np.linspace(1, 0, 420, dtype=np.float32)[:, None, None])
        comp(fr, text_layer("end", ["Same game. Different roads."], F_END, shadow_blur=14), 960, 150 + 10 * (1 - a), a)
        a2 = ss((t - EV.credit) / 1.0) * fo
        comp(fr, text_layer("end2", ["Edited by BreezeOg"], F_END2, color=(235, 230, 225), spacing=4), 960, 250, a2 * 0.92)


SURF = None


def render(t):
    global SURF
    if SURF is None:
        SURF = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(SURF)
    ctx.set_source_rgb(0, 0, 0); ctx.paint()
    draw_frame(ctx, t)
    SURF.flush()
    buf = np.ndarray((H, W, 4), np.uint8, SURF.get_data())
    fr = buf[..., :3].astype(np.float32)          # BGR
    overlay_text(fr, t)
    fr *= VIG
    g = GRAIN[int(t * FPS) % len(GRAIN)]
    g = np.repeat(np.repeat(g, 2, 0), 2, 1)[..., None]
    fr += g
    if t < 0.8:
        fr *= ss(t / 0.8)
    return np.clip(fr, 0, 255).astype(np.uint8)


def render_index(i):
    return render(i / FPS).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", nargs="*", type=float)
    ap.add_argument("--out", default=os.path.join(ROOT, "build/video.mp4"))
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    a = ap.parse_args()
    if a.stills is not None:
        init_worker()
        os.makedirs(os.path.join(ROOT, "build/stills"), exist_ok=True)
        for t in a.stills:
            fr = render(t)
            Image.fromarray(fr[..., ::-1]).save(os.path.join(ROOT, f"build/stills/t{t:06.2f}.png"))
            print("still", t)
        return
    n0 = int(round(a.start * FPS)); n1 = int(round((a.end or EV.total) * FPS))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-tune", "film",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(a.workers, initializer=init_worker) as pool:
        for k, b in enumerate(pool.imap(render_index, range(n0, n1), chunksize=4)):
            p.stdin.write(b)
            if k % 150 == 0:
                el = time.time() - t0
                print(f"frame {n0 + k}/{n1}  {el:.0f}s elapsed  {(k + 1) / max(el, 1e-3):.1f} fps", flush=True)
    p.stdin.close(); p.wait()
    print("done", a.out, "%.0fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
