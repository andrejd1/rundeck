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

// Screen: status 1 on / 2 off and the AOD setting from __sim.screen; tests
// flip it with __sim.setScreen(status), which fires the change callbacks.
export class Screen {
  constructor() {
    const s = sim()
    s.screen = s.screen || { status: 1, aod: false }
    s.screenListeners = s.screenListeners || []
    s.setScreen = (status) => {
      s.screen.status = status
      for (const cb of s.screenListeners.slice()) cb(status)
    }
  }
  getStatus() {
    return sim().screen.status
  }
  getAodMode() {
    return sim().screen.aod
  }
  onChange(cb) {
    sim().screenListeners.push(cb)
  }
  offChange(cb) {
    const l = sim().screenListeners
    const i = l.indexOf(cb)
    if (i >= 0) l.splice(i, 1)
  }
}
