// Runs the REAL data widget (index.js + layout) against the @zos stubs.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CENTER_VALUE,
  LAP_DIST_VALUE,
  LAP_HR_VALUE,
  LAP_TIME_VALUE,
  NOTICE,
  NOTICE_SUB,
} from "../data-widget/common/index.r.layout.js"
import { buildConfig } from "../shared/config.js"
import { loadObject, TRIAL_KEY } from "../shared/device-store.js"
import { MSG } from "../shared/messages.js"
import { bootWidget } from "../sim/world.js"

const cfg = (obj = {}) => buildConfig((k) => obj[k])

test("trial: first run shows a notice and counts after 5 minutes", async () => {
  const w = await bootWidget({ config: cfg() })
  w.run(3)
  assert.equal(w.page.state.mode, "pending") // offline: waiting for the phone
  w.run(8)
  assert.equal(w.textAt(NOTICE), "Trial run 1 of 5")
  assert.equal(w.page.state.mode, "trial")
  w.run(300)
  assert.equal(loadObject(TRIAL_KEY).used, 1)
  const reports = (globalThis.__sim.sideCalls || []).filter(
    (c) => c.method === MSG.TRIAL_REPORT,
  )
  assert.deepEqual(
    reports.map((r) => r.params.trial_used),
    [1],
  )
  // the 30 s marker refresh does not spam the phone
  w.run(120)
  assert.equal(
    globalThis.__sim.sideCalls.filter((c) => c.method === MSG.TRIAL_REPORT)
      .length,
    1,
  )
})

test("trial used up: basic screen only", async () => {
  const w = await bootWidget({ config: cfg(), trial: { used: 5, last: null } })
  w.run(3)
  assert.notEqual(w.page.state.mode, "locked") // not before the phone had its say
  w.run(30)
  assert.equal(w.page.state.mode, "locked")
  assert.equal(w.textAt(NOTICE), "Unlock in Zepp app")
  assert.match(w.textAt(NOTICE_SUB), /Trial ended/)
  assert.equal(w.textAt(LAP_HR_VALUE), null) // hidden
  assert.equal(w.textAt(LAP_TIME_VALUE), null)
  assert.equal(w.textAt(CENTER_VALUE), "5'38")
})

test("license from the phone unlocks a locked screen mid-run", async () => {
  const w = await bootWidget({
    config: cfg(),
    trial: { used: 5, last: null },
    sideResponse: (req) =>
      req.method === MSG.GET_CONFIG
        ? { code: 0, config: cfg(), licensed: true, trial_used: 5 }
        : { code: 1 },
  })
  await new Promise((r) => setImmediate(r)) // let the GET_CONFIG reply land
  w.run(5)
  assert.equal(w.page.state.mode, "full")
  assert.notEqual(w.textAt(LAP_HR_VALUE), null)
  assert.equal(w.textAt(NOTICE_SUB), null)
})

test("the phone's higher trial count wins", async () => {
  const w = await bootWidget({
    config: cfg(),
    sideResponse: () => ({ code: 0, licensed: false, trial_used: 5 }),
  })
  await new Promise((r) => setImmediate(r))
  w.run(3)
  assert.equal(w.page.state.mode, "locked")
})

test("lap key closes a lap and leaves the native lap alone", async () => {
  const w = await bootWidget({ licensed: true, config: cfg({ auto_lap: "0" }) })
  w.run(100, { speed: 4 })
  assert.equal(w.pressLap(), false)
  assert.match(w.textAt(NOTICE), /^Lap 1 /)
  assert.equal(w.textAt(LAP_DIST_VALUE), null) // notice covers the row
  w.run(10, { speed: 4 })
  assert.equal(w.textAt(LAP_TIME_VALUE), "00:10")
  w.run(10, { speed: 4 })
  assert.equal(w.textAt(LAP_DIST_VALUE), "0.08") // notice gone after 6 s
})

test("center pace is colored against the target", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({ target_range: "5:00-5:20" }),
  })
  w.run(5)
  const center = w
    .widgets()
    .find((x) => x.props.x === CENTER_VALUE.x && x.props.y === CENTER_VALUE.y)
  assert.equal(center.props.color, 0x60a5fa) // 5'38 is slower: below
})
