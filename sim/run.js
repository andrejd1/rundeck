// Headless preview: runs the REAL data widget against the @zos stubs through
// a scripted run and writes every interesting state to sim/out/preview.html.
//
//   npm run preview

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildConfig } from "../shared/config.js"
import { framesToHtml } from "./render.js"
import { bootWidget } from "./world.js"

const outDir = join(dirname(fileURLToPath(import.meta.url)), "out")
mkdirSync(outDir, { recursive: true })
const frames = []
const snap = (world, caption) =>
  frames.push({ caption, widgets: world.snapshot() })

const cfg = (obj) => buildConfig((k) => obj[k])

// 1. licensed, reference layout: easy long run on rolling terrain
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({ max_hr: "185", target_range: "5:30-5:50" }),
  })
  w.run(1500, {
    speed: 3.55,
    grade: 1.5,
    hr: (t) => 118 + Math.round(20 * Math.sin(t / 200)),
  })
  w.pressLap()
  w.run(43, { speed: 3.0, grade: -3, hr: 106 })
  snap(w, "Full screen - HR zones, pace target 5:30-5:50")
  w.pressLap()
  snap(w, "Lap key - lap summary flash")
}

// 2. power as the center metric with a target, power zone bar
{
  const w = await bootWidget({
    licensed: true,
    config: cfg({
      primary_metric: "power",
      bar_metric: "power",
      ftp: "290",
      target_range: "250-270",
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
  snap(w, "Power center (above 250-270 W), power zones, >1 h")
}

// 3. first trial run
{
  const w = await bootWidget({ config: cfg({}) })
  w.run(5, { hr: 131 })
  snap(w, "Trial - first run notice")
}

// 4. trial used up: basic mode
{
  const w = await bootWidget({
    config: cfg({}),
    trial: { used: 5, last: null },
  })
  w.run(600, { hr: 141 })
  snap(w, "Trial over - basic screen")
}

writeFileSync(join(outDir, "preview.html"), framesToHtml(frames))
console.log(`wrote ${frames.length} frames to sim/out/preview.html`)
