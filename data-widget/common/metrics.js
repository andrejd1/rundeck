// Live metrics adapter. Reads native workout data instead of estimating it:
// getSportData (@zos/app-access, permission data:user.hd.workout) and the
// HeartRate sensor. Every value degrades to null on signal loss.
//
// Battery: every getSportData call is an IPC into the native workout service.
// Channels on screen at full rate poll at 1 Hz; slow-moving ones (averages,
// altitude, ascent) poll every few ticks; power, calories and average cadence
// only when the layout shows them (`channels`). While the page is out of
// view (`display` false) only what the lap/average stats and the trial need
// is read: time, distance, HR, power, altitude.

import { getSportData } from "@zos/app-access"
import { HeartRate } from "@zos/sensor"
import { parseDurationString, parsePaceString } from "../../shared/parse.js"

function firstNumber(obj, keys) {
  if (!obj) return null
  for (const k of keys) {
    const v = parseFloat(obj[k])
    if (Number.isFinite(v)) return v
  }
  return null
}

export class LiveMetrics {
  constructor({ paceUnit = "min_per_km", channels = {} } = {}) {
    this.paceUnit = paceUnit
    this.channels = channels
    this.tick = 0
    this.hr = null
    this.heartRate = null
    this.hrInitAttempts = 0
    this._initHeartRate()
    this.snapshot = {
      speed: null, // m/s
      avg_speed: null,
      distance: null, // m
      elapsed: null, // s, native (excludes pauses)
      cadence: null,
      hr: null,
      power: null,
      altitude: null,
      ascent: null, // native total ascent, m
      calories: null,
      avg_cadence: null,
    }
  }

  // Requires data:user.hd.heart_rate; construction can fail transiently right
  // after the workout starts, so refresh() retries a few times.
  _initHeartRate() {
    if (this.heartRate || this.hrInitAttempts >= 5) return
    this.hrInitAttempts += 1
    try {
      this.heartRate = new HeartRate()
      this.heartRate.onCurrentChange(() => {
        this.hr = this.heartRate.getCurrent()
      })
      this.hr = this.heartRate.getCurrent()
    } catch (e) {
      this.heartRate = null
    }
  }

  _query(type, handler) {
    try {
      getSportData({ type }, (result) => {
        if (!result || result.code !== 0 || !result.data) return
        try {
          const arr = JSON.parse(result.data)
          handler(Array.isArray(arr) ? arr[0] : arr)
        } catch (e) {
          /* malformed payload -> keep last value */
        }
      })
    } catch (e) {
      /* API unavailable on this firmware -> stay null */
    }
  }

  _speedFromPace(str) {
    const secPerUnit = parsePaceString(str)
    if (!secPerUnit) return null
    return (this.paceUnit === "min_per_mile" ? 1609.344 : 1000) / secPerUnit
  }

  refresh({ display = true } = {}) {
    this.tick += 1
    const every = (n) => this.tick % n === 1
    const s = this.snapshot

    if (display)
      this._query("pace", (d) => {
        s.speed = this._speedFromPace(d && (d.pace || d.avg_pace))
      })
    this._query("distance", (d) => {
      const km = firstNumber(d, ["distance"])
      if (km != null) s.distance = km * 1000
    })
    this._query("duration", (d) => {
      // some firmwares report plain seconds instead of "mm:ss"
      const raw = d && d.duration
      const sec = Number.isFinite(raw) ? raw : parseDurationString(raw)
      if (sec != null) s.elapsed = sec
    })
    if (display)
      this._query("cadence", (d) => {
        const c = firstNumber(d, ["cadence"])
        if (c != null) s.cadence = c
      })
    if (every(5)) {
      if (display)
        this._query("avg_pace", (d) => {
          const v = this._speedFromPace(d && (d.avg_pace || d.pace))
          if (v != null) s.avg_speed = v
        })
      this._query("altitude", (d) => {
        const a = firstNumber(d, ["altitude"])
        if (a != null) s.altitude = a
      })
    }
    if (display && every(10)) {
      this._query("total_up_altitude", (d) => {
        const a = firstNumber(d, ["total_up_altitude"])
        if (a != null) s.ascent = a
      })
    }
    if (display && this.channels.calories && every(5)) {
      this._query("calories", (d) => {
        const v = firstNumber(d, ["calories"])
        if (v != null) s.calories = v
      })
    }
    if (display && this.channels.avg_cadence && every(5)) {
      this._query("avg_cadence", (d) => {
        const v = firstNumber(d, ["avg_cadence", "cadence"])
        if (v != null) s.avg_cadence = v
      })
    }
    // Running power (e.g. Stryd paired to the native workout) is not in the
    // documented getSportData types; probe it only when something shows it.
    if (this.channels.power) {
      this._query("power", (d) => {
        const w = firstNumber(d, ["power", "device_power"])
        if (w != null) s.power = w
      })
    }

    if (!this.heartRate) this._initHeartRate()
    if (this.heartRate) {
      try {
        const v = this.heartRate.getCurrent()
        if (v != null && v > 0) this.hr = v
      } catch (e) {
        /* keep last value */
      }
    }
    s.hr = this.hr != null && this.hr > 0 ? this.hr : null
    return s
  }

  destroy() {
    if (this.heartRate && this.heartRate.offCurrentChange) {
      try {
        this.heartRate.offCurrentChange()
      } catch (e) {
        /* ignore */
      }
    }
  }
}
