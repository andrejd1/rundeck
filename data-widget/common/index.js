// RunDeck — Zepp OS Workout Extension data screen. Pinned inside the native
// running workout (app.json extType "workout"): the native workout keeps GPS,
// recording and laps; this page lays out a dense one-screen dashboard on top.
//
// Every number is the watch's own: each slot's value is a SPORT_DATA widget
// the watch draws and updates itself (also while this page's code is
// suspended), so the screen always matches the native workout. RunDeck draws
// the labels, the HR zone, the zone bar and the target colors.
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
  ZONE_BAR,
} from "zosLoader:./index.[pf].layout.js"
import { BasePage } from "@zeppos/zml/base-page"
import { getDeviceInfo } from "@zos/device"
import { Screen } from "@zos/sensor"
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
import { px } from "@zos/utils"
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
  FIELDS,
  fieldValue,
  newerLayout,
  ROWS,
  rowSlots,
  SLOT_IDS,
} from "../../shared/fields.js"
import { MSG } from "../../shared/messages.js"
import { TargetTracker } from "../../shared/target.js"
import { TRIAL_RUNS, TrialSession } from "../../shared/trial.js"
import {
  ZONE_COLORS,
  ZONE_COUNT,
  zoneColor,
  zonePosition,
} from "../../shared/zones.js"
import { readVo2Max, resolveHrZones } from "./hr-zones.js"
import { LiveMetrics } from "./metrics.js"

const TICK_MS = 1000
const SCREEN_OFF = 2 // Screen.getStatus(): 1 on, 2 off
// For a moment after coming back on screen, late getSportData answers
// redraw at once (the zone bar and target colors).
const CATCH_UP_REDRAW_SEC = 3
const CONFIG_RETRY_SEC = 60
// Wait this long for the phone's reply (license, trial count) before the
// access mode is latched for the activity; offline, the cached state decides.
const PHONE_GRACE_SEC = 10
// edit_id of the native HR chart; slots take 101 and up
const CHART_EDIT_ID = 100

