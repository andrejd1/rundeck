// Layout for round 480x480 devices (T-Rex 3 / Balance / Active class).
// Dense one-screen dashboard: HR header with history graph, lap vs average
// rows around the big pace (or power) and elapsed time, a five-zone bar in
// the middle, lap distance / grade and distance / ascent at the bottom.
// Pure black background (AMOLED pixels off); every coordinate goes through
// px() so 454px-class displays scale from designWidth 480.

import { align } from "@zos/ui"
import { px } from "@zos/utils"

export const COLORS = {
  bg: 0x000000,
  value: 0xffffff,
  divider: 0x3a3a3a,
  // label colors per field group (shared/fields.js)
  hr: 0xef4444,
  pace: 0x60a5fa,
  time: 0x22c55e,
  dist: 0xf59e0b,
  body: 0x2dd4bf,
  notice: 0xf2f2f2,
  noticeWarn: 0xf59e0b,
  // center value against the pace/power target
  below: 0x60a5fa,
  inside: 0x2ee66b,
  above: 0xef4444,
  graphEmpty: 0x1a1a1a,
}

const label = (x, y, w, color, alignH = align.CENTER_H, size = 22) => ({
  x: px(x),
  y: px(y),
  w: px(w),
  h: px(size + 6),
  color,
  text_size: px(size),
  align_h: alignH,
  align_v: align.CENTER_V,
})

const value = (x, y, w, size, alignH = align.CENTER_H) => ({
  x: px(x),
  y: px(y),
  w: px(w),
  h: px(size + 6),
  color: COLORS.value,
  text_size: px(size),
  align_h: alignH,
  align_v: align.CENTER_V,
})

const line = (x, y, w, h) => ({
  x: px(x),
  y: px(y),
  w: px(w),
  h: px(h),
  color: COLORS.divider,
})

// --- slots ------------------------------------------------------------------
// Every slot is a {label, value} pair of TEXT props placed by row and column
// count (ROW_GEOMETRY); any field can go in any slot, so the widget shrinks
// text that would overflow its slot width.

export const HR_GRAPH = {
  x: px(92),
  y: px(50),
  h: px(52),
  barW: px(3), // pitch per bar; drawn 1 px narrower so the bars read apart
  minBarH: px(2),
}
// zone ("Z2") next to the header value when the header shows heart rate
export const HEADER_SUFFIX = label(330, 64, 70, COLORS.value, align.LEFT, 28)

// Label stacked above its value, both centered in a cell.
const stack = (x, y, w, labelSize, valueSize) => ({
  label: label(x, y, w, COLORS.value, align.CENTER_H, labelSize),
  value: value(x, y + labelSize + 4, w, valueSize),
})

