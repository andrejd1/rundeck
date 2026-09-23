// Runs the REAL data widget (index.js + layout) against the @zos stubs.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  HEADER_SUFFIX,
  NOTICE,
  NOTICE_SUB,
  ROW_GEOMETRY as RG,
} from "../data-widget/common/index.r.layout.js"
import { buildConfig } from "../shared/config.js"
import { LAYOUT_KEY, loadObject, TRIAL_KEY } from "../shared/device-store.js"
import { MSG } from "../shared/messages.js"
import { bootEditor, bootWidget } from "../sim/world.mjs"

// geometry of the default column counts
const SLOT_GEOMETRY = {
  header: RG.header[1].header,
  ...RG.r1[2],
  ...RG.r2[3],
  ...RG.r3[3],
  ...RG.r4[2],
  ...RG.r5[2],
}
const CENTER_VALUE = SLOT_GEOMETRY.r2c.value
const LAP_HR_VALUE = SLOT_GEOMETRY.r1l.value
const LAP_TIME_VALUE = SLOT_GEOMETRY.r3l.value
const LAP_DIST_VALUE = SLOT_GEOMETRY.r4l.value
const labelAt = (w, id) => w.textAt(SLOT_GEOMETRY[id].label)
const valueAt = (w, id) => w.textAt(SLOT_GEOMETRY[id].value)

const cfg = (obj = {}) => buildConfig((k) => obj[k])

test("trial: runs are counted silently after 5 minutes", async () => {
  const w = await bootWidget({ config: cfg() })
  w.run(3)
  assert.equal(w.page.state.mode, "pending") // offline: waiting for the phone
  w.run(8)
  assert.equal(w.page.state.mode, "trial")
  assert.equal(w.textAt(NOTICE), null) // no trial text on the run screen
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
  assert.equal(list.buttons()[0].props.text, "Top row: 1 col")
  assert.equal(list.buttons()[1].props.text, "Top: Heart rate")
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
  assert.equal(l.bar, "auto")
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

test("auto bar follows a power target and marks the range", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      ftp: "300",
      target_metric: "power",
      target_range: "270-300",
    }),
  })
  w.set({ sport: { ...globalThis.__sim.sport, power: { power: "285" } } })
  w.run(3)
  const band = w
    .widgets()
    .find((x) => x.type === "FILL_RECT" && x.props.h === 5)
  assert.equal(band.props.visible, true)
  assert.ok(band.props.w > 10)
  // power is polled because the target needs it
  assert.ok(globalThis.__sim.sportReads.power > 0)
})

test("watch editor: reusing the page instance goes back to the list", async () => {
  const e = await bootEditor({ pick: "r2c" })
  assert.equal(e.page.state.mode, "pick")
  // replace() to the same page may keep the state object: re-init with {}
  e.page.onInit(JSON.stringify({}))
  assert.equal(e.page.state.mode, "list")
  assert.equal(e.page.state.slot, null)
})

test("watch editor: a failure is shown on screen, not a black page", async () => {
  const e = await bootEditor({})
  e.page.state.error = new Error("boom")
  const before = e.widgets().length
  e.page.build()
  const added = e.widgets().slice(before)
  assert.equal(added.length, 1)
  assert.match(added[0].props.text, /RunDeck editor error:\nboom/)
})

test("watch editor: row buttons cycle the column count", async () => {
  const list = await bootEditor({})
  assert.ok(list.buttons().some((b) => b.props.text === "Row 1: 2 cols"))
  list.tap("Row 1: 2 cols")
  assert.equal(loadObject(LAYOUT_KEY).cols.r1, 3)
  const again = await bootEditor({})
  assert.ok(again.buttons().some((b) => b.props.text === "1 middle: Max HR"))
  again.tap("Labels: Text")
  assert.equal(loadObject(LAYOUT_KEY).labels, "short")
})

test("3 columns and icon labels on the run screen", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        cols: { r1: 3, r4: 3 },
        labels: "icons",
        updated_at: 2,
      }),
    }),
  })
  w.run(20)
  const r1c = RG.r1[3].r1c
  assert.equal(w.textAt(r1c.value) != null, true)
  const icons = w
    .widgets()
    .filter((x) => x.type === "IMG" && x.props.visible !== false)
  assert.ok(icons.some((i) => i.props.src === "icons/20/heart.png"))
  // the two-column slot of row 1 isn't drawn at its old spot any more
  assert.equal(w.textAt(RG.r1[2].r1l.value), null)
})

test("short labels", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({ labels: "short", updated_at: 2 }),
    }),
  })
  w.run(3)
  assert.equal(labelAt(w, "r1l"), "LapHR")
})

test("top row: two columns, HR label carries the zone", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        cols: { header: 2 },
        slots: { headerl: "hr", headerr: "elapsed" },
        updated_at: 2,
      }),
    }),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  w.run(5, { hr: 150 })
  assert.equal(w.textAt(RG.header[2].headerl.label), "HR Z4")
  assert.equal(w.textAt(RG.header[2].headerr.label), "Time")
  assert.ok(!w.textAt(HEADER_SUFFIX)) // no zone suffix in 2 columns
})

