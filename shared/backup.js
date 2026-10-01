// Settings export / import (phone settings page only). The export is one line
// of JSON the user copies out of the settings page and pastes back in, on the
// same phone or another one. It holds every screen setting and the presets,
// never the license key, its activation or the trial count: those belong to
// the purchase and the watch, not to a layout someone shares.
//
// Import replaces: a setting missing from the text goes back to its default,
// so the result is exactly what was exported.

import { normalizeLayout } from "./fields.js"
import { normalizePresets, readPresets } from "./presets.js"

export const BACKUP_APP = "RunDeck"
export const BACKUP_FORMAT = 1

// Plain settings strings, with the values an enum key accepts.
export const BACKUP_KEYS = {
  pace_unit: ["min_per_km", "min_per_mile"],
  target_metric: ["pace", "power", "hr"],
  target_pace_low: null,
  target_pace_high: null,
  target_power_low: null,
  target_power_high: null,
  target_hr_low: null,
  target_hr_high: null,
  hr_zone_method: ["device", "max", "lthr", "custom"],
  max_hr: null,
  lthr: null,
  hr_zones_custom: null,
  threshold_pace: null,
  ftp: null,
}

const MAX_VALUE_LEN = 64

/** `get(key)` -> raw settings string. Returns the export text. */
export function exportSettings(get) {
  const settings = {}
  for (const k of Object.keys(BACKUP_KEYS)) {
    const v = get(k)
    if (v != null && v !== "") settings[k] = String(v)
  }
  let layout = null
  try {
    layout = JSON.parse(get("layout_json") || "null")
  } catch (e) {
    layout = null
  }
  const { updated_at, ...body } = normalizeLayout(layout)
  return JSON.stringify({
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    settings,
    layout: body,
    presets: readPresets(get),
  })
}

/**
 * Export text -> {ok: true, values, settings, presets} where `values` is
 * every settings key to write (as strings), or {ok: false, message}. `now`
 * stamps the layout and target so the import beats the watch's copies.
 */
export function importSettings(text, now = Date.now()) {
  const raw = String(text == null ? "" : text).trim()
  if (!raw) return { ok: false, message: "Nothing pasted" }
  let data
  try {
    data = JSON.parse(raw)
  } catch (e) {
    return {
      ok: false,
      message:
        raw[0] === "{"
          ? "The text is cut off - copy all of it"
          : "Not a RunDeck export",
    }
  }
  if (!data || typeof data !== "object" || data.app !== BACKUP_APP)
    return { ok: false, message: "Not a RunDeck export" }
  if (!(Number(data.format) >= 1) || Number(data.format) > BACKUP_FORMAT)
    return {
      ok: false,
      message: "Made by a newer RunDeck - update the app first",
    }

  const src =
    data.settings && typeof data.settings === "object" ? data.settings : {}
  const values = {}
  let settings = 0
  for (const k of Object.keys(BACKUP_KEYS)) {
    const v = src[k]
    let s =
      typeof v === "string" || typeof v === "number"
        ? String(v).trim().slice(0, MAX_VALUE_LEN)
        : ""
    const allowed = BACKUP_KEYS[k]
    if (allowed && allowed.indexOf(s) < 0) s = ""
    if (s) settings += 1
    values[k] = s
  }
  const presets = normalizePresets(data.presets)
  values.layout_json = JSON.stringify({
    ...normalizeLayout(data.layout),
    updated_at: now,
  })
  values.presets_json = JSON.stringify(presets)
  values.preset_active = ""
  values.target_range = ""
  values.target_at = String(now)
  return { ok: true, values, settings, presets: presets.length }
}