// Geometry per row and column count: { [cols]: { [slotId]: {label, value} } }.
// `label: null` means the slot shows no label (big center values).
export const ROW_GEOMETRY = {
  header: {
    1: {
      // HR: graph on the left, label above the value, zone suffix after it
      header: {
        label: label(214, 30, 120, COLORS.value, align.LEFT, 20),
        value: value(212, 50, 124, 56, align.LEFT),
      },
    },
    2: {
      headerl: stack(96, 34, 140, 18, 42),
      headerr: stack(244, 34, 140, 18, 42),
    },
  },
  r1: {
    2: {
      r1l: {
        label: label(56, 121, 92, COLORS.value, align.RIGHT),
        value: value(154, 114, 76, 34, align.LEFT),
      },
      r1r: {
        label: label(332, 121, 92, COLORS.value, align.LEFT),
        value: value(250, 114, 76, 34, align.RIGHT),
      },
    },
    3: {
      r1l: stack(44, 109, 120, 16, 24),
      r1c: stack(168, 109, 144, 16, 24),
      r1r: stack(316, 109, 120, 16, 24),
    },
  },
  r2: {
    // left and right labels on one line (the left used to sit 14 px lower)
    3: {
      r2l: {
        label: label(22, 166, 118, COLORS.value, align.CENTER_H, 20),
        value: value(22, 190, 118, 38),
      },
      r2c: { label: null, value: value(140, 168, 200, 72) },
      r2r: {
        label: label(340, 166, 118, COLORS.value, align.CENTER_H, 20),
        value: value(340, 190, 118, 38),
      },
    },
    2: { r2l: stack(36, 164, 200, 20, 54), r2r: stack(244, 164, 200, 20, 54) },
    1: { r2c: { label: null, value: value(60, 166, 360, 80) } },
  },
  r3: {
    3: {
      r3l: {
        label: label(22, 284, 118, COLORS.value, align.CENTER_H, 20),
        value: value(22, 308, 118, 34),
      },
      r3c: { label: null, value: value(140, 284, 200, 60) },
      r3r: {
        label: label(340, 284, 118, COLORS.value, align.CENTER_H, 20),
        value: value(340, 308, 118, 34),
      },
    },
    2: { r3l: stack(40, 284, 196, 20, 44), r3r: stack(244, 284, 196, 20, 44) },
    1: { r3c: { label: null, value: value(70, 284, 340, 68) } },
  },
  // Row 4 mirrors row 1: same 50 px band, same sizes (it used to be 44 px
  // with a smaller value font, which read as squeezed).
  r4: {
    2: {
      r4l: {
        label: label(56, 372, 92, COLORS.value, align.RIGHT),
        value: value(154, 365, 76, 34, align.LEFT),
      },
      r4r: {
        label: label(332, 372, 92, COLORS.value, align.LEFT),
        value: value(250, 365, 76, 34, align.RIGHT),
      },
    },
    3: {
      r4l: stack(56, 360, 120, 16, 24),
      r4c: stack(178, 360, 124, 16, 24),
      r4r: stack(304, 360, 120, 16, 24),
    },
  },
  r5: {
    2: {
      r5l: stack(132, 413, 104, 18, 28),
      r5r: stack(246, 413, 104, 18, 28),
    },
    1: { r5c: stack(170, 413, 140, 18, 28) },
  },
}

// Single top value that is not HR: no graph, so label and value are centered.
export const HEADER_CENTERED = {
  label: label(140, 28, 200, COLORS.value, align.CENTER_H, 20),
  value: value(130, 50, 220, 56),
}

// Column separators per row and column count.
export const ROW_DIVIDERS = {
  r1: {
    2: [line(239, 114, 2, 40)],
    3: [line(166, 114, 2, 40), line(314, 114, 2, 40)],
  },
  r4: {
    2: [line(239, 363, 2, 42)],
    3: [line(177, 363, 2, 42), line(303, 363, 2, 42)],
  },
}

// Icon-mode labels: icon square next to the qualifier text ("Avg", "Lap").
export const ICON = { maxSize: px(26), gap: px(4) }

// Average glyph width as a fraction of the font size, used to shrink text
// that would overflow its slot (the watch font is narrower; this is safe).
export const GLYPH_WIDTH = 0.62

// --- zone bar ---------------------------------------------------------------
export const ZONE_BAR = {
  x: px(26),
  y: px(258),
  w: px(428),
  h: px(14),
  gap: px(3),
  marker: { w: px(8), y: px(250), h: px(30), color: 0xffffff },
  // target range: a white strip just under the bar
  band: { y: px(275), h: px(5), minW: px(10), color: 0xffffff },
}

// --- notice (trial status, lap flash, locked) overlaying the lap dist row ---
export const NOTICE = {
  x: px(56),
  y: px(362),
  w: px(368),
  h: px(44),
  color: COLORS.notice,
  text_size: px(26),
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
}
// second notice line in locked mode, where the lap rows are hidden
export const NOTICE_SUB = {
  x: px(40),
  y: px(116),
  w: px(400),
  h: px(38),
  color: COLORS.noticeWarn,
  text_size: px(26),
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
}

// Horizontal rules between rows (always the same).
export const DIVIDERS = [
  line(60, 108, 360, 2),
  line(28, 158, 424, 2),
  line(44, 357, 392, 2),
  line(84, 409, 312, 2),
]
