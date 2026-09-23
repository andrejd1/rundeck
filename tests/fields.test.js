import assert from "node:assert/strict"
import { test } from "node:test"
import {
  channelsNeeded,
  DEFAULT_SLOTS,
  defaultLayout,
  FIELD_IDS,
  FIELD_NAMES,
  FIELDS,
  fieldValue,
  newerLayout,
  normalizeLayout,
  SLOT_IDS,
} from "../shared/fields.js"
import { RunStats } from "../shared/stats.js"

const ctx = (s = {}, stats = new RunStats()) => ({
  s: { hr: 150, speed: 1000 / 300, distance: 5000, elapsed: 1500, ...s },
  stats,
  unit: "min_per_km",
  hrZones: [100, 120, 140, 160, 180, 200],
  now: new Date(2026, 0, 1, 7, 5),
})

test("every field formats without throwing, with and without data", () => {
  for (const id of FIELD_IDS) {
    assert.equal(typeof fieldValue(id, ctx()), "string", id)
    assert.equal(
      typeof fieldValue(
        id,
        ctx({ hr: null, speed: null, distance: null, elapsed: null }),
      ),
      "string",
      id,
    )
    assert.ok(FIELD_NAMES[id], `name for ${id}`)
    assert.ok(FIELDS[id].label.length <= 9, `short label for ${id}`)
  }
})

test("a few formats", () => {
  assert.equal(fieldValue("pace", ctx()), "5'00")
  assert.equal(fieldValue("hr_zone", ctx()), "Z3")
  assert.equal(fieldValue("speed", ctx()), "12.0")
  assert.equal(fieldValue("clock", ctx()), "7:05")
  assert.equal(fieldValue("distance", ctx()), "5.00")
  assert.equal(fieldValue("bogus", ctx()), "")
})

test("default layout fills every slot", () => {
  const l = defaultLayout()
  for (const id of SLOT_IDS) assert.ok(FIELDS[l.slots[id]], id)
  assert.deepEqual(l.slots, DEFAULT_SLOTS)
})

test("normalize keeps valid picks and repairs the rest", () => {
  const l = normalizeLayout({
    slots: { header: "pace", r1l: "nope" },
    bar: "x",
    updated_at: "12",
  })
  assert.equal(l.slots.header, "pace")
  assert.equal(l.slots.r1l, DEFAULT_SLOTS.r1l)
  assert.equal(l.bar, "hr")
  assert.equal(l.updated_at, 12)
})

test("newer layout wins, ties keep the first", () => {
  const a = { slots: { header: "pace" }, updated_at: 10 }
  const b = { slots: { header: "clock" }, updated_at: 20 }
  assert.equal(newerLayout(a, b).slots.header, "clock")
  assert.equal(newerLayout(b, a).slots.header, "clock")
  assert.equal(newerLayout(a, { ...b, updated_at: 10 }).slots.header, "pace")
  assert.equal(newerLayout(a, null).slots.header, "pace")
})

test("only channels on screen are polled", () => {
  assert.deepEqual(channelsNeeded(defaultLayout()), {})
  const l = normalizeLayout({ slots: { r4l: "calories", r2c: "power" } })
  assert.deepEqual(channelsNeeded(l), { calories: true, power: true })
  assert.deepEqual(channelsNeeded(normalizeLayout({ bar: "power" })), {
    power: true,
  })
})
