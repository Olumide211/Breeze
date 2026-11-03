"""Cairo drawing primitives and stylized characters for TWO ROADS."""
import math, random
import cairo

TAU = 2 * math.pi


def hx(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


def mixc(c1, c2, t):
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def ss(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def lerp(a, b, t):
    return a + (b - a) * t


def src(ctx, c, alpha=None):
    if len(c) == 3: c = (*c, 1.0)
    ctx.set_source_rgba(c[0], c[1], c[2], c[3] if alpha is None else c[3] * alpha)


def vgrad(ctx, x, y, w, h, stops):
    g = cairo.LinearGradient(0, y, 0, y + h)
    for o, c in stops:
        g.add_color_stop_rgba(o, *(c if len(c) == 4 else (*c, 1)))
    ctx.rectangle(x, y, w, h); ctx.set_source(g); ctx.fill()


def glow(ctx, x, y, r, c, a=1.0, op=cairo.OPERATOR_OVER):
    g = cairo.RadialGradient(x, y, 0, x, y, r)
    g.add_color_stop_rgba(0, c[0], c[1], c[2], a)
    g.add_color_stop_rgba(0.35, c[0], c[1], c[2], a * 0.35)
    g.add_color_stop_rgba(1, c[0], c[1], c[2], 0)
    ctx.save(); ctx.set_operator(op)
    ctx.arc(x, y, r, 0, TAU); ctx.set_source(g); ctx.fill(); ctx.restore()


def rrect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()


def poly(ctx, pts):
    ctx.move_to(*pts[0])
    for p in pts[1:]: ctx.line_to(*p)
    ctx.close_path()


def cloud(ctx, x, y, s, c, a):
    src(ctx, c, a)
    for dx, dy, r in ((0, 0, 1.0), (1.1, 0.25, 0.8), (-1.1, 0.3, 0.75), (0.5, -0.45, 0.8), (-0.5, -0.3, 0.7), (1.9, 0.45, 0.5), (-1.9, 0.5, 0.45)):
        ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill()


def stars(ctx, W, H, t, seed=3, n=90, a=0.8, c=(1, 1, 1)):
    r = random.Random(seed)
    for i in range(n):
        x, y = r.uniform(0, W), r.uniform(0, H) ** 1.3 / H ** 0.3
        tw = 0.55 + 0.45 * math.sin(t * r.uniform(1, 3) + r.uniform(0, 6))
        rad = r.uniform(0.7, 1.9)
        src(ctx, c, a * tw * r.uniform(0.4, 1)); ctx.arc(x, y, rad, 0, TAU); ctx.fill()


# ----------------------------------------------------------------- ball
def ball(ctx, x, y, r, ang, shadow_y=None, light=(1, 1, 1), alpha=1.0):
    if shadow_y is not None:
        hgt = max(0, shadow_y - y - r)
        sc = 1 / (1 + hgt / 120)
        ctx.save(); ctx.translate(x, shadow_y); ctx.scale(1.1 * r * sc, 0.28 * r * sc)
        ctx.arc(0, 0, 1, 0, TAU); ctx.restore()
        src(ctx, (0, 0, 0), 0.35 * alpha * sc); ctx.fill()
    g = cairo.RadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05)
    g.add_color_stop_rgba(0, 1, 1, 1, alpha)
    g.add_color_stop_rgba(0.7, 0.86 * light[0], 0.86 * light[1], 0.88 * light[2], alpha)
    g.add_color_stop_rgba(1, 0.55 * light[0], 0.55 * light[1], 0.6 * light[2], alpha)
    ctx.arc(x, y, r, 0, TAU); ctx.set_source(g); ctx.fill()
    # pentagon patches
    ctx.save(); ctx.arc(x, y, r, 0, TAU); ctx.clip()
    src(ctx, (0.13, 0.14, 0.18), 0.85 * alpha)
    for k in range(6):
        if k == 0:
            px, py, pr = 0, 0, 0.32
        else:
            a = ang + k * TAU / 5
            px, py, pr = math.cos(a) * 0.82, math.sin(a) * 0.82, 0.3
        pts = [(x + (px + pr * math.cos(ang + j * TAU / 5)) * r, y + (py + pr * math.sin(ang + j * TAU / 5)) * r) for j in range(5)]
        poly(ctx, pts); ctx.fill()
    ctx.restore()


def bounce_y(t, impacts, h0=300.0, g=2400.0):
    """height above ground for a ball dropped from h0 that hits the ground at
    each time in impacts (physically consistent parabolas)."""
    if not impacts or t >= impacts[-1]:
        return 0.0
    if t < impacts[0]:
        dt = impacts[0] - t
        return min(h0, 0.5 * g * dt * dt)
    for a, b in zip(impacts, impacts[1:]):
        if a <= t < b:
            T = b - a; u = t - a
            return 0.5 * g * u * (T - u)
    return 0.0


# ----------------------------------------------------------------- characters
SKIN = hx("#c89070")


def figure(ctx, x, yf, h, shirt, shorts, hair=hx("#2a1d16"), skin=SKIN, facing=1,
           mode="idle", phase=0.0, amt=1.0, kick=0.0, socks=None, shoes=hx("#1b1b22"),
           silhouette=None, rim=None, rim_dx=0.0, stripes=None, adult=False, bag=None, alpha=1.0):
    """Faceless stylized person. yf = feet y, h = total height.
    mode: idle | run | walk | kick | juggle. kick in [0,1] lifts the front leg."""
    if rim is not None:
        ctx.save(); ctx.translate(rim_dx, -abs(rim_dx) * 0.3)
        figure(ctx, x, yf, h, rim, rim, rim, rim, facing, mode, phase, amt, kick, rim, rim,
               silhouette=rim, adult=adult, bag=bag, alpha=alpha)
        ctx.restore()
    if silhouette is not None:
        shirt = shorts = hair = skin = shoes = silhouette
        socks = silhouette; stripes = None
    socks = socks or shirt
    f = facing
    r = h * (0.1 if adult else 0.125)
    leg = h * (0.48 if adult else 0.45)
    bob = 0.0
    sw = amt
    if mode == "run":
        bob = -0.025 * h * abs(math.sin(phase))
    elif mode == "walk":
        bob = -0.01 * h * abs(math.sin(phase)); sw = 0.45 * amt
    elif mode == "idle":
        sw = 0.0; bob = -0.004 * h * math.sin(phase)
    hip_y = yf - leg + bob
    sh_y = yf - h + 2 * r + 0.02 * h + bob
    head_y = yf - h + r + bob
    lean = 0.0 if mode in ("idle", "walk") else 0.06 * f * amt

    def limb(x0, y0, a1, a2, L1, L2, w, col, foot=None):
        x1 = x0 + math.sin(a1) * L1 * f; y1 = y0 + math.cos(a1) * L1
        x2 = x1 + math.sin(a2) * L2 * f; y2 = y1 + math.cos(a2) * L2
        src(ctx, col, alpha); ctx.set_line_width(w); ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.move_to(x0, y0); ctx.line_to(x1, y1); ctx.line_to(x2, y2); ctx.stroke()
        return x2, y2

    def leg_angles(p, front):
        if mode in ("run", "walk"):
            th = 0.62 * sw * math.sin(p)
            kn = 0.15 + (0.95 if mode == "run" else 0.45) * sw * max(0.0, math.sin(p - 1.4))
            return th, th - kn
        if mode in ("kick", "juggle") and front:
            th = -0.1 + 1.25 * kick if mode == "kick" else 0.05 + 0.85 * kick
            sh = th - (0.9 * (1 - kick) if mode == "kick" else 0.9 * kick)
            return th, sh
        return (0.06 if front else -0.06), (0.0 if front else -0.08)

    def arm_angles(p, front):
        if mode in ("run", "walk"):
            a = -0.7 * sw * math.sin(p)
            return a + 3.1416 * 0, a + (1.3 if mode == "run" else 0.4) * sw
        if mode in ("kick", "juggle"):
            return (-0.6 if front else 0.7) * (0.4 + kick * 0.6), (-0.2 if front else 0.9)
        return (0.12 if front else -0.1), (0.25 if front else 0.05)

    hip_x = x + lean * h * 0.15
    shx = x + lean * h * 0.35
    leg_w = h * (0.088 if not adult else 0.08)
    arm_w = h * (0.062 if not adult else 0.058)
    back_shade = 0.82 if silhouette is None else 1.0

    def shade(c, k):
        return (c[0] * k, c[1] * k, c[2] * k, c[3] if len(c) > 3 else 1)

    # back arm & leg
    a1, a2 = arm_angles(phase + math.pi, False)
    limb(shx - 0.07 * h * f, sh_y + 0.02 * h, a1, a2, 0.17 * h, 0.16 * h, arm_w, shade(skin, back_shade))
    t1, t2 = leg_angles(phase + math.pi, False)
    fx, fy = limb(hip_x - 0.025 * h * f, hip_y, t1, t2, leg * 0.5, leg * 0.5, leg_w, shade(skin, back_shade))
    src(ctx, shade(shoes, back_shade), alpha); ctx.save(); ctx.translate(fx + 0.025 * h * f, fy); ctx.scale(0.05 * h, 0.025 * h)
    ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.fill()
    # bag strap (behind torso)
    # torso
    tw = h * (0.25 if adult else 0.235)
    ctx.save(); ctx.translate(shx, sh_y); ctx.rotate(-lean * 0.5)
    rrect(ctx, -tw / 2, -0.01 * h, tw, hip_y - sh_y + 0.04 * h, 0.06 * h)
    src(ctx, shirt, alpha); ctx.fill_preserve()
    if stripes is not None:
        ctx.save(); ctx.clip()
        src(ctx, stripes, alpha)
        n = 5
        for i in range(n):
            if i % 2 == 0: continue
            ctx.rectangle(-tw / 2 + i * tw / n, -0.02 * h, tw / n, h)
            ctx.fill()
        ctx.restore()
    ctx.new_path()
    # shorts
    rrect(ctx, -tw / 2 - 0.004 * h, hip_y - sh_y - 0.03 * h, tw + 0.008 * h, 0.12 * h, 0.025 * h)
    src(ctx, shorts, alpha); ctx.fill()
    ctx.restore()
    if bag is not None:
        src(ctx, bag, alpha)
        rrect(ctx, shx - (0.17 * h) * f - 0.07 * h, hip_y - 0.12 * h, 0.15 * h, 0.13 * h, 0.03 * h); ctx.fill()
        ctx.set_line_width(0.018 * h); ctx.move_to(shx - 0.05 * h * f, sh_y + 0.01 * h)
        ctx.line_to(shx - 0.15 * h * f, hip_y - 0.11 * h); ctx.stroke()
    # front leg
    t1, t2 = leg_angles(phase, True)
    fx, fy = limb(hip_x + 0.025 * h * f, hip_y, t1, t2, leg * 0.5, leg * 0.5, leg_w, skin)
    src(ctx, shoes, alpha); ctx.save(); ctx.translate(fx + 0.025 * h * f, fy); ctx.scale(0.05 * h, 0.025 * h)
    ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.fill()
    front_foot = (fx + 0.03 * h * f, fy)
    # neck + head
    src(ctx, skin, alpha); ctx.rectangle(shx - 0.025 * h, head_y + r * 0.6, 0.05 * h, 0.05 * h); ctx.fill()
    hx_ = shx + lean * h * 0.1
    ctx.arc(hx_, head_y, r, 0, TAU); ctx.fill()
    # hair: cap over top/back of head
    src(ctx, hair, alpha)
    ctx.save(); ctx.arc(hx_, head_y, r * 1.04, 0, TAU); ctx.clip()
    ctx.arc(hx_ - 0.35 * r * f, head_y - 0.45 * r, r * 1.05, 0, TAU); ctx.fill()
    ctx.restore()
    # ear hint (simple, no face)
    if silhouette is None:
        src(ctx, shade(skin, 0.85), alpha); ctx.arc(hx_ - 0.15 * r * f, head_y + 0.1 * r, r * 0.16, 0, TAU); ctx.fill()
    # front arm
    a1, a2 = arm_angles(phase, True)
    limb(shx + 0.07 * h * f, sh_y + 0.02 * h, a1, a2, 0.17 * h, 0.16 * h, arm_w, skin)
    # sleeves
    src(ctx, shirt, alpha)
    for sx in (shx + 0.07 * h * f, shx - 0.07 * h * f):
        ctx.arc(sx, sh_y + 0.035 * h, arm_w * 0.85, 0, TAU); ctx.fill()
    return front_foot


# ----------------------------------------------------------------- scenery
class Skyline:
    """Rosario-style low-rise city silhouette (deterministic)."""
    def __init__(self, seed, width, hmin, hmax, wmin, wmax):
        r = random.Random(seed)
        self.b = []
        x = -200
        while x < width + 400:
            w = r.uniform(wmin, wmax); hh = r.uniform(hmin, hmax)
            kind = r.random()
            self.b.append((x, w, hh, kind, r.random(), [(r.random(), r.random(), r.random()) for _ in range(14)]))
            x += w + r.uniform(-4, 6)

    def draw(self, ctx, base, col, off=0.0, win=None, win_a=0.0, t=0.0):
        for x, w, hh, kind, rr, wins in self.b:
            X = x - off
            src(ctx, col)
            ctx.rectangle(X, base - hh, w, hh + 400); ctx.fill()
            if kind < 0.25:      # water tank
                ctx.rectangle(X + w * 0.3, base - hh - 22, w * 0.3, 18); ctx.fill()
                ctx.rectangle(X + w * 0.33, base - hh - 6, 3, 6); ctx.rectangle(X + w * 0.55, base - hh - 6, 3, 6); ctx.fill()
            elif kind < 0.4:     # antenna
                ctx.set_line_width(2); ctx.move_to(X + w * 0.7, base - hh); ctx.line_to(X + w * 0.7, base - hh - 30); ctx.stroke()
            elif kind < 0.55:    # pitched roof
                poly(ctx, [(X - 3, base - hh), (X + w / 2, base - hh - w * 0.28), (X + w + 3, base - hh)]); ctx.fill()
            if win is not None and win_a > 0:
                cols = max(1, int(w // 22)); rows = max(1, int(hh // 30))
                k = 0
                for i in range(cols):
                    for j in range(rows):
                        a, b_, c = wins[k % len(wins)]; k += 1
                        if a < 0.5: continue
                        flick = 0.85 + 0.15 * math.sin(t * (0.5 + c) + b_ * 9)
                        src(ctx, win, win_a * flick * (0.5 + 0.5 * b_))
                        ctx.rectangle(X + 7 + i * 22, base - hh + 10 + j * 30, 9, 13); ctx.fill()


def hill_y(x, base, amp, seed=0):
    return base - amp * (0.55 * math.sin(x * 0.0042 + seed) + 0.3 * math.sin(x * 0.011 + 2 * seed) + 0.15 * math.sin(x * 0.023 + 3 * seed))


def hill(ctx, W, base, amp, col, off=0.0, seed=0.0, bottom=1080):
    ctx.move_to(-10, bottom)
    for x in range(-10, int(W) + 20, 12):
        ctx.line_to(x, hill_y(x + off, base, amp, seed))
    ctx.line_to(W + 20, bottom); ctx.close_path(); src(ctx, col); ctx.fill()


class Village:
    """terraced white houses with orange roofs scattered on a hillside."""
    def __init__(self, seed, width, base, amp, hseed, n=70, depth=150):
        r = random.Random(seed)
        self.h = []
        for _ in range(n):
            x = r.uniform(-100, width + 300)
            y = hill_y(x, base, amp, hseed) + r.uniform(8, depth)
            s = r.uniform(0.7, 1.25)
            self.h.append((x, y, s, r.random()))
        self.h.sort(key=lambda a: a[1])
        self.base, self.amp, self.hseed = base, amp, hseed

    def draw(self, ctx, off, wall, roof, win, win_a=0.0, scale=1.0):
        for x, y, s, rr in self.h:
            X = x - off
            w, hh = 26 * s * scale, 18 * s * scale
            src(ctx, wall); ctx.rectangle(X, y - hh, w, hh); ctx.fill()
            src(ctx, roof); poly(ctx, [(X - 3, y - hh), (X + w / 2, y - hh - 9 * s * scale), (X + w + 3, y - hh)]); ctx.fill()
            if win_a > 0 and rr > 0.5:
                src(ctx, win, win_a); ctx.rectangle(X + w * 0.35, y - hh * 0.65, w * 0.25, hh * 0.35); ctx.fill()


def palm(ctx, x, y, h, col, t=0.0):
    src(ctx, col); ctx.set_line_width(h * 0.05); ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.move_to(x, y); ctx.curve_to(x + h * 0.05, y - h * 0.4, x + h * 0.12, y - h * 0.7, x + h * 0.08, y - h); ctx.stroke()
    tx, ty = x + h * 0.08, y - h
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for k in range(9):
        side = -1 if k < 4 else 1
        spread = (k - 4) / 4.0                        # -1 .. 1
        sway = 0.04 * math.sin(t * 1.3 + k)
        L = h * (0.42 + 0.08 * (1 - abs(spread)))
        up = 0.9 - 1.25 * abs(spread)                 # centre fronds rise, outer droop
        prev = (tx, ty)
        for i in range(1, 13):
            sv = i / 12
            px = tx + spread * L * sv + sway * L * sv
            py = ty - up * L * 0.55 * sv + L * 0.75 * sv * sv * (0.5 + abs(spread))
            ctx.set_line_width(max(1.5, h * 0.035 * math.sin(math.pi * (0.15 + 0.85 * sv)) * (1.2 - sv * 0.6)))
            ctx.move_to(*prev); ctx.line_to(px, py); ctx.stroke()
            prev = (px, py)
    ctx.arc(tx, ty, h * 0.025, 0, TAU); ctx.fill()


def streetlamp(ctx, x, y, h, col, light, a=1.0):
    src(ctx, col); ctx.set_line_width(6); ctx.move_to(x, y); ctx.line_to(x, y - h); ctx.line_to(x + 40, y - h - 8); ctx.stroke()
    rrect(ctx, x + 30, y - h - 8, 26, 10, 4); ctx.fill()
    glow(ctx, x + 43, y - h, 160, light, 0.35 * a)
    glow(ctx, x + 43, y - h, 40, light, 0.8 * a)
