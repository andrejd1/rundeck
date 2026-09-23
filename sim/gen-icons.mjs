// Field icons for the "Icons" label style: renders each glyph in its field
// group's color to assets/common.r/icons/{20,26}/<name>.png (IMG widgets are
// not scaled on the watch, so each size is its own file).
//
//   node sim/gen-icons.mjs

import { mkdirSync } from "node:fs"
import { chromium } from "playwright-core"

const C = {
  hr: "#ef4444",
  pace: "#60a5fa",
  time: "#22c55e",
  dist: "#f59e0b",
  body: "#2dd4bf",
}
const stroke = (c, d, w = 2.4) =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
const fill = (c, d) => `<path d="${d}" fill="${c}"/>`

// 24x24 glyphs
const ICONS = {
  heart: fill(
    C.hr,
    "M12 21.2 3.6 13C1.2 10.6 1.3 6.7 3.8 4.6 6 2.8 9.4 3.2 12 6c2.6-2.8 6-3.2 8.2-1.4 2.5 2.1 2.6 6 .2 8.4z",
  ),
  zone: [4, 8, 12, 16, 20]
    .map(
      (x, i) =>
        `<rect x="${x - 1.6}" y="${18 - i * 3.2}" width="3.2" height="${3 + i * 3.2}" rx="1" fill="${C.hr}"/>`,
    )
    .join(""),
  gauge:
    stroke(C.pace, "M3.5 17a9 9 0 1 1 17 0") +
    stroke(C.pace, "M12 15l4.5-5.5", 2.6) +
    `<circle cx="12" cy="15" r="2" fill="${C.pace}"/>`,
  bolt: fill(C.pace, "M13.5 1.5 4 13.5h6.5l-1.5 9 10-12.5h-6.5z"),
  stopwatch:
    `<circle cx="12" cy="13.5" r="8" fill="none" stroke="${C.time}" stroke-width="2.4"/>` +
    stroke(C.time, "M9.5 2.5h5M12 2.5v3M12 13.5V9") +
    stroke(C.time, "M18.5 6.5l1.5-1.5"),
  clock:
    `<circle cx="12" cy="12" r="9" fill="none" stroke="${C.time}" stroke-width="2.4"/>` +
    stroke(C.time, "M12 7v5.5l3.5 2"),
  flag: stroke(C.dist, "M5 22V3") + fill(C.dist, "M6 3.5h12l-3 4 3 4H6z"),
  laps:
    stroke(C.dist, "M20 12a8 8 0 1 1-2.3-5.6") + fill(C.dist, "M21 3.5v6h-6z"),
  slope: fill(C.dist, "M2.5 20.5h19v-15z"),
  ascent:
    fill(C.dist, "M1.5 21 9 9l4 6 3-4.5L22.5 21z") +
    stroke(C.dist, "M18 8V2.5M15.5 5 18 2.5 20.5 5", 2),
  altitude:
    fill(C.dist, "M1.5 21 9.5 6.5l4.5 8 2.5-3.5 6 10z") +
    stroke(C.dist, "M9.5 2.5v2", 2),
  descent:
    fill(C.dist, "M1.5 21 9 9l4 6 3-4.5L22.5 21z") +
    stroke(C.dist, "M18 2.5V8M15.5 5.5 18 8l2.5-2.5", 2),
  vspeed: stroke(
    C.dist,
    "M8 20V4M4.5 7.5 8 4l3.5 3.5M16 4v16M12.5 16.5 16 20l3.5-3.5",
  ),
  load: [5, 10, 15, 20]
    .map(
      (x, i) =>
        `<rect x="${x - 2}" y="${16 - i * 4}" width="4" height="${5 + i * 4}" rx="1" fill="${C.body}"/>`,
    )
    .join(""),
  thermo:
    stroke(C.time, "M10 14.5V4.5a2 2 0 1 1 4 0v10") +
    `<circle cx="12" cy="17.5" r="3.6" fill="${C.time}"/>`,
  sun:
    `<circle cx="12" cy="15" r="4.5" fill="${C.time}"/>` +
    stroke(C.time, "M2 20h20M12 5v3M5 8l2 2M19 8l-2 2", 2),
  feet: `<ellipse cx="8" cy="8.5" rx="3.2" ry="5" fill="${C.body}" transform="rotate(-12 8 8.5)"/><ellipse cx="16" cy="14.5" rx="3.2" ry="5" fill="${C.body}" transform="rotate(12 16 14.5)"/>`,
  flame: fill(
    C.body,
    "M12 22c-4.4 0-7.5-3-7.5-7 0-3.4 2.2-5.6 4-7.6.5 2 1.6 3 2.6 3.3C10.7 7 12 4 14.6 2c-.4 3 1.4 5 2.8 6.8 1.3 1.7 2.1 3.5 2.1 5.7 0 4.3-3.1 7.5-7.5 7.5z",
  ),
}

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium",
})
const page = await browser.newPage()
for (const size of [20, 26]) {
  const dir = `assets/common.r/icons/${size}`
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: size, height: size })
  for (const [name, body] of Object.entries(ICONS)) {
    await page.setContent(
      `<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${body}</svg></body>`,
    )
    await page.screenshot({
      path: `${dir}/${name}.png`,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    })
  }
}
await browser.close()
console.log(`${Object.keys(ICONS).length} icons x 2 sizes`)
