import assert from "node:assert/strict"
import { test } from "node:test"
import {
  COUNT_AFTER_SEC,
  decideMode,
  emptyTrial,
  normalizeTrial,
  runsLeft,
  TRIAL_RUNS,
  TrialSession,
} from "../shared/trial.js"

// Drive a session through an activity: wall clock and native elapsed advance
// together from `start`.
function run(session, startWall, seconds, startElapsed = 0) {
  let mode
  for (let t = 0; t <= seconds; t += 1)
    mode = session.tick(startWall + t, startElapsed + t)
  return mode
}

test("a run counts once, after 5 minutes of native time", () => {
  const s = new TrialSession(emptyTrial(), false)
  assert.equal(run(s, 1000, COUNT_AFTER_SEC - 1), "trial")
  assert.equal(s.trial.used, 0)
  run(s, 1000 + COUNT_AFTER_SEC, 600, COUNT_AFTER_SEC)
  assert.equal(s.trial.used, 1)
})

test("short runs are free", () => {
  const s = new TrialSession(emptyTrial(), false)
  run(s, 0, 120)
  assert.equal(s.trial.used, 0)
})

test("no clock yet -> pending, nothing latched", () => {
  const s = new TrialSession(emptyTrial(), false)
  assert.equal(s.tick(0, null), "pending")
  assert.equal(s.mode, null)
})

test("after 5 counted runs the next activity is locked", () => {
  let state = emptyTrial()
  for (let i = 0; i < TRIAL_RUNS; i++) {
    const s = new TrialSession(state, false)
    run(s, i * 10000, 400)
    state = s.trial
  }
  assert.equal(state.used, TRIAL_RUNS)
  assert.equal(runsLeft(state), 0)
  const next = new TrialSession(state, false)
  assert.equal(next.tick(100000, 3), "locked")
})

test("the run that uses up the trial finishes unlocked", () => {
  const s = new TrialSession({ used: TRIAL_RUNS - 1, last: null }, false)
  assert.equal(run(s, 0, 3600), "trial")
  assert.equal(s.trial.used, TRIAL_RUNS)
})

test("reopening the screen in the same activity is not a new run", () => {
  const first = new TrialSession(emptyTrial(), false)
  run(first, 0, 900)
  assert.equal(first.trial.used, 1)
  // screen rebuilt 2 min later (wall), after a 1 min pause (elapsed +60)
  const again = new TrialSession(first.trial, false)
  run(again, 1020, 600, 960)
  assert.equal(again.trial.used, 1)
})

test("a reopened last trial activity stays unlocked", () => {
  const first = new TrialSession({ used: TRIAL_RUNS - 1, last: null }, false)
  run(first, 0, 900)
  const again = new TrialSession(first.trial, false)
  assert.equal(again.tick(1000, 950), "trial")
})

test("a new activity is recognized by its restarted native clock", () => {
  const first = new TrialSession(emptyTrial(), false)
  run(first, 0, 900)
  const next = new TrialSession(first.trial, false)
  run(next, 1200, 400) // elapsed restarts at 0
  assert.equal(next.trial.used, 2)
})

test("mode stays latched when the pause shifts the clocks apart", () => {
  const s = new TrialSession({ used: TRIAL_RUNS - 1, last: null }, false)
  run(s, 0, 400)
  // 20 min paused: wall moves, elapsed does not
  assert.equal(s.tick(1600, 400), "trial")
})

test("licensed is full and never counts", () => {
  const s = new TrialSession({ used: TRIAL_RUNS, last: null }, true)
  assert.equal(run(s, 0, 900), "full")
  assert.equal(s.trial.used, TRIAL_RUNS)
})

test("a license arriving mid-run unlocks immediately", () => {
  const s = new TrialSession({ used: TRIAL_RUNS, last: null }, false)
  assert.equal(s.tick(0, 10), "locked")
  s.setLicensed(true)
  assert.equal(s.tick(1, 11), "full")
})

test("phone count merges by max and marks dirty", () => {
  const s = new TrialSession({ used: 1, last: null }, false)
  s.mergeRemote(3)
  assert.equal(s.trial.used, 3)
  assert.deepEqual(s.takeDirty(), { used: 3, last: null })
  s.mergeRemote(2)
  assert.equal(s.takeDirty(), null)
})

test("normalizeTrial rejects junk", () => {
  assert.deepEqual(normalizeTrial("x"), emptyTrial())
  assert.deepEqual(
    normalizeTrial({ used: -2, last: { wall: "a" } }),
    emptyTrial(),
  )
  assert.equal(
    decideMode({
      licensed: false,
      trial: emptyTrial(),
      nowWall: 0,
      elapsed: 0,
    }),
    "trial",
  )
})
