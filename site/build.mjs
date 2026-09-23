// Builds the landing page: site/template.html -> site/index.html.
// The watch screens are the simulator's own frames (docs/screenshots/*.svg,
// `npm run screenshots`), inlined so the page always shows the real layout.
//
//   node site/build.mjs

import { readFileSync, writeFileSync } from "node:fs"
import { FIELD_IDS, FIELD_NAMES } from "../shared/fields.js"
import { BUY_URL } from "../shared/license.js"

const root = new URL("..", import.meta.url)
const read = (p) => readFileSync(new URL(p, root))

const watch = (n) =>
  read(`docs/screenshots/screenshot_${n}.svg`)
    .toString()
    // the watch font is condensed; DejaVu (the simulator's) is not
    .replaceAll(
      "'DejaVu Sans',Arial,sans-serif",
      "'Barlow Semi Condensed','Barlow Condensed','Arial Narrow',sans-serif",
    )
    // scale with the page: drop the fixed size, keep the viewBox
    .replace(/ width="480" height="480"/, "")
    // the simulator's outer ring doubles the bezel on the page
    .replace(/<circle cx="240" cy="240" r="238" fill="none"[^>]*\/>/, "")

const icon = `data:image/png;base64,${read("docs/icons/d-monogram.png").toString("base64")}`
const fields = FIELD_IDS.filter((id) => id !== "none")
  .map((id) => `<span>${FIELD_NAMES[id]}</span>`)
  .join("")

let html = read("site/template.html").toString()
html = html
  .replaceAll("{{icon}}", icon)
  .replaceAll("{{buy}}", BUY_URL)
  .replace("{{fields}}", fields)
  .replace(/\{\{watch:(\d+)\}\}/g, (_, n) => watch(n))
html = html.replace(
  "family=Barlow+Condensed:wght@500;600;700",
  "family=Barlow+Condensed:wght@500;600;700&family=Barlow+Semi+Condensed:wght@600",
)
writeFileSync(new URL("site/index.html", root), html)

// ---------------------------------------------------------------- privacy
// PRIVACY.md is the single source; this tiny converter covers what it uses:
// # / ## headings, paragraphs, "- " lists, **bold**, `code`, [links](url).
function inline(t) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
}
function markdown(md) {
  const out = []
  let para = []
  let list = null
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`)
    para = []
    if (list)
      out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`)
    list = null
  }
  for (const line of md.split("\n")) {
    const h = /^(#{1,2}) (.*)$/.exec(line)
    if (h) {
      flush()
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    } else if (line.startsWith("- ")) {
      if (para.length) flush()
      list = list || []
      list.push(line.slice(2))
    } else if (/^\s+\S/.test(line) && list) {
      list[list.length - 1] += ` ${line.trim()}`
    } else if (line.trim() === "") flush()
    else para.push(line.trim())
  }
  flush()
  return out.join("\n")
}
const privacy = read("site/privacy-template.html")
  .toString()
  .replaceAll("{{icon}}", icon)
  .replace("{{content}}", markdown(read("PRIVACY.md").toString()))
writeFileSync(new URL("site/privacy.html", root), privacy)
console.log("site/privacy.html")
console.log(
  `site/index.html ${(html.length / 1024).toFixed(0)} KB, ${fields.split("<span>").length - 1} fields`,
)
