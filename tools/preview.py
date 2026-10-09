#!/usr/bin/env python3
"""Preview renderer: draws RunDeck's screen the way RunDeckField.onUpdate
does, for any round screen size, from the same geometry and catalog
(tools/catalog.py). Garmin's simulator needs device files from a Garmin
login; this needs only Pillow, so it runs anywhere (CI, a sandbox).

Fonts: Roboto Condensed Bold at the field's pixel sizes, like the watch's
scalable fonts; --bitmap uses the shipped bitmap ladder instead (watches
without scalable fonts).

usage:
  python3 tools/preview.py                  docs/ui-preview.png (gallery)
  python3 tools/preview.py --check          every layout on every screen size:
                                            text inside its box, nothing off-screen
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402

GF = __import__("gen-fonts")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTF = os.path.join(ROOT, "tools", "fonts", "RobotoCondensed-VF.ttf")

GROUP_DARK = [0xEF4444, 0x60A5FA, 0x22C55E, 0xF59E0B, 0x2DD4BF]
GROUP_LIGHT = [0xC81E1E, 0x1D4ED8, 0x15803D, 0xB45309, 0x0F766E]
ZONE_COLORS = [0x3B82F6, 0x14B8A6, 0x22C55E, 0xF59E0B, 0xEF4444]
TARGET_DARK = {1: 0x60A5FA, 2: 0x2EE66B, 3: 0xEF4444}
TARGET_LIGHT = {1: 0x1D4ED8, 2: 0x15803D, 3: 0xC81E1E}

FIELD = {f[1]: f for f in C.FIELDS}
BY_ID = {f[0]: f for f in C.FIELDS}


def rgb(c):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


_fonts = {}


def ttf(size):
    if size not in _fonts:
        f = ImageFont.truetype(TTF, size)
        f.set_variation_by_name("Bold")
        _fonts[size] = f
    return _fonts[size]


class Fonts:
    """The watch's FontCache: any size (scalable) or the bitmap ladder."""

    def __init__(self, w, bitmap):
        self.sizes = None
        if bitmap:
            path = os.path.join(ROOT, "resources-round-%dx%d" % (w, w), "bmfonts.xml")
            text = open(path).read()
            self.sizes = [int(v) for v in text.split('id="BmSizes">')[1].split("<")[0].split(",")]

    def size(self, s, letters=False):
        s = max(6, s)
        if self.sizes is None:
            return s
        top = len(self.sizes)
        if letters:
            top = sum(1 for d in GF.LADDER if d <= GF.TEXT_UP_TO)
        best = self.sizes[0]
        for v in self.sizes[:top]:
            if v <= s:
                best = v
        return best

    def smaller(self, s):
        if self.sizes is None:
            return s - (2 if s > 30 else 1)
        below = [v for v in self.sizes if v < s]
        return below[-1] if below else 0

    def width(self, text, s, letters=False):
        return ttf(self.size(s, letters)).getlength(text)


# --------------------------------------------------------------- values

def two(n):
    return "%02d" % n


def duration(sec):
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return "%d:%s:%s" % (h, two(m), two(s)) if h else "%d:%s" % (m, two(s))


