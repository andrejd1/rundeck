// Customizable screen: a catalog of data fields and the slot layout that
// places them. The same layout is edited in the phone settings and on the
// watch (page/), so it carries an `updated_at` stamp and the newer copy wins.
//
// Platform-free: formatters take a context built by the data widget
// ({s: live snapshot, stats: RunStats, unit, hrZones, now: Date}).

import {
  ascentStr,
  distanceStr,
  durationStr,
  gradeStr,
  intStr,
  lapTimeStr,
  paceStr,
} from "./format.js"
import { zonePosition } from "./zones.js"

export const LAYOUT_VERSION = 1

// Slots top to bottom. `kind` decides the geometry (see the layout file):
// header = the big top value, half = two-column rows with inline labels,
// side = left/right of a big center, center = big value, bottom = last row.
export const SLOTS = [
  { id: "header", kind: "header", name: "Top", short: "Top" },
  { id: "r1l", kind: "half", name: "Row 1 left", short: "1 left" },
  { id: "r1r", kind: "half", name: "Row 1 right", short: "1 right" },
  { id: "r2l", kind: "side", name: "Row 2 left", short: "2 left" },
  { id: "r2c", kind: "center", name: "Row 2 center", short: "2 center" },
  { id: "r2r", kind: "side", name: "Row 2 right", short: "2 right" },
  { id: "r3l", kind: "side", name: "Row 3 left", short: "3 left" },
  { id: "r3c", kind: "center", name: "Row 3 center", short: "3 center" },
  { id: "r3r", kind: "side", name: "Row 3 right", short: "3 right" },
  { id: "r4l", kind: "half", name: "Row 4 left", short: "4 left" },
  { id: "r4r", kind: "half", name: "Row 4 right", short: "4 right" },
  { id: "r5l", kind: "bottom", name: "Bottom left", short: "5 left" },
  { id: "r5r", kind: "bottom", name: "Bottom right", short: "5 right" },
]

export const SLOT_IDS = SLOTS.map((s) => s.id)

