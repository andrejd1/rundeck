// Runs the REAL data widget (index.js + layout) against the @zos stubs.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  HEADER_SUFFIX,
  NOTICE,
  NOTICE_SUB,
  SLOT_GEOMETRY,
} from "../data-widget/common/index.r.layout.js"
import { buildConfig } from "../shared/config.js"
import { LAYOUT_KEY, loadObject, TRIAL_KEY } from "../shared/device-store.js"
import { MSG } from "../shared/messages.js"
import { bootEditor, bootWidget } from "../sim/world.js"

const CENTER_VALUE = SLOT_GEOMETRY.r2c.value
const LAP_HR_VALUE = SLOT_GEOMETRY.r1l.value
const LAP_TIME_VALUE = SLOT_GEOMETRY.r3l.value
const LAP_DIST_VALUE = SLOT_GEOMETRY.r4l.value
const labelAt = (w, id) => w.textAt(SLOT_GEOMETRY[id].label)
const valueAt = (w, id) => w.textAt(SLOT_GEOMETRY[id].value)

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

test("layout from the phone puts fields where the user wants them", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        slots: {
          r1l: "avg_hr",
          r1r: "lap_hr",
          r3r: "distance",
          r4l: "calories",
        },
        updated_at: 5,
      }),
    }),
  })
  w.set({ sport: { ...globalThis.__sim.sport, calories: { calories: "8" } } })
  w.run(20)
  assert.equal(labelAt(w, "r1l"), "Avg HR")
  assert.equal(labelAt(w, "r3r"), "Distance")
  assert.equal(labelAt(w, "r4l"), "Calories")
  assert.equal(valueAt(w, "r4l"), "8")
  // calories are polled only because they are on screen
  assert.ok(globalThis.__sim.sportReads.calories > 0)
})

test("a newer layout edited on the watch beats the phone's", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({ slots: { r2c: "pace" }, updated_at: 5 }),
    }),
    layout: { slots: { r2c: "clock" }, updated_at: 9 },
  })
  w.run(2)
  assert.equal(w.page.state.layout.slots.r2c, "clock")
})

test("watch edits reach the phone on the next config reply", async () => {
  const w = await bootWidget({
    licensed: true,
    layout: { slots: { r2c: "clock" }, updated_at: 9 },
    sideResponse: () => ({
      code: 0,
      licensed: true,
      config: cfg({ layout_json: JSON.stringify({ updated_at: 5 }) }),
    }),
  })
  await new Promise((r) => setImmediate(r))
  const sent = globalThis.__sim.sideCalls.filter(
    (c) => c.method === MSG.LAYOUT_UPDATE,
  )
  assert.equal(sent.length, 1)
  assert.equal(sent[0].params.layout.slots.r2c, "clock")
  assert.equal(w.page.state.layout.slots.r2c, "clock")
})

test("device HR zones are the default", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({}),
    sim: {
      hr: 150,
      hrZoneSettings: {
        type: 1,
        rest: 60,
        range: [90, 108, 126, 144, 162, 181],
      },
    },
  })
  w.run(2, { hr: 150 })
  assert.deepEqual(w.page.state.hrZones, [90, 108, 126, 144, 162, 181])
  assert.equal(w.textAt(HEADER_SUFFIX), "Z4")
})

test("no zone API: zones from the profile age, then max HR 190", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({}),
    sim: { profile: { age: 40 } },
  })
  assert.deepEqual(w.page.state.hrZones, [90, 108, 126, 144, 162, 180])
  const w2 = await bootWidget({ licensed: true, config: cfg({}) })
  assert.deepEqual(w2.page.state.hrZones, [95, 114, 133, 152, 171, 190])
})

test("custom phone zones override the watch", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({ hr_zone_method: "max", max_hr: "200" }),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  assert.deepEqual(w.page.state.hrZones, [100, 120, 140, 160, 180, 200])
})

test("watch editor: pick a field for a slot", async () => {
  const list = await bootEditor({})
  assert.equal(list.buttons()[0].props.text, "Top: Heart rate")
  list.tap("2 center: Pace")
  assert.deepEqual(JSON.parse(globalThis.__sim.navigation.at(-1).params), {
    pick: "r2c",
  })

  const pick = await bootEditor({ pick: "r2c" })
  pick.tap("Power")
  const saved = loadObject(LAYOUT_KEY)
  assert.equal(saved.slots.r2c, "power")
  assert.ok(saved.updated_at > 0)
  const sent = globalThis.__sim.sideCalls.filter(
    (c) => c.method === MSG.LAYOUT_UPDATE,
  )
  assert.equal(sent.at(-1).params.layout.slots.r2c, "power")

  const again = await bootEditor({})
  assert.ok(again.buttons().some((b) => b.props.text === "2 center: Power"))
})

test("watch editor: zone bar and reset", async () => {
  const bar = await bootEditor({ pick: "bar" })
  bar.tap("Off")
  assert.equal(loadObject(LAYOUT_KEY).bar, "off")
  const list = await bootEditor({})
  list.tap("Reset to default")
  const l = loadObject(LAYOUT_KEY)
  assert.equal(l.bar, "hr")
  assert.equal(l.slots.r2c, "pace")
})

test("zone bar off hides the bar", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({ layout_json: JSON.stringify({ bar: "off", updated_at: 1 }) }),
  })
  w.run(3)
  const marker = w
    .widgets()
    .find((x) => x.type === "FILL_RECT" && x.props.w === 8)
  assert.equal(marker.props.visible, false)
})
