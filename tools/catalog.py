#!/usr/bin/env python3
"""The field catalog and every setting, in one place.

Writes the files that list them, so the watch code, the Garmin Connect
settings page and the on-watch editor never disagree:

  source/FieldTable.mc            labels, groups, samples, kinds per field id
  resources/strings/fields.xml    field names for the pickers
  resources/properties.xml        every setting and its default
  resources/settings/settings.xml the Garmin Connect (phone) settings page

Field ids are stored in the user's settings: never renumber one, only add.

usage: python3 tools/catalog.py   (from the repository root)
"""

import os
import sys
from xml.sax.saxutils import escape

# Label color groups (source/Theme.mc): hr red, pace blue, time green,
# dist orange, body teal.
HR, PACE, TIME, DIST, BODY = range(5)

# How a raw value turns into text (source/Format.mc).
K = dict(
    NONE=0, INT=1, PACE=2, SPEED=3, DUR=4, DIST=5, ELEV=6, DEC1=7,
    CLOCK=8, ZONE=9, TEMP=10, PCT=11, TOD=12,
)

# id, key, picker name, label (<= 9 chars), short label (<= 5), group,
# widest typical value (sizes the digits), kind
FIELDS = [
    (0, "none", "Empty", "", "", BODY, "", "NONE"),
    (1, "hr", "Heart rate", "HR", "HR", HR, "000", "INT"),
    (2, "hr_zone", "HR zone", "HR Zone", "Zone", HR, "Z0", "ZONE"),
    (3, "avg_hr", "Average HR", "Avg HR", "AvgHR", HR, "000", "INT"),
    (4, "max_hr", "Max HR", "Max HR", "MaxHR", HR, "000", "INT"),
    (5, "pace", "Pace", "Pace", "Pace", PACE, "0:00", "PACE"),
    (6, "avg_pace", "Average pace", "Avg Pace", "AvgP", PACE, "0:00", "PACE"),
    (7, "lap_pace", "Lap pace", "Lap Pace", "LapP", PACE, "0:00", "PACE"),
    (8, "last_lap_pace", "Last lap pace", "Last Lap", "LastP", PACE, "0:00", "PACE"),
    (9, "max_pace", "Best pace (max speed)", "Max Pace", "MaxP", PACE, "0:00", "PACE"),
    (10, "speed", "Speed", "Speed", "Spd", PACE, "00.0", "SPEED"),
    (11, "avg_speed", "Average speed", "Avg Spd", "AvgSp", PACE, "00.0", "SPEED"),
    (12, "lap_speed", "Lap speed", "Lap Spd", "LapSp", PACE, "00.0", "SPEED"),
    (13, "last_lap_speed", "Last lap speed", "Last Spd", "LastS", PACE, "00.0", "SPEED"),
    (14, "max_speed", "Max speed", "Max Spd", "MaxSp", PACE, "00.0", "SPEED"),
    (15, "power", "Power", "Power", "Pwr", PACE, "000", "INT"),
    (16, "avg_power", "Average power", "Avg Pwr", "AvgW", PACE, "000", "INT"),
    (17, "max_power", "Max power", "Max Pwr", "MaxW", PACE, "000", "INT"),
    (18, "timer", "Workout time (timer)", "Time", "Time", TIME, "00:00", "DUR"),
    (19, "elapsed", "Elapsed time (with pauses)", "Elapsed", "Elap", TIME, "00:00", "DUR"),
    (20, "lap_time", "Lap time", "Lap Time", "LapT", TIME, "00:00", "DUR"),
    (21, "last_lap_time", "Last lap time", "Last Lap", "LastT", TIME, "00:00", "DUR"),
    (22, "clock", "Time of day", "Clock", "Clock", TIME, "00:00", "CLOCK"),
    (23, "sunrise", "Sunrise time", "Sunrise", "Sunrs", TIME, "00:00", "TOD"),
    (24, "sunset", "Sunset time", "Sunset", "Sunst", TIME, "00:00", "TOD"),
    (25, "distance", "Distance", "Distance", "Dist", DIST, "00.00", "DIST"),
    (26, "lap_distance", "Lap distance", "Lap Dist", "LapD", DIST, "0.00", "DIST"),
    (27, "last_lap_distance", "Last lap distance", "Last Dist", "LastD", DIST, "0.00", "DIST"),
    (28, "laps", "Lap number", "Lap #", "Lap#", DIST, "00", "INT"),
    (29, "dist_to_dest", "Distance to destination", "To Dest", "Dest", DIST, "00.00", "DIST"),
    (30, "ascent", "Total ascent", "Ascent", "Asc", DIST, "0000", "ELEV"),
    (31, "descent", "Total descent", "Descent", "Desc", DIST, "0000", "ELEV"),
    (32, "lap_ascent", "Lap ascent", "Lap Asc", "LapAs", DIST, "000", "ELEV"),
    (33, "lap_descent", "Lap descent", "Lap Desc", "LapDs", DIST, "000", "ELEV"),
    (34, "last_lap_ascent", "Last lap ascent", "Last Asc", "LastA", DIST, "000", "ELEV"),
    (35, "last_lap_descent", "Last lap descent", "Last Desc", "LstDs", DIST, "000", "ELEV"),
    (36, "altitude", "Altitude", "Altitude", "Alt", DIST, "0000", "ELEV"),
    (37, "cadence", "Cadence", "Cadence", "Cad", BODY, "000", "INT"),
    (38, "avg_cadence", "Average cadence", "Avg Cad", "AvgC", BODY, "000", "INT"),
    (39, "max_cadence", "Max cadence", "Max Cad", "MaxC", BODY, "000", "INT"),
    (40, "calories", "Calories", "Calories", "Cal", BODY, "0000", "INT"),
    (41, "lap_calories", "Lap calories", "Lap Cal", "LapCl", BODY, "000", "INT"),
    (42, "aerobic_te", "Aerobic training effect", "Aer TE", "AerTE", BODY, "0.0", "DEC1"),
    (43, "vo2max", "VO2 max (running)", "VO2 Max", "VO2", BODY, "00", "INT"),
    (44, "temperature", "Temperature", "Temp", "Temp", TIME, "-00", "TEMP"),
    (45, "battery", "Battery", "Battery", "Batt", BODY, "000%", "PCT"),
]

