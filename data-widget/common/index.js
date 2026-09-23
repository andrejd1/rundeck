// RunDeck — Zepp OS Workout Extension data screen. Pinned inside the native
// running workout (app.json extType "workout"): the native workout keeps GPS,
// recording and laps; this page renders a dense one-screen dashboard on top.
//
// The screen is a fixed grid of slots (shared/fields.js); which field sits in
// which slot is the user's layout, edited in the phone settings or on the
// watch (page/). Access: 5 free runs, then the full screen needs a license
// (shared/trial.js). Locked mode keeps the three main slots so the page is
// never a dead end mid-run.

import {
  COLORS,
  DIVIDERS,
  GLYPH_WIDTH,
  HEADER_CENTERED,
  HEADER_SUFFIX,
  HR_GRAPH,
  ICON,
  NOTICE,
  NOTICE_SUB,
  ROW_DIVIDERS,
  ROW_GEOMETRY,
  UNIT,
  ZONE_BAR,
} from "zosLoader:./index.[pf].layout.js"
import { BasePage } from "@zeppos/zml/base-page"
import { getDeviceInfo } from "@zos/device"
import { KEY_EVENT_CLICK, KEY_SHORTCUT, offKey, onKey } from "@zos/interaction"
import {
  align,
  createWidget,
  deleteWidget,
  edit_widget_group_type,
  getTextLayout,
  prop,
  sport_data,
  widget,
} from "@zos/ui"
import { appGlobals } from "../../shared/app-globals.js"
import { barValue, resolveBar } from "../../shared/bar.js"
import { normalizeConfig } from "../../shared/config.js"
import {
  CONFIG_KEY,
  LAYOUT_KEY,
  LICENSE_KEY,
  loadObject,
  saveObject,
  TRIAL_KEY,
} from "../../shared/device-store.js"
import {
  activeSlots,
  channelsNeeded,
  FIELDS,
  fieldUnit,
  fieldValue,
  newerLayout,
  ROWS,
  rowSlots,
  SLOT_IDS,
} from "../../shared/fields.js"
import { lapTimeStr, paceStr } from "../../shared/format.js"
import { MSG } from "../../shared/messages.js"
import { HR_GRAPH_BARS, RunStats } from "../../shared/stats.js"
import { TargetTracker } from "../../shared/target.js"
import { TRIAL_RUNS, TrialSession } from "../../shared/trial.js"
import {
  ZONE_COLORS,
  ZONE_COUNT,
  zoneColor,
  zonePosition,
} from "../../shared/zones.js"
import { resolveHrZones } from "./hr-zones.js"
import { LiveMetrics } from "./metrics.js"

const TICK_MS = 1000
const GRAPH_EVERY_TICKS = 5 // HR graph redraw cadence (bars move every 10 s)
const LAP_NOTICE_SEC = 6
const LAP_DEBOUNCE_SEC = 2
const CONFIG_RETRY_SEC = 60
// Wait this long for the phone's reply (license, trial count) before the
// access mode is latched for the activity; offline, the cached state decides.
const PHONE_GRACE_SEC = 10
// Rows the notice lines cover while they are up.
const NOTICE_ROW = "r4"
const NOTICE_SUB_ROW = "r1"

// Text size that fits `text` in the box's width (never above its own size).
function fittedSize(box, text) {
  const len = String(text).length
  if (!len) return box.text_size
  return Math.min(box.text_size, Math.floor(box.w / (len * GLYPH_WIDTH)))
}

