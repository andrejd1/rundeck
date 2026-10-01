// Presets and settings export / import: the platform-free logic.
import assert from "node:assert/strict"
import { test } from "node:test"
import { exportSettings, importSettings } from "../shared/backup.js"
import { buildConfig, normalizeConfig } from "../shared/config.js"
import {
  MAX_PRESETS,
  normalizePresets,
  presetFromSettings,
  presetMatches,
  presetSettings,
  withLocalPreset,
} from "../shared/presets.js"

const getter = (obj) => (k) => (k in obj ? obj[k] : null)
const layout = { slots: { r2c: "power" }, bar: "power", updated_at: 5 }

test("a preset is the layout and target, nothing personal", () => {
  const get = getter({
    target_metric: "power",
    target_power_low: "250",
    target_power_high: "270",
    ftp: "290",
    pace_unit: "min_per_mile",
  })
  const p = presetFromSettings(get, "p1", "  Tempo   run ", layout)
  assert.equal(p.name, "Tempo run")
  assert.equal(p.layout.slots.r2c, "power")
  assert.equal(p.layout.updated_at, undefined)
  assert.equal(p.values.target_power_low, "250")
  assert.equal(p.values.ftp, undefined)
  assert.equal(p.values.pace_unit, undefined)
  assert.ok(presetMatches(get, p, layout))
  assert.ok(!presetMatches(get, p, { ...layout, bar: "hr" }))
})

test("applying a preset stamps layout and target and clears the legacy target", () => {
  const p = presetFromSettings(
    getter({ target_metric: "hr", target_hr_low: "150" }),
    "p1",
    "Easy",
    layout,
  )
  const out = presetSettings(p, 1000)
  assert.equal(JSON.parse(out.layout_json).updated_at, 1000)
  assert.equal(out.target_metric, "hr")
  assert.equal(out.target_hr_low, "150")
  assert.equal(out.target_pace_low, "")
  assert.equal(out.target_range, "")
  assert.deepEqual(JSON.parse(out.preset_active), { id: "p1", at: 1000 })
})

test("preset lists drop junk, duplicates and anything past the limit", () => {
  const ok = (i) => ({ id: `p${i}`, name: `P${i}` })
  const list = normalizePresets([
    null,
    { id: "", name: "x" },
    { id: "a", name: "  " },
    ok(1),
    ok(1),
    ...Array.from({ length: 10 }, (_, i) => ok(i + 2)),
  ])
  assert.equal(list.length, MAX_PRESETS)
  assert.equal(list[0].id, "p1")
  assert.equal(list[1].id, "p2")
})

test("the watch config carries every preset with its target parsed", () => {
  const p = presetFromSettings(
    getter({ target_metric: "pace", target_pace_low: "8:00" }),
    "p1",
    "Easy",
    layout,
  )
  const cfg = buildConfig(
    getter({
      pace_unit: "min_per_mile",
      presets_json: JSON.stringify([p]),
      preset_active: JSON.stringify({ id: "p1", at: 40 }),
      target_at: "50",
    }),
  )
  assert.equal(cfg.presets.length, 1)
  assert.equal(cfg.presets[0].name, "Easy")
  assert.equal(cfg.presets[0].target.metric, "pace")
  // 8:00 per mile, ±5 s
  assert.ok(Math.abs(cfg.presets[0].target.max - 1609.344 / 475) < 1e-9)
  assert.equal(cfg.preset_id, "p1")
  assert.equal(cfg.target_at, 50)
  const back = normalizeConfig(JSON.parse(JSON.stringify(cfg)))
  assert.equal(back.presets[0].layout.slots.r2c, "power")
})

test("a watch pick wins only over an older phone target", () => {
  const cfg = normalizeConfig({
    v: 2,
    target: { metric: "pace", min: 3, max: 3.2 },
    presets: [
      { id: "p1", name: "HR", target: { metric: "hr", min: 140, max: 150 } },
    ],
    target_at: 100,
  })
  assert.equal(withLocalPreset(cfg, { id: "p1", at: 90 }), cfg)
  assert.equal(withLocalPreset(cfg, { id: "gone", at: 200 }), cfg)
  assert.equal(withLocalPreset(cfg, null), cfg)
  const won = withLocalPreset(cfg, { id: "p1", at: 200 })
  assert.equal(won.target.metric, "hr")
  assert.equal(won.preset_id, "p1")
  assert.equal(won.target_at, 200)
})

test("export -> import round trip, without the license", () => {
  const p = presetFromSettings(
    getter({ target_metric: "hr", target_hr_low: "150" }),
    "p1",
    "Easy",
    layout,
  )
  const text = exportSettings(
    getter({
      pace_unit: "min_per_mile",
      ftp: "290",
      hr_zone_method: "lthr",
      lthr: "170",
      layout_json: JSON.stringify(layout),
      presets_json: JSON.stringify([p]),
      license_key: "SECRET-KEY",
      license_state: '{"licensed":true}',
      trial_used: "3",
    }),
  )
  assert.ok(!/SECRET|licensed|trial/.test(text))
  const r = importSettings(text, 777)
  assert.equal(r.ok, true)
  assert.equal(r.settings, 4)
  assert.equal(r.presets, 1)
  assert.equal(r.values.pace_unit, "min_per_mile")
  assert.equal(r.values.ftp, "290")
  assert.equal(r.values.max_hr, "") // not exported -> back to default
  const l = JSON.parse(r.values.layout_json)
  assert.equal(l.slots.r2c, "power")
  assert.equal(l.updated_at, 777)
  assert.equal(JSON.parse(r.values.presets_json)[0].name, "Easy")
  assert.equal(r.values.target_at, "777")
  assert.equal(r.values.license_key, undefined)
})

test("import refuses what it can't use and says why", () => {
  assert.match(importSettings("").message, /Nothing pasted/)
  assert.match(importSettings("hello").message, /Not a RunDeck export/)
  assert.match(importSettings('{"app":"RunDeck","form').message, /cut off/)
  assert.match(importSettings('{"app":"Other"}').message, /Not a RunDeck/)
  assert.match(
    importSettings('{"app":"RunDeck","format":99}').message,
    /newer RunDeck/,
  )
  const r = importSettings(
    JSON.stringify({
      app: "RunDeck",
      format: 1,
      settings: { pace_unit: "furlongs", ftp: { x: 1 }, lthr: 170 },
    }),
  )
  assert.equal(r.ok, true)
  assert.equal(r.values.pace_unit, "")
  assert.equal(r.values.ftp, "")
  assert.equal(r.values.lthr, "170")
})