# "Icons" label style: an icon (tools/gen-icons.py) plus a short qualifier.
ICON_NAMES = [
    "heart", "zone", "gauge", "bolt", "stopwatch", "clock", "flag", "laps",
    "ascent", "altitude", "descent", "load", "thermo", "sun", "feet", "flame",
    "battery",
]
ICON_LABEL = dict(
    hr=("heart", ""), hr_zone=("zone", ""), avg_hr=("heart", "Avg"), max_hr=("heart", "Max"),
    pace=("gauge", ""), avg_pace=("gauge", "Avg"), lap_pace=("gauge", "Lap"),
    last_lap_pace=("gauge", "Last"), max_pace=("gauge", "Max"),
    speed=("gauge", "Spd"), avg_speed=("gauge", "Avg"), lap_speed=("gauge", "Lap"),
    last_lap_speed=("gauge", "Last"), max_speed=("gauge", "Max"),
    power=("bolt", ""), avg_power=("bolt", "Avg"), max_power=("bolt", "Max"),
    timer=("stopwatch", ""), elapsed=("stopwatch", "All"), lap_time=("stopwatch", "Lap"),
    last_lap_time=("stopwatch", "Last"), clock=("clock", ""), sunrise=("sun", "Rise"),
    sunset=("sun", "Set"), distance=("flag", ""), lap_distance=("flag", "Lap"),
    last_lap_distance=("flag", "Last"), laps=("laps", ""), dist_to_dest=("flag", "Dest"),
    ascent=("ascent", ""), descent=("descent", ""), lap_ascent=("ascent", "Lap"),
    lap_descent=("descent", "Lap"), last_lap_ascent=("ascent", "Last"),
    last_lap_descent=("descent", "Last"), altitude=("altitude", ""),
    cadence=("feet", ""), avg_cadence=("feet", "Avg"), max_cadence=("feet", "Max"),
    calories=("flame", ""), lap_calories=("flame", "Lap"), aerobic_te=("load", "Aer"),
    vo2max=("load", "VO2"), temperature=("thermo", ""), battery=("battery", ""),
)

