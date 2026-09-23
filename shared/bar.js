// Which zones the zone bar shows. The watch gives extensions no access to a
// planned structured workout, so the bar follows the user's own settings:
//   auto  -> the target's metric when its threshold is known (power: FTP /
//            critical power, pace: LT pace), otherwise heart rate zones
//   hr / pace / power -> that metric, falling back to HR zones when its
//            threshold is missing
//   off   -> no bar
// When the bar shows the target's metric, the target range is drawn on it.

import { zonePosition } from "./zones.js"

/**
 * @returns {{metric: "hr"|"pace"|"power", bounds: number[],
 *   band: {from: number, to: number}|null}|null} null when the bar is off
 */
export function resolveBar(setting, cfg, hrZones) {
  if (setting === "off") return null
  const zonesFor = (m) =>
    m === "pace" ? cfg.pace_zones : m === "power" ? cfg.power_zones : hrZones
  const target = cfg.target
  let metric = setting
  if (setting === "auto" || !setting)
    metric = target && zonesFor(target.metric) ? target.metric : "hr"
  if (metric !== "hr" && !zonesFor(metric)) metric = "hr"
  const bounds = zonesFor(metric)
  if (!bounds) return null
  let band = null
  if (target && target.metric === metric) {
    const a = zonePosition(target.min, bounds)
    const b = zonePosition(target.max, bounds)
    if (a && b)
      band = { from: Math.min(a.pos, b.pos), to: Math.max(a.pos, b.pos) }
  }
  return { metric, bounds, band }
}

/** Live value for the bar's metric from the metrics snapshot. */
export function barValue(metric, s) {
  if (metric === "pace") return s.speed
  if (metric === "power") return s.power
  return s.hr
}