DataWidget(
  BasePage({
    state: {
      config: null,
      layout: null, // effective layout: newer of phone config vs watch edit
      hrZones: null,
      licensed: false,
      trial: null, // TrialSession
      mode: "pending",
      metrics: null,
      stats: null,
      tracker: null,
      timer: null,
      ticks: 0,
      ui: {},
      cache: {}, // last rendered text/color/size/visibility per widget key
      notice: null, // {text, color, until}
      lastLapAt: null,
      lastConfigAttemptAt: null,
      configReceived: false,
      initAt: null,
      reportedUsed: null, // trial count last reported to the phone
      native: {}, // slotId -> {type, w}: SPORT_DATA widgets for native fields
      measureCache: new Map(), // "size|text" -> px width
      unitDropped: {}, // "slot|unit" -> true once the unit didn't fit
    },

    nowSec() {
      return Date.now() / 1000
    },

    // ------------------------------------------------------------ lifecycle

    onInit() {
      this.state.initAt = this.nowSec()
      this.state.config = normalizeConfig(loadObject(CONFIG_KEY))
      this.state.layout = newerLayout(
        this.state.config.layout,
        loadObject(LAYOUT_KEY),
      )
      this.state.hrZones = resolveHrZones(this.state.config)
      const lic = loadObject(LICENSE_KEY)
      this.state.licensed = !!(lic && lic.licensed)
      this.state.trial = new TrialSession(
        loadObject(TRIAL_KEY),
        this.state.licensed,
      )
      // app.js receives phone pushes for the whole mini program; it hands
      // them to the live screen through this hook.
      const globals = appGlobals()
      if (globals) {
        this.state.pushHook = (params) => this.applyRemote(params)
        globals.onConfigPush = this.state.pushHook
      }
      this.fetchConfig()
    },

    build() {
      const cfg = this.state.config
      this.state.metrics = new LiveMetrics({
        paceUnit: cfg.pace_unit,
        channels: this.channels(),
      })
      this.state.stats = new RunStats({ autoLapM: cfg.auto_lap_m })
      this.state.tracker = new TargetTracker(cfg.target)
      this.buildUi()
      this.applyGeometry()
      this.registerKeys()
      this.state.timer = setInterval(() => this.onTick(), TICK_MS)
      this.onTick()
    },

    // Back from the on-watch layout editor (or any other page): pick up a
    // layout edited there.
    onResume() {
      this.applyLayout(newerLayout(this.state.layout, loadObject(LAYOUT_KEY)))
      this.onTick()
    },

    onDestroy() {
      try {
        offKey()
      } catch (e) {
        /* ignore */
      }
      if (this.state.timer) clearInterval(this.state.timer)
      if (this.state.metrics) this.state.metrics.destroy()
      this.persistTrial()
      const globals = appGlobals()
      if (globals && globals.onConfigPush === this.state.pushHook)
        globals.onConfigPush = null
    },

    // Lap key: close a RunDeck lap and let the native workout record its own
    // lap too (returning false keeps the native default behavior).
    registerKeys() {
      onKey({
        callback: (key, event) => {
          if (key === KEY_SHORTCUT && event === KEY_EVENT_CLICK) {
            const now = this.nowSec()
            if (
              this.state.lastLapAt == null ||
              now - this.state.lastLapAt >= LAP_DEBOUNCE_SEC
            ) {
              this.state.lastLapAt = now
              this.onLap(this.state.stats.lapNow())
              this.render()
            }
          }
          return false
        },
      })
    },

    // ------------------------------------------------------ phone messaging

    fetchConfig() {
      this.state.lastConfigAttemptAt = this.nowSec()
      let uuid = ""
      try {
        uuid = getDeviceInfo().uuid || ""
      } catch (e) {
        /* no device info: activation falls back to a generic label */
      }
      let pending
      try {
        pending = this.request({
          method: MSG.GET_CONFIG,
          params: {
            device_uuid: uuid,
            trial_used: this.state.trial.trial.used,
          },
        })
      } catch (e) {
        return
      }
      pending
        .then((data) => {
          if (data && data.code === 0) {
            this.state.configReceived = true
            this.applyRemote(data)
          }
        })
        .catch(() => {
          /* phone out of range: cached config + license stay in force */
        })
    },

    /** Config/license from the phone (pull reply or push). */
    applyRemote(data) {
      if (!data || typeof data !== "object") return
      if (data.config) {
        const cfg = normalizeConfig(data.config)
        saveObject(CONFIG_KEY, cfg)
        this.applyConfig(cfg)
      }
      if (typeof data.licensed === "boolean") {
        this.state.licensed = data.licensed
        saveObject(LICENSE_KEY, {
          licensed: data.licensed,
          checked_at: Date.now(),
        })
        this.state.trial.setLicensed(data.licensed)
      }
      if (data.trial_used != null) this.state.trial.mergeRemote(data.trial_used)
      this.persistTrial()
      if (this.state.ui.slots) this.render()
    },

    applyConfig(cfg) {
      this.state.config = cfg
      this.state.hrZones = resolveHrZones(cfg)
      const { metrics, stats, tracker } = this.state
      if (metrics) metrics.paceUnit = cfg.pace_unit
      if (stats) stats.setAutoLap(cfg.auto_lap_m)
      if (tracker) tracker.setTarget(cfg.target)
      const local = loadObject(LAYOUT_KEY)
      const layout = newerLayout(cfg.layout, local)
      // edited on the watch while the phone was away: hand it over now
      if (local && layout.updated_at > cfg.layout.updated_at)
        this.sendLayout(layout)
      this.applyLayout(layout)
    },

    applyLayout(layout) {
      this.state.layout = layout
      if (this.state.metrics) this.state.metrics.channels = this.channels()
      if (this.state.ui.slots) {
        this.applyGeometry()
        this.render()
      }
    },

    // Place every slot for the layout's column counts. Runs on build and on
    // layout changes only, not per tick; slots of other column counts hide.
    applyGeometry() {
      const { ui, layout } = this.state
      const geo = {}
      for (const row of ROWS) {
        const cols = layout.cols[row.id]
        for (const id of rowSlots(row.id, cols))
          geo[id] = ROW_GEOMETRY[row.id][cols][id]
      }
      // a single top value without the HR graph is centered
      if (geo.header && layout.slots.header !== "hr")
        geo.header = HEADER_CENTERED
      this.state.geo = geo
      // native value widgets are placed per slot: rebuild them where needed
      for (const id of Object.keys(this.state.native)) this.dropNative(id)
      // sizes/positions changed: forget what was drawn for the slots
      for (const k of Object.keys(this.state.cache))
        if (/^(r\d[lcr]|header[lr]?)[lviu]:/.test(k)) delete this.state.cache[k]
      this.state.unitDropped = {}
      for (const id of SLOT_IDS) {
        const g = geo[id]
        const slot = ui.slots[id]
        if (!g) {
          this.setProp(`${id}v`, slot.value, "visible", false)
          this.setProp(`${id}l`, slot.label, "visible", false)
          this.setProp(`${id}i`, slot.icon, "visible", false)
          this.setProp(`${id}u`, slot.unit, "visible", false)
          continue
        }
        const { unitPad, ...valueProps } = g.value // unitPad is ours, not a widget prop
        slot.value.setProperty(prop.MORE, valueProps)
        if (g.label) slot.label.setProperty(prop.MORE, { ...g.label })
      }
      for (const row of ROWS) {
        const lines = ui.rowDividers[row.id] || []
        const want = (ROW_DIVIDERS[row.id] || {})[layout.cols[row.id]] || []
        lines.forEach((w, i) => {
          const d = want[i]
          this.setProp(`rd${row.id}${i}`, w, "visible", !!d)
          if (d) w.setProperty(prop.MORE, { x: d.x, y: d.y, w: d.w, h: d.h })
        })
      }
    },

    sendLayout(layout) {
      try {
        this.call({ method: MSG.LAYOUT_UPDATE, params: { layout } })
      } catch (e) {
        /* sent again on the next config reply */
      }
    },

    channels() {
      const t = this.state.config.target
      return channelsNeeded(
        this.state.layout,
        t && t.metric === "power" ? ["power"] : [],
      )
    },

    persistTrial() {
      const t = this.state.trial && this.state.trial.takeDirty()
      if (!t) return
      saveObject(TRIAL_KEY, t)
      // only a new count is news to the phone, not the 30 s marker refresh
      if (t.used === this.state.reportedUsed) return
      this.state.reportedUsed = t.used
      try {
        this.call({ method: MSG.TRIAL_REPORT, params: { trial_used: t.used } })
      } catch (e) {
        /* reported again with the next GET_CONFIG */
      }
    },

    // ------------------------------------------------------------------ tick

    onTick() {
      const { metrics, stats, trial } = this.state
      if (!metrics) return
      this.state.ticks += 1
      const s = metrics.refresh()
      const autoLap = stats.update({
        elapsed: s.elapsed,
        distance: s.distance,
        hr: s.hr,
        power: s.power,
        altitude: s.altitude,
      })
      if (autoLap) this.onLap(autoLap)

      // Trial runs are counted silently: the run screen stays clean, and the
      // trial status lives in the phone settings.
      const now = this.nowSec()
      const settled =
        this.state.configReceived || now - this.state.initAt >= PHONE_GRACE_SEC
      this.state.mode = trial.tick(now, settled ? s.elapsed : null)
      this.persistTrial()

      if (
        !this.state.configReceived &&
        now - this.state.lastConfigAttemptAt >= CONFIG_RETRY_SEC
      )
        this.fetchConfig()
      this.render()
    },

    onLap(lap) {
      if (!lap) return
      const unit = this.state.config.pace_unit
      const speed = lap.time > 0 ? lap.distance / lap.time : null
      this.showNotice(
        `Lap ${lap.index}  ${paceStr(speed, unit)}  ${lapTimeStr(lap.time)}`,
        COLORS.notice,
        LAP_NOTICE_SEC,
      )
    },

    showNotice(text, color, seconds) {
      this.state.notice = { text, color, until: this.nowSec() + seconds }
    },

    // ------------------------------------------------------------------- UI

    buildUi() {
      const ui = this.state.ui
      const text = (props) => createWidget(widget.TEXT, { ...props, text: "" })
      createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: 480,
        h: 480,
        color: COLORS.bg,
      })
      ui.dividers = DIVIDERS.map((d) => createWidget(widget.FILL_RECT, d))

      ui.graph = []
      for (let i = 0; i < HR_GRAPH_BARS; i++) {
        ui.graph.push(
          createWidget(widget.FILL_RECT, {
            x: HR_GRAPH.x + i * HR_GRAPH.barW,
            y: HR_GRAPH.y + HR_GRAPH.h - HR_GRAPH.minBarH,
            w: HR_GRAPH.barW - 1,
            h: HR_GRAPH.minBarH,
            color: COLORS.graphEmpty,
          }),
        )
      }

      // every slot of every column count exists once; applyGeometry places
      // the ones the layout shows and hides the rest
      const blank = ROW_GEOMETRY.header[1].header
      ui.slots = {}
      for (const id of SLOT_IDS) {
        ui.slots[id] = {
          label: text(blank.label),
          value: text(blank.value),
          unit: text({ ...blank.value, visible: false }),
          icon: createWidget(widget.IMG, {
            x: 0,
            y: 0,
            w: ICON.maxSize,
            h: ICON.maxSize,
            src: "icons/26/heart.png",
          }),
        }
      }
      ui.rowDividers = {}
      for (const row of ROWS) {
        ui.rowDividers[row.id] = [0, 1].map(() =>
          createWidget(widget.FILL_RECT, { ...DIVIDERS[0], w: 2, h: 2 }),
        )
      }
      ui.headerSuffix = text(HEADER_SUFFIX)

      const segW = (ZONE_BAR.w - ZONE_BAR.gap * (ZONE_COUNT - 1)) / ZONE_COUNT
      ui.zoneSegs = []
      for (let i = 0; i < ZONE_COUNT; i++) {
        ui.zoneSegs.push(
          createWidget(widget.FILL_RECT, {
            x: Math.round(ZONE_BAR.x + i * (segW + ZONE_BAR.gap)),
            y: ZONE_BAR.y,
            w: Math.round(segW),
            h: ZONE_BAR.h,
            radius: Math.round(ZONE_BAR.h / 2),
            color: ZONE_COLORS[i],
          }),
        )
      }
      ui.band = createWidget(widget.FILL_RECT, {
        x: ZONE_BAR.x,
        y: ZONE_BAR.band.y,
        w: ZONE_BAR.band.minW,
        h: ZONE_BAR.band.h,
        radius: Math.round(ZONE_BAR.band.h / 2),
        color: ZONE_BAR.band.color,
      })
      ui.marker = createWidget(widget.FILL_RECT, {
        x: ZONE_BAR.x,
        y: ZONE_BAR.marker.y,
        w: ZONE_BAR.marker.w,
        h: ZONE_BAR.marker.h,
        radius: Math.round(ZONE_BAR.marker.w / 2),
        color: ZONE_BAR.marker.color,
      })

      ui.notice = text(NOTICE)
      ui.noticeSub = text(NOTICE_SUB)
    },

    // Redraw-avoiding property setter: every widget update is an IPC on
    // device, so each (widget, property) pair remembers its last value.
    setProp(key, w, name, value) {
      if (!w) return
      const c = this.state.cache
      const k = `${key}:${name}`
      if (c[k] === value) return
      c[k] = value
      if (name === "text") w.setProperty(prop.TEXT, value)
      else if (name === "visible") w.setProperty(prop.VISIBLE, value)
      else w.setProperty(prop.MORE, { [name]: value })
    },

    /** Text + color + a size shrunk to fit the widget's width. */
    setFitted(key, w, props, text, color) {
      this.setProp(key, w, "text_size", fittedSize(props, text))
      this.setProp(key, w, "text", text)
      if (color != null) this.setProp(key, w, "color", color)
    },

    // One SPORT_DATA widget per slot showing a native-only field, created on
    // demand at the slot's value box (the value is read and drawn by the
    // watch itself; RunDeck never sees it). `type` null hides it.
    showNative(id, type, box) {
      const cur = this.state.native[id]
      if (!type) {
        if (cur) this.setProp(`${id}n`, cur.w, "visible", false)
        return
      }
      if (cur && cur.type === type) {
        this.setProp(`${id}n`, cur.w, "visible", true)
        return
      }
      if (cur) this.dropNative(id)
      let w = null
      try {
        w = createWidget(widget.SPORT_DATA, {
          edit_id: 101 + SLOT_IDS.indexOf(id),
          category: edit_widget_group_type.SPORTS,
          default_type: sport_data[type],
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          text_x: 0,
          text_y: 0,
          text_w: box.w,
          text_h: box.h,
          text_size: box.text_size,
          text_color: COLORS.value,
          rect_visible: false,
          sub_text_visible: false,
        })
      } catch (e) {
        w = null // type not supported on this firmware: the slot stays blank
      }
      if (!w) return
      this.state.native[id] = { type, w }
      delete this.state.cache[`${id}n:visible`]
    },

    dropNative(id) {
      const cur = this.state.native[id]
      if (!cur) return
      try {
        deleteWidget(cur.w)
      } catch (e) {
        /* already gone */
      }
      delete this.state.native[id]
      delete this.state.cache[`${id}n:visible`]
    },

    // Unit shown after a value, or "" for none: units can be switched off;
    // the big center numbers of three-column rows stay unit-free (they are
    // the main pace/time and a unit would shrink them); the single top HR
    // shows its zone there instead.
    unitFor(id, fieldId, ctx) {
      const { layout } = this.state
      if (layout.units === "hide") return ""
      if ((id === "r2c" || id === "r3c") && layout.cols[id.slice(0, 2)] === 3)
        return ""
      if (id === "header" && fieldId === "hr") return ""
      return fieldUnit(fieldId, ctx)
    },

    // Rendered text width in px: the watch's own layout engine when the
    // firmware offers it, else an estimate that errs wide (never overlaps).
    measure(text, size) {
      const cache = this.state.measureCache
      const key = `${size}|${text}`
      if (cache.has(key)) return cache.get(key)
      let w = null
      try {
        if (typeof getTextLayout === "function")
          w = getTextLayout(text, {
            text_size: size,
            text_width: 1000, // wide enough never to wrap
            wrapped: 0,
          }).width
      } catch (e) {
        w = null
      }
      if (!(w > 0)) w = Math.ceil(String(text).length * size * GLYPH_WIDTH)
      if (cache.size > 300) cache.clear()
      cache.set(key, w)
      return w
    },

    // Value with an optional small unit after it ("7.14 km"). The pair is
    // measured, shrunk together to fit the box, then placed by the box's
    // alignment; the unit sits on the value's baseline.
    // Value + small unit. The unit never costs the value any size: the
    // value keeps the size it would have alone, and the unit is shown only
    // when it fits next to it. Once a unit doesn't fit (10.00 km, 10'05 /km)
    // it stays off until the layout changes, so it doesn't flicker as the
    // value's width changes.
    renderValue(id, slot, box, text, unit, color) {
      const key = `${id}v`
      const size = fittedSize(box, text)
      const unitSize = Math.max(UNIT.minSize, Math.round(size * UNIT.ratio))
      const dropKey = `${id}|${unit}`
      let vw = 0
      let uw = 0
      if (unit && !this.state.unitDropped[dropKey]) {
        vw = this.measure(text, size)
        uw = this.measure(unit, unitSize)
        // the unit is always on the right; keep clear of a label/divider there
        if (vw + UNIT.gap + uw > box.w - (box.unitPad || 0))
          this.state.unitDropped[dropKey] = true
      }
      if (!unit || this.state.unitDropped[dropKey]) {
        this.setProp(`${id}u`, slot.unit, "visible", false)
        this.setProp(key, slot.value, "x", box.x)
        this.setProp(key, slot.value, "w", box.w)
        this.setProp(key, slot.value, "align_h", box.align_h)
        this.setFitted(key, slot.value, box, text, color)
        return
      }
      const room = box.w - (box.unitPad || 0)
      const total = vw + UNIT.gap + uw
      let x0 = box.x
      if (box.align_h === align.CENTER_H)
        x0 = box.x + Math.round((box.w - total) / 2)
      else if (box.align_h === align.RIGHT) x0 = box.x + room - total
      this.setProp(key, slot.value, "x", x0)
      this.setProp(key, slot.value, "w", vw + 2)
      this.setProp(key, slot.value, "align_h", align.LEFT)
      this.setProp(key, slot.value, "text_size", size)
      this.setProp(key, slot.value, "text", text)
      this.setProp(key, slot.value, "color", color)
      // baseline: the value is vertically centered in the box
      const baseline = box.y + box.h / 2 + size * 0.36
      const uk = `${id}u`
      this.setProp(uk, slot.unit, "visible", true)
      this.setProp(uk, slot.unit, "x", x0 + vw + UNIT.gap)
      this.setProp(uk, slot.unit, "y", Math.round(baseline - unitSize * 1.05))
      this.setProp(uk, slot.unit, "w", uw + 4)
      this.setProp(uk, slot.unit, "h", unitSize + 6)
      this.setProp(uk, slot.unit, "align_h", align.LEFT)
      this.setProp(uk, slot.unit, "align_v", align.TOP)
      this.setProp(uk, slot.unit, "text_size", unitSize)
      this.setProp(uk, slot.unit, "text", unit)
      this.setProp(uk, slot.unit, "color", COLORS.unit)
    },

    // Field name as text, short text, or icon + qualifier ("Avg", "Lap").
    renderLabel(id, slot, box, f, style, colorOverride) {
      const iconMode = style === "icons" && !!box && !!f.icon
      this.setProp(`${id}l`, slot.label, "visible", !!box)
      this.setProp(`${id}i`, slot.icon, "visible", iconMode)
      if (!box) return
      const color = colorOverride || COLORS[f.group]
      if (!iconMode) {
        this.setProp(`${id}l`, slot.label, "x", box.x)
        this.setProp(`${id}l`, slot.label, "w", box.w)
        this.setProp(`${id}l`, slot.label, "align_h", box.align_h)
        this.setFitted(
          `${id}l`,
          slot.label,
          box,
          style === "short" ? f.short : f.label,
          color,
        )
        return
      }
      const size = box.text_size <= 18 ? 20 : 26
      const qual = f.qual || ""
      const qualW = qual
        ? Math.ceil(qual.length * box.text_size * GLYPH_WIDTH)
        : 0
      const unitW = size + (qual ? ICON.gap + qualW : 0)
      let x0 = box.x
      if (box.align_h === align.CENTER_H)
        x0 = box.x + Math.round((box.w - unitW) / 2)
      else if (box.align_h === align.RIGHT) x0 = box.x + box.w - unitW
      const src = `icons/${size}/${f.icon}.png`
      const sig = `${x0}:${size}:${src}`
      if (this.state.cache[`${id}i:sig`] !== sig) {
        this.state.cache[`${id}i:sig`] = sig
        slot.icon.setProperty(prop.MORE, {
          x: x0,
          y: box.y + Math.round((box.h - size) / 2),
          w: size,
          h: size,
          src,
        })
      }
      this.setProp(`${id}l`, slot.label, "x", x0 + size + ICON.gap)
      this.setProp(`${id}l`, slot.label, "w", Math.max(qualW, 1))
      this.setProp(`${id}l`, slot.label, "align_h", align.LEFT)
      this.setProp(`${id}l`, slot.label, "text_size", box.text_size)
      this.setProp(`${id}l`, slot.label, "text", qual)
      this.setProp(`${id}l`, slot.label, "color", color)
    },

    render() {
      const { ui, config: cfg, stats, metrics, mode, layout } = this.state
      if (!ui.slots || !metrics) return
      const s = metrics.snapshot
      const locked = mode === "locked"
      const ctx = {
        s,
        stats,
        unit: cfg.pace_unit,
        hrZones: this.state.hrZones,
        now: new Date(),
      }

      // target: colors every slot that shows the target's live metric
      const t = cfg.target
      const status = this.state.tracker.update(t ? barValue(t.metric, s) : null)
      const targetField = t ? t.metric : null

      const n = this.state.notice
      const noticeOn = !locked && !!n && this.nowSec() < n.until
      if (!noticeOn) this.state.notice = null

      const hrPos = zonePosition(s.hr, this.state.hrZones)

      // locked mode keeps the top row and one big value from rows 2 and 3
      const shown = activeSlots(layout)
      const lockedKeep = rowSlots("header", layout.cols.header)
      for (const r of ["r2", "r3"]) {
        const ids = rowSlots(r, layout.cols[r])
        lockedKeep.push(ids.indexOf(`${r}c`) >= 0 ? `${r}c` : ids[0])
      }
      for (const id of shown) {
        const slot = ui.slots[id]
        const g = this.state.geo[id]
        const row = id.slice(0, 2)
        const visible =
          (!locked || lockedKeep.indexOf(id) >= 0) &&
          !(noticeOn && row === NOTICE_ROW) &&
          !(locked && row === NOTICE_SUB_ROW)
        const fieldId = layout.slots[id]
        let f = FIELDS[fieldId] || FIELDS.none
        // native-only fields: the watch draws the value (SPORT_DATA widget)
        this.showNative(id, visible && f.native ? f.native : null, g.value)
        this.setProp(`${id}v`, slot.value, "visible", visible && !f.native)
        if (!visible || f.native)
          this.setProp(`${id}u`, slot.unit, "visible", false)
        if (!visible) {
          this.setProp(`${id}l`, slot.label, "visible", false)
          this.setProp(`${id}i`, slot.icon, "visible", false)
          continue
        }
        let labelColor = null
        // HR in a two-column top row: no room for the graph or the zone
        // suffix, so the zone rides in the label, in the zone's color
        if (fieldId === "hr" && (id === "headerl" || id === "headerr")) {
          const z = hrPos && hrPos.zone > 0 ? `Z${hrPos.zone}` : ""
          if (z) {
            f = { ...f, label: `HR ${z}`, short: `HR ${z}`, qual: z }
            labelColor = zoneColor(hrPos.zone)
          }
        }
        this.renderLabel(id, slot, g.label, f, layout.labels, labelColor)
        const valueColor =
          fieldId === targetField && status ? COLORS[status] : COLORS.value
        if (!f.native)
          this.renderValue(
            id,
            slot,
            g.value,
            fieldValue(fieldId, ctx),
            this.unitFor(id, fieldId, ctx),
            valueColor,
          )
      }

      // single top value showing HR: zone suffix + HR graph
      const headerIsHr =
        layout.cols.header === 1 && layout.slots.header === "hr"
      this.setProp(
        "suffix",
        ui.headerSuffix,
        "text",
        headerIsHr && hrPos && hrPos.zone > 0 ? `Z${hrPos.zone}` : "",
      )
      this.setProp(
        "suffix",
        ui.headerSuffix,
        "color",
        zoneColor(hrPos ? hrPos.zone : 0),
      )
      const showGraph = !locked && headerIsHr
      if (this.state.ticks % GRAPH_EVERY_TICKS === 1 || !showGraph)
        this.renderGraph(!showGraph)

      // dividers: only the header rule stays in locked mode
      for (let i = 1; i < ui.dividers.length; i++)
        this.setProp(`div${i}`, ui.dividers[i], "visible", !locked)
      for (const row of ROWS) {
        const want = (ROW_DIVIDERS[row.id] || {})[layout.cols[row.id]] || []
        ui.rowDividers[row.id].forEach((w, i) => {
          this.setProp(`rd${row.id}${i}`, w, "visible", !locked && !!want[i])
        })
      }

      this.renderZoneBar(locked)

      this.setProp("notice", ui.notice, "visible", noticeOn || locked)
      this.setProp("noticeSub", ui.noticeSub, "visible", locked)
      if (locked) {
        this.setProp(
          "noticeSub",
          ui.noticeSub,
          "text",
          `Trial ended (${TRIAL_RUNS} runs)`,
        )
        this.setProp("notice", ui.notice, "text", "Unlock in Zepp app")
        this.setProp("notice", ui.notice, "color", COLORS.noticeWarn)
      } else if (noticeOn) {
        this.setProp("notice", ui.notice, "text", n.text)
        this.setProp("notice", ui.notice, "color", n.color)
      }
    },

    renderZoneBar(locked) {
      const { ui, config: cfg, layout, metrics } = this.state
      const bar = locked
        ? null
        : resolveBar(layout.bar, cfg, this.state.hrZones)
      for (let i = 0; i < ui.zoneSegs.length; i++)
        this.setProp(`seg${i}`, ui.zoneSegs[i], "visible", !!bar)

      // target range under the bar, when the bar shows the target's metric
      const band = bar && bar.band
      this.setProp("band", ui.band, "visible", !!band)
      if (band) {
        const x = Math.round(ZONE_BAR.x + band.from * ZONE_BAR.w)
        const w = Math.max(
          ZONE_BAR.band.minW,
          Math.round((band.to - band.from) * ZONE_BAR.w),
        )
        const sig = `${x}:${w}`
        if (this.state.cache.band !== sig) {
          this.state.cache.band = sig
          ui.band.setProperty(prop.MORE, {
            x: Math.min(x, ZONE_BAR.x + ZONE_BAR.w - w),
            y: ZONE_BAR.band.y,
            w,
            h: ZONE_BAR.band.h,
          })
        }
      }

      const pos = bar
        ? zonePosition(barValue(bar.metric, metrics.snapshot), bar.bounds)
        : null
      this.setProp("marker", ui.marker, "visible", !!pos)
      if (!pos) return
      const x = Math.round(
        ZONE_BAR.x + pos.pos * (ZONE_BAR.w - ZONE_BAR.marker.w),
      )
      if (this.state.cache.markerX === x) return
      this.state.cache.markerX = x
      ui.marker.setProperty(prop.MORE, {
        x,
        y: ZONE_BAR.marker.y,
        w: ZONE_BAR.marker.w,
        h: ZONE_BAR.marker.h,
      })
    },

    renderGraph(hidden) {
      const { ui, stats } = this.state
      const zones = this.state.hrZones
      const bars = hidden ? [] : stats.graph()
      const vals = bars.filter((v) => v != null)
      let lo = vals.length ? Math.min(...vals) - 5 : 0
      let hi = vals.length ? Math.max(...vals) + 5 : 1
      if (hi - lo < 30) {
        const mid = (hi + lo) / 2
        lo = mid - 15
        hi = mid + 15
      }
      // right-aligned: the newest bucket is always the rightmost bar
      const offset = HR_GRAPH_BARS - bars.length
      for (let i = 0; i < HR_GRAPH_BARS; i++) {
        const v = i >= offset ? bars[i - offset] : null
        const h =
          v == null
            ? HR_GRAPH.minBarH
            : Math.max(
                HR_GRAPH.minBarH,
                Math.round(((v - lo) / (hi - lo)) * HR_GRAPH.h),
              )
        const pos = v == null ? null : zonePosition(v, zones)
        const color =
          v == null ? COLORS.graphEmpty : zoneColor(pos ? pos.zone : 0)
        const key = `g${i}`
        const sig = hidden ? "hidden" : `${h}:${color}`
        if (this.state.cache[key] === sig) continue
        this.state.cache[key] = sig
        ui.graph[i].setProperty(prop.MORE, {
          x: HR_GRAPH.x + i * HR_GRAPH.barW,
          y: HR_GRAPH.y + HR_GRAPH.h - h,
          w: HR_GRAPH.barW - 1,
          h,
          color: hidden ? COLORS.bg : color,
        })
      }
    },
  }),
)
