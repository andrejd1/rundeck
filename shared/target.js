// Optional pace or power target for the big center metric. The target is a
// {metric, min, max} range in internal units (m/s for pace, W for power);
// the center value is colored below / inside / above it.

// A few seconds of smoothing so GPS pace jitter doesn't flicker the color.
const WINDOW = 3

export function classify(value, target) {
  if (!target || value == null || !Number.isFinite(value)) return null
  const lo = Math.min(target.min, target.max)
  const hi = Math.max(target.min, target.max)
  if (value < lo) return "below"
  if (value > hi) return "above"
  return "inside"
}

export class TargetTracker {
  constructor(target) {
    this.target = target || null
    this.samples = []
  }

  setTarget(target) {
    this.target = target || null
    this.samples = []
  }

  /** Feed one sample (or null on signal loss); returns the smoothed status. */
  update(value) {
    if (!this.target) return null
    if (value == null || !Number.isFinite(value)) {
      this.samples = []
      return null
    }
    this.samples.push(value)
    if (this.samples.length > WINDOW) this.samples.shift()
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length
    return classify(avg, this.target)
  }
}
