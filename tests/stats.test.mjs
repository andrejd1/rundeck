import assert from "node:assert/strict"
import { test } from "node:test"
import { HR_GRAPH_BARS, RunStats } from "../shared/stats.js"

// 1 Hz run at constant speed; hrAt(t) gives the HR sample
function feed(stats, { from = 0, to, speed = 3.5, hrAt = () => 150, alt }) {
  const laps = []
  for (let t = from; t <= to; t++) {
    const lap = stats.update({
      elapsed: t,
      distance: t * speed,
      hr: hrAt(t),
      altitude: alt ? alt(t * speed) : null,
    })
    if (lap) laps.push(lap)
  }
  return laps
}

test("time-weighted averages", () => {
  const s = new RunStats()
  feed(s, { to: 100, hrAt: (t) => (t <= 50 ? 140 : 160) })
  assert.equal(Math.round(s.avgHr.value), 150)
})

test("paused native clock accumulates nothing", () => {
  const s = new RunStats()
  feed(s, { to: 10, hrAt: () => 140 })
  for (let i = 0; i < 30; i++) s.update({ elapsed: 10, distance: 35, hr: 100 })
  assert.equal(s.avgHr.value, 140)
})

test("auto-lap closes exactly at 1 km", () => {
  const s = new RunStats({ autoLapM: 1000 })
  const laps = feed(s, { to: 700, speed: 4 })
  assert.equal(laps.length, 2)
  assert.equal(laps[0].index, 1)
  assert.equal(laps[0].distance, 1000)
  assert.equal(laps[0].time, 250)
  assert.equal(s.lap.startDistance, 2000)
  assert.equal(Math.round(s.lapDistance()), 800)
})

test("manual lap resets lap fields and the auto-lap baseline", () => {
  const s = new RunStats({ autoLapM: 1000 })
  feed(s, { to: 100, speed: 4, hrAt: () => 150 })
  const lap = s.lapNow()
  assert.equal(lap.distance, 400)
  assert.equal(lap.hr, 150)
  assert.equal(s.lapTime(), 0)
  const laps = feed(s, { from: 101, to: 351, speed: 4 })
  assert.equal(laps.length, 1) // 400 m + 1000 m = at 1400 m
  assert.equal(laps[0].distance, 1000)
})

test("lap pace needs some distance", () => {
  const s = new RunStats()
  feed(s, { to: 2, speed: 3 })
  assert.equal(s.lapSpeed(), null)
  feed(s, { from: 3, to: 60, speed: 3 })
  assert.ok(Math.abs(s.lapSpeed() - 3) < 1e-9)
})

test("opened mid-run: laps start at the first sample", () => {
  const s = new RunStats()
  s.update({ elapsed: 1200, distance: 3000, hr: 150 })
  s.update({ elapsed: 1210, distance: 3040, hr: 150 })
  assert.equal(s.lapTime(), 10)
  assert.equal(s.lapDistance(), 40)
})

test("HR graph keeps the last 36 ten-second buckets", () => {
  const s = new RunStats()
  feed(s, { to: 600, hrAt: (t) => 100 + Math.floor(t / 10) })
  const g = s.graph()
  assert.equal(g.length, HR_GRAPH_BARS)
  assert.ok(g[g.length - 1] > g[0])
})

test("grade from altitude over distance", () => {
  const s = new RunStats()
  // 5% climb
  feed(s, { to: 60, speed: 3, alt: (d) => 200 + d * 0.05 })
  assert.equal(Math.round(s.grade), 5)
  // then a 3% descent
  feed(s, { from: 61, to: 140, speed: 3, alt: (d) => 209 - (d - 183) * 0.03 })
  assert.equal(Math.round(s.grade), -3)
})
