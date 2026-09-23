// Icon options for RunDeck. Renders each SVG to a 480x480 PNG (same size as
// the shipped icon) and a comparison sheet. Run from the repo root:
//   node docs/icons/gen.mjs
import { writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const Z = ["#3b82f6", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444"]
const bg = (fill = "#0b0f14") =>
  `<circle cx="240" cy="240" r="240" fill="${fill}"/>`
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">${body}</svg>`

const icons = {
  // five zone cards fanned like a deck
  "a-deck": svg(
    bg() +
      Z.map((c, i) => {
        const y = 118 + i * 52
        const x = 96 + i * 12
        return `<rect x="${x}" y="${y}" width="${288 - i * 24}" height="40" rx="20" fill="${c}" transform="rotate(-8 240 240)"/>`
      }).join(""),
  ),
  // zone-colored gauge with a needle
  "b-gauge": svg(
    bg() +
      Z.map((c, i) => {
        const a0 = Math.PI * (1 + i / 5) + 0.03
        const a1 = Math.PI * (1 + (i + 1) / 5) - 0.03
        const r = 150
        const p = (a) => `${240 + r * Math.cos(a)} ${280 + r * Math.sin(a)}`
        return `<path d="M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}" stroke="${c}" stroke-width="44" fill="none" stroke-linecap="butt"/>`
      }).join("") +
      `<line x1="240" y1="280" x2="330" y2="176" stroke="#fff" stroke-width="16" stroke-linecap="round"/>` +
      `<circle cx="240" cy="280" r="24" fill="#fff"/>`,
  ),
  // dashboard tiles: big center value + side tiles
  "c-tiles": svg(
    bg() +
      `<rect x="100" y="96" width="280" height="56" rx="16" fill="#ef4444"/>` +
      `<rect x="72" y="168" width="96" height="84" rx="16" fill="#3b82f6"/>` +
      `<rect x="180" y="168" width="120" height="84" rx="16" fill="#fff"/>` +
      `<rect x="312" y="168" width="96" height="84" rx="16" fill="#3b82f6"/>` +
      Z.map(
        (c, i) =>
          `<rect x="${72 + i * 68}" y="268" width="60" height="18" rx="9" fill="${c}"/>`,
      ).join("") +
      `<rect x="72" y="302" width="96" height="84" rx="16" fill="#22c55e"/>` +
      `<rect x="180" y="302" width="120" height="84" rx="16" fill="#fff"/>` +
      `<rect x="312" y="302" width="96" height="84" rx="16" fill="#22c55e"/>`,
  ),
  // RD monogram over the zone bar
  "d-monogram": svg(
    bg() +
      `<text x="240" y="275" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="800" font-size="190" fill="#fff" letter-spacing="-8">RD</text>` +
      Z.map(
        (c, i) =>
          `<rect x="${86 + i * 63}" y="318" width="55" height="26" rx="13" fill="${c}"/>`,
      ).join("") +
      `<rect x="250" y="306" width="10" height="50" rx="5" fill="#fff"/>`,
  ),
  // forward chevrons in zone colors (speed)
  "e-chevrons": svg(
    bg() +
      Z.map((c, i) => {
        const x = 108 + i * 52
        return `<path d="M ${x} 140 L ${x + 90} 240 L ${x} 340" stroke="${c}" stroke-width="34" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      }).join(""),
  ),
  // heartbeat line over a stacked deck
  "f-pulse": svg(
    bg() +
      [0, 1, 2]
        .map(
          (i) =>
            `<rect x="${110 + i * 14}" y="${150 + i * 30}" width="${260 - i * 28}" height="200" rx="28" fill="${["#1f2937", "#273449", "#334155"][i]}"/>`,
        )
        .join("") +
      `<polyline points="120,300 190,300 215,250 245,350 275,215 300,300 360,300" stroke="#ef4444" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      Z.map(
        (c, i) =>
          `<rect x="${156 + i * 34}" y="330" width="28" height="12" rx="6" fill="${c}"/>`,
      ).join(""),
  ),
}

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium",
})
const page = await browser.newPage()
await page.setViewportSize({ width: 480, height: 480 })
for (const [name, s] of Object.entries(icons)) {
  writeFileSync(`docs/icons/${name}.svg`, s)
  await page.setContent(
    `<body style="margin:0;background:transparent">${s}</body>`,
  )
  await page.screenshot({
    path: `docs/icons/${name}.png`,
    omitBackground: true,
    clip: { x: 0, y: 0, width: 480, height: 480 },
  })
}
// sheet: each icon big + at watch app-list size
const cells = Object.entries(icons)
  .map(
    ([
      name,
      s,
    ]) => `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:10px">
  <div style="width:220px;height:220px">${s.replace('width="480" height="480"', 'width="220" height="220"')}</div>
  <div style="display:flex;gap:14px;align-items:center">${s.replace('width="480" height="480"', 'width="72" height="72"')}${s.replace('width="480" height="480"', 'width="40" height="40"')}</div>
  <figcaption style="color:#cbd5e1;font:600 22px sans-serif">${name.toUpperCase()}</figcaption></figure>`,
  )
  .join("")
await page.setViewportSize({ width: 900, height: 820 })
await page.setContent(
  `<body style="margin:0;background:#0b0f14;padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px 12px;width:852px">${cells}</body>`,
)
await page.screenshot({ path: "docs/icons/options.png", fullPage: true })
await browser.close()
console.log("icons written")
