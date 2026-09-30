// Runs the REAL data widget (index.js + layout) against the @zos stubs.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  HEADER_CENTERED,
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
  header: HEADER_CENTERED,
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
  assert.equal(w.typeAt(LAP_HR_VALUE), null) // hidden
  assert.equal(w.typeAt(LAP_TIME_VALUE), null)
  assert.equal(w.typeAt(CENTER_VALUE), "PACE")
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
  assert.equal(w.typeAt(LAP_HR_VALUE), "HR_CUR_SECTION")
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

test("every value is the watch's own: native widgets, nothing computed", async () => {
  const w = await bootWidget({ licensed: true, config: cfg() })
  w.run(3)
  const types = {}
  for (const [id, box] of Object.entries(SLOT_GEOMETRY))
    types[id] = w.typeAt(box.value)
  assert.deepEqual(types, {
    header: "HR",
    r1l: "HR_CUR_SECTION",
    r1r: "HR_AVG",
    r2l: "PACE_CUR_AVG",
    r2c: "PACE",
    r2r: "PACE_AVG",
    r3l: "DURATION_CUR_SECTION",
    r3c: "DURATION_NET",
    r3r: "STRIDE_FREQ",
    r4l: "DISTANCE_CUR_SECTION",
    r4r: "SLOPE",
    r5l: "DISTANCE_TOTAL",
    r5r: "ALTITUDE_TOTAL_UP",
  })
  // no RunDeck-drawn value text anywhere but the labels
  assert.equal(w.textAt(CENTER_VALUE), null)
  assert.equal(w.textAt(LAP_DIST_VALUE), null)
  // no watch chart widget beside the top HR
  assert.ok(!w.widgets().some((x) => x.props.default_type === "CHART_HR"))
})

test("the lap key is left to the watch", async () => {
  const w = await bootWidget({ licensed: true, config: cfg() })
  w.run(3)
  assert.equal(globalThis.__sim.keyHandler, undefined)
})

test("center pace is colored against the target", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({ target_range: "5:00-5:20" }),
  })
  w.run(5)
  assert.equal(w.nativeAt(CENTER_VALUE).props.text_color, 0x60a5fa) // 5'38 is slower: below
  // back in range: the watch-drawn value is recreated in the new color
  w.set({ sport: { ...globalThis.__sim.sport, pace: { pace: "5'10''" } } })
  w.run(5)
  assert.equal(w.nativeAt(CENTER_VALUE).props.text_color, 0x2ee66b)
  assert.equal(
    w.widgets().filter((x) => x.props.default_type === "PACE").length,
    1,
  )
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
  w.run(20)
  assert.equal(labelAt(w, "r1l"), "Avg HR")
  assert.equal(labelAt(w, "r3r"), "Distance")
  assert.equal(labelAt(w, "r4l"), "Calories")
  assert.equal(w.typeAt(SLOT_GEOMETRY.r4l.value), "CONSUME")
  assert.equal(w.typeAt(SLOT_GEOMETRY.r3r.value), "DISTANCE_TOTAL")
  // nothing is read that only the watch draws
  assert.equal(globalThis.__sim.sportReads.calories, undefined)
  assert.equal(globalThis.__sim.sportReads.distance, undefined)
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
  assert.ok(
    again.buttons().some((b) => b.props.text === "1 middle: % of max HR"),
  )
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
  assert.equal(w.typeAt(r1c.value), "HR_MAX_PERCENT")
  const icons = w
    .widgets()
    .filter((x) => x.type === "IMG" && x.props.visible !== false)
  assert.ok(icons.some((i) => i.props.src === "icons/20/heart.png"))
  // the two-column slot of row 1 isn't drawn at its old spot any more
  assert.equal(w.typeAt(RG.r1[2].r1l.value), null)
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

