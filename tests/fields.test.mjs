import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
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

test("every field is the watch's own value, except HR zone and VO2 max", () => {
  assert.deepEqual(Object.keys(FIELDS).sort(), [...FIELD_IDS].sort())
  for (const id of FIELD_IDS) {
    const f = FIELDS[id]
    assert.ok(FIELD_NAMES[id], `name for ${id}`)
    assert.ok(f.label.length <= 9, `label for ${id}`)
    assert.ok(f.short.length <= 5, `short label for ${id}`)
    if (id === "none") continue
    if (id === "hr_zone" || id === "vo2max") {
      assert.equal(f.native, undefined)
      continue
    }
    assert.match(f.native, /^[A-Z0-9_]+$/, id)
    assert.ok(f.sample, `sample for ${id}`)
    assert.equal(f.value, undefined, `${id} is drawn by the watch`)
    assert.equal(fieldValue(id, {}), "")
  }
  // no two fields show the same native value
  const natives = FIELD_IDS.map((id) => FIELDS[id].native).filter(Boolean)
  assert.equal(new Set(natives).size, natives.length)
})

test("the HR zone places the native heart rate in the zones", () => {
  const ctx = (hr) => ({ s: { hr }, hrZones: [100, 120, 140, 160, 180, 200] })
  assert.equal(fieldValue("hr_zone", ctx(150)), "Z3")
  assert.equal(fieldValue("hr_zone", ctx(null)), "--")
  assert.equal(fieldValue("bogus", ctx(150)), "")
})

test("VO2 max is the watch's user status value", () => {
  assert.equal(fieldValue("vo2max", { vo2max: 52.4 }), "52")
  assert.equal(fieldValue("vo2max", { vo2max: null }), "--")
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
  assert.equal(l.bar, "auto")
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

test("every native type exists in the Zepp OS SDK", () => {
  const dts = readFileSync(
    new URL(
      "../node_modules/@zeppos/device-types/dist/index.d.ts",
      import.meta.url,
    ),
    "utf8",
  )
  const start = dts.indexOf("interface IHmUISportDataType")
  const known = new Set(
    [
      ...dts.slice(start, dts.indexOf("}", start)).matchAll(/(\w+): number/g),
    ].map((m) => m[1]),
  )
  assert.ok(known.size > 100)
  for (const id of FIELD_IDS) {
    const t = FIELDS[id].native
    if (t) assert.ok(known.has(t), `${id}: ${t}`)
  }
})
