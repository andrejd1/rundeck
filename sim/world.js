// Scripted world shared by the preview and the widget tests: boots the REAL
// data widget against the @zos stubs and drives the native workout clock.

import { KEY_EVENT_CLICK, KEY_SHORTCUT } from "@zos/interaction"
import { __resetWidgets, __widgets } from "@zos/ui"

let bootCount = 0

export async function bootWidget({
  config,
  licensed,
  trial,
  sideResponse,
} = {}) {
  __resetWidgets()
  const store = await import("../shared/device-store.js")
  if (config) store.saveObject(store.CONFIG_KEY, config)
  else store.removeObject(store.CONFIG_KEY)
  if (licensed != null)
    store.saveObject(store.LICENSE_KEY, { licensed, checked_at: 0 })
  else store.removeObject(store.LICENSE_KEY)
  if (trial) store.saveObject(store.TRIAL_KEY, trial)
  else store.removeObject(store.TRIAL_KEY)

  globalThis.__sim = {
    hr: 148,
    sport: {
      pace: { pace: "5'38''" },
      avg_pace: { avg_pace: "4'42''" },
      distance: { distance: "0.00" },
      duration: { duration: "0:00" },
      cadence: { cadence: "178" },
      altitude: { altitude: "210" },
      total_up_altitude: { total_up_altitude: "0" },
    },
    sideResponse: sideResponse || (() => Promise.reject(new Error("offline"))),
  }
  globalThis.getApp = () => ({ globalData: {} })
  let page
  globalThis.DataWidget = (p) => {
    page = p
  }
  // fresh module instance per boot (the widget registers itself on import)
  await import(`../data-widget/common/index.js?boot=${bootCount++}`)
  let wall = 1_000_000
  page.nowSec = () => wall
  page.onInit()
  // build() starts a real interval: the world drives ticks by hand instead
  const realSetInterval = globalThis.setInterval
  globalThis.setInterval = () => 0
  page.build()
  globalThis.setInterval = realSetInterval

  const world = {
    page,
    elapsed: 0,
    distance: 0,
    altitude: 210,
    ascent: 0,
    set(fields) {
      Object.assign(globalThis.__sim, fields)
    },
    // advance n seconds of running at `speed` m/s, `grade` %
    run(n, { speed = 3.4, grade = 0, hr } = {}) {
      for (let i = 0; i < n; i++) {
        wall += 1
        world.elapsed += 1
        world.distance += speed
        const climb = (speed * grade) / 100
        world.altitude += climb
        if (climb > 0) world.ascent += climb
        if (hr)
          globalThis.__sim.hr =
            typeof hr === "function" ? hr(world.elapsed) : hr
        const s = globalThis.__sim.sport
        s.duration = {
          duration: `${Math.floor(world.elapsed / 60)}:${String(world.elapsed % 60).padStart(2, "0")}`,
        }
        s.distance = { distance: (world.distance / 1000).toFixed(3) }
        s.altitude = { altitude: world.altitude.toFixed(1) }
        s.total_up_altitude = { total_up_altitude: world.ascent.toFixed(0) }
        page.onTick()
      }
    },
    pressLap() {
      wall += 0
      return globalThis.__sim.keyHandler(KEY_SHORTCUT, KEY_EVENT_CLICK)
    },
    widgets: () => __widgets,
    // visible text of the widget whose props match `slot` (layout object)
    textAt(slot) {
      const w = __widgets.find(
        (x) =>
          x.type === "TEXT" && x.props.x === slot.x && x.props.y === slot.y,
      )
      return w && w.props.visible !== false ? w.props.text : null
    },
    snapshot: () =>
      __widgets.map((w) => ({ type: w.type, props: { ...w.props } })),
  }
  return world
}