// shipped icon size nearest to a scaled size
function iconFile(size) {
  let best = ICON.sizes[0]
  for (const s of ICON.sizes)
    if (Math.abs(s - size) < Math.abs(best - size)) best = s
  return best
}

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
      tracker: null,
      inView: true, // onPause/onResume: drawing only while on screen
      screenDark: false, // screen off without the always-on display
      screen: null,
      screenUpdate: null,
      drawn: false, // the last tick drew the screen
      inRefresh: false,
      redrawUntil: 0, // late getSportData answers redraw until then
      timer: null,
      ticks: 0,
      ui: {},
      cache: {}, // last rendered text/color/size/visibility per widget key
      lastConfigAttemptAt: null,
      configReceived: false,
      initAt: null,
      reportedUsed: null, // trial count last reported to the phone
      native: {}, // slotId -> {sig, w}: the watch-drawn value widgets
      measureCache: new Map(), // "size|text" -> px width
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
      this.state.vo2max = readVo2Max()
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
      // answers that land after the tick drew (async on device) redraw at
      // once when the screen just came back
      this.state.metrics.onData = () => {
        if (
          !this.state.inRefresh &&
          this.visible() &&
          this.nowSec() < this.state.redrawUntil
        )
          this.render()
      }
      this.state.tracker = new TargetTracker(cfg.target)
      this.buildUi()
      this.applyGeometry()
      this.watchScreen()
      this.state.timer = setInterval(() => this.onTick(), TICK_MS)
      this.onTick()
    },

    // Back in view (from another data page, the on-watch layout editor or
    // any other page): pick up a layout edited there and draw at once.
    onResume() {
      this.state.inView = true
      this.applyLayout(newerLayout(this.state.layout, loadObject(LAYOUT_KEY)))
      this.onTick()
    },

    // Out of view (another data page): draw nothing; the watch keeps its own
    // values current.
    onPause() {
      this.state.inView = false
    },

    // Screen off with raise-to-wake (no always-on display): nothing is seen,
    // so it counts as out of view; waking draws fresh values at once. With
    // the always-on display the screen may still show RunDeck, so it keeps
    // drawing.
    watchScreen() {
      try {
        const screen = new Screen()
        const update = () => {
          const was = this.state.screenDark
          this.readScreen()
          if (was && !this.state.screenDark) this.onTick()
        }
        this.state.screen = screen
        this.state.screenUpdate = update
        screen.onChange(update)
        this.readScreen()
      } catch (e) {
        this.state.screen = null // no screen sensor: always drawn
      }
    },

    readScreen() {
      const screen = this.state.screen
      if (!screen) return
      try {
        this.state.screenDark =
          screen.getStatus() === SCREEN_OFF && !screen.getAodMode()
      } catch (e) {
        this.state.screenDark = false
      }
    },

    // on screen: in view (onPause/onResume) and the screen not dark
    visible() {
      return this.state.inView && !this.state.screenDark
    },

    onDestroy() {
      if (this.state.timer) clearInterval(this.state.timer)
      if (this.state.screen)
        try {
          this.state.screen.offChange(this.state.screenUpdate)
        } catch (e) {
          /* ignore */
        }
      if (this.state.metrics) this.state.metrics.destroy()
      this.persistTrial()
      const globals = appGlobals()
      if (globals && globals.onConfigPush === this.state.pushHook)
        globals.onConfigPush = null
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
      const { metrics, tracker } = this.state
      if (metrics) {
        metrics.paceUnit = cfg.pace_unit
        metrics.channels = this.channels()
      }
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
        if (/^(r\d[lcr]|header[lr]?)[lvi]:/.test(k)) delete this.state.cache[k]
      for (const id of SLOT_IDS) {
        const g = geo[id]
        const slot = ui.slots[id]
        if (!g) {
          this.setProp(`${id}v`, slot.value, "visible", false)
          this.setProp(`${id}l`, slot.label, "visible", false)
          this.setProp(`${id}i`, slot.icon, "visible", false)
          continue
        }
        slot.value.setProperty(prop.MORE, { ...g.value })
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

    // Live values the screen colors by: pace/power only when the zone bar
    // or the target uses them (HR comes from the sensor anyway).
    channels() {
      const { config: cfg, layout, hrZones } = this.state
      const set = {}
      const bar = resolveBar(layout.bar, cfg, hrZones)
      if (bar && bar.metric !== "hr") set[bar.metric] = true
      if (cfg.target && cfg.target.metric !== "hr")
        set[cfg.target.metric] = true
      return set
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
      const { metrics, trial } = this.state
      if (!metrics) return
      this.state.ticks += 1
      // a missed screen-on event must not leave the screen frozen
      if (this.state.screenDark) this.readScreen()
      const now = this.nowSec()
      const visible = this.visible()
      if (visible && !this.state.drawn)
        this.state.redrawUntil = now + CATCH_UP_REDRAW_SEC
      this.state.inRefresh = true
      let s
      try {
        s = metrics.refresh()
      } finally {
        this.state.inRefresh = false
      }

      // Trial runs are counted silently: the run screen stays clean, and the
      // trial status lives in the phone settings.
      const settled =
        this.state.configReceived || now - this.state.initAt >= PHONE_GRACE_SEC
      this.state.mode = trial.tick(now, settled ? s.elapsed : null)
      this.persistTrial()

      if (
        !this.state.configReceived &&
        now - this.state.lastConfigAttemptAt >= CONFIG_RETRY_SEC
      )
        this.fetchConfig()
      if (visible) this.render()
      this.state.drawn = visible
    },

    // ------------------------------------------------------------------- UI

    buildUi() {
      const ui = this.state.ui
      const text = (props) => createWidget(widget.TEXT, { ...props, text: "" })
      createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: px(480),
        h: px(480),
        color: COLORS.bg,
      })
      ui.dividers = DIVIDERS.map((d) => createWidget(widget.FILL_RECT, d))

      // every slot of every column count exists once; applyGeometry places
      // the ones the layout shows and hides the rest
      const blank = ROW_GEOMETRY.header[1].header
      ui.slots = {}
      for (const id of SLOT_IDS) {
        ui.slots[id] = {
          label: text(blank.label),
          value: text(blank.value),
          icon: createWidget(widget.IMG, {
            x: 0,
            y: 0,
            w: ICON.large,
            h: ICON.large,
            src: `icons/${iconFile(ICON.large)}/heart.png`,
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

    // The watch-drawn value of a slot: one SPORT_DATA widget, sized for the
    // field's widest typical value and placed by the box's alignment (the
    // widget has no alignment of its own). A new color (target status)
    // recreates it: text_color is fixed at creation. `f` null deletes it;
    // deleted, not hidden, since the watch keeps drawing a SPORT_DATA widget
    // whatever its visible property says.
    showNative(id, f, box, color) {
      if (!f) {
        this.dropNative(id)
        return
      }
      const size = fittedSize(box, f.sample)
      const w = Math.min(box.w, this.measure(f.sample, size) + 2)
      let x = box.x
      if (box.align_h === align.CENTER_H)
        x = box.x + Math.round((box.w - w) / 2)
      else if (box.align_h === align.RIGHT) x = box.x + box.w - w
      const sig = `${f.native}|${color}|${x}|${w}|${size}`
      const cur = this.state.native[id]
      if (cur && cur.sig === sig) return
      this.dropNative(id)
      const widgetObj = this.createNative(
        101 + SLOT_IDS.indexOf(id),
        f.native,
        {
          x,
          y: box.y,
          w,
          h: box.h,
          text_size: size,
          text_color: color,
        },
      )
      if (widgetObj) this.state.native[id] = { sig, w: widgetObj }
    },

    createNative(editId, type, box) {
      try {
        return (
          createWidget(widget.SPORT_DATA, {
            edit_id: editId,
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
            text_color: box.text_color,
            rect_visible: false,
            sub_text_visible: false,
          }) || null
        )
      } catch (e) {
        return null // type not supported on this firmware: the slot stays blank
      }
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
    },

    // The watch's own HR chart next to a single top HR value.
    showChart(show) {
      const ui = this.state.ui
      if (!show) {
        if (ui.chart)
          try {
            deleteWidget(ui.chart)
          } catch (e) {
            /* already gone */
          }
        ui.chart = null
        return
      }
      if (ui.chart) return
      ui.chart = this.createNative(CHART_EDIT_ID, "CHART_HR", {
        ...HR_GRAPH,
        text_size: px(16),
        text_color: COLORS.value,
      })
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
      const size = iconFile(
        box.text_size <= ICON.smallUpTo ? ICON.small : ICON.large,
      )
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
      const { ui, config: cfg, metrics, mode, layout } = this.state
      if (!ui.slots || !metrics) return
      const s = metrics.snapshot
      const locked = mode === "locked"
      const ctx = { s, hrZones: this.state.hrZones, vo2max: this.state.vo2max }

      // target: colors every slot that shows the target's live metric
      const t = cfg.target
      const status = this.state.tracker.update(t ? barValue(t.metric, s) : null)
      const targetField = t ? t.metric : null

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
        const visible = !locked || lockedKeep.indexOf(id) >= 0
        const fieldId = layout.slots[id]
        let f = FIELDS[fieldId] || FIELDS.none
        const valueColor =
          fieldId === targetField && status ? COLORS[status] : COLORS.value
        // the watch draws the value (SPORT_DATA widget)
        this.showNative(id, visible && f.native ? f : null, g.value, valueColor)
        this.setProp(`${id}v`, slot.value, "visible", visible && !!f.value)
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
        const labelBox =
          layout.labels === "icons" && g.iconLabel ? g.iconLabel : g.label
        this.renderLabel(id, slot, labelBox, f, layout.labels, labelColor)
        // the HR zone: the one value RunDeck draws itself
        if (f.value)
          this.setFitted(
            `${id}v`,
            slot.value,
            g.value,
            fieldValue(fieldId, ctx),
            valueColor,
          )
      }

      // single top value showing HR: zone suffix + the watch's HR chart
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
      this.showChart(!locked && headerIsHr)

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

      this.setProp("notice", ui.notice, "visible", locked)
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
  }),
)
