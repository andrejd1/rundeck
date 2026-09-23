// `zeus build` (zpm) copies every file of the project and runs every `.js`
// file through esbuild targeting ES2015 — imported by the app or not. Its
// ignore list is hardcoded (dot-folders, dist/, node_modules/); .gitignore is
// not consulted. So Node-only code (tests, simulator, site build) must use
// .mjs, and .js is reserved for code that runs on the watch or the phone.
import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const APP = [
  "app.js",
  "app-side/",
  "setting/",
  "page/",
  "data-widget/",
  "shared/",
]

function jsFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (
      e.name.startsWith(".") ||
      e.name === "node_modules" ||
      e.name === "dist"
    )
      continue
    const p = join(dir, e.name)
    if (e.isDirectory()) jsFiles(p, out)
    else if (e.name.endsWith(".js")) out.push(relative(ROOT, p))
  }
  return out
}

test("every .js file zeus would compile belongs to the app", () => {
  const stray = jsFiles(ROOT).filter(
    (f) => !APP.some((a) => f === a || f.startsWith(a)),
  )
  assert.deepEqual(
    stray,
    [],
    "Node-only files must be .mjs, or zeus build fails on them",
  )
})
