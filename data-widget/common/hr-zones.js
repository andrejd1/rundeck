// Which HR zones the screen uses. "device" (the default) reads the zones the
// user set on the watch (Workout.getUserHrZoneSettings, Zepp OS 4.2+); older
// firmware falls back to 220 - age from the user profile, then to max HR 190.
// "custom" uses the zones the phone computed from the settings page.

import { Workout } from "@zos/sensor"
import { getProfile } from "@zos/user"
import { ageHrZones, deviceHrZones, hrZones } from "../../shared/zones.js"

// Read at screen start and on config changes only, so no caching needed.
export function readDeviceHrZones() {
  try {
    const w = new Workout()
    if (typeof w.getUserHrZoneSettings === "function") {
      const z = deviceHrZones(w.getUserHrZoneSettings())
      if (z) return z
    }
  } catch (e) {
    /* API missing on this firmware */
  }
  try {
    return ageHrZones(getProfile().age)
  } catch (e) {
    return null // no profile permission / data
  }
}

export function resolveHrZones(cfg) {
  if (cfg.hr_zone_source !== "device" && cfg.hr_zones) return cfg.hr_zones
  return readDeviceHrZones() || hrZones({ maxHr: 190 })
}
