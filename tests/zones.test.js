import assert from "node:assert/strict"
import { test } from "node:test"
import {
  hrZones,
  isValidBounds,
  paceZones,
  parseCustomBounds,
  powerZones,
  zonePosition,
} from "../shared/zones.js"

test("HR zones from max HR", () => {
  assert.deepEqual(hrZones({ maxHr: 200 }), [100, 120, 140, 160, 180, 200])
  assert.deepEqual(hrZones({}), [95, 114, 133, 152, 171, 190])
})

test("HR zones from LTHR and custom, with fallbacks", () => {
  assert.deepEqual(
    hrZones({ method: "lthr", lthr: 170 }),
    [119, 145, 153, 162, 170, 180],
  )
  assert.deepEqual(
    hrZones({ method: "custom", custom: "120,140,155,168,180" }),
    [120, 140, 155, 168, 180, 192],
  )
  assert.deepEqual(
    hrZones({ method: "custom", custom: "1,2", maxHr: 200 })[5],
    200,
  )
  assert.deepEqual(hrZones({ method: "lthr", maxHr: 200 })[0], 100)
})

test("custom bounds must ascend", () => {
  assert.equal(parseCustomBounds("150,140,155,168,180"), null)
  assert.deepEqual(
    parseCustomBounds("120 140 155 168 180 195"),
    [120, 140, 155, 168, 180, 195],
  )
})

test("pace and power zones need thresholds", () => {
  assert.equal(paceZones(null), null)
  assert.equal(powerZones(0), null)
  assert.ok(isValidBounds(paceZones(1000 / 270)))
  assert.deepEqual(powerZones(300), [195, 240, 270, 300, 345, 390])
})

test("zone position: equal-width segments, clamped ends", () => {
  const b = [100, 120, 140, 160, 180, 200]
  assert.deepEqual(zonePosition(90, b), { zone: 0, pos: 0 })
  assert.deepEqual(zonePosition(100, b), { zone: 1, pos: 0 })
  assert.deepEqual(zonePosition(150, b), { zone: 3, pos: 0.5 })
  assert.deepEqual(zonePosition(250, b), { zone: 5, pos: 1 })
  assert.equal(zonePosition(null, b), null)
  assert.equal(zonePosition(150, [1, 2]), null)
})
