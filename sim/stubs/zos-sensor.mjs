// Headless stubs of the @zos/sensor classes the widget uses. Live values come
// from globalThis.__sim so scenarios can script them.

const sim = () => globalThis.__sim || {}

export class HeartRate {
  getCurrent() {
    return sim().hr != null ? sim().hr : 0
  }
  onCurrentChange() {}
  offCurrentChange() {}
}

// Workout: getUserHrZoneSettings exists only when __sim.hrZoneSettings is
// set, like firmware below Zepp OS 4.2 where the method is missing.
export class Workout {
  constructor() {
    const z = sim().hrZoneSettings
    if (z) this.getUserHrZoneSettings = () => z
  }
  getStatus() {
    return {}
  }
}
