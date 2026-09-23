// Every round screen size: the data screen runs in a separate process per
// size (px() is fixed at load), with dense layouts in all label styles, and
// nothing may leave the circle, overlap, or miss its icon file.
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))

// 480 Balance / T-Rex 3 / Cheetah Pro, 466 GTR 4 / Active 2, 454 Cheetah /
// T-Rex Ultra, 416 GTR Mini / Falcon; 390 and 360 cover smaller rounds
const SCREENS = [480, 466, 454, 416, 390, 360]

const check = (screen) =>
  new Promise((resolve, reject) =>
    execFile(
      process.execPath,
      ["--import", "./sim/register.mjs", "sim/screen-check.mjs"],
      { cwd: ROOT, env: { ...process.env, SIM_SCREEN: String(screen) } },
      (err, out) => (err ? reject(err) : resolve(JSON.parse(out))),
    ),
  )

test("every round screen size: everything inside, no overlaps", {
  concurrency: true,
}, async (t) => {
  await Promise.all(
    SCREENS.map((screen) =>
      t.test(`${screen} px`, async () => {
        const problems = await check(screen)
        assert.ok(Object.keys(problems).length >= 9)
        for (const [layout, list] of Object.entries(problems))
          assert.deepEqual(list, [], `${screen} px ${layout}`)
      }),
    ),
  )
})
