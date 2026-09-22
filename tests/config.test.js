import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildConfig,
  DEFAULT_CONFIG,
  normalizeConfig,
  parsePace,
  parseTarget,
} from "../shared/config.js"

const settings = (obj) => (k) => obj[k]

test("pace parsing", () => {
  assert.equal(parsePace("4:00"), 1000 / 240)
  assert.equal(parsePace("4'30"), 1000 / 270)
  assert.equal(parsePace("8:00", "min_per_mile"), 1609.344 / 480)
  assert.equal(parsePace("4:75"), null)
  assert.equal(parsePace("fast"), null)
})

test("targets: ranges in either order, single values widened", () => {
  const t = parseTarget("pace", "4:50-4:40")
  assert.equal(t.min, 1000 / 290)
  assert.equal(t.max, 1000 / 280)
  const single = parseTarget("pace", "4:45")
  assert.equal(single.min, 1000 / 290)
  assert.equal(single.max, 1000 / 280)
  assert.deepEqual(parseTarget("power", "270-250"), {
    metric: "power",
    min: 250,
    max: 270,
  })
  assert.deepEqual(parseTarget("power", "260"), {
    metric: "power",
    min: 252,
    max: 268,
  })
  assert.equal(parseTarget("power", "abc"), null)
  assert.equal(parseTarget("hr", "150"), null)
})

test("defaults with empty settings", () => {
  const cfg = buildConfig(settings({}))
  assert.equal(cfg.primary, "pace")
  assert.equal(cfg.bar, "hr")
  assert.equal(cfg.auto_lap_m, 1000)
  assert.equal(cfg.target, null)
  assert.deepEqual(cfg.hr_zones, DEFAULT_CONFIG.hr_zones)
})

test("zone bar falls back to HR without thresholds", () => {
  assert.equal(buildConfig(settings({ bar_metric: "power" })).bar, "hr")
  assert.equal(
    buildConfig(settings({ bar_metric: "power", ftp: "280" })).bar,
    "power",
  )
  assert.equal(
    buildConfig(settings({ bar_metric: "pace", threshold_pace: "4:30" })).bar,
    "pace",
  )
})

test("target follows the center metric; miles auto-lap per mile", () => {
  const cfg = buildConfig(
    settings({
      primary_metric: "power",
      target_range: "250-270",
      pace_unit: "min_per_mile",
    }),
  )
  assert.deepEqual(cfg.target, { metric: "power", min: 250, max: 270 })
  assert.equal(cfg.auto_lap_m, 1609.344)
  assert.equal(buildConfig(settings({ auto_lap: "0" })).auto_lap_m, 0)
})

test("watch rejects configs of another version", () => {
  assert.deepEqual(normalizeConfig({ v: 99, primary: "power" }), DEFAULT_CONFIG)
  assert.equal(normalizeConfig({ v: 1, primary: "power" }).primary, "power")
})
