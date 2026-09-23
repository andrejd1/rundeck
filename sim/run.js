// Headless preview: runs the REAL data widget and layout editor against the
// @zos stubs and writes every interesting state to sim/out/preview.html.
//
//   npm run preview

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildConfig } from "../shared/config.js"
import { framesToHtml } from "./render.js"
import { bootEditor, bootWidget } from "./world.js"

const outDir = join(dirname(fileURLToPath(import.meta.url)), "out")
mkdirSync(outDir, { recursive: true })
const frames = []
const snap = (world, caption) =>
  frames.push({ caption, widgets: world.snapshot() })

const cfg = (obj) => buildConfig((k) => obj[k])
const layoutJson = (slots, bar = "hr", extra = {}) =>
  JSON.stringify({ v: 1, slots, bar, updated_at: 1, ...extra })

// 1. default layout, watch HR zones, pace target
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({ target_range: "5:30-5:50", threshold_pace: "4:45" }),
    sim: {
      hrZoneSettings: {
        type: 1,
        rest: 55,
        range: [93, 111, 130, 148, 167, 185],
      },
    },
  })
  w.run(1500, {
    speed: 3.55,
    grade: 1.5,
    hr: (t) => 118 + Math.round(20 * Math.sin(t / 200)),
  })
  w.pressLap()
  w.run(43, { speed: 3.0, grade: -3, hr: 106 })
  snap(w, "Auto bar: pace zones from LT pace, target 5:30-5:50 marked")
  w.pressLap()
  snap(w, "Lap key - lap summary flash")
}

// 2. customized like the second reference screenshot
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: layoutJson({
        header: "hr",
        r1l: "avg_hr",
        r1r: "lap_hr",
        r2l: "lap_pace",
        r2c: "pace",
        r2r: "avg_pace",
        r3l: "lap_time",
        r3c: "elapsed",
        r3r: "distance",
        r4l: "calories",
        r4r: "grade",
        r5l: "cadence",
        r5r: "ascent",
      }),
    }),
  })
  w.set({
    sport: {
      ...globalThis.__sim.sport,
      calories: { calories: "8" },
      cadence: { cadence: "105" },
    },
  })
  w.run(117, { speed: 0.5, hr: 85 })
  snap(w, "Custom layout (phone or watch)")
}

// 3. power runner: power center + target, power zones, clock on top
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      ftp: "290",
      target_metric: "power",
      target_range: "250-270",
      layout_json: layoutJson(
        {
          header: "hr",
          r1l: "lap_hr",
          r1r: "max_hr",
          r2l: "lap_power",
          r2c: "power",
          r2r: "pace",
          r3l: "lap_time",
          r3c: "elapsed",
          r3r: "clock",
          r4l: "laps",
          r4r: "avg_power",
          r5l: "distance",
          r5r: "hr_zone",
        },
        "power",
      ),
    }),
  })
  w.set({
    sport: {
      ...globalThis.__sim.sport,
      power: { power: "284" },
      pace: { pace: "4'05''" },
    },
  })
  w.run(3900, { speed: 4.1, grade: 0, hr: 162 })
  snap(w, "Power layout (above 250-270 W), >1 h")
}

// 4. three columns in rows 1, 4 and 5, icon labels
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      threshold_pace: "4:45",
      target_range: "5:30-5:50",
      layout_json: layoutJson(
        {
          r1l: "lap_hr",
          r1c: "max_hr",
          r1r: "avg_hr",
          r4l: "lap_distance",
          r4c: "laps",
          r4r: "grade",
          r5l: "distance",
          r5c: "calories",
          r5r: "ascent",
        },
        "auto",
        { cols: { r1: 3, r2: 3, r3: 3, r4: 3, r5: 2 }, labels: "icons" },
      ),
    }),
  })
  w.set({ sport: { ...globalThis.__sim.sport, calories: { calories: "412" } } })
  w.run(1500, {
    speed: 3.55,
    grade: 2,
    hr: (t) => 140 + Math.round(10 * Math.sin(t / 90)),
  })
  snap(w, "3 columns in rows 1 and 4, icon labels")
}

// 5. big-number rows as 2 and 1 columns, short labels
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: layoutJson(
        { r2l: "pace", r2r: "lap_pace", r3c: "elapsed", r5c: "distance" },
        "auto",
        { cols: { r1: 2, r2: 2, r3: 1, r4: 2, r5: 1 }, labels: "short" },
      ),
    }),
  })
  w.run(900, { speed: 3.3, hr: 150 })
  snap(w, "Row 2 as 2 columns, row 3 and bottom as 1, short labels")
}

// 6. top row as 2 columns (HR + time), rows 1 and 4 with 3 columns
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      layout_json: layoutJson(
        {
          headerl: "hr",
          headerr: "elapsed",
          r1l: "lap_hr",
          r1c: "max_hr",
          r1r: "avg_hr",
          r4l: "lap_distance",
          r4c: "distance",
          r4r: "last_lap_pace",
          r5l: "avg_cadence",
          r5r: "ascent",
        },
        "auto",
        { cols: { header: 2, r1: 3, r2: 3, r3: 3, r4: 3, r5: 2 } },
      ),
    }),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  w.set({
    sport: { ...globalThis.__sim.sport, avg_cadence: { avg_cadence: "171" } },
  })
  w.run(1400, { speed: 3.4, grade: 1, hr: 152 })
  snap(w, "Top row as 2 columns (HR with zone), rows 1 and 4 with 3 columns")
}

// 7. native-only fields (drawn by the watch) and a heart rate target
{
  // what the watch would draw for each native type in this frame
  globalThis.__nativeSamples = {
    ALTITUDE_TOTAL_DOWN: "112",
    OTHER_AEROBIC_TE: "3.4",
    STRIDE: "1.12",
    OTHER_TRAIN_LOAD: "86",
  }
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      target_metric: "hr",
      target_hr_low: "140",
      target_hr_high: "150",
      layout_json: layoutJson(
        {
          r1l: "lap_hr",
          r1r: "avg_hr",
          r4l: "descent",
          r4c: "stride",
          r4r: "aerobic_te",
          r5l: "ascent",
          r5r: "train_load",
        },
        "auto",
        { cols: { header: 1, r1: 2, r2: 3, r3: 3, r4: 3, r5: 2 } },
      ),
    }),
    sim: { hrZoneSettings: { range: [90, 108, 126, 144, 162, 181] } },
  })
  w.run(1800, { speed: 3.3, grade: 1.5, hr: 147 })
  snap(w, "Native fields (descent, stride, TE, load) and HR target 140-150")
}

// 8. trial used up: basic screen
{
  const w = await bootWidget({
    config: cfg({}),
    trial: { used: 5, last: null },
  })
  w.run(600, { hr: 141 })
  snap(w, "Trial over - basic screen")
}

// 9-10. on-watch layout editor
{
  const e = await bootEditor({})
  snap(e, "Watch editor - slot list")
  const p = await bootEditor({ pick: "r2c" })
  snap(p, "Watch editor - pick a field")
}

writeFileSync(join(outDir, "preview.html"), framesToHtml(frames))
console.log(`wrote ${frames.length} frames to sim/out/preview.html`)
