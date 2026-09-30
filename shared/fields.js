// Customizable screen: a catalog of data fields and the slot layout that
// places them. The same layout is edited in the phone settings and on the
// watch (page/), so it carries an `updated_at` stamp and the newer copy wins.
//
// Platform-free: the one RunDeck-drawn value (HR zone) takes a context
// built by the data widget ({s: live snapshot, hrZones}).

import { zonePosition } from "./zones.js"

export const LAYOUT_VERSION = 1

// Slots top to bottom. `kind` decides the geometry (see the layout file):
// header = the big top value, half = two-column rows with inline labels,
// side = left/right of a big center, center = big value, bottom = last row.
export const SLOTS = [
  { id: "header", row: "header", name: "Top", short: "Top" },
  { id: "headerl", row: "header", name: "Top left", short: "Top left" },
  { id: "headerr", row: "header", name: "Top right", short: "Top right" },
  { id: "r1l", row: "r1", name: "Row 1 left", short: "1 left" },
  { id: "r1c", row: "r1", name: "Row 1 middle", short: "1 middle" },
  { id: "r1r", row: "r1", name: "Row 1 right", short: "1 right" },
  { id: "r2l", row: "r2", name: "Row 2 left", short: "2 left" },
  { id: "r2c", row: "r2", name: "Row 2 center", short: "2 center" },
  { id: "r2r", row: "r2", name: "Row 2 right", short: "2 right" },
  { id: "r3l", row: "r3", name: "Row 3 left", short: "3 left" },
  { id: "r3c", row: "r3", name: "Row 3 center", short: "3 center" },
  { id: "r3r", row: "r3", name: "Row 3 right", short: "3 right" },
  { id: "r4l", row: "r4", name: "Row 4 left", short: "4 left" },
  { id: "r4c", row: "r4", name: "Row 4 middle", short: "4 middle" },
  { id: "r4r", row: "r4", name: "Row 4 right", short: "4 right" },
  { id: "r5l", row: "r5", name: "Bottom left", short: "5 left" },
  { id: "r5c", row: "r5", name: "Bottom middle", short: "5 middle" },
  { id: "r5r", row: "r5", name: "Bottom right", short: "5 right" },
]

// Rows with a user-chosen column count. Limits keep text readable on a
// round 480 px screen: the top row takes 1 (with the HR graph) or 2, rows 1
// and 4 are thin strips (2 or 3), the big-number rows 2 and 3 take 1-3, and
// the bottom row, where the screen is only ~200 px wide, takes 1 or 2.
export const ROWS = [
  { id: "header", name: "Top row", cols: [1, 2] },
  { id: "r1", name: "Row 1", cols: [2, 3] },
  { id: "r2", name: "Row 2", cols: [1, 2, 3] },
  { id: "r3", name: "Row 3", cols: [1, 2, 3] },
  { id: "r4", name: "Row 4", cols: [2, 3] },
  { id: "r5", name: "Bottom row", cols: [1, 2] },
]
export const DEFAULT_COLS = { header: 1, r1: 2, r2: 3, r3: 3, r4: 2, r5: 2 }

// Which slots a row shows for a column count.
export function rowSlots(rowId, cols) {
  if (rowId === "header")
    return cols === 2 ? ["headerl", "headerr"] : ["header"]
  if (cols === 1) return [`${rowId}c`]
  if (cols === 2) return [`${rowId}l`, `${rowId}r`]
  return [`${rowId}l`, `${rowId}c`, `${rowId}r`]
}

/** Slots on screen for a layout, top to bottom. */
export function activeSlots(layout) {
  const out = []
  for (const row of ROWS) out.push(...rowSlots(row.id, layout.cols[row.id]))
  return out
}

// How field names appear on the watch.
export const LABEL_STYLES = ["text", "short", "icons"]
export const LABEL_STYLE_NAMES = {
  text: "Text",
  short: "Short text",
  icons: "Icons",
}

export const SLOT_IDS = SLOTS.map((s) => s.id)

