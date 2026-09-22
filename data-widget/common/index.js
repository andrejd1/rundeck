// RunDeck — Zepp OS Workout Extension data screen. Pinned inside the native
// running workout (app.json extType "workout"): the native workout keeps GPS,
// recording and laps; this page renders a dense one-screen dashboard on top.
//
// Access: 5 free runs, then the full screen needs a license (see
// shared/trial.js). Locked mode keeps the basics (HR, pace, time, distance)
// so the page is never a dead end mid-run.

import {
  ASCENT_LABEL,
  ASCENT_VALUE,
  AVG_HR_LABEL,
  AVG_HR_VALUE,
  AVG_PACE_LABEL,
  AVG_PACE_VALUE,
  CADENCE_LABEL,
  CADENCE_VALUE,
  CENTER_VALUE,
  CENTER_VALUE_WIDE_SIZE,
  COLORS,
  DIST_LABEL,
  DIST_VALUE,
  DIVIDERS,
  ELAPSED_VALUE,
  ELAPSED_VALUE_LONG_SIZE,
  GRADE_LABEL,
  GRADE_VALUE,
  HR_GRAPH,
  HR_LABEL,
  HR_VALUE,
  HR_ZONE,
  LAP_DIST_LABEL,
  LAP_DIST_VALUE,
  LAP_HR_LABEL,
  LAP_HR_VALUE,
  LAP_PACE_LABEL,
  LAP_PACE_VALUE,
  LAP_TIME_LABEL,
  LAP_TIME_VALUE,
  NOTICE,
  NOTICE_SUB,
  ZONE_BAR,
} from "zosLoader:./index.[pf].layout.js"
import { BasePage } from "@zeppos/zml/base-page"
import { getDeviceInfo } from "@zos/device"
import { KEY_EVENT_CLICK, KEY_SHORTCUT, offKey, onKey } from "@zos/interaction"
import { createWidget, prop, widget } from "@zos/ui"
import { appGlobals } from "../../shared/app-globals.js"
import { normalizeConfig } from "../../shared/config.js"
import {
  CONFIG_KEY,
  LICENSE_KEY,
  loadObject,
  saveObject,
  TRIAL_KEY,
} from "../../shared/device-store.js"
import {
  ascentStr,
  distanceStr,
  durationStr,
  gradeStr,
  intStr,
  lapTimeStr,
  paceStr,
} from "../../shared/format.js"
import { MSG } from "../../shared/messages.js"
import { HR_GRAPH_BARS, RunStats } from "../../shared/stats.js"
import { TargetTracker } from "../../shared/target.js"
import { runsLeft, TRIAL_RUNS, TrialSession } from "../../shared/trial.js"
import {
  ZONE_COLORS,
  ZONE_COUNT,
  zoneColor,
  zonePosition,
} from "../../shared/zones.js"
import { LiveMetrics } from "./metrics.js"

const TICK_MS = 1000
const GRAPH_EVERY_TICKS = 5 // HR graph redraw cadence (bars move every 10 s)
const TRIAL_NOTICE_SEC = 15
const LAP_NOTICE_SEC = 6
const LAP_DEBOUNCE_SEC = 2
const CONFIG_RETRY_SEC = 60
// Wait this long for the phone's reply (license, trial count) before the
// access mode is latched for the activity; offline, the cached state decides.
const PHONE_GRACE_SEC = 10