test("single non-HR top value is centered, no HR chart", async () => {
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
  assert.equal(w.typeAt(HEADER_CENTERED.value), "DURATION_NET")
  assert.ok(!w.widgets().some((x) => x.props.default_type === "CHART_HR"))
})

test("native values sit by their box's alignment", async () => {
  const w = await bootWidget({ licensed: true, config: cfg() })
  w.run(3)
  const box = SLOT_GEOMETRY.r1r.value // right-aligned beside its label
  const n = w.nativeAt(box)
  assert.equal(n.props.x + n.props.w, box.x + box.w)
  // every value keeps inside its slot, with room past its sample's width
  for (const [id, g] of Object.entries(SLOT_GEOMETRY)) {
    const d = w.nativeAt(g.value)
    assert.ok(d, id)
    assert.ok(d.props.x >= g.value.x, id)
    assert.ok(d.props.x + d.props.w <= g.value.x + g.value.w, id)
  }
  const left = w.nativeAt(SLOT_GEOMETRY.r1l.value)
  assert.equal(left.props.x, SLOT_GEOMETRY.r1l.value.x)
})

test("locked mode deletes the hidden native values", async () => {
  const w = await bootWidget({ config: cfg(), trial: { used: 5, last: null } })
  w.run(30)
  assert.equal(w.page.state.mode, "locked")
  const types = w
    .widgets()
    .filter((x) => x.type === "SPORT_DATA")
    .map((x) => x.props.default_type)
    .sort()
  // top HR and the two big center values only, no chart
  assert.deepEqual(types, ["DURATION_NET", "HR", "PACE"])
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
  const header = w.nativeAt(HEADER_CENTERED.value)
  assert.equal(header.props.default_type, "HR")
  assert.equal(header.props.text_color, 0xef4444) // above the range
  const band = w
    .widgets()
    .find((x) => x.type === "FILL_RECT" && x.props.h === 5)
  assert.equal(band.props.visible, true)
})

test("top HR icon is centered on the screen", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({ labels: "icons", updated_at: 2 }),
    }),
  })
  for (const hr of [95, 152]) {
    w.run(2, { hr })
    const icon = w
      .widgets()
      .find((x) => x.type === "IMG" && /\/heart\.png$/.test(x.props.src || ""))
    assert.equal(icon.props.x + icon.props.w / 2, 240, `HR ${hr}`)
  }
})

test("out of view: nothing drawn, drawn at once when back", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg(),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  w.run(5, { hr: 120 })
  assert.equal(w.textAt(HEADER_SUFFIX), "Z2")
  w.page.onPause()
  w.run(5, { hr: 160 })
  assert.equal(w.textAt(HEADER_SUFFIX), "Z2") // not redrawn meanwhile
  w.page.onResume()
  assert.equal(w.textAt(HEADER_SUFFIX), "Z4")
})

test("screen off without always-on display: no drawing, fresh on wake", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg(),
    sim: {
      screen: { status: 1, aod: false },
      hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] },
    },
  })
  w.run(5, { hr: 120 })
  globalThis.__sim.setScreen(2) // raise-to-wake: screen goes dark
  w.run(5, { hr: 160 })
  assert.equal(w.textAt(HEADER_SUFFIX), "Z2")
  // wrist raised: redrawn at once, without waiting for the next tick
  globalThis.__sim.setScreen(1)
  assert.equal(w.textAt(HEADER_SUFFIX), "Z4")
})

test("a missed screen-on event doesn't freeze the screen", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg(),
    sim: {
      screen: { status: 1, aod: false },
      hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] },
    },
  })
  w.run(5, { hr: 120 })
  globalThis.__sim.setScreen(2)
  w.run(5, { hr: 160 })
  globalThis.__sim.screen.status = 1 // on again, but no change event came
  w.run(1, { hr: 160 })
  assert.equal(w.textAt(HEADER_SUFFIX), "Z4")
})

