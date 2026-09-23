// Training zones for the zone bar and the target check. Zones are derived on
// the phone from the athlete's thresholds and sent to the watch as a bounds
// array: [z1Low, z2Low, z3Low, z4Low, z5Low, top] in the metric's internal
// unit (bpm, m/s, W), strictly ascending. Five zones, equal-width bar
// segments; the marker is placed proportionally inside its zone.

export const ZONE_COUNT = 5

// Z1..Z5: blue, teal, green, amber, red (reference layout palette)
export const ZONE_COLORS = [0x3b82f6, 0x14b8a6, 0x22c55e, 0xf59e0b, 0xef4444]

// %max HR — the common 5-zone model (50/60/70/80/90%)
const MAX_HR_FRACTIONS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
// %LTHR — Friel running zones (Z1 <85%, Z2 85-89, Z3 90-94, Z4 95-99, Z5 100+)
const LTHR_FRACTIONS = [0.7, 0.85, 0.9, 0.95, 1.0, 1.06]
// % of threshold speed (easy < 78%, steady, tempo, threshold, VO2)
const PACE_FRACTIONS = [0.7, 0.78, 0.88, 0.95, 1.02, 1.15]
// %FTP — Stryd-style running power zones
const POWER_FRACTIONS = [0.65, 0.8, 0.9, 1.0, 1.15, 1.3]

const scale = (base, fractions) =>
  base != null && Number.isFinite(base) && base > 0
    ? fractions.map((f) => base * f)
    : null

export function isValidBounds(b) {
  if (!Array.isArray(b) || b.length !== ZONE_COUNT + 1) return false
  for (let i = 0; i < b.length; i++) {
    if (!Number.isFinite(b[i]) || b[i] <= 0) return false
    if (i > 0 && b[i] <= b[i - 1]) return false
  }
  return true
}

// "120,140,155,168,180" (Z1..Z5 lower bounds) + optional top; without a top
// the Z5 band gets the same width as Z4.
export function parseCustomBounds(str) {
  if (!str || typeof str !== "string") return null
  const nums = str
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number)
  if (nums.length === ZONE_COUNT) {
    const w = nums[4] - nums[3]
    nums.push(nums[4] + (w > 0 ? w : 10))
  }
  return isValidBounds(nums) ? nums : null
}

/**
 * Zones from the watch's own settings (Workout.getUserHrZoneSettings, Zepp
 * OS 4.2+): {type, rest, range: [z1Low..z5Low, max]} — already our format.
 */
export function deviceHrZones(settings) {
  const r = settings && settings.range
  if (!Array.isArray(r)) return null
  const b = r.map(Number)
  return isValidBounds(b) ? b : null
}

/** Estimated max HR (220 - age) zones, used when the watch has no zone API. */
export function ageHrZones(age) {
  const a = Number(age)
  if (!Number.isFinite(a) || a < 10 || a > 100) return null
  return scale(220 - a, MAX_HR_FRACTIONS).map(Math.round)
}

export function hrZones({ method = "max", maxHr, lthr, custom } = {}) {
  if (method === "custom") {
    const b = parseCustomBounds(custom)
    if (b) return b
  }
  if (method === "lthr") {
    const b = scale(lthr, LTHR_FRACTIONS)
    if (b) return b.map(Math.round)
  }
  const b = scale(maxHr || 190, MAX_HR_FRACTIONS)
  return b.map(Math.round)
}

export const paceZones = (thresholdMps) => scale(thresholdMps, PACE_FRACTIONS)
export const powerZones = (ftp) => {
  const b = scale(ftp, POWER_FRACTIONS)
  return b ? b.map(Math.round) : null
}

/**
 * Where a live value sits on the zone bar.
 * @returns {{zone:number, pos:number}|null} zone 1..5 (0 below Z1), pos 0..1
 *   along the whole bar (equal-width segments)
 */
export function zonePosition(value, bounds) {
  if (value == null || !Number.isFinite(value) || !isValidBounds(bounds))
    return null
  if (value < bounds[0]) return { zone: 0, pos: 0 }
  if (value >= bounds[ZONE_COUNT]) return { zone: ZONE_COUNT, pos: 1 }
  let i = 0
  while (i < ZONE_COUNT - 1 && value >= bounds[i + 1]) i++
  const inZone = (value - bounds[i]) / (bounds[i + 1] - bounds[i])
  return { zone: i + 1, pos: (i + inZone) / ZONE_COUNT }
}

export function zoneColor(zone) {
  return zone >= 1 && zone <= ZONE_COUNT ? ZONE_COLORS[zone - 1] : 0x8a97a8
}
