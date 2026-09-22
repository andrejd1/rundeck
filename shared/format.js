// Display formatting for the RunDeck screen. Internal units: speed in m/s,
// distance and altitude in meters, time in seconds, power in watts.

const METERS_PER_MILE = 1609.344
const FEET_PER_METER = 3.28084

export const isImperial = (paceUnit) => paceUnit === "min_per_mile"

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`)

// m/s -> "5'38" (per km or mile). Slower than 59'59 reads as no pace.
export function paceStr(mps, paceUnit = "min_per_km") {
  if (mps == null || !Number.isFinite(mps) || mps <= 0) return "-'--"
  const meters = isImperial(paceUnit) ? METERS_PER_MILE : 1000
  let sec = Math.round(meters / mps)
  if (sec > 59 * 60 + 59) return "-'--"
  const m = Math.floor(sec / 60)
  sec -= m * 60
  return `${m}'${pad2(sec)}`
}

// 2014 -> "33:34", 3814 -> "1:03:34"
export function durationStr(sec) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "--:--"
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`
}

// Lap clock keeps two minute digits like the reference layout: "00:43"
export function lapTimeStr(sec) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "--:--"
  const s = Math.floor(sec)
  if (s >= 3600) return durationStr(s)
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

// meters -> "7.14" in km or miles, one decimal from 100 up
export function distanceStr(m, paceUnit = "min_per_km") {
  if (m == null || !Number.isFinite(m) || m < 0) return "--"
  const v = m / (isImperial(paceUnit) ? METERS_PER_MILE : 1000)
  return v >= 100 ? v.toFixed(1) : v.toFixed(2)
}

export function ascentStr(m, paceUnit = "min_per_km") {
  if (m == null || !Number.isFinite(m)) return "--"
  return `${Math.round(isImperial(paceUnit) ? m * FEET_PER_METER : m)}`
}

export function gradeStr(pct) {
  if (pct == null || !Number.isFinite(pct)) return "--%"
  const r = Math.round(pct)
  return `${r === 0 ? 0 : r}%`
}

export function intStr(v) {
  return v == null || !Number.isFinite(v) ? "--" : `${Math.round(v)}`
}