test("screen off with always-on display: keeps drawing", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg(),
    sim: {
      screen: { status: 1, aod: true },
      hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] },
    },
  })
  w.run(5, { hr: 120 })
  globalThis.__sim.setScreen(2)
  w.run(5, { hr: 160 })
  assert.equal(w.textAt(HEADER_SUFFIX), "Z4")
})

test("only what colors the screen is read: pace and power on demand", async () => {
  const w = await bootWidget({ licensed: true, config: cfg() })
  w.run(5)
  const r = globalThis.__sim.sportReads
  assert.equal(r.duration, 6) // trial clock
  assert.equal(r.pace, undefined) // no pace target, HR bar
  assert.equal(r.power, undefined)
  const paced = await bootWidget({
    licensed: true,
    config: cfg({ target_range: "5:00-5:20" }),
  })
  paced.run(5)
  assert.ok(globalThis.__sim.sportReads.pace > 0)
})

test("VO2 max comes from the watch's user status", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({ slots: { r4r: "vo2max" }, updated_at: 2 }),
    }),
    sim: { workoutStatus: { vo2Max: 53.2 } },
  })
  w.run(2)
  assert.equal(w.textAt(SLOT_GEOMETRY.r4r.value), "53")
  assert.equal(w.typeAt(SLOT_GEOMETRY.r4r.value), null)
})

test("new native fields reach their slot", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        slots: { r4l: "power_3s", r4r: "last_lap_distance" },
        updated_at: 2,
      }),
    }),
  })
  w.run(2)
  assert.equal(w.typeAt(SLOT_GEOMETRY.r4l.value), "DEVICE_3S_AVG_POWER")
  assert.equal(w.typeAt(SLOT_GEOMETRY.r4r.value), "DISTANCE_PREV_SECTION")
})

test("watch-drawn values are not recreated when the page comes back", async () => {
  const w = await bootWidget({ licensed: true, config: cfg() })
  w.run(3)
  const before = w.widgets().filter((x) => x.type === "SPORT_DATA")
  w.page.onPause()
  w.page.onResume()
  w.run(3)
  const after = w.widgets().filter((x) => x.type === "SPORT_DATA")
  assert.equal(after.length, before.length)
  for (const x of before) assert.ok(after.includes(x))
})

test("a type the firmware doesn't know is never handed to the watch", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg(),
    sim: { unknownSportTypes: ["PACE_CUR_AVG"] },
  })
  w.run(3)
  assert.equal(w.typeAt(SLOT_GEOMETRY.r2l.value), null) // lap pace: blank
  assert.equal(w.typeAt(SLOT_GEOMETRY.r2c.value), "PACE")
  assert.ok(
    w
      .widgets()
      .filter((x) => x.type === "SPORT_DATA")
      .every((x) => x.props.default_type != null),
  )
})

test("workout time is sized like lap time until the hour digit appears", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        cols: { header: 2 },
        slots: { headerl: "lap_time", headerr: "elapsed" },
        updated_at: 2,
      }),
    }),
  })
  w.run(3)
  const size = (id) => w.nativeAt(RG.header[2][id].value).props.text_size
  assert.equal(size("headerr"), size("headerl"))
  w.run(3600)
  assert.ok(size("headerr") < size("headerl"))
})

test("every HR field names its zone, Z1 to Z5", async () => {
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: JSON.stringify({
        cols: { r1: 3 },
        slots: { r1c: "hr" },
        updated_at: 2,
      }),
    }),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  w.run(3, { hr: 70 }) // below zone 1 (90): no zone to name
  assert.equal(w.textAt(RG.r1[3].r1c.label), "HR")
  assert.ok(!w.textAt(HEADER_SUFFIX))
  w.run(3, { hr: 95 })
  assert.equal(w.textAt(RG.r1[3].r1c.label), "HR Z1")
  w.run(3, { hr: 150 })
  assert.equal(w.textAt(RG.r1[3].r1c.label), "HR Z4")
  assert.equal(w.textAt(HEADER_SUFFIX), "Z4")
})