// Label color groups (the layout file maps them to colors).
// hr: red, pace: blue, time: green, dist: orange, body: teal
//
// Every value is the watch's own: `native` is the @zos/ui sport_data type a
// SPORT_DATA widget draws over the slot, so what RunDeck shows is exactly
// what the native workout records (lap values follow the watch's own laps
// and auto-lap setting) and keeps updating while RunDeck's code is
// suspended. RunDeck draws only the label. `sample` is a widest typical
// value; it sizes the digits to fit the slot. The one exception is the HR
// zone: no native field carries it, so it is the native heart rate placed
// in the user's zones.

/**
 * Field catalog. `label` fits every slot (<= 9 chars), `short` is the
 * compact label (<= 5 chars), `icon` + `qual` the icon-mode label (icon file
 * in assets/common.r/icons, qualifier text next to it).
 */
export const FIELDS = {
  none: {
    short: "",
    icon: "",
    qual: "",
    label: "",
    group: "body",
  },
  hr_zone: {
    short: "Zone",
    icon: "zone",
    qual: "",
    label: "HR Zone",
    group: "hr",
    sample: "Z0",
    value: (c) => {
      const p = zonePosition(c.s.hr, c.hrZones)
      return p && p.zone > 0 ? `Z${p.zone}` : "--"
    },
  },
  hr: {
    short: "HR",
    icon: "heart",
    qual: "",
    label: "HR",
    group: "hr",
    native: "HR",
    sample: "000",
  },
  avg_hr: {
    short: "AvgHR",
    icon: "heart",
    qual: "Avg",
    label: "Avg HR",
    group: "hr",
    native: "HR_AVG",
    sample: "000",
  },
  lap_hr: {
    short: "LapHR",
    icon: "heart",
    qual: "Lap",
    label: "Lap HR",
    group: "hr",
    native: "HR_CUR_SECTION",
    sample: "000",
  },
  last_lap_hr: {
    short: "LastH",
    icon: "heart",
    qual: "Last",
    label: "Last HR",
    group: "hr",
    native: "HR_PREV_SECTION",
    sample: "000",
  },
  pace: {
    short: "Pace",
    icon: "gauge",
    qual: "",
    label: "Pace",
    group: "pace",
    native: "PACE",
    sample: "0'00\"",
  },
  avg_pace: {
    short: "AvgP",
    icon: "gauge",
    qual: "Avg",
    label: "Avg Pace",
    group: "pace",
    native: "PACE_AVG",
    sample: "0'00\"",
  },
  lap_pace: {
    short: "LapP",
    icon: "gauge",
    qual: "Lap",
    label: "Lap Pace",
    group: "pace",
    native: "PACE_CUR_AVG",
    sample: "0'00\"",
  },
  last_lap_pace: {
    short: "LastP",
    icon: "gauge",
    qual: "Last",
    label: "Last Lap",
    group: "pace",
    native: "PACE_PREV_AVG",
    sample: "0'00\"",
  },
  speed: {
    short: "Spd",
    icon: "gauge",
    qual: "Spd",
    label: "Speed",
    group: "pace",
    native: "SPEED",
    sample: "00.0",
  },
  power: {
    short: "Pwr",
    icon: "bolt",
    qual: "",
    label: "Power",
    group: "pace",
    native: "DEVICE_POWER",
    sample: "000",
  },
  avg_power: {
    short: "AvgW",
    icon: "bolt",
    qual: "Avg",
    label: "Avg Pwr",
    group: "pace",
    native: "DEVICE_AVG_POWER",
    sample: "000",
  },
  lap_power: {
    short: "LapW",
    icon: "bolt",
    qual: "Lap",
    label: "Lap Pwr",
    group: "pace",
    native: "DEVICE_LAP_AVG_POWER",
    sample: "000",
  },
  elapsed: {
    short: "Time",
    icon: "stopwatch",
    qual: "",
    label: "Time",
    group: "time",
    native: "DURATION_NET",
    sample: "0:00:00",
  },
  lap_time: {
    short: "LapT",
    icon: "stopwatch",
    qual: "Lap",
    label: "Lap Time",
    group: "time",
    native: "DURATION_CUR_SECTION",
    sample: "00:00",
  },
  last_lap_time: {
    short: "LastT",
    icon: "stopwatch",
    qual: "Last",
    label: "Last Lap",
    group: "time",
    native: "DURATION_PREV_SECTION",
    sample: "00:00",
  },
  clock: {
    short: "Clock",
    icon: "clock",
    qual: "",
    label: "Clock",
    group: "time",
    native: "OTHER_CUR_TIME",
    sample: "00:00",
  },
  distance: {
    short: "Dist",
    icon: "flag",
    qual: "",
    label: "Distance",
    group: "dist",
    native: "DISTANCE_TOTAL",
    sample: "00.00",
  },
  lap_distance: {
    short: "LapD",
    icon: "flag",
    qual: "Lap",
    label: "Lap Dist",
    group: "dist",
    native: "DISTANCE_CUR_SECTION",
    sample: "0.00",
  },
  laps: {
    short: "Lap#",
    icon: "laps",
    qual: "",
    label: "Lap #",
    group: "dist",
    native: "OTHER_SECTION_ORDER",
    sample: "00",
  },
  grade: {
    short: "Grade",
    icon: "slope",
    qual: "",
    label: "Grade",
    group: "dist",
    native: "SLOPE",
    sample: "-00%",
  },
  ascent: {
    short: "Asc",
    icon: "ascent",
    qual: "",
    label: "Ascent",
    group: "dist",
    native: "ALTITUDE_TOTAL_UP",
    sample: "0000",
  },
  altitude: {
    short: "Alt",
    icon: "altitude",
    qual: "",
    label: "Altitude",
    group: "dist",
    native: "ALTITUDE",
    sample: "0000",
  },
  cadence: {
    short: "Cad",
    icon: "feet",
    qual: "",
    label: "Cadence",
    group: "body",
    native: "STRIDE_FREQ",
    sample: "000",
  },
  avg_cadence: {
    short: "AvgC",
    icon: "feet",
    qual: "Avg",
    label: "Avg Cad",
    group: "body",
    native: "STRIDE_AVG_FREQ",
    sample: "000",
  },
  calories: {
    short: "Cal",
    icon: "flame",
    qual: "",
    label: "Calories",
    group: "body",
    native: "CONSUME",
    sample: "0000",
  },
  descent: {
    short: "Desc",
    icon: "descent",
    qual: "",
    label: "Descent",
    group: "dist",
    native: "ALTITUDE_TOTAL_DOWN",
    sample: "0000",
  },
  lap_ascent: {
    short: "LapAs",
    icon: "ascent",
    qual: "Lap",
    label: "Lap Asc",
    group: "dist",
    native: "ALTITUDE_CUR_UP",
    sample: "000",
  },
  lap_descent: {
    short: "LapDs",
    icon: "descent",
    qual: "Lap",
    label: "Lap Desc",
    group: "dist",
    native: "ALTITUDE_CUR_DOWN",
    sample: "000",
  },
  max_altitude: {
    short: "MaxAl",
    icon: "altitude",
    qual: "Max",
    label: "Max Alt",
    group: "dist",
    native: "ALTITUDE_MAX",
    sample: "0000",
  },
  vertical_speed: {
    short: "VSpd",
    icon: "vspeed",
    qual: "",
    label: "Vert Spd",
    group: "dist",
    native: "SPEED_VERTICAL",
    sample: "0000",
  },
  max_speed: {
    short: "MaxSp",
    icon: "gauge",
    qual: "Max",
    label: "Max Spd",
    group: "pace",
    native: "SPEED_MAX",
    sample: "00.0",
  },
  stride: {
    short: "Strd",
    icon: "feet",
    qual: "Len",
    label: "Stride",
    group: "body",
    native: "STRIDE",
    sample: "0.00",
  },
  avg_stride: {
    short: "AvgSt",
    icon: "feet",
    qual: "Avg",
    label: "Avg Strd",
    group: "body",
    native: "STRIDE_AVG",
    sample: "0.00",
  },
  steps: {
    short: "Steps",
    icon: "feet",
    qual: "",
    label: "Steps",
    group: "body",
    native: "STRIDE_COUNT",
    sample: "00000",
  },
  hr_pct_max: {
    short: "%Max",
    icon: "heart",
    qual: "%",
    label: "%HR Max",
    group: "hr",
    native: "HR_MAX_PERCENT",
    sample: "000%",
  },
  hr_pct_reserve: {
    short: "%HRR",
    icon: "heart",
    qual: "%R",
    label: "%HRR",
    group: "hr",
    native: "HR_RESERVED_PERCENT",
    sample: "000%",
  },
  aerobic_te: {
    short: "AerTE",
    icon: "load",
    qual: "Aer",
    label: "Aer TE",
    group: "body",
    native: "OTHER_AEROBIC_TE",
    sample: "0.0",
  },
  anaerobic_te: {
    short: "AnaTE",
    icon: "load",
    qual: "Ana",
    label: "Ana TE",
    group: "body",
    native: "OTHER_ANAEROBIC_TE",
    sample: "0.0",
  },
  train_load: {
    short: "Load",
    icon: "load",
    qual: "",
    label: "Load",
    group: "body",
    native: "OTHER_TRAIN_LOAD",
    sample: "000",
  },
  temperature: {
    short: "Temp",
    icon: "thermo",
    qual: "",
    label: "Temp",
    group: "time",
    native: "TEMP",
    sample: "-00",
  },
  sunset: {
    short: "Sunst",
    icon: "sun",
    qual: "",
    label: "Sunset",
    group: "time",
    native: "OTHER_SUNSET_TIME",
    sample: "00:00",
  },
}