def pace(mps, statute=False):
    if not mps or mps <= 0:
        return "--"
    sec = int((1609.344 if statute else 1000.0) / mps)
    return "--" if sec >= 3600 else "%d:%s" % (sec // 60, two(sec % 60))


def distance(m):
    v = m / 1000.0
    return "%.2f" % (math.floor(v * 100) / 100.0) if v < 100 else "%.1f" % (math.floor(v * 10) / 10.0)


def zone_of(v, b):
    if v is None or v <= 0:
        return -1
    if v < b[0]:
        return 0
    for i in range(1, 6):
        if v <= b[i]:
            return i
    return 5


def position(v, b):
    z = zone_of(v, b)
    if z < 0:
        return -1
    if z == 0:
        return 0.0
    if v >= b[5]:
        return 1.0
    return (z - 1 + (v - b[z - 1]) / (b[z] - b[z - 1])) / 5.0


HR_ZONES = [97, 116, 135, 155, 174, 194]  # a typical watch's own zones


def sample_run(hr=162, speed=1000 / 338.0, timer=25 * 60 + 43, power=388):
    return dict(
        hr=hr, avg_hr=152, max_hr=171, speed=speed, avg_speed=1000 / 289.0,
        max_speed=1000 / 241.0, lap_speed=1000 / 292.0, last_lap_speed=1000 / 287.0,
        power=power, avg_power=251, max_power=402, timer=timer, elapsed=timer + 64,
        lap_time=4 * 60 + 21, last_lap_time=4 * 60 + 47, distance=18340.0,
        lap_distance=340.0, last_lap_distance=1000.0, laps=19, ascent=115, descent=112,
        lap_ascent=6, lap_descent=3, altitude=247, cadence=178, avg_cadence=171,
        max_cadence=184, calories=1024, lap_calories=21, te=3.4, vo2=52, temp=21,
        battery=84, dest=4120.0,
    )


def text(key, run):
    r = run
    k = {
        "hr": str(r["hr"]), "avg_hr": str(r["avg_hr"]), "max_hr": str(r["max_hr"]),
        "pace": pace(r["speed"]), "avg_pace": pace(r["avg_speed"]), "lap_pace": pace(r["lap_speed"]),
        "last_lap_pace": pace(r["last_lap_speed"]), "max_pace": pace(r["max_speed"]),
        "speed": "%.1f" % (r["speed"] * 3.6), "avg_speed": "%.1f" % (r["avg_speed"] * 3.6),
        "lap_speed": "%.1f" % (r["lap_speed"] * 3.6), "last_lap_speed": "%.1f" % (r["last_lap_speed"] * 3.6),
        "max_speed": "%.1f" % (r["max_speed"] * 3.6),
        "power": str(r["power"]), "avg_power": str(r["avg_power"]), "max_power": str(r["max_power"]),
        "timer": duration(r["timer"]), "elapsed": duration(r["elapsed"]),
        "lap_time": duration(r["lap_time"]), "last_lap_time": duration(r["last_lap_time"]),
        "clock": "07:05", "sunrise": "06:58", "sunset": "18:41",
        "distance": distance(r["distance"]), "lap_distance": distance(r["lap_distance"]),
        "last_lap_distance": distance(r["last_lap_distance"]), "laps": str(r["laps"]),
        "dist_to_dest": distance(r["dest"]), "ascent": str(r["ascent"]), "descent": str(r["descent"]),
        "lap_ascent": str(r["lap_ascent"]), "lap_descent": str(r["lap_descent"]),
        "last_lap_ascent": "11", "last_lap_descent": "9", "altitude": str(r["altitude"]),
        "cadence": str(r["cadence"]), "avg_cadence": str(r["avg_cadence"]), "max_cadence": str(r["max_cadence"]),
        "calories": str(r["calories"]), "lap_calories": str(r["lap_calories"]), "aerobic_te": "%.1f" % r["te"],
        "vo2max": str(r["vo2"]), "temperature": str(r["temp"]), "battery": "%d%%" % r["battery"],
        "none": "",
    }
    if key == "hr_zone":
        z = zone_of(r["hr"], HR_ZONES)
        return "Z%d" % z if z > 0 else "--"
    return k[key]


def sample(key, run):
    if key in ("timer", "elapsed") and run[key] >= 3600:
        return "0:00:00"
    return FIELD[key][6]


# ---------------------------------------------------------------- render

class Screen:
    def __init__(self, w, bitmap=False, dark=True):
        self.w = w
        self.sc = w / 480.0
        self.ts = self.sc * (1.0 + (360 - w) / 360.0 * 0.45 if w < 360 else 1.0)
        self.fonts = Fonts(w, bitmap)
        self.dark = dark
        self.img = Image.new("RGB", (w, w), (0, 0, 0) if dark else (255, 255, 255))
        self.draw = ImageDraw.Draw(self.img)
        self.boxes = []  # (kind, text, x0, y0, x1, y1) of everything drawn

    def px(self, v):
        return int(round(v * self.sc))

    def fitted(self, sample_text, value, design_size, design_w, letters=False):
        w = self.px(design_w)
        size = int(round(design_size * self.ts))
        for _ in range(40):
            if size <= 6:
                break
            tw = max(self.fonts.width(sample_text, size, letters), self.fonts.width(value, size, letters))
            if tw <= w:
                break
            nxt = self.fonts.smaller(size)
            if self.fonts.sizes is None:
                nxt = min(nxt, int(size * w / tw))
            if nxt <= 0:
                break
            size = nxt
        return size

    def text(self, x, y, w, h, align, size, s, color, kind="text"):
        font = ttf(self.fonts.size(size, kind in ("label", "notice")))
        anchor = {0: "lm", 1: "mm", 2: "rm"}[align]
        jx = x if align == 0 else x + w / 2 if align == 1 else x + w
        self.draw.text((jx, y + h / 2), s, fill=rgb(color), font=font, anchor=anchor)
        b = self.draw.textbbox((jx, y + h / 2), s, font=font, anchor=anchor)
        self.boxes.append((kind, s, b, (x, y, x + w, y + h)))

    def fill(self, x, y, w, h, color, radius=0):
        self.draw.rounded_rectangle([x, y, x + max(w, 1) - 1, y + max(h, 1) - 1], radius=radius, fill=rgb(color))


def render(w, layout, run, target=None, bar=0, locked=False, bitmap=False, dark=True,
           short=False, pace_zones=None, power_zones=None):
    """layout: dict cols (6), slots (18 keys)."""
    s = Screen(w, bitmap, dark)
    fg = 0xFFFFFF if dark else 0x000000
    zone = zone_of(run["hr"], HR_ZONES)
    zone = zone if zone > 0 else 0
    status = 0
    tfield = None
    if target:
        live = {1: run["speed"], 2: run["power"], 3: run["hr"]}[target[0]]
        status = 1 if live < target[1] else 3 if live > target[2] else 2
        tfield = {1: "pace", 2: "power", 3: "hr"}[target[0]]
    for r in range(6):
        cols = layout["cols"][r]
        ids = C.slot_ids(r, cols)
        geo = C.GEOMETRY[(r, cols)]
        for k, slot in enumerate(ids):
            if locked and r > 0 and r not in (2, 3):
                continue
            if locked and r > 0 and len(ids) > 1 and k != (1 if len(ids) == 3 else 0):
                continue
            g = geo[k]
            key = layout["slots"][slot]
            if key == "none":
                continue
            value = text(key, run)
            color = fg
            if tfield == key and status:
                color = (TARGET_DARK if dark else TARGET_LIGHT)[status]
            size = s.fitted(sample(key, run), value, g[8], g[7])
            vx, vy, vw = s.px(g[5]), s.px(g[6]), s.px(g[7])
            vh = int(round((g[8] + 6) * s.sc))
            s.text(vx, vy, vw, vh, g[9], size, value, color, "value")
            if slot == 0 and key == "hr" and zone > 0:
                tw = s.fonts.width(value, size)
                sx = vx + (vw + tw) / 2 + s.px(C.SUFFIX[0])
                ss = int(round(C.SUFFIX[2] * s.ts))
                s.text(sx, vy, 0, vh, 0, ss, "Z%d" % zone, ZONE_COLORS[zone - 1], "suffix")
            if g[3] == 0:
                continue
            f = FIELD[key]
            label = f[4] if short else f[3]
            lcolor = (GROUP_DARK if dark else GROUP_LIGHT)[f[5]]
            if key == "hr" and slot != 0 and zone > 0:
                label = "HR Z%d" % zone
                lcolor = ZONE_COLORS[zone - 1]
            lsize = s.fitted(label, label, g[3], g[2], True)
            s.text(s.px(g[0]), s.px(g[1]), s.px(g[2]), int(round((g[3] + 6) * s.sc)), g[4], lsize, label, lcolor, "label")
    div = 0x3A3A3A if dark else 0xB0B0B0
    for i, d in enumerate(C.DIVIDERS):
        if not locked or i == 0:
            s.fill(s.px(d[0]), s.px(d[1]), s.px(d[2]), s.px(d[3]), div)
    if not locked:
        for r in range(6):
            for d in C.ROW_DIVIDERS.get((r, layout["cols"][r]), []):
                s.fill(s.px(d[0]), s.px(d[1]), s.px(d[2]), s.px(d[3]), div)
        draw_bar(s, run, target, bar, fg, pace_zones, power_zones)
    else:
        notice = 0xF59E0B if dark else 0xB45309
        for n, msg in [(C.NOTICE_SUB, "Trial ended (5 runs)"), (C.NOTICE, "Unlock in Garmin Connect")]:
            size = s.fitted(msg, msg, n[3], n[2], True)
            s.text(s.px(n[0]), s.px(n[1]), s.px(n[2]), int(round((n[3] + 6) * s.sc)), 1, size, msg, notice, "notice")
    return s


def draw_bar(s, run, target, bar, fg, pace_zones, power_zones):
    zones = {3: HR_ZONES, 1: pace_zones, 2: power_zones}
    if bar == 4:
        return
    metric = 3
    if bar == 0 and target and zones.get(target[0]):
        metric = target[0]
    elif bar == 2:
        metric = 1
    elif bar == 3:
        metric = 2
    if not zones.get(metric):
        metric = 3
    b = C.BAR
    x, y, w = s.px(b[0]), s.px(b[1]), s.px(b[2])
    h = max(2, s.px(b[3]))
    gap = max(1, s.px(b[4]))
    seg = (w - gap * 4) / 5.0
    for i in range(5):
        s.fill(int(round(x + i * (seg + gap))), y, int(round(seg)), h, ZONE_COLORS[i], h // 2)
    bounds = zones[metric]
    if target and target[0] == metric:
        a, c = position(target[1], bounds), position(target[2], bounds)
        if a >= 0 and c >= 0:
            bx = x + int(round(min(a, c) * w))
            bw = max(int(round(abs(c - a) * w)), s.px(b[10]))
            bx = min(bx, x + w - bw)
            bh = max(2, s.px(b[9]))
            s.fill(bx, s.px(b[8]), bw, bh, fg, bh // 2)
    live = {1: run["speed"], 2: run["power"], 3: run["hr"]}[metric]
    pos = position(live, bounds)
    if pos >= 0:
        mw = max(3, s.px(b[5]))
        mx = x + int(round(pos * (w - mw)))
        s.fill(mx, s.px(b[6]), mw, s.px(b[7]), fg, mw // 2)


def round_mask(img, bezel=0x2A2A2A):
    w = img.size[0]
    pad = 6
    out = Image.new("RGB", (w + 2 * pad, w + 2 * pad), (13, 17, 23))
    mask = Image.new("L", (w, w), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, w - 1, w - 1], fill=255)
    out.paste(img, (pad, pad), mask)
    ImageDraw.Draw(out).ellipse([pad - 2, pad - 2, pad + w + 1, pad + w + 1], outline=rgb(bezel), width=2)
    return out


def default_layout():
    cols = [r[3] for r in C.ROWS]
    slots = [C.DEFAULT_SLOTS[s[0]] for s in C.SLOTS]
    return {"cols": cols, "slots": slots}


def with_slots(layout, cols=None, **kw):
    out = {"cols": list(layout["cols"]), "slots": list(layout["slots"])}
    if cols:
        out["cols"] = cols
    ids = [s[0] for s in C.SLOTS]
    for k, v in kw.items():
        out["slots"][ids.index(k)] = v
    return out


def pace_bounds(threshold_sec):
    t = 1000.0 / threshold_sec
    return [t * f for f in (0.7, 0.78, 0.88, 0.95, 1.02, 1.15)]


SCENES = [
    ("Default screen: pace target 5:30-5:50 with pace zones (LT pace 4:30)",
     lambda: dict(layout=default_layout(), target=(1, 1000 / 350.0, 1000 / 330.0), pace_zones=pace_bounds(270))),
    ("3 columns in rows 1 and 4, short labels, HR zones",
     lambda: dict(layout=with_slots(default_layout(), cols=[1, 3, 3, 3, 3, 2], r1l="avg_hr", r1c="hr_zone",
                                    r1r="max_hr", r4l="lap_distance", r4c="laps", r4r="lap_ascent"),
                  short=True)),
    ("Power target 250-270 W above range, run past an hour",
     lambda: dict(layout=with_slots(default_layout(), cols=[2, 2, 3, 3, 2, 2], headerl="hr", headerr="timer",
                                    r2l="lap_pace", r2c="power", r2r="pace", r3r="clock", r4r="avg_power",
                                    r5r="hr_zone"),
                  run=sample_run(timer=65 * 60), target=(2, 250, 270), power_zones=[163, 200, 225, 250, 288, 325])),
    ("Row 2 as 2 columns, row 3 and bottom as 1",
     lambda: dict(layout=with_slots(default_layout(), cols=[1, 2, 2, 1, 2, 1], r2l="pace", r2r="lap_pace",
                                    r3c="timer", r5c="distance"), run=sample_run(hr=150))),
    ("Trial over: basic screen",
     lambda: dict(layout=default_layout(), locked=True, run=sample_run(hr=141))),
    ("White background (MIP setting), HR target 140-150",
     lambda: dict(layout=default_layout(), dark=False, target=(3, 140, 150), run=sample_run(hr=147))),
]

SIZES = [454, 416, 390, 360, 280, 260, 240, 218]
BITMAP_SIZES = {218, 240, 260, 280}  # watches without scalable fonts are mostly these


def gallery(path):
    tiles = []
    for title, scene in SCENES:
        args = scene()
        run = args.pop("run", sample_run())
        tiles.append((title, round_mask(render(454, args.pop("layout"), run, **args).img)))
    for w in [416, 390, 280, 260, 240, 218]:
        s = render(w, default_layout(), sample_run(), target=(1, 1000 / 350.0, 1000 / 330.0),
                   pace_zones=pace_bounds(270), bitmap=w in BITMAP_SIZES)
        tiles.append(("%d px%s" % (w, " (bitmap fonts)" if w in BITMAP_SIZES else ""), round_mask(s.img)))
    cols = 3
    tw = 470
    th = 470 + 50
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new("RGB", (cols * tw, rows * th), (13, 17, 23))
    d = ImageDraw.Draw(out)
    cap = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15) if os.path.exists(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") else ttf(15)
    for i, (title, img) in enumerate(tiles):
        cx, cy = (i % cols) * tw, (i // cols) * th
        out.paste(img, (cx + (tw - img.size[0]) // 2, cy + 5))
        d.text((cx + tw / 2, cy + 476), title, fill=(200, 205, 212), font=cap, anchor="ma")
    out.save(path)
    print("wrote", path)


def check():
    """Every layout combination on every size: text inside the screen and its box."""
    problems = 0
    import itertools
    combos = list(itertools.product(*[r[2] for r in C.ROWS]))
    for w in SIZES:
        for bitmap in ([False, True] if w in BITMAP_SIZES or True else [False]):
            if bitmap and not os.path.exists(os.path.join(ROOT, "resources-round-%dx%d" % (w, w))):
                continue
            for cols in combos:
                layout = with_slots(default_layout(), cols=list(cols))
                for run in (sample_run(), sample_run(timer=3 * 3600 + 5, hr=188)):
                    s = render(w, layout, run, bitmap=bitmap)
                    r = w / 2.0
                    for kind, txt, (x0, y0, x1, y1), box in s.boxes:
                        if kind == "suffix":
                            continue
                        # horizontal: never wider than its box (1 px slack)
                        if x0 < box[0] - 1 or x1 > box[2] + 1:
                            problems += 1
                            if problems < 30:
                                print("overflow w=%d bm=%s cols=%s %s %r %s box=%s" % (w, bitmap, cols, kind, txt, (x0, x1), box[:3:2]))
                        # inside the round screen (corners of the ink box)
                        for (px_, py_) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
                            if math.hypot(px_ - r, py_ - r) > r + 1:
                                problems += 1
                                if problems < 30:
                                    print("off-screen w=%d bm=%s cols=%s %s %r" % (w, bitmap, cols, kind, txt))
                                break
    print("problems:", problems)
    return problems


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(1 if check() else 0)
    gallery(os.path.join(ROOT, "docs", "ui-preview.png"))
