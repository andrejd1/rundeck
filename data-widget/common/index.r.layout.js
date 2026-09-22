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
  hrLabel: 0xef4444,
  paceLabel: 0x60a5fa,
  timeLabel: 0x22c55e,
  distLabel: 0xf59e0b,
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

// --- HR header --------------------------------------------------------------
export const HR_GRAPH = {
  x: px(92),
  y: px(50),
  h: px(52),
  barW: px(3), // pitch per bar; drawn 1 px narrower so the bars read apart
  minBarH: px(2),
}
export const HR_LABEL = label(214, 30, 60, COLORS.hrLabel, align.LEFT, 20)
export const HR_VALUE = value(212, 50, 120, 56, align.LEFT)
export const HR_ZONE = label(330, 64, 70, COLORS.value, align.LEFT, 28)

// --- lap HR | avg HR ----------------------------------------------------------
export const LAP_HR_LABEL = label(56, 121, 92, COLORS.hrLabel, align.RIGHT)
export const LAP_HR_VALUE = value(154, 114, 74, 34, align.LEFT)
export const AVG_HR_VALUE = value(252, 114, 74, 34, align.RIGHT)
export const AVG_HR_LABEL = label(332, 121, 92, COLORS.hrLabel, align.LEFT)

// --- lap pace | CENTER | avg pace -------------------------------------------
export const LAP_PACE_LABEL = label(
  22,
  180,
  118,
  COLORS.paceLabel,
  align.CENTER_H,
  20,
)
export const LAP_PACE_VALUE = value(22, 204, 118, 38)
export const CENTER_VALUE = value(140, 168, 200, 72)
export const CENTER_VALUE_WIDE_SIZE = px(52) // 5+ characters, e.g. "284W"
export const AVG_PACE_LABEL = label(
  340,
  166,
  118,
  COLORS.paceLabel,
  align.CENTER_H,
  20,
)
export const AVG_PACE_VALUE = value(340, 190, 118, 38)

// --- zone bar ---------------------------------------------------------------
export const ZONE_BAR = {
  x: px(26),
  y: px(258),
  w: px(428),
  h: px(14),
  gap: px(3),
  marker: { w: px(8), y: px(250), h: px(30), color: 0xffffff },
}

// --- lap time | ELAPSED | cadence -------------------------------------------
export const LAP_TIME_LABEL = label(
  22,
  284,
  118,
  COLORS.timeLabel,
  align.CENTER_H,
  20,
)
export const LAP_TIME_VALUE = value(22, 308, 118, 34)
export const ELAPSED_VALUE = value(140, 284, 200, 60)
export const ELAPSED_VALUE_LONG_SIZE = px(46) // past one hour: "1:03:34"
export const CADENCE_LABEL = label(
  340,
  284,
  118,
  COLORS.timeLabel,
  align.CENTER_H,
  20,
)
export const CADENCE_VALUE = value(340, 308, 118, 34)

// --- lap dist | grade -------------------------------------------------------
export const LAP_DIST_LABEL = label(
  58,
  376,
  94,
  COLORS.distLabel,
  align.RIGHT,
  20,
)
export const LAP_DIST_VALUE = value(156, 370, 78, 30, align.LEFT)
export const GRADE_VALUE = value(246, 370, 72, 30, align.RIGHT)
export const GRADE_LABEL = label(324, 376, 80, COLORS.distLabel, align.LEFT, 20)

// --- distance | ascent ------------------------------------------------------
export const DIST_LABEL = label(
  132,
  410,
  104,
  COLORS.distLabel,
  align.CENTER_H,
  18,
)
export const DIST_VALUE = value(132, 428, 104, 30)
export const ASCENT_LABEL = label(
  246,
  410,
  104,
  COLORS.distLabel,
  align.CENTER_H,
  18,
)
export const ASCENT_VALUE = value(246, 428, 104, 30)

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
