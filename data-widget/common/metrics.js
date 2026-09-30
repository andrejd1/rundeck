// Live values RunDeck needs for itself: every number on screen is drawn by
// the watch (SPORT_DATA widgets), so this reads only what colors the screen
// and counts trial runs: heart rate (zones, HR zone field), pace and power
// (zone bar and target colors) and the workout time (trial). All of them are
// the native workout's values (getSportData, the HeartRate sensor); nothing
// is computed. Every value degrades to null on signal loss.
//
// Battery: every getSportData call is an IPC into the native workout service;
// pace and power are read only when something colors by them (`channels`).
// getSportData may answer asynchronously: `onData` hears every answer.

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
    this.onData = null
    this.hr = null
    this.heartRate = null
    this.hrInitAttempts = 0
    this._initHeartRate()
    this.snapshot = {
      speed: null, // m/s
      elapsed: null, // s, native (excludes pauses)
      hr: null,
      power: null,
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
          if (this.onData) this.onData(type)
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

  refresh() {
    const s = this.snapshot
    if (this.channels.pace)
      this._query("pace", (d) => {
        s.speed = this._speedFromPace(d && (d.pace || d.avg_pace))
      })
    this._query("duration", (d) => {
      // some firmwares report plain seconds instead of "mm:ss"
      const raw = d && d.duration
      const sec = Number.isFinite(raw) ? raw : parseDurationString(raw)
      if (sec != null) s.elapsed = sec
    })
    // Running power (e.g. Stryd paired to the native workout) is not in the
    // documented getSportData types; probe it only when something uses it.
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
