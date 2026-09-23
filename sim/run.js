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
const layoutJson = (slots, bar = "hr") =>
  JSON.stringify({ v: 1, slots, bar, updated_at: 1 })

// 1. default layout, watch HR zones, pace target
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({ target_range: "5:30-5:50" }),
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
  snap(w, "Default layout - watch HR zones, pace target")
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

// 4. trial used up: basic screen
{
  const w = await bootWidget({
    config: cfg({}),
    trial: { used: 5, last: null },
  })
  w.run(600, { hr: 141 })
  snap(w, "Trial over - basic screen")
}

// 5-6. on-watch layout editor
{
  const e = await bootEditor({})
  snap(e, "Watch editor - slot list")
  const p = await bootEditor({ pick: "r2c" })
  snap(p, "Watch editor - pick a field")
}

writeFileSync(join(outDir, "preview.html"), framesToHtml(frames))
console.log(`wrote ${frames.length} frames to sim/out/preview.html`)
