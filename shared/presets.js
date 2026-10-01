// Presets: named snapshots of what changes from run to run, the screen layout
// and the target. Zones, FTP, LT pace and the pace unit describe the runner,
// not the run, so they stay out: applying an old preset must never roll back
// an updated FTP.
//
// Phone settings keep them in "presets_json" and the last applied one in
// "preset_active" ({id, at}). The watch config carries every preset ready to
// use (layout + parsed target, see buildConfig), so the watch can switch
// offline. Whoever switched last wins: the watch's pick ({id, at}) beats the
// phone's target when it is newer than the phone's last target change
// ("target_at"); layouts already settle by their own updated_at.

import { normalizeLayout } from "./fields.js"

export const MAX_PRESETS = 6
export const PRESET_NAME_MAX = 20

// Settings a preset stores besides the layout.
export const PRESET_TARGET_KEYS = [
  "target_metric",
  "target_pace_low",
  "target_pace_high",
  "target_power_low",
  "target_power_high",
  "target_hr_low",
  "target_hr_high",
]

const TARGET_METRICS = ["pace", "power", "hr"]

const cleanName = (name) =>
  String(name == null ? "" : name)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PRESET_NAME_MAX)

export const newPresetId = () =>
  `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

// Layout without its stamp: what a preset stores and compares.
const layoutBody = (raw) => {
  const l = normalizeLayout(raw)
  return { v: l.v, slots: l.slots, cols: l.cols, labels: l.labels, bar: l.bar }
}

/** Any input -> {id, name, layout, values} or null. */
export function normalizePreset(raw) {
  if (!raw || typeof raw !== "object") return null
  const id = typeof raw.id === "string" ? raw.id.slice(0, 32) : ""
  const name = cleanName(raw.name)
  if (!id || !name) return null
  const src = raw.values && typeof raw.values === "object" ? raw.values : {}
  const values = {}
  for (const k of PRESET_TARGET_KEYS) {
    const v = src[k]
    values[k] =
      typeof v === "string" || typeof v === "number"
        ? String(v).trim().slice(0, 16)
        : ""
  }
  if (TARGET_METRICS.indexOf(values.target_metric) < 0)
    values.target_metric = "pace"
  return { id, name, layout: layoutBody(raw.layout), values }
}

/** A list of presets: valid ones, unique ids, at most MAX_PRESETS. */
export function normalizePresets(raw) {
  const out = []
  if (!Array.isArray(raw)) return out
  for (const r of raw) {
    const p = normalizePreset(r)
    if (p && out.length < MAX_PRESETS && !out.some((q) => q.id === p.id))
      out.push(p)
  }
  return out
}

function parseJson(text) {
  try {
    return JSON.parse(text || "null")
  } catch (e) {
    return null
  }
}

/** `get(key)` -> raw settings string. */
export const readPresets = (get) =>
  normalizePresets(parseJson(get("presets_json")))

/** {id, at} of the preset applied last, or null. */
export function readActive(get) {
  const a = parseJson(get("preset_active"))
  if (!a || typeof a !== "object" || typeof a.id !== "string") return null
  const at = Number(a.at)
  return { id: a.id, at: Number.isFinite(at) && at > 0 ? at : 0 }
}

/** Current layout + target settings as a preset. */
export function presetFromSettings(get, id, name, layoutRaw) {
  const values = {}
  for (const k of PRESET_TARGET_KEYS) {
    const v = get(k)
    values[k] = v == null ? "" : String(v)
  }
  return normalizePreset({ id, name, layout: layoutRaw, values })
}

/**
 * Settings to write to apply a preset at time `at`: its layout (stamped, so
 * it beats the watch's copy), its target, and the active marker. The legacy
 * single-string target goes, or it would come back through the fallback.
 */
export function presetSettings(preset, at) {
  const out = {
    layout_json: JSON.stringify({ ...preset.layout, updated_at: at }),
    target_range: "",
    target_at: String(at),
    preset_active: JSON.stringify({ id: preset.id, at }),
  }
  for (const k of PRESET_TARGET_KEYS) out[k] = preset.values[k]
  return out
}

/** Do the current settings still equal the preset (layout and target)? */
export function presetMatches(get, preset, layoutRaw) {
  if (JSON.stringify(layoutBody(layoutRaw)) !== JSON.stringify(preset.layout))
    return false
  const cur = presetFromSettings(get, preset.id, preset.name, layoutRaw)
  return PRESET_TARGET_KEYS.every((k) => cur.values[k] === preset.values[k])
}

/**
 * Watch side: a config from the phone with the watch's own preset pick
 * (`local` = {id, at}) laid over it when that pick is newer than the
 * phone's last target change. Returns `cfg` itself when nothing changes.
 */
export function withLocalPreset(cfg, local) {
  if (!cfg || !local || typeof local.id !== "string") return cfg
  if (!(Number(local.at) > (Number(cfg.target_at) || 0))) return cfg
  const presets = Array.isArray(cfg.presets) ? cfg.presets : []
  const p = presets.find((q) => q && q.id === local.id)
  if (!p) return cfg
  return {
    ...cfg,
    target: p.target || null,
    preset_id: p.id,
    target_at: Number(local.at),
  }
}