# Picker order (phone and watch): the catalog order, "Empty" last.
PICKER = [f[0] for f in FIELDS if f[0] != 0] + [0]

# Slots top to bottom; the property key is "s_" + id (source/Layout.mc
# indexes slots in this order).
SLOTS = [
    ("header", "Top"), ("headerl", "Top left"), ("headerr", "Top right"),
    ("r1l", "Row 1 left"), ("r1c", "Row 1 middle"), ("r1r", "Row 1 right"),
    ("r2l", "Row 2 left"), ("r2c", "Row 2 center"), ("r2r", "Row 2 right"),
    ("r3l", "Row 3 left"), ("r3c", "Row 3 center"), ("r3r", "Row 3 right"),
    ("r4l", "Row 4 left"), ("r4c", "Row 4 middle"), ("r4r", "Row 4 right"),
    ("r5l", "Bottom left"), ("r5c", "Bottom middle"), ("r5r", "Bottom right"),
]

# The reference layout (field keys).
DEFAULT_SLOTS = dict(
    header="hr", headerl="hr", headerr="timer",
    r1l="avg_hr", r1c="hr_zone", r1r="max_hr",
    r2l="lap_pace", r2c="pace", r2r="avg_pace",
    r3l="lap_time", r3c="timer", r3r="cadence",
    r4l="lap_distance", r4c="lap_ascent", r4r="laps",
    r5l="distance", r5c="calories", r5r="ascent",
)

# Rows with a user-chosen column count: id, name, allowed counts, default.
ROWS = [
    ("header", "Top row", [1, 2], 1),
    ("r1", "Row 1", [2, 3], 2),
    ("r2", "Row 2", [1, 2, 3], 3),
    ("r3", "Row 3", [1, 2, 3], 3),
    ("r4", "Row 4", [2, 3], 2),
    ("r5", "Bottom row", [1, 2], 2),
]

MAX_PRESETS = 4

# ------------------------------------------------------------- geometry
# Designed at 480 px (the Amazfit layout) and scaled per screen by the
# field. A slot is 10 numbers: label x, y, w, text size, align, value x, y,
# w, text size, align (align 0 left, 1 center, 2 right; label size 0 = no
# label). A box is as high as its text size + 6; text is centered in it.

def stack(x, y, w, ls, vs):
    """Label above its value, both centered in a cell."""
    return [x, y, w, ls, 1, x, y + ls + 4, w, vs, 1]


NO_LABEL = [0, 0, 0, 0, 1]

