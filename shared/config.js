// Phone settings -> the compact config the watch renders with. Built on the
// phone (thresholds, zone math, target parsing) so the watch only reads
// ready-to-use numbers in internal units. The screen layout travels with it
// (shared/fields.js); the watch keeps whichever layout copy is newer.

import { defaultLayout, normalizeLayout } from "./fields.js"
import { hrZones, paceZones, powerZones } from "./zones.js"

export const CONFIG_VERSION = 2
export const METERS_PER_MILE = 1609.344

export const DEFAULT_CONFIG = {
  v: CONFIG_VERSION,
  pace_unit: "min_per_km",
  // "device": the watch's own HR zones (resolved on the watch), else the
  // phone-computed hr_zones below
  hr_zone_source: "device",
  hr_zones: null,
  pace_zones: null,
  power_zones: null,
  target: null, // {metric: pace|power, min, max} in m/s or W
  auto_lap_m: 1000,
  layout: defaultLayout(),
}

const numOrNull = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

// "4:30" / "4'30" / "4.30" per km|mi -> m/s
export function parsePace(str, paceUnit = "min_per_km") {
  if (str == null) return null
  const m = String(str)
    .trim()
    .match(/^(\d{1,2})\s*[:'.]\s*(\d{1,2})$/)
  if (!m) return null
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  if (!(sec > 0) || parseInt(m[2], 10) > 59) return null
  const meters = paceUnit === "min_per_mile" ? METERS_PER_MILE : 1000
  return meters / sec
}

/**
 * Target text -> {metric, min, max}. Pace: "4:40-4:50" (either order) or a
 * single "4:45" (±5 s). Power: "250-270" or "260" (±3%). Heart rate:
 * "150-160" or "155" (±5 bpm).
 */
export function parseTarget(metric, str, paceUnit = "min_per_km") {
  if (!str || (metric !== "pace" && metric !== "power" && metric !== "hr"))
    return null
  const parts = String(str)
    .split(/\s*[-–]\s*/)
    .filter(Boolean)
  if (parts.length < 1 || parts.length > 2) return null
  if (metric === "pace") {
    const vals = parts.map((p) => parsePace(p, paceUnit))
    if (vals.some((v) => v == null)) return null
    if (vals.length === 1) {
      const meters = paceUnit === "min_per_mile" ? METERS_PER_MILE : 1000
      const sec = meters / vals[0]
      vals.splice(0, 1, meters / (sec + 5), meters / (sec - 5))
    }
    return { metric, min: Math.min(...vals), max: Math.max(...vals) }
  }
  const vals = parts.map(Number)
  if (vals.some((v) => !Number.isFinite(v) || v <= 0)) return null
  if (vals.length === 1)
    vals.splice(
      0,
      1,
      ...(metric === "hr"
        ? [vals[0] - 5, vals[0] + 5]
        : [vals[0] * 0.97, vals[0] * 1.03]),
    )
  return {
    metric,
    min: Math.round(Math.min(...vals)),
    max: Math.round(Math.max(...vals)),
  }
}

// The target is entered as From / To, stored per metric
// (target_<metric>_low / _high) so switching between pace, power and heart
// rate keeps each range. Either end alone is a single value widened by the
// metric's tolerance. Older builds stored one "a-b" string in target_range,
// still honored while the metric's From / To are both empty.
export const targetKeys = (metric) => [
  `target_${metric}_low`,
  `target_${metric}_high`,
]

function targetText(s, metric) {
  const [lowKey, highKey] = targetKeys(metric)
  const low = s(lowKey, "")
  const high = s(highKey, "")
  if (low && high) return `${low}-${high}`
  return low || high || s("target_range", "")
}

/** Settings layout: the JSON the settings page and the watch write. */
export function readLayout(get) {
  let raw = null
  try {
    raw = JSON.parse(get("layout_json") || "null")
  } catch (e) {
    raw = null
  }
  return normalizeLayout(raw)
}

/** `get(key)` returns the raw settings string (or "" / null). */
export function buildConfig(get) {
  const s = (k, d) => {
    const v = get(k)
    return v == null || v === "" ? d : String(v)
  }
  const paceUnit =
    s("pace_unit", "min_per_km") === "min_per_mile"
      ? "min_per_mile"
      : "min_per_km"
  const method = s("hr_zone_method", "device")
  const autoLap = s("auto_lap", "1")
  const targetMetric = s("target_metric", "pace")
  return {
    v: CONFIG_VERSION,
    pace_unit: paceUnit,
    hr_zone_source: method === "device" ? "device" : "custom",
    hr_zones:
      method === "device"
        ? null
        : hrZones({
            method,
            maxHr: numOrNull(s("max_hr", "")),
            lthr: numOrNull(s("lthr", "")),
            custom: s("hr_zones_custom", ""),
          }),
    pace_zones: paceZones(parsePace(s("threshold_pace", ""), paceUnit)),
    power_zones: powerZones(numOrNull(s("ftp", ""))),
    target: parseTarget(targetMetric, targetText(s, targetMetric), paceUnit),
    auto_lap_m:
      autoLap === "0"
        ? 0
        : paceUnit === "min_per_mile"
          ? METERS_PER_MILE
          : 1000,
    layout: readLayout(get),
  }
}

/** Watch side: accept only a well-formed config, else the defaults. */
export function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== CONFIG_VERSION)
    return { ...DEFAULT_CONFIG, layout: defaultLayout() }
  return { ...DEFAULT_CONFIG, ...raw, layout: normalizeLayout(raw.layout) }
}
