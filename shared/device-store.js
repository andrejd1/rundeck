// Durable on-watch persistence (config, layout, trial counter, license).
// localStorage (@zos/storage) alone proved unreliable on-device in Intervals
// Guide: leaving the extension page (or an abrupt kill of the extension
// runtime) can come back with an empty localStorage. Every value is therefore
// written to BOTH localStorage and a JSON file in the app's /data directory
// (@zos/fs), and reads fall back to the file when localStorage comes up empty.

import { readFileSync, rmSync, writeFileSync } from "@zos/fs"
import { localStorage } from "@zos/storage"

export const CONFIG_KEY = "rundeck_config" // screen config from the phone
export const TRIAL_KEY = "rundeck_trial" // {used, last}
export const LICENSE_KEY = "rundeck_license" // {licensed, checked_at}
export const LAYOUT_KEY = "rundeck_layout" // layout edited on the watch

const filePath = (key) => `${key}.json`

// Values this runtime already wrote to BOTH copies: the same config can reach
// the cache through app.js (push) and the widget (pull), and a flash write per
// path costs battery for nothing.
const lastWritten = new Map()

export function saveObject(key, obj) {
  let raw
  try {
    raw = JSON.stringify(obj)
  } catch (e) {
    return
  }
  if (lastWritten.get(key) === raw) return
  try {
    localStorage.setItem(key, raw)
  } catch (e) {
    /* storage full/unavailable -> the file copy below still persists */
  }
  try {
    writeFileSync({
      path: filePath(key),
      data: raw,
      options: { encoding: "utf8" },
    })
  } catch (e) {
    /* fs unavailable -> localStorage copy is the fallback */
  }
  lastWritten.set(key, raw)
}

export function loadObject(key) {
  const fromLocal = parse(readLocal(key))
  if (fromLocal != null) return fromLocal
  const fromFile = parse(readFile(key))
  if (fromFile != null) {
    // heal localStorage so the cheaper read path works again
    try {
      localStorage.setItem(key, JSON.stringify(fromFile))
    } catch (e) {
      /* non-fatal */
    }
  }
  return fromFile
}

export function removeObject(key) {
  lastWritten.delete(key)
  try {
    localStorage.removeItem(key)
  } catch (e) {
    /* ignore */
  }
  try {
    rmSync({ path: filePath(key) })
  } catch (e) {
    /* file may not exist */
  }
}

function readLocal(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

function readFile(key) {
  try {
    const raw = readFileSync({
      path: filePath(key),
      options: { encoding: "utf8" },
    })
    return typeof raw === "string" ? raw : null
  } catch (e) {
    return null
  }
}

function parse(raw) {
  if (!raw || typeof raw !== "string") return null
  try {
    const obj = JSON.parse(raw)
    return obj && typeof obj === "object" ? obj : null
  } catch (e) {
    return null
  }
}