test("single non-HR top value is centered, no graph", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        slots: { header: "elapsed" },
        updated_at: 2,
      }),
    }),
  })
  w.run(5)
  // graph bars live in the header band (y 50-102); none may be drawn
  const bars = w
    .widgets()
    .filter(
      (x) =>
        x.type === "FILL_RECT" &&
        x.props.visible !== false &&
        x.props.y >= 50 &&
        x.props.y + x.props.h <= 102 &&
        x.props.h > 2 &&
        x.props.color !== 0,
    )
  assert.deepEqual(
    bars.map((b) => b.props),
    [],
  )
})

test("native-only fields are drawn by SPORT_DATA widgets in their slot", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        slots: { r4l: "descent", r4r: "aerobic_te" },
        updated_at: 2,
      }),
    }),
  })
  w.run(3)
  const natives = () =>
    w
      .widgets()
      .filter((x) => x.type === "SPORT_DATA" && x.props.visible !== false)
  assert.deepEqual(
    natives()
      .map((n) => n.props.default_type)
      .sort(),
    ["ALTITUDE_TOTAL_DOWN", "OTHER_AEROBIC_TE"],
  )
  const box = SLOT_GEOMETRY.r4l.value
  const d = natives().find(
    (n) => n.props.default_type === "ALTITUDE_TOTAL_DOWN",
  )
  assert.equal(d.props.x, box.x)
  assert.equal(d.props.y, box.y)
  assert.equal(labelAt(w, "r4l"), "Descent")
  assert.equal(w.textAt(box), null) // our own value text stays hidden
  // the lap notice covers row 4: native values hide with it
  w.pressLap()
  assert.equal(natives().length, 0)
})

test("heart rate target colors HR and marks the bar", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      target_metric: "hr",
      target_hr_low: "140",
      target_hr_high: "150",
    }),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  w.run(3, { hr: 160 })
  const header = w
    .widgets()
    .find(
      (x) =>
        x.type === "TEXT" &&
        x.props.visible !== false &&
        x.props.x === RG.header[1].header.value.x &&
        x.props.y === RG.header[1].header.value.y,
    )
  assert.equal(header.props.text, "160")
  assert.equal(header.props.color, 0xef4444) // above the range
  const band = w
    .widgets()
    .find((x) => x.type === "FILL_RECT" && x.props.h === 5)
  assert.equal(band.props.visible, true)
})

test("units: small unit after values, none on the big center numbers", async () => {
  const w = await bootWidget({ licensed: true, config: cfg({}) })
  w.run(300, { speed: 3.4, hr: 150 })
  assert.equal(w.unitAt(SLOT_GEOMETRY.r5l.value), "km") // distance
  assert.equal(w.unitAt(SLOT_GEOMETRY.r1l.value), null) // HR: no "bpm"
  assert.equal(w.unitAt(SLOT_GEOMETRY.r2r.value), null) // pace in 3 columns
  assert.equal(w.unitAt(SLOT_GEOMETRY.r3r.value), null) // cadence: no "spm"
  assert.equal(w.unitAt(SLOT_GEOMETRY.r2c.value), null) // big pace: none
  assert.equal(w.unitAt(SLOT_GEOMETRY.r3c.value), null) // big time: none
  assert.equal(w.unitAt(SLOT_GEOMETRY.r3l.value), null) // lap time has none
  // value and unit don't overlap
  const v = w
    .widgets()
    .find(
      (x) =>
        x.type === "TEXT" &&
        x.props.visible !== false &&
        x.props.text === w.textAt(SLOT_GEOMETRY.r5l.value) &&
        x.props.y === SLOT_GEOMETRY.r5l.value.y,
    )
  const u = w
    .widgets()
    .find(
      (x) =>
        x.type === "TEXT" && x.props.visible !== false && x.props.text === "km",
    )
  assert.ok(u.props.x >= v.props.x + v.props.w - 2)
})

test("pace unit only where the column is wide enough", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        slots: { r5r: "avg_pace", r1l: "lap_pace" },
        updated_at: 2,
      }),
    }),
  })
  w.run(300, { speed: 3.4, hr: 150 })
  assert.equal(w.unitAt(SLOT_GEOMETRY.r5r.value), "/km") // 2 columns
  assert.equal(w.unitAt(SLOT_GEOMETRY.r1l.value), "/km") // 2 columns
  assert.equal(w.unitAt(SLOT_GEOMETRY.r2r.value), null) // 3 columns
})

test("units follow miles and can be switched off", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({ pace_unit: "min_per_mile" }),
  })
  w.run(60, { speed: 3.4 })
  assert.equal(w.unitAt(SLOT_GEOMETRY.r5l.value), "mi")
  assert.equal(w.unitAt(SLOT_GEOMETRY.r5r.value), "ft")
  const off = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({ units: "hide", updated_at: 2 }),
    }),
  })
  off.run(60, { speed: 3.4 })
  assert.equal(off.unitAt(SLOT_GEOMETRY.r5l.value), null)
  assert.equal(off.textAt(SLOT_GEOMETRY.r5l.value), "0.20")
})