# (row, column count) -> slot geometry in rowSlots() order
GEOMETRY = {
    (0, 1): [[140, 28, 200, 20, 1, 130, 50, 220, 56, 1]],
    (0, 2): [stack(96, 34, 140, 18, 42), stack(244, 34, 140, 18, 42)],
    (1, 2): [
        [56, 121, 92, 22, 2, 154, 114, 76, 34, 0],
        [332, 121, 92, 22, 0, 250, 114, 76, 34, 2],
    ],
    (1, 3): [stack(44, 109, 120, 16, 24), stack(168, 109, 144, 16, 24), stack(316, 109, 120, 16, 24)],
    (2, 1): [NO_LABEL + [60, 166, 360, 80, 1]],
    (2, 2): [stack(36, 164, 200, 20, 54), stack(244, 164, 200, 20, 54)],
    (2, 3): [
        [22, 166, 118, 20, 1, 22, 190, 118, 38, 1],
        NO_LABEL + [140, 168, 200, 72, 1],
        [340, 166, 118, 20, 1, 340, 190, 118, 38, 1],
    ],
    (3, 1): [NO_LABEL + [70, 284, 340, 68, 1]],
    (3, 2): [stack(40, 284, 196, 20, 44), stack(244, 284, 196, 20, 44)],
    (3, 3): [
        [22, 284, 118, 20, 1, 22, 308, 118, 34, 1],
        NO_LABEL + [140, 284, 200, 60, 1],
        [340, 284, 118, 20, 1, 340, 308, 118, 34, 1],
    ],
    # row 4 mirrors row 1: same band, same sizes
    (4, 2): [
        [56, 372, 92, 22, 2, 154, 365, 76, 34, 0],
        [332, 372, 92, 22, 0, 250, 365, 76, 34, 2],
    ],
    (4, 3): [stack(56, 360, 120, 16, 24), stack(178, 360, 124, 16, 24), stack(304, 360, 120, 16, 24)],
    # bottom row: pulled toward the middle, where the circle leaves room
    (5, 1): [stack(170, 413, 140, 18, 28)],
    (5, 2): [stack(142, 413, 96, 18, 28), stack(242, 413, 96, 18, 28)],
}

# column separators [x, y, w, h] per (row, column count)
ROW_DIVIDERS = {
    (1, 2): [[239, 114, 2, 40]],
    (1, 3): [[166, 114, 2, 40], [314, 114, 2, 40]],
    (4, 2): [[239, 363, 2, 42]],
    (4, 3): [[177, 363, 2, 42], [303, 363, 2, 42]],
}

# horizontal rules between rows
DIVIDERS = [[60, 108, 360, 2], [28, 158, 424, 2], [44, 357, 392, 2], [84, 409, 312, 2]]

# HR zone after a single top value: x gap after the value, y, text size
SUFFIX = [10, 64, 28]

# zone bar: x, y, w, h, gap; marker w, y, h; target band y, h, min w
BAR = [26, 258, 428, 14, 3, 8, 250, 30, 275, 5, 10]

# basic mode (trial over): x, y, w, text size
NOTICE = [56, 362, 368, 26]
NOTICE_SUB = [40, 116, 400, 26]


def slot_ids(row, cols):
    """Slot indices a row shows for a column count (Layout.rowSlots)."""
    if row == 0:
        return [1, 2] if cols == 2 else [0]
    base = row * 3
    return {1: [base + 1], 2: [base, base + 2], 3: [base, base + 1, base + 2]}[cols]


def layout_table():
    for r, row in enumerate(ROWS):
        for c in row[2]:
            assert len(GEOMETRY[(r, c)]) == c or (r == 0 and c == 1), (r, c)
    flat = lambda rows: ", ".join(str(v) for g in rows for v in g)
    lines = [
        "// Generated by tools/catalog.py - edit the geometry there, not here.",
        "",
        "import Toybox.Lang;",
        "",
        "module LayoutTable {",
        "",
        "    // every slot a row shows for a column count, rowSlots() order",
        "    function rowGeometry(row as Number, cols as Number) as Array<Number> {",
    ]
    for (r, c), g in sorted(GEOMETRY.items()):
        lines.append("        if (row == %d && cols == %d) {" % (r, c))
        lines.append("            return [%s];" % flat(g))
        lines.append("        }")
    lines.append("        return [] as Array<Number>;")
    lines.append("    }")
    lines.append("")
    lines.append("    function rowDividers(row as Number, cols as Number) as Array<Number> {")
    for (r, c), g in sorted(ROW_DIVIDERS.items()):
        lines.append("        if (row == %d && cols == %d) {" % (r, c))
        lines.append("            return [%s];" % flat(g))
        lines.append("        }")
    lines.append("        return [] as Array<Number>;")
    lines.append("    }")
    for name, val in [("DIVIDERS", flat(DIVIDERS)), ("SUFFIX", flat([SUFFIX])), ("BAR", flat([BAR])),
                      ("NOTICE", flat([NOTICE])), ("NOTICE_SUB", flat([NOTICE_SUB]))]:
        lines.append("")
        lines.append("    const %s as Array<Number> = [%s];" % (name, val))
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