// Label color groups (the layout file maps them to colors).
// hr: red, pace: blue, time: green, dist: orange, body: teal
const pace = (mps, ctx) => paceStr(mps, ctx.unit)
const avgSpeed = (ctx) =>
  ctx.s.avg_speed != null ? ctx.s.avg_speed : ctx.stats.avgSpeed()
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`)

/**
 * Field catalog. `label` fits every slot (<= 9 chars); `needs` names the
 * extra native channels the field polls (battery: only what is on screen).
 */
export const FIELDS = {
  none: { label: "", group: "body", value: () => "" },
  hr: { label: "HR", group: "hr", value: (c) => intStr(c.s.hr) },
  hr_zone: {
    label: "HR Zone",
    group: "hr",
    value: (c) => {
      const p = zonePosition(c.s.hr, c.hrZones)
      return p && p.zone > 0 ? `Z${p.zone}` : "--"
    },
  },
  avg_hr: {
    label: "Avg HR",
    group: "hr",
    value: (c) => intStr(c.stats.avgHr.value),
  },
  lap_hr: {
    label: "Lap HR",
    group: "hr",
    value: (c) => intStr(c.stats.lapHr()),
  },
  max_hr: { label: "Max HR", group: "hr", value: (c) => intStr(c.stats.maxHr) },
  pace: { label: "Pace", group: "pace", value: (c) => pace(c.s.speed, c) },
  avg_pace: {
    label: "Avg Pace",
    group: "pace",
    value: (c) => pace(avgSpeed(c), c),
  },
  lap_pace: {
    label: "Lap Pace",
    group: "pace",
    value: (c) => pace(c.stats.lapSpeed(), c),
  },
  last_lap_pace: {
    label: "Last Lap",
    group: "pace",
    value: (c) => {
      const l = c.stats.laps[c.stats.laps.length - 1]
      return pace(l && l.time > 0 ? l.distance / l.time : null, c)
    },
  },
  speed: {
    label: "Speed",
    group: "pace",
    value: (c) => {
      const v = c.s.speed
      if (v == null) return "--"
      const perHour = c.unit === "min_per_mile" ? 3600 / 1609.344 : 3.6
      return (v * perHour).toFixed(1)
    },
  },
  power: {
    label: "Power",
    group: "pace",
    needs: ["power"],
    value: (c) => intStr(c.s.power),
  },
  avg_power: {
    label: "Avg Pwr",
    group: "pace",
    needs: ["power"],
    value: (c) => intStr(c.stats.avgPower.value),
  },
  lap_power: {
    label: "Lap Pwr",
    group: "pace",
    needs: ["power"],
    value: (c) => intStr(c.stats.lapPower()),
  },
  elapsed: {
    label: "Time",
    group: "time",
    value: (c) => durationStr(c.s.elapsed),
  },
  lap_time: {
    label: "Lap Time",
    group: "time",
    value: (c) => lapTimeStr(c.stats.lapTime()),
  },
  clock: {
    label: "Clock",
    group: "time",
    value: (c) => `${c.now.getHours()}:${pad2(c.now.getMinutes())}`,
  },
  distance: {
    label: "Distance",
    group: "dist",
    value: (c) => distanceStr(c.s.distance, c.unit),
  },
  lap_distance: {
    label: "Lap Dist",
    group: "dist",
    value: (c) => distanceStr(c.stats.lapDistance(), c.unit),
  },
  laps: {
    label: "Laps",
    group: "dist",
    value: (c) => `${c.stats.laps.length}`,
  },
  grade: {
    label: "Grade",
    group: "dist",
    value: (c) => gradeStr(c.stats.grade),
  },
  ascent: {
    label: "Ascent",
    group: "dist",
    value: (c) => ascentStr(c.s.ascent, c.unit),
  },
  altitude: {
    label: "Altitude",
    group: "dist",
    value: (c) => ascentStr(c.s.altitude, c.unit),
  },
  cadence: {
    label: "Cadence",
    group: "body",
    value: (c) => intStr(c.s.cadence),
  },
  avg_cadence: {
    label: "Avg Cad",
    group: "body",
    needs: ["avg_cadence"],
    value: (c) => intStr(c.s.avg_cadence),
  },
  calories: {
    label: "Calories",
    group: "body",
    needs: ["calories"],
    value: (c) => intStr(c.s.calories),
  },
}

// Order shown in the pickers (phone and watch).
export const FIELD_IDS = [
  "hr",
  "hr_zone",
  "avg_hr",
  "lap_hr",
  "max_hr",
  "pace",
  "avg_pace",
  "lap_pace",
  "last_lap_pace",
  "speed",
  "power",
  "avg_power",
  "lap_power",
  "elapsed",
  "lap_time",
  "clock",
  "distance",
  "lap_distance",
  "laps",
  "grade",
  "ascent",
  "altitude",
  "cadence",
  "avg_cadence",
  "calories",
  "none",
]

// Long names for the pickers where there is room.
export const FIELD_NAMES = {
  none: "Empty",
  hr: "Heart rate",
  hr_zone: "HR zone",
  avg_hr: "Average HR",
  lap_hr: "Lap HR",
  max_hr: "Max HR",
  pace: "Pace",
  avg_pace: "Average pace",
  lap_pace: "Lap pace",
  last_lap_pace: "Last lap pace",
  speed: "Speed",
  power: "Power",
  avg_power: "Average power",
  lap_power: "Lap power",
  elapsed: "Workout time",
  lap_time: "Lap time",
  clock: "Time of day",
  distance: "Distance",
  lap_distance: "Lap distance",
  laps: "Lap count",
  grade: "Grade",
  ascent: "Total ascent",
  altitude: "Altitude",
  cadence: "Cadence",
  avg_cadence: "Average cadence",
  calories: "Calories",
}

export const BAR_OPTIONS = ["auto", "hr", "pace", "power", "off"]
export const BAR_NAMES = {
  auto: "Auto",
  hr: "HR zones",
  pace: "Pace zones",
  power: "Power zones",
  off: "Off",
}

// The reference layout.
export const DEFAULT_SLOTS = {
  header: "hr",
  r1l: "lap_hr",
  r1r: "avg_hr",
  r2l: "lap_pace",
  r2c: "pace",
  r2r: "avg_pace",
  r3l: "lap_time",
  r3c: "elapsed",
  r3r: "cadence",
  r4l: "lap_distance",
  r4r: "grade",
  r5l: "distance",
  r5r: "ascent",
}

export const defaultLayout = () => ({
  v: LAYOUT_VERSION,
  slots: { ...DEFAULT_SLOTS },
  bar: "auto",
  updated_at: 0,
})

/** Any input -> a complete layout; unknown slots/fields fall back to defaults. */
export function normalizeLayout(raw) {
  const out = defaultLayout()
  if (!raw || typeof raw !== "object") return out
  const slots = raw.slots && typeof raw.slots === "object" ? raw.slots : {}
  for (const id of SLOT_IDS) {
    if (FIELDS[slots[id]]) out.slots[id] = slots[id]
  }
  if (BAR_OPTIONS.indexOf(raw.bar) >= 0) out.bar = raw.bar
  const t = Number(raw.updated_at)
  if (Number.isFinite(t) && t > 0) out.updated_at = t
  return out
}

/** The newer of two layouts (ties keep `a`). */
export function newerLayout(a, b) {
  const la = normalizeLayout(a)
  const lb = normalizeLayout(b)
  return lb.updated_at > la.updated_at ? lb : la
}

/** Extra native channels the layout needs polled. */
export function channelsNeeded(layout, extra = []) {
  const set = {}
  for (const id of SLOT_IDS) {
    const f = FIELDS[layout.slots[id]]
    for (const n of (f && f.needs) || []) set[n] = true
  }
  if (layout.bar === "power") set.power = true
  for (const n of extra) set[n] = true
  return set
}

export function fieldValue(fieldId, ctx) {
  const f = FIELDS[fieldId] || FIELDS.none
  return f.value(ctx)
}