// Order shown in the pickers (phone and watch).
export const FIELD_IDS = [
  "hr",
  "hr_zone",
  "avg_hr",
  "lap_hr",
  "last_lap_hr",
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
  "last_lap_time",
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
  "descent",
  "lap_ascent",
  "lap_descent",
  "max_altitude",
  "vertical_speed",
  "max_speed",
  "stride",
  "avg_stride",
  "steps",
  "hr_pct_max",
  "hr_pct_reserve",
  "aerobic_te",
  "anaerobic_te",
  "train_load",
  "temperature",
  "sunset",
  "none",
]

// Long names for the pickers where there is room.
export const FIELD_NAMES = {
  none: "Empty",
  hr: "Heart rate",
  hr_zone: "HR zone",
  avg_hr: "Average HR",
  lap_hr: "Lap HR",
  last_lap_hr: "Last lap HR",
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
  last_lap_time: "Last lap time",
  clock: "Time of day",
  distance: "Distance",
  lap_distance: "Lap distance",
  laps: "Lap number",
  grade: "Grade",
  ascent: "Total ascent",
  altitude: "Altitude",
  cadence: "Cadence",
  avg_cadence: "Average cadence",
  calories: "Calories",
  descent: "Total descent",
  lap_ascent: "Lap ascent",
  lap_descent: "Lap descent",
  max_altitude: "Max altitude",
  vertical_speed: "Vertical speed",
  max_speed: "Max speed",
  stride: "Stride length",
  avg_stride: "Average stride length",
  steps: "Steps",
  hr_pct_max: "% of max HR",
  hr_pct_reserve: "% of HR reserve",
  aerobic_te: "Aerobic training effect",
  anaerobic_te: "Anaerobic training effect",
  train_load: "Training load",
  temperature: "Temperature",
  sunset: "Sunset time",
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
  headerl: "hr",
  headerr: "elapsed",
  r1l: "lap_hr",
  r1c: "hr_pct_max",
  r1r: "avg_hr",
  r2l: "lap_pace",
  r2c: "pace",
  r2r: "avg_pace",
  r3l: "lap_time",
  r3c: "elapsed",
  r3r: "cadence",
  r4l: "lap_distance",
  r4c: "laps",
  r4r: "grade",
  r5l: "distance",
  r5c: "calories",
  r5r: "ascent",
}

export const defaultLayout = () => ({
  v: LAYOUT_VERSION,
  slots: { ...DEFAULT_SLOTS },
  cols: { ...DEFAULT_COLS },
  labels: "text",
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
  const cols = raw.cols && typeof raw.cols === "object" ? raw.cols : {}
  for (const row of ROWS) {
    const n = Number(cols[row.id])
    if (row.cols.indexOf(n) >= 0) out.cols[row.id] = n
  }
  if (LABEL_STYLES.indexOf(raw.labels) >= 0) out.labels = raw.labels
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

/** Text a RunDeck-drawn field shows ("" for native and empty ones). */
export function fieldValue(fieldId, ctx) {
  const f = FIELDS[fieldId] || FIELDS.none
  return f.value ? f.value(ctx) : ""
}