KEY_ID = {f[1]: f[0] for f in FIELDS}


def mc_string(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def field_table():
    ids = [f[0] for f in FIELDS]
    assert ids == list(range(len(FIELDS))), "field ids must be 0..n-1"
    for f in FIELDS:
        assert len(f[3]) <= 9 and len(f[4]) <= 5, f
    lines = [
        "// Generated by tools/catalog.py - edit the catalog there, not here.",
        "",
        "import Toybox.Lang;",
        "",
        "module FieldTable {",
        "",
        "    const COUNT = %d;" % len(FIELDS),
        "",
    ]
    for f in FIELDS:
        lines.append("    const F_%s = %d;" % (f[1].upper(), f[0]))
    lines.append("")
    for name, k in sorted(K.items(), key=lambda kv: kv[1]):
        lines.append("    const K_%s = %d;" % (name, k))

    def arr(name, typ, values):
        lines.append("")
        lines.append("    const %s as Array<%s> = [" % (name, typ))
        for v in values:
            lines.append("        %s," % v)
        lines.append("    ];")

    arr("LABEL", "String", [mc_string(f[3]) for f in FIELDS])
    arr("SHORT", "String", [mc_string(f[4]) for f in FIELDS])
    arr("GROUP", "Number", [str(f[5]) for f in FIELDS])
    arr("SAMPLE", "String", [mc_string(f[6]) for f in FIELDS])
    arr("KIND", "Number", ["K_" + f[7] for f in FIELDS])
    arr("ICON", "Number", [str(ICON_NAMES.index(ICON_LABEL[f[1]][0])) if f[1] in ICON_LABEL else "-1" for f in FIELDS])
    arr("QUAL", "String", [mc_string(ICON_LABEL[f[1]][1]) if f[1] in ICON_LABEL else '""' for f in FIELDS])
    arr("PICKER", "Number", [str(i) for i in PICKER])
    arr("SLOT_KEY", "String", [mc_string("s_" + s[0]) for s in SLOTS])
    arr("SLOT_NAME", "String", [mc_string(s[1]) for s in SLOTS])
    arr("DEFAULT_SLOT", "Number", [str(KEY_ID[DEFAULT_SLOTS[s[0]]]) for s in SLOTS])
    arr("ROW_KEY", "String", [mc_string("cols_" + r[0]) for r in ROWS])
    arr("ROW_NAME", "String", [mc_string(r[1]) for r in ROWS])
    arr("ROW_DEFAULT", "Number", [str(r[3]) for r in ROWS])
    lines.append("")
    lines.append("    // allowed column counts per row")
    lines.append("    const ROW_COLS as Array<Array<Number> > = [")
    for r in ROWS:
        lines.append("        [%s]," % ", ".join(str(c) for c in r[2]))
    lines.append("    ];")
    lines.append("")
    lines.append("    function name(id as Number) as String {")
    lines.append("        return WatchUi.loadResource(NAMES[id]) as String;")
    lines.append("    }")
    arr("NAMES", "ResourceId", ["Rez.Strings.f_%s" % f[1] for f in FIELDS])
    lines.append("}")
    lines.append("")
    # WatchUi is needed by name()
    lines.insert(3, "import Toybox.WatchUi;")
    return "\n".join(lines)


def strings_xml():
    out = ["<!-- Generated by tools/catalog.py -->", "<strings>"]
    for f in FIELDS:
        out.append('    <string id="f_%s">%s</string>' % (f[1], escape(f[2])))
    for s in SLOTS:
        out.append('    <string id="slot_%s">%s</string>' % (s[0], escape(s[1])))
    for r in ROWS:
        out.append('    <string id="row_%s">%s columns</string>' % (r[0], escape(r[1])))
    for i in range(1, MAX_PRESETS + 1):
        out.append('    <string id="apply_%d">Apply preset %d</string>' % (i, i))
        out.append('    <string id="save_%d">Save the current screen as preset %d</string>' % (i, i))
        out.append('    <string id="preset_name_%d">Preset %d name</string>' % (i, i))
    for c in (1, 2, 3):
        out.append('    <string id="cols_%d">%d</string>' % (c, c))
    out.append("</strings>")
    return "\n".join(out) + "\n"


# Settings besides the layout: (key, type, default, setting xml or None).
# `None` keeps a property off the phone page (still a property).
def other_properties():
    return [
        ("labels", "number", 0),
        ("bar", "number", 0),
        ("compact", "number", KEY_ID["pace"]),
        ("target_metric", "number", 1),
        ("target_pace_low", "string", ""),
        ("target_pace_high", "string", ""),
        ("target_power_low", "string", ""),
        ("target_power_high", "string", ""),
        ("target_hr_low", "string", ""),
        ("target_hr_high", "string", ""),
        ("hr_zone_method", "number", 0),
        ("max_hr", "number", 0),
        ("lthr", "number", 0),
        ("hr_zones_custom", "string", ""),
        ("threshold_pace", "string", ""),
        ("ftp", "number", 0),
        ("preset_action", "number", 0),
    ] + [("preset_name_%d" % i, "string", "") for i in range(1, MAX_PRESETS + 1)] + [
        ("license_key", "string", ""),
        ("license_status", "string", "Trial: 5 free runs"),
    ]


def properties_xml():
    out = ["<!-- Generated by tools/catalog.py -->", "<properties>"]
    for r in ROWS:
        out.append('    <property id="cols_%s" type="number">%d</property>' % (r[0], r[3]))
    for s in SLOTS:
        out.append('    <property id="s_%s" type="number">%d</property>' % (s[0], KEY_ID[DEFAULT_SLOTS[s[0]]]))
    for key, typ, default in other_properties():
        out.append('    <property id="%s" type="%s">%s</property>' % (key, typ, escape(str(default))))
    out.append("</properties>")
    return "\n".join(out) + "\n"


def list_setting(key, title, entries, indent="        "):
    out = ['%s<setting propertyKey="@Properties.%s" title="%s">' % (indent, key, escape(title))]
    out.append('%s    <settingConfig type="list">' % indent)
    for value, label in entries:
        out.append('%s        <listEntry value="%d">%s</listEntry>' % (indent, value, label))
    out.append("%s    </settingConfig>" % indent)
    out.append("%s</setting>" % indent)
    return out


def text_setting(key, title, typ="alphaNumeric", indent="        ", extra=""):
    return [
        '%s<setting propertyKey="@Properties.%s" title="%s">' % (indent, key, escape(title)),
        '%s    <settingConfig type="%s"%s/>' % (indent, typ, extra),
        "%s</setting>" % indent,
    ]


def settings_xml():
    field_entries = [(i, "@Strings.f_" + FIELDS[i][1]) for i in PICKER]
    out = ["<!-- Generated by tools/catalog.py -->", "<settings>"]

    out.append('    <group id="g_layout" title="Screen layout" description="Columns per row and the field in every spot. Rows with fewer columns show fewer of the spots below.">')
    for r in ROWS:
        out += list_setting("cols_" + r[0], r[1] + " columns", [(c, "@Strings.cols_%d" % c) for c in r[2]])
    for s in SLOTS:
        out += list_setting("s_" + s[0], s[1], field_entries)
    out += list_setting("labels", "Field names", [(0, "Text"), (1, "Short text"), (2, "Icons")])
    out += list_setting("bar", "Zone bar", [(0, "Auto (follows the target)"), (1, "Heart rate zones"), (2, "Pace zones"), (3, "Power zones"), (4, "Off")])
    out += list_setting("compact", "Field in a smaller data screen spot", field_entries)
    out.append("    </group>")

    out.append('    <group id="g_target" title="Target" description="Pace as m:ss in the watch\'s pace unit, power in W, heart rate in bpm. One end alone is a single value with a tolerance. Every spot showing that live value turns green inside the range, blue below, red above.">')
    out += list_setting("target_metric", "Target metric", [(1, "Pace"), (2, "Power"), (3, "Heart rate")])
    out += text_setting("target_pace_low", "Pace from (e.g. 5:30)")
    out += text_setting("target_pace_high", "Pace to (e.g. 5:50)")
    out += text_setting("target_power_low", "Power from (W)")
    out += text_setting("target_power_high", "Power to (W)")
    out += text_setting("target_hr_low", "Heart rate from (bpm)")
    out += text_setting("target_hr_high", "Heart rate to (bpm)")
    out.append("    </group>")

    out.append('    <group id="g_zones" title="Zones" description="Heart rate zones default to the watch\'s own. Pace zones need the threshold pace, power zones the FTP.">')
    out += list_setting("hr_zone_method", "Heart rate zones", [(0, "The watch's zones"), (1, "% of max HR"), (2, "% of threshold HR"), (3, "Custom")])
    out += text_setting("max_hr", "Max HR (for % of max HR)", "numeric", extra=' min="100" max="240"')
    out += text_setting("lthr", "Threshold HR (for % of threshold HR)", "numeric", extra=' min="80" max="230"')
    out += text_setting("hr_zones_custom", "Custom zones: Z1-Z5 lower bounds, e.g. 120,140,155,168,180")
    out += text_setting("threshold_pace", "Threshold pace (m:ss)")
    out += text_setting("ftp", "FTP / critical power (W)", "numeric", extra=' min="50" max="1000"')
    out.append("    </group>")

    out.append('    <group id="g_presets" title="Presets" description="A preset keeps the screen layout and the target under a name. Pick an action and save: the watch carries it out on its next sync and sets this back to None. On the watch: the data field\'s settings, Presets.">')
    for i in range(1, MAX_PRESETS + 1):
        out += text_setting("preset_name_%d" % i, "Preset %d name" % i, extra=' maxLength="20"')
    actions = [(0, "None")] + [(i, "@Strings.apply_%d" % i) for i in range(1, MAX_PRESETS + 1)] + [
        (10 + i, "@Strings.save_%d" % i) for i in range(1, MAX_PRESETS + 1)
    ]
    out += list_setting("preset_action", "Action", actions)
    out.append("    </group>")

    out.append('    <group id="g_license" title="License" description="5 free runs, then RunDeck needs a license key (one-time purchase). Paste the key from the purchase e-mail; the watch activates it the next time RunDeck runs with the phone connected.">')
    out += text_setting("license_key", "License key")
    out += text_setting("license_status", "Status", extra=' readonly="true"')
    out.append("    </group>")
    out.append("</settings>")
    return "\n".join(out) + "\n"


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)
    print("wrote", path)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write(os.path.join(root, "source", "FieldTable.mc"), field_table())
    write(os.path.join(root, "source", "LayoutTable.mc"), layout_table())
    write(os.path.join(root, "resources", "strings", "fields.xml"), strings_xml())
    write(os.path.join(root, "resources", "properties.xml"), properties_xml())
    write(os.path.join(root, "resources", "settings", "settings.xml"), settings_xml())


if __name__ == "__main__":
    sys.exit(main())
