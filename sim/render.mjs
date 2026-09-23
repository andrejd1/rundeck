// Render the recorded widget tree to SVG (one round screen per frame, sized
// by SIM_SCREEN like px()).

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SCREEN } from "./stubs/zos-utils.mjs"

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/common.r",
)
const imgCache = new Map()
function imgData(src) {
  if (!imgCache.has(src)) {
    const file = join(ASSETS, src)
    imgCache.set(
      src,
      existsSync(file)
        ? `data:image/png;base64,${readFileSync(file).toString("base64")}`
        : null,
    )
  }
  return imgCache.get(src)
}

const hex = (n) => `#${(n == null ? 0 : n).toString(16).padStart(6, "0")}`
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

function textAnchor(p) {
  const size = p.text_size || 24
  let x = p.x
  let anchor = "start"
  if (p.align_h === "center_h") {
    x = p.x + (p.w || 0) / 2
    anchor = "middle"
  } else if (p.align_h === "right") {
    x = p.x + (p.w || 0)
    anchor = "end"
  }
  let y
  if (p.align_v === "center_v") {
    y = p.y + (p.h || size) / 2 + size * 0.35
  } else {
    y = p.y + size * 0.9
  }
  return { x, y, anchor, size }
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ""
  for (const word of words) {
    if (cur && `${cur} ${word}`.length > maxChars) {
      lines.push(cur)
      cur = word
    } else {
      cur = cur ? `${cur} ${word}` : word
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function renderWidget(w) {
  const p = w.props
  if (p.visible === false) return ""
  switch (w.type) {
    case "FILL_RECT": {
      const alpha =
        p.alpha != null ? ` fill-opacity="${(p.alpha / 255).toFixed(2)}"` : ""
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.radius || 0}" fill="${hex(p.color)}"${alpha}/>`
    }
    case "TEXT": {
      if (!p.text) return ""
      const { x, y, anchor, size } = textAnchor(p)
      const font = `font-size="${size}" fill="${hex(p.color)}" font-family="'DejaVu Sans',Arial,sans-serif" font-weight="600"`
      if (p.text_style === "wrap") {
        const maxChars = Math.max(4, Math.floor((p.w || 480) / (size * 0.58)))
        const lines = wrapText(String(p.text), maxChars)
        const spans = lines
          .map(
            (l, i) =>
              `<tspan x="${x}" dy="${i === 0 ? 0 : size * 1.2}">${esc(l)}</tspan>`,
          )
          .join("")
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" ${font}>${spans}</text>`
      }
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" ${font}>${esc(p.text)}</text>`
    }
    case "BUTTON": {
      const r = p.radius || 0
      const size = p.text_size || 24
      const cx = p.x + p.w / 2
      const cy = p.y + p.h / 2 + size * 0.35
      return (
        `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${r}" fill="${hex(p.normal_color)}"/>` +
        `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${size}" fill="${hex(p.color != null ? p.color : 0xffffff)}" font-family="'DejaVu Sans',Arial,sans-serif" font-weight="700">${esc(p.text)}</text>`
      )
    }
    // native value drawn by the watch: the preview shows __sim-style sample
    // values per type (or a dash), centered in the box like the watch does
    case "SPORT_DATA": {
      const sample = (globalThis.__nativeSamples || {})[p.default_type] || "--"
      const size = p.text_size || 30
      return `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + size * 0.35}" text-anchor="middle" font-size="${size}" fill="${hex(p.text_color)}" font-family="'DejaVu Sans',Arial,sans-serif" font-weight="600">${esc(sample)}</text>`
    }
    case "IMG": {
      const data = imgData(p.src)
      if (!data) return ""
      return `<image x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" href="${data}"/>`
    }
    default:
      return ""
  }
}

export function frameToSvg(widgets, id, screen = SCREEN) {
  const body = widgets.map(renderWidget).join("\n    ")
  const c = screen / 2
  return `<svg width="${screen}" height="${screen}" viewBox="0 0 ${screen} ${screen}" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="round${id}"><circle cx="${c}" cy="${c}" r="${c}"/></clipPath></defs>
  <circle cx="${c}" cy="${c}" r="${c - 1}" fill="#000"/>
  <g clip-path="url(#round${id})">
    ${body}
  </g>
  <circle cx="${c}" cy="${c}" r="${c - 2}" fill="none" stroke="#333" stroke-width="3"/>
</svg>`
}

export function framesToHtml(frames) {
  const cells = frames
    .map(
      (f, i) => `<figure>
  ${frameToSvg(f.widgets, i)}
  <figcaption>${esc(f.caption)}</figcaption>
</figure>`,
    )
    .join("\n")
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { background:#22262c; margin:0; padding:24px; font-family:'DejaVu Sans',Arial,sans-serif;
         display:grid; grid-template-columns:repeat(3, 480px); gap:28px 24px; width:1488px; }
  figure { margin:0; }
  figcaption { color:#cbd5e1; font-size:20px; text-align:center; padding-top:10px; }
</style></head><body>
${cells}
</body></html>`
}
