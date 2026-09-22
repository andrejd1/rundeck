// Regenerate docs/screenshots (360x360 PNGs) and docs/ui-preview.png from
// sim/out/preview.html (run `node --import ./sim/register.js sim/run.js` first).
// Uses the Playwright-managed Chromium; set PLAYWRIGHT_CHROMIUM if the
// executable lives elsewhere.

import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const html = readFileSync("sim/out/preview.html", "utf8")
const figs = [...html.matchAll(/<figure>([\s\S]*?)<\/figure>/g)].map((m) => {
  const cap = /<figcaption>([\s\S]*?)<\/figcaption>/.exec(m[1])[1]
  const svg = /(<svg[\s\S]*?<\/svg>)/.exec(m[1])[1]
  return { cap, svg }
})
console.log("frames:", figs.length)

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium",
})
const page = await browser.newPage()

// store screenshots: every frame at 360x360
for (let i = 0; i < figs.length; i++) {
  await page.setViewportSize({ width: 360, height: 360 })
  await page.setContent(`<body style="margin:0;background:transparent">
    <div style="width:360px;height:360px">${figs[i].svg.replace('width="480" height="480"', 'width="360" height="360"')}</div></body>`)
  await page.screenshot({
    path: `docs/screenshots/screenshot_${i}.png`,
    omitBackground: true,
  })
  // svg copies too
  writeFileSync(`docs/screenshots/screenshot_${i}.svg`, figs[i].svg)
  console.log("screenshot_" + i)
}

// ui-preview.png: 3-column grid of all frames with captions (512px cells)
const cells = figs
  .map(
    (
      f,
    ) => `<figure style="margin:0;width:512px;display:flex;flex-direction:column;align-items:center;padding:8px 0">
  ${f.svg}<figcaption style="color:#cbd5e1;font:600 20px sans-serif;text-align:center;padding-top:8px">${f.cap}</figcaption></figure>`,
  )
  .join("")
const rows = Math.ceil(figs.length / 3)
const height = rows * 550
await page.setViewportSize({ width: 1536, height })
await page.setContent(
  `<body style="margin:0;background:#0b0f14"><div style="display:flex;flex-wrap:wrap;width:1536px">${cells}</div></body>`,
)
await page.screenshot({ path: "docs/ui-preview.png", fullPage: true })
console.log("ui-preview.png")
await browser.close()
