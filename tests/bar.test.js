import assert from "node:assert/strict"
import { test } from "node:test"
import { barValue, resolveBar } from "../shared/bar.js"

const HR = [100, 120, 140, 160, 180, 200]
const PACE = [2, 2.5, 3, 3.5, 4, 4.5]
const POWER = [200, 240, 270, 300, 345, 390]
const cfg = (o = {}) => ({
  pace_zones: null,
  power_zones: null,
  target: null,
  ...o,
})

test("auto: HR zones without a target", () => {
  const b = resolveBar("auto", cfg({ pace_zones: PACE }), HR)
  assert.equal(b.metric, "hr")
  assert.equal(b.band, null)
})

test("auto: follows a power target when FTP is set", () => {
  const b = resolveBar(
    "auto",
    cfg({
      power_zones: POWER,
      target: { metric: "power", min: 270, max: 300 },
    }),
    HR,
  )
  assert.equal(b.metric, "power")
  assert.deepEqual(b.bounds, POWER)
  assert.deepEqual(b.band, { from: 0.4, to: 0.6 })
})

test("auto: follows a pace target when LT pace is set", () => {
  const b = resolveBar(
    "auto",
    cfg({ pace_zones: PACE, target: { metric: "pace", min: 3, max: 3.5 } }),
    HR,
  )
  assert.equal(b.metric, "pace")
  assert.deepEqual(b.band, { from: 0.4, to: 0.6 })
})

test("auto: a target without its threshold falls back to HR", () => {
  const b = resolveBar(
    "auto",
    cfg({ target: { metric: "power", min: 1, max: 2 } }),
    HR,
  )
  assert.equal(b.metric, "hr")
  assert.equal(b.band, null)
})

test("explicit metric, fallback and off", () => {
  assert.equal(resolveBar("pace", cfg({ pace_zones: PACE }), HR).metric, "pace")
  assert.equal(resolveBar("power", cfg(), HR).metric, "hr")
  assert.equal(resolveBar("off", cfg(), HR), null)
  // explicit HR bar with a pace target: no band (different metric)
  assert.equal(
    resolveBar(
      "hr",
      cfg({ pace_zones: PACE, target: { metric: "pace", min: 3, max: 3.5 } }),
      HR,
    ).band,
    null,
  )
})

test("bar value per metric", () => {
  const s = { hr: 150, speed: 3.2, power: 280 }
  assert.equal(barValue("hr", s), 150)
  assert.equal(barValue("pace", s), 3.2)
  assert.equal(barValue("power", s), 280)
})
