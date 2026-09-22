// Trial accounting: 5 free runs, then the full screen needs a license.
//
// A run counts once it passes COUNT_AFTER_SEC of native elapsed time, once
// per activity — opening the screen, or reopening it in the same activity,
// never costs a run. The access mode is latched per activity: a run that
// starts on the trial finishes on it, even if it is the one that uses the
// trial up, and a license arriving mid-run upgrades immediately.
//
// State is plain JSON ({used, last}) persisted on the watch and mirrored to
// the phone (both sides keep the max). It is not tamper-proof and doesn't try
// to be: a reinstall can reset it.

export const TRIAL_RUNS = 5
export const COUNT_AFTER_SEC = 5 * 60
// A screen reopened within this window, with a native clock that has not gone
// backwards, belongs to the activity that was last counted.
const SAME_ACTIVITY_WINDOW_SEC = 30 * 60

export const emptyTrial = () => ({ used: 0, last: null })

export function normalizeTrial(raw) {
  const t = emptyTrial()
  if (!raw || typeof raw !== "object") return t
  const used = Number(raw.used)
  if (Number.isFinite(used) && used > 0) t.used = Math.floor(used)
  const l = raw.last
  if (l && Number.isFinite(l.wall) && Number.isFinite(l.elapsed)) {
    t.last = { wall: l.wall, elapsed: l.elapsed }
  }
  return t
}

export function runsLeft(trial) {
  return Math.max(0, TRIAL_RUNS - trial.used)
}

/** Is the activity now at `elapsed` the one the trial last counted? */
export function isCountedActivity(trial, nowWall, elapsed) {
  const l = trial.last
  if (!l || elapsed == null) return false
  return nowWall - l.wall <= SAME_ACTIVITY_WINDOW_SEC && elapsed >= l.elapsed
}

/**
 * Access mode for the activity starting to be shown now.
 * @returns {"full"|"trial"|"locked"}
 */
export function decideMode({ licensed, trial, nowWall, elapsed }) {
  if (licensed) return "full"
  if (isCountedActivity(trial, nowWall, elapsed)) return "trial"
  return trial.used < TRIAL_RUNS ? "trial" : "locked"
}

/**
 * Per-activity trial session: latches the mode, counts the run, keeps the
 * `last` marker fresh so a reopened screen is recognized.
 */
export class TrialSession {
  constructor(trial, licensed) {
    this.trial = normalizeTrial(trial)
    this.licensed = !!licensed
    this.mode = null // latched on the first tick with a native clock
    this.counted = false
    this.dirty = false
  }

  setLicensed(licensed) {
    this.licensed = !!licensed
    if (this.licensed) this.mode = "full"
  }

  /** Merge a trial count reported by the phone (max wins). */
  mergeRemote(used) {
    const n = Number(used)
    if (Number.isFinite(n) && n > this.trial.used) {
      this.trial.used = Math.floor(n)
      this.dirty = true
    }
  }

  /** One tick; returns the current mode. */
  tick(nowWall, elapsed) {
    if (this.mode == null) {
      if (elapsed == null && !this.licensed) return "pending"
      this.counted =
        !this.licensed && isCountedActivity(this.trial, nowWall, elapsed)
      this.mode = decideMode({
        licensed: this.licensed,
        trial: this.trial,
        nowWall,
        elapsed,
      })
    }
    if (this.mode !== "trial" || elapsed == null) return this.mode
    if (!this.counted && elapsed >= COUNT_AFTER_SEC) {
      this.counted = true
      this.trial.used += 1
      this.trial.last = { wall: nowWall, elapsed }
      this.dirty = true
    } else if (this.counted) {
      const l = this.trial.last
      // refresh the marker every 30 s of wall time (cheap flash writes)
      if (!l || nowWall - l.wall >= 30) {
        this.trial.last = { wall: nowWall, elapsed }
        this.dirty = true
      }
    }
    return this.mode
  }

  /** Returns the state to persist when it changed since the last call. */
  takeDirty() {
    if (!this.dirty) return null
    this.dirty = false
    return { used: this.trial.used, last: this.trial.last }
  }
}