DataWidget(
  BasePage({
    state: {
      config: null,
      licensed: false,
      trial: null, // TrialSession
      mode: "pending",
      metrics: null,
      stats: null,
      tracker: null,
      timer: null,
      ticks: 0,
      ui: {},
      cache: {}, // last rendered text/color/visibility per widget key
      notice: null, // {text, color, until}
      lastLapAt: null,
      lastConfigAttemptAt: null,
      configReceived: false,
      initAt: null,
      reportedUsed: null, // trial count last reported to the phone
    },

    nowSec() {
      return Date.now() / 1000
    },

    // ------------------------------------------------------------ lifecycle

    onInit() {
      this.state.initAt = this.nowSec()
      this.state.config = normalizeConfig(loadObject(CONFIG_KEY))
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
        wantPower: this.usesPower(cfg),
      })
      this.state.stats = new RunStats({ autoLapM: cfg.auto_lap_m })
      this.state.tracker = new TargetTracker(cfg.target)
      this.buildUi()
      this.registerKeys()
      this.state.timer = setInterval(() => this.onTick(), TICK_MS)
      this.onTick()
    },

    onResume() {
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
      if (this.state.ui.center) this.render()
    },

    applyConfig(cfg) {
      this.state.config = cfg
      const { metrics, stats, tracker } = this.state
      if (metrics) {
        metrics.paceUnit = cfg.pace_unit
        metrics.wantPower = this.usesPower(cfg)
      }
      if (stats) stats.setAutoLap(cfg.auto_lap_m)
      if (tracker) tracker.setTarget(cfg.target)
    },

    usesPower(cfg) {
      return cfg.primary === "power" || cfg.bar === "power"
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

      const wasMode = this.state.mode
      const usedBefore = trial.trial.used
      const now = this.nowSec()
      const settled =
        this.state.configReceived || now - this.state.initAt >= PHONE_GRACE_SEC
      this.state.mode = trial.tick(now, settled ? s.elapsed : null)
      if (wasMode === "pending" && this.state.mode === "trial") {
        const n = trial.counted ? trial.trial.used : trial.trial.used + 1
        this.showNotice(
          `Trial run ${Math.min(n, TRIAL_RUNS)} of ${TRIAL_RUNS}`,
          COLORS.notice,
          TRIAL_NOTICE_SEC,
        )
      }
      if (trial.trial.used > usedBefore && runsLeft(trial.trial) === 0) {
        this.showNotice(
          "Last trial run - unlock in Zepp app",
          COLORS.noticeWarn,
          TRIAL_NOTICE_SEC,
        )
      }
      this.persistTrial()

      if (
        !this.state.configReceived &&
        this.nowSec() - this.state.lastConfigAttemptAt >= CONFIG_RETRY_SEC
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
      const text = (key, props) => {
        ui[key] = createWidget(widget.TEXT, { ...props, text: "" })
      }
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
      text("hrLabel", HR_LABEL)
      text("hr", HR_VALUE)
      text("hrZone", HR_ZONE)
      text("lapHrLabel", LAP_HR_LABEL)
      text("lapHr", LAP_HR_VALUE)
      text("avgHr", AVG_HR_VALUE)
      text("avgHrLabel", AVG_HR_LABEL)

      text("leftLabel", LAP_PACE_LABEL)
      text("left", LAP_PACE_VALUE)
      text("center", CENTER_VALUE)
      text("rightLabel", AVG_PACE_LABEL)
      text("right", AVG_PACE_VALUE)

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
      ui.marker = createWidget(widget.FILL_RECT, {
        x: ZONE_BAR.x,
        y: ZONE_BAR.marker.y,
        w: ZONE_BAR.marker.w,
        h: ZONE_BAR.marker.h,
        radius: Math.round(ZONE_BAR.marker.w / 2),
        color: ZONE_BAR.marker.color,
      })

      text("lapTimeLabel", LAP_TIME_LABEL)
      text("lapTime", LAP_TIME_VALUE)
      text("elapsed", ELAPSED_VALUE)
      text("cadenceLabel", CADENCE_LABEL)
      text("cadence", CADENCE_VALUE)

      text("lapDistLabel", LAP_DIST_LABEL)
      text("lapDist", LAP_DIST_VALUE)
      text("grade", GRADE_VALUE)
      text("gradeLabel", GRADE_LABEL)

      text("distLabel", DIST_LABEL)
      text("dist", DIST_VALUE)
      text("ascentLabel", ASCENT_LABEL)
      text("ascent", ASCENT_VALUE)

      text("notice", NOTICE)
      text("noticeSub", NOTICE_SUB)

      this.setText("hrLabel", "HR")
      this.setText("lapHrLabel", "Lap HR")
      this.setText("avgHrLabel", "Avg HR")
      this.setText("lapTimeLabel", "Lap Time")
      this.setText("cadenceLabel", "Cadence")
      this.setText("lapDistLabel", "Lap Dist")
      this.setText("gradeLabel", "Grade")
      this.setText("distLabel", "Distance")
      this.setText("ascentLabel", "Ascent")
    },

    // redraw-avoiding setters: each widget update is an IPC on device
    setText(key, text, color) {
      const c = this.state.cache
      const w = this.state.ui[key]
      if (!w) return
      if (c[`t:${key}`] !== text) {
        c[`t:${key}`] = text
        w.setProperty(prop.TEXT, text)
      }
      if (color != null && c[`c:${key}`] !== color) {
        c[`c:${key}`] = color
        w.setProperty(prop.MORE, { color })
      }
    },

    setTextSize(key, size) {
      const w = this.state.ui[key]
      if (!w || this.state.cache[`s:${key}`] === size) return
      this.state.cache[`s:${key}`] = size
      w.setProperty(prop.MORE, { text_size: size })
    },

    setVisible(key, visible, w = this.state.ui[key]) {
      const c = this.state.cache
      if (!w || c[`v:${key}`] === visible) return
      c[`v:${key}`] = visible
      w.setProperty(prop.VISIBLE, visible)
    },

    setGroupVisible(keys, visible) {
      for (const k of keys) this.setVisible(k, visible)
    },

    render() {
      const { ui, config: cfg, stats, metrics, mode } = this.state
      if (!ui.center || !metrics) return
      const s = metrics.snapshot
      const unit = cfg.pace_unit
      const locked = mode === "locked"

      // --- header: HR + zone + graph
      const hrPos = zonePosition(s.hr, cfg.hr_zones)
      this.setText("hr", intStr(s.hr))
      this.setText(
        "hrZone",
        hrPos && hrPos.zone > 0 ? `Z${hrPos.zone}` : "",
        zoneColor(hrPos ? hrPos.zone : 0),
      )
      if (this.state.ticks % GRAPH_EVERY_TICKS === 1 || locked)
        this.renderGraph(locked)

      // --- center: primary metric colored against its target
      const primaryValue = cfg.primary === "power" ? s.power : s.speed
      const status = this.state.tracker.update(primaryValue)
      const centerText =
        cfg.primary === "power" ? `${intStr(s.power)}W` : paceStr(s.speed, unit)
      this.setTextSize(
        "center",
        centerText.length > 4 ? CENTER_VALUE_WIDE_SIZE : CENTER_VALUE.text_size,
      )
      this.setText("center", centerText, status ? COLORS[status] : COLORS.value)
      const el = s.elapsed
      this.setText("elapsed", durationStr(el))
      this.setTextSize(
        "elapsed",
        el != null && el >= 3600
          ? ELAPSED_VALUE_LONG_SIZE
          : ELAPSED_VALUE.text_size,
      )
      this.setText("dist", distanceStr(s.distance, unit))

      const detail = [
        "lapHrLabel",
        "lapHr",
        "avgHr",
        "avgHrLabel",
        "leftLabel",
        "left",
        "rightLabel",
        "right",
        "lapTimeLabel",
        "lapTime",
        "cadenceLabel",
        "cadence",
        "ascentLabel",
        "ascent",
      ]
      const lapRow = ["lapDistLabel", "lapDist", "grade", "gradeLabel"]
      this.setGroupVisible(detail, !locked)
      for (let i = 0; i < ui.zoneSegs.length; i++)
        this.setVisible(`seg${i}`, !locked, ui.zoneSegs[i])
      for (let i = 1; i < ui.dividers.length; i++)
        this.setVisible(`div${i}`, !locked, ui.dividers[i])

      if (locked) {
        this.setVisible("marker", false)
        this.setGroupVisible(lapRow, false)
        this.setVisible("notice", true)
        this.setVisible("noticeSub", true)
        this.setText("noticeSub", `Trial ended (${TRIAL_RUNS} runs)`)
        this.setText("notice", "Unlock in Zepp app", COLORS.noticeWarn)
        return
      }
      this.setVisible("noticeSub", false)

      // --- HR row
      this.setText("lapHr", intStr(stats.lapHr()))
      this.setText("avgHr", intStr(stats.avgHr.value))

      // --- pace/power row
      if (cfg.primary === "power") {
        this.setText("leftLabel", "Lap Pwr")
        this.setText("left", intStr(stats.lapPower()))
        this.setText("rightLabel", "Pace")
        this.setText("right", paceStr(s.speed, unit))
      } else {
        this.setText("leftLabel", "Lap Pace")
        this.setText("left", paceStr(stats.lapSpeed(), unit))
        this.setText("rightLabel", "Avg Pace")
        this.setText(
          "right",
          paceStr(s.avg_speed != null ? s.avg_speed : stats.avgSpeed(), unit),
        )
      }

      // --- zone bar marker
      const barValue =
        cfg.bar === "power" ? s.power : cfg.bar === "pace" ? s.speed : s.hr
      const bounds =
        cfg.bar === "power"
          ? cfg.power_zones
          : cfg.bar === "pace"
            ? cfg.pace_zones
            : cfg.hr_zones
      const pos = zonePosition(barValue, bounds)
      this.setVisible("marker", !!pos)
      if (pos) {
        const x = Math.round(
          ZONE_BAR.x + pos.pos * (ZONE_BAR.w - ZONE_BAR.marker.w),
        )
        if (this.state.cache.markerX !== x) {
          this.state.cache.markerX = x
          ui.marker.setProperty(prop.MORE, {
            x,
            y: ZONE_BAR.marker.y,
            w: ZONE_BAR.marker.w,
            h: ZONE_BAR.marker.h,
          })
        }
      }

      // --- time row
      this.setText("lapTime", lapTimeStr(stats.lapTime()))
      this.setText("cadence", intStr(s.cadence))

      // --- lap distance / grade, or a notice over them
      const n = this.state.notice
      const noticeOn = !!n && this.nowSec() < n.until
      if (!noticeOn) this.state.notice = null
      this.setGroupVisible(lapRow, !noticeOn)
      this.setVisible("notice", noticeOn)
      if (noticeOn) this.setText("notice", n.text, n.color)
      this.setText("lapDist", distanceStr(stats.lapDistance(), unit))
      this.setText("grade", gradeStr(stats.grade))
      this.setText("ascent", ascentStr(s.ascent, unit))
    },

    renderGraph(hidden) {
      const { ui, stats, config: cfg } = this.state
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
        const pos = v == null ? null : zonePosition(v, cfg.hr_zones)
        const color =
          v == null ? COLORS.graphEmpty : zoneColor(pos ? pos.zone : 0)
        const key = `g${i}`
        const sig = `${h}:${color}`
        if (this.state.cache[key] === sig) continue
        this.state.cache[key] = sig
        ui.graph[i].setProperty(prop.MORE, {
          x: HR_GRAPH.x + i * HR_GRAPH.barW,
          y: HR_GRAPH.y + HR_GRAPH.h - h,
          w: HR_GRAPH.barW - 1,
          h,
          color,
        })
      }
    },
  }),
)
