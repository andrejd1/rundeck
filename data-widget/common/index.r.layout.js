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
// Every slot is a {label, value} pair of TEXT props; any field can go in any
// slot, so the widget shrinks text that would overflow its slot width.

export const HR_GRAPH = {
  x: px(92),
  y: px(50),
  h: px(52),
  barW: px(3), // pitch per bar; drawn 1 px narrower so the bars read apart
  minBarH: px(2),
}
// zone ("Z2") next to the header value when the header shows heart rate
export const HEADER_SUFFIX = label(330, 64, 70, COLORS.value, align.LEFT, 28)

export const SLOT_GEOMETRY = {
  header: {
    label: label(214, 30, 120, COLORS.value, align.LEFT, 20),
    value: value(212, 50, 124, 56, align.LEFT),
  },
  r1l: {
    label: label(56, 121, 92, COLORS.value, align.RIGHT),
    value: value(154, 114, 76, 34, align.LEFT),
  },
  r1r: {
    label: label(332, 121, 92, COLORS.value, align.LEFT),
    value: value(250, 114, 76, 34, align.RIGHT),
  },
  r2l: {
    label: label(22, 180, 118, COLORS.value, align.CENTER_H, 20),
    value: value(22, 204, 118, 38),
  },
  r2c: { label: null, value: value(140, 168, 200, 72) },
  r2r: {
    label: label(340, 166, 118, COLORS.value, align.CENTER_H, 20),
    value: value(340, 190, 118, 38),
  },
  r3l: {
    label: label(22, 284, 118, COLORS.value, align.CENTER_H, 20),
    value: value(22, 308, 118, 34),
  },
  r3c: { label: null, value: value(140, 284, 200, 60) },
  r3r: {
    label: label(340, 284, 118, COLORS.value, align.CENTER_H, 20),
    value: value(340, 308, 118, 34),
  },
  r4l: {
    label: label(58, 376, 94, COLORS.value, align.RIGHT, 20),
    value: value(156, 370, 78, 30, align.LEFT),
  },
  r4r: {
    label: label(324, 376, 80, COLORS.value, align.LEFT, 20),
    value: value(246, 370, 72, 30, align.RIGHT),
  },
  r5l: {
    label: label(132, 410, 104, COLORS.value, align.CENTER_H, 18),
    value: value(132, 428, 104, 30),
  },
  r5r: {
    label: label(246, 410, 104, COLORS.value, align.CENTER_H, 18),
    value: value(246, 428, 104, 30),
  },
}

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
}

// --- notice (trial status, lap flash, locked) overlaying the lap dist row ---
export const NOTICE = {
  x: px(56),
  y: px(366),
  w: px(368),
  h: px(40),
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

export const DIVIDERS = [
  line(60, 108, 360, 2),
  line(239, 114, 2, 40),
  line(28, 158, 424, 2),
  line(48, 362, 384, 2),
  line(239, 368, 2, 36),
  line(92, 406, 296, 2),
]
