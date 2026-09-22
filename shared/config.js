// Phone settings -> the compact config the watch renders with. Built on the
// phone (thresholds, zone math, target parsing) so the watch only reads
// ready-to-use numbers in internal units.

import { hrZones, paceZones, powerZones } from "./zones.js"

export const CONFIG_VERSION = 1
export const METERS_PER_MILE = 1609.344

export const DEFAULT_CONFIG = {
  v: CONFIG_VERSION,
  pace_unit: "min_per_km",
  primary: "pace", // big center metric: pace | power
  bar: "hr", // zone bar: hr | pace | power
  hr_zones: hrZones({ maxHr: 190 }),
  pace_zones: null,
  power_zones: null,
  target: null, // {metric: pace|power, min, max} in m/s or W
  auto_lap_m: 1000,
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
 * single "4:45" (±5 s). Power: "250-270" or "260" (±3%).
 */
export function parseTarget(metric, str, paceUnit = "min_per_km") {
  if (!str || (metric !== "pace" && metric !== "power")) return null
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
  if (vals.length === 1) vals.splice(0, 1, vals[0] * 0.97, vals[0] * 1.03)
  return {
    metric,
    min: Math.round(Math.min(...vals)),
    max: Math.round(Math.max(...vals)),
  }
}

/** `get(key)` returns the raw settings string (or "" / null). */
export function buildConfig(get) {
  const s = (k, d) => {
    const v = get(k)
    return v == null || v === "" ? d : String(v)
  }
  const paceUnit = s("pace_unit", "min_per_km")
  const thresholdPace = parsePace(s("threshold_pace", ""), paceUnit)
  const ftp = numOrNull(s("ftp", ""))
  const primary = s("primary_metric", "pace") === "power" ? "power" : "pace"
  let bar = s("bar_metric", "hr")
  const paceBounds = paceZones(thresholdPace)
  const powerBounds = powerZones(ftp)
  // a bar without thresholds would be meaningless: fall back to HR
  if (bar === "pace" && !paceBounds) bar = "hr"
  if (bar === "power" && !powerBounds) bar = "hr"
  if (bar !== "pace" && bar !== "power") bar = "hr"
  const autoLap = s("auto_lap", "1")
  return {
    v: CONFIG_VERSION,
    pace_unit: paceUnit === "min_per_mile" ? "min_per_mile" : "min_per_km",
    primary,
    bar,
    hr_zones: hrZones({
      method: s("hr_zone_method", "max"),
      maxHr: numOrNull(s("max_hr", "")),
      lthr: numOrNull(s("lthr", "")),
      custom: s("hr_zones_custom", ""),
    }),
    pace_zones: paceBounds,
    power_zones: powerBounds,
    // the target always applies to the big center metric
    target: parseTarget(primary, s("target_range", ""), paceUnit),
    auto_lap_m:
      autoLap === "0"
        ? 0
        : paceUnit === "min_per_mile"
          ? METERS_PER_MILE
          : 1000,
  }
}

/** Watch side: accept only a well-formed config, else the defaults. */
export function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== CONFIG_VERSION)
    return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...raw }
}
