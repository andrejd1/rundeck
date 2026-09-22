// Run statistics the native workout doesn't expose: laps (manual + auto),
// time-weighted averages, the HR history graph and grade. Driven by the
// native elapsed clock, so a paused workout accumulates nothing.
//
// Platform-free: fed one sample per tick by the data widget, unit-tested in
// Node.

export const HR_GRAPH_BARS = 36
export const HR_GRAPH_BUCKET_SEC = 10 // 36 x 10 s = the last 6 minutes

const MAX_TICK_GAP_SEC = 5 // longer gaps (screen asleep, page rebuilt) aren't credited as samples
const MIN_LAP_PACE_DIST_M = 10 // below this a lap pace is noise
const GRADE_SAMPLE_M = 10 // record an altitude point every 10 m of distance
const GRADE_MIN_SPAN_M = 40 // shortest distance a grade is computed over
const GRADE_MAX_SPAN_M = 100 // longest look-back window
const MAX_GRADE_PCT = 45

class WeightedMean {
  constructor() {
    this.sum = 0
    this.weight = 0
  }
  add(v, w) {
    if (v == null || !Number.isFinite(v) || v <= 0 || !(w > 0)) return
    this.sum += v * w
    this.weight += w
  }
  get value() {
    return this.weight > 0 ? this.sum / this.weight : null
  }
}

export class RunStats {
  constructor({ autoLapM = 0 } = {}) {
    this.autoLapM = autoLapM > 0 ? autoLapM : 0
    this.lastElapsed = null
    this.elapsed = null
    this.distance = null
    this.avgHr = new WeightedMean()
    this.avgPower = new WeightedMean()
    this.laps = [] // closed laps: {index, time, distance, hr, power}
    this.hrGraph = [] // closed buckets, oldest first
    this.bucket = { start: null, mean: new WeightedMean() }
    this.altPoints = [] // {d, alt}, spaced >= GRADE_SAMPLE_M
    this.grade = null
    this._startLap(0, 0)
  }

  _startLap(elapsed, distance) {
    this.lap = {
      index: this.laps.length + 1,
      startElapsed: elapsed,
      startDistance: distance,
      hr: new WeightedMean(),
      power: new WeightedMean(),
    }
  }

  setAutoLap(meters) {
    this.autoLapM = meters > 0 ? meters : 0
  }

  /**
   * One tick of native data. `elapsed` is the native workout clock (s),
   * `distance` in m; hr/power may be null on signal loss.
   * @returns {object|null} the lap closed by auto-lap on this tick, if any
   */
  update({ elapsed, distance, hr, power, altitude } = {}) {
    if (distance != null && Number.isFinite(distance) && distance >= 0) {
      this.distance = distance
    }
    if (elapsed == null || !Number.isFinite(elapsed)) return null
    const prev = this.lastElapsed
    this.lastElapsed = elapsed
    this.elapsed = elapsed
    if (prev == null) {
      // Opened mid-run: laps start from here, averages from the first sample.
      this.lap.startElapsed = elapsed
      this.lap.startDistance = this.distance || 0
      this.bucket.start = elapsed
      this._sampleAltitude(altitude)
      return null
    }
    const dt = elapsed - prev
    if (dt > 0 && dt <= MAX_TICK_GAP_SEC) {
      this.avgHr.add(hr, dt)
      this.avgPower.add(power, dt)
      this.lap.hr.add(hr, dt)
      this.lap.power.add(power, dt)
      this.bucket.mean.add(hr, dt)
    }
    this._rollGraph(elapsed)
    this._sampleAltitude(altitude)
    return this._checkAutoLap()
  }

  _rollGraph(elapsed) {
    if (this.bucket.start == null) this.bucket.start = elapsed
    while (elapsed - this.bucket.start >= HR_GRAPH_BUCKET_SEC) {
      this.hrGraph.push(this.bucket.mean.value)
      if (this.hrGraph.length > HR_GRAPH_BARS) this.hrGraph.shift()
      this.bucket = {
        start: this.bucket.start + HR_GRAPH_BUCKET_SEC,
        mean: new WeightedMean(),
      }
    }
  }

  _sampleAltitude(altitude) {
    if (altitude == null || !Number.isFinite(altitude) || this.distance == null)
      return
    const pts = this.altPoints
    const last = pts[pts.length - 1]
    if (last && this.distance - last.d < GRADE_SAMPLE_M) return
    pts.push({ d: this.distance, alt: altitude })
    while (pts.length > 2 && this.distance - pts[1].d >= GRADE_MAX_SPAN_M)
      pts.shift()
    const first = pts[0]
    const span = this.distance - first.d
    if (span >= GRADE_MIN_SPAN_M && span <= GRADE_MAX_SPAN_M * 1.5) {
      const g = ((altitude - first.alt) / span) * 100
      this.grade = Math.max(-MAX_GRADE_PCT, Math.min(MAX_GRADE_PCT, g))
    } else if (span > GRADE_MAX_SPAN_M * 1.5) {
      // distance jumped (GPS catch-up): restart the window
      this.altPoints = [{ d: this.distance, alt: altitude }]
      this.grade = null
    }
  }

  _checkAutoLap() {
    if (!this.autoLapM || this.distance == null) return null
    if (this.distance - this.lap.startDistance < this.autoLapM) return null
    // lap boundary lands on the exact auto-lap distance, not the sample
    // that crossed it, so 1 km laps don't drift by a few meters each
    return this._closeLap(this.lap.startDistance + this.autoLapM)
  }

  /** Manual lap (lap key). Returns the closed lap. */
  lapNow() {
    return this._closeLap(this.distance != null ? this.distance : 0)
  }

  _closeLap(atDistance) {
    const closed = {
      index: this.lap.index,
      time: this.lapTime(),
      distance: Math.max(0, atDistance - this.lap.startDistance),
      hr: this.lap.hr.value,
      power: this.lap.power.value,
    }
    this.laps.push(closed)
    this._startLap(this.elapsed != null ? this.elapsed : 0, atDistance)
    return closed
  }

  lapTime() {
    return this.elapsed != null
      ? Math.max(0, this.elapsed - this.lap.startElapsed)
      : 0
  }

  lapDistance() {
    return this.distance != null
      ? Math.max(0, this.distance - this.lap.startDistance)
      : 0
  }

  /** Lap average speed (m/s), null until the lap has covered enough ground. */
  lapSpeed() {
    const d = this.lapDistance()
    const t = this.lapTime()
    return d >= MIN_LAP_PACE_DIST_M && t > 0 ? d / t : null
  }

  lapHr() {
    return this.lap.hr.value
  }

  lapPower() {
    return this.lap.power.value
  }

  avgSpeed() {
    return this.distance && this.elapsed ? this.distance / this.elapsed : null
  }

  /** HR graph bars, oldest first, including the open bucket. */
  graph() {
    const open = this.bucket.mean.value
    const bars = open != null ? this.hrGraph.concat([open]) : this.hrGraph
    return bars.slice(-HR_GRAPH_BARS)
  }
}
