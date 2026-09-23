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
  assert.equal(cfg.hr_zone_source, "device")
  assert.equal(cfg.hr_zones, null)
  assert.equal(cfg.auto_lap_m, 1000)
  assert.equal(cfg.target, null)
  assert.deepEqual(cfg.layout, DEFAULT_CONFIG.layout)
})

test("custom HR zone methods are computed on the phone", () => {
  const cfg = buildConfig(settings({ hr_zone_method: "max", max_hr: "200" }))
  assert.equal(cfg.hr_zone_source, "custom")
  assert.deepEqual(cfg.hr_zones, [100, 120, 140, 160, 180, 200])
})

test("pace/power zones need thresholds", () => {
  assert.equal(buildConfig(settings({})).power_zones, null)
  assert.ok(buildConfig(settings({ ftp: "280" })).power_zones)
  assert.ok(buildConfig(settings({ threshold_pace: "4:30" })).pace_zones)
})

test("target metric is chosen explicitly; miles auto-lap per mile", () => {
  const cfg = buildConfig(
    settings({
      target_metric: "power",
      target_range: "250-270",
      pace_unit: "min_per_mile",
    }),
  )
  assert.deepEqual(cfg.target, { metric: "power", min: 250, max: 270 })
  assert.equal(cfg.auto_lap_m, 1609.344)
  assert.equal(buildConfig(settings({ auto_lap: "0" })).auto_lap_m, 0)
  assert.equal(
    buildConfig(settings({ target_range: "4:40-4:50" })).target.metric,
    "pace",
  )
})

test("layout comes from layout_json, junk falls back to defaults", () => {
  const cfg = buildConfig(
    settings({
      layout_json: JSON.stringify({
        slots: { r2c: "power", r1l: "bogus" },
        bar: "power",
        updated_at: 5,
      }),
    }),
  )
  assert.equal(cfg.layout.slots.r2c, "power")
  assert.equal(cfg.layout.slots.r1l, "lap_hr")
  assert.equal(cfg.layout.bar, "power")
  assert.equal(cfg.layout.updated_at, 5)
  assert.deepEqual(
    buildConfig(settings({ layout_json: "{nope" })).layout,
    DEFAULT_CONFIG.layout,
  )
})

test("watch rejects configs of another version", () => {
  assert.deepEqual(normalizeConfig({ v: 1, primary: "power" }), DEFAULT_CONFIG)
  assert.equal(normalizeConfig({ v: 2, auto_lap_m: 0 }).auto_lap_m, 0)
})
