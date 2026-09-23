// Geometry checks for one rendered frame on a round screen: every visible
// text, icon and bar lies inside the circle, texts and icons don't overlap,
// and every icon file exists. Text extents use the widget's own width
// estimate (GLYPH_WIDTH, which errs wide).
//
//   SIM_SCREEN=416 node --import ./sim/register.mjs sim/screen-check.mjs
// prints the problems of a set of dense layouts as JSON (used by the tests).

import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { GLYPH_WIDTH } from "../data-widget/common/index.r.layout.js"
import { SCREEN } from "./stubs/zos-utils.mjs"

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/common.r",
)

// drawn extent {x0, x1, y0, y1} of a visible widget, or null
export function extent(w) {
  const p = w.props
  if (p.visible === false) return null
  if (w.type === "TEXT") {
    if (!p.text) return null
    const size = p.text_size || 24
    const tw = String(p.text).length * size * GLYPH_WIDTH
    let x0 = p.x
    if (p.align_h === "center_h") x0 = p.x + ((p.w || 0) - tw) / 2
    else if (p.align_h === "right") x0 = p.x + (p.w || 0) - tw
    // baseline as the watch places it; digits/caps fill ~0.72 em above it
    const base =
      p.align_v === "center_v"
        ? p.y + (p.h || size) / 2 + size * 0.35
        : p.y + size * 0.9
    return { x0, x1: x0 + tw, y0: base - size * 0.72, y1: base }
  }
  // native value: the watch draws it centered in the box; measure the
  // sample the preview shows for its type
  if (w.type === "SPORT_DATA") {
    const text = (globalThis.__nativeSamples || {})[p.default_type] || "--"
    return extent({
      type: "TEXT",
      props: { ...p, text, align_h: "center_h", align_v: "center_v" },
    })
  }
  if (w.type === "IMG" || w.type === "FILL_RECT")
    return { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h }
  return null
}

const inCircle = (x, y, r, tol) => Math.hypot(x - r, y - r) <= r + tol

export function checkFrame(widgets, screen = SCREEN) {
  const problems = []
  const r = screen / 2
  const items = []
  for (const w of widgets) {
    const e = extent(w)
    if (!e) continue
    const p = w.props
    const what =
      w.type === "TEXT"
        ? `"${p.text}"`
        : w.type === "IMG"
          ? p.src
          : w.type === "SPORT_DATA"
            ? `native ${p.default_type}`
            : `${w.type}@${p.x},${p.y}`
    if (w.type === "FILL_RECT" && p.w >= screen) continue // background
    if (w.type === "IMG" && !existsSync(join(ASSETS, p.src)))
      problems.push(`missing icon ${p.src}`)
    // rounded bar ends and glyph side bearings: 2 px of slack
    const corners = [
      [e.x0, e.y0],
      [e.x1, e.y0],
      [e.x0, e.y1],
      [e.x1, e.y1],
    ]
    const tol = w.type === "FILL_RECT" ? (p.radius || 0) * 0.3 + 1 : 2
    if (corners.some(([x, y]) => !inCircle(x, y, r, tol)))
      problems.push(`${what} leaves the screen`)
    items.push({ what, e, rect: w.type === "FILL_RECT" })
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].rect && items[j].rect) continue // bars, dividers
      const a = items[i].e
      const b = items[j].e
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
      if (ox > 1 && oy > 1)
        problems.push(`${items[i].what} overlaps ${items[j].what}`)
    }
  return problems
}

// dense layouts that stress every row and column count
export const CHECK_LAYOUTS = {
  default: {},
  wide: {
    slots: {
      header: "hr",
      r1l: "lap_hr",
      r1c: "elapsed",
      r1r: "avg_hr",
      r2l: "lap_power",
      r2c: "power",
      r2r: "avg_power",
      r3l: "lap_pace",
      r3c: "pace",
      r3r: "avg_pace",
      r4l: "lap_distance",
      r4c: "distance",
      r4r: "steps",
      r5l: "descent",
      r5r: "ascent",
    },
    cols: { header: 1, r1: 3, r2: 3, r3: 3, r4: 3, r5: 2 },
  },
  split: {
    slots: {
      headerl: "hr",
      headerr: "lap_time",
      r2c: "pace",
      r3c: "elapsed",
      r5c: "distance",
    },
    cols: { header: 2, r1: 2, r2: 1, r3: 1, r4: 2, r5: 1 },
  },
}

async function main() {
  const { buildConfig } = await import("../shared/config.js")
  const { bootWidget } = await import("./world.mjs")
  globalThis.__nativeSamples = {
    ALTITUDE_TOTAL_DOWN: "1234",
    STRIDE_COUNT: "12345",
  }
  const out = {}
  for (const [name, layout] of Object.entries(CHECK_LAYOUTS))
    for (const labels of ["text", "short", "icons"]) {
      const json = JSON.stringify({
        ...layout,
        labels,
        units: "show",
        updated_at: 1,
      })
      const w = await bootWidget({
        licensed: true,
        config: buildConfig((k) => ({ layout_json: json })[k]),
        sim: { hrZoneSettings: { range: [93, 111, 130, 148, 167, 185] } },
      })
      w.set({
        sport: {
          ...globalThis.__sim.sport,
          power: { power: "388" },
          pace: { pace: "15'50''" },
          avg_pace: { avg_pace: "15'13''" },
        },
      })
      // long values: 1:5x:xx elapsed, 2-digit km, 3-digit HR
      w.run(7000, { speed: 3.6, grade: 1, hr: 178 })
      out[`${name}/${labels}`] = checkFrame(w.snapshot())
    }
  console.log(JSON.stringify(out))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
