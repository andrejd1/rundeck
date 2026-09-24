// Phone side service against a fake settingsStorage and a scripted Polar.
import assert from "node:assert/strict"
import { test } from "node:test"
import { MSG } from "../shared/messages.js"

const store = new Map()
globalThis.settings = {
  settingsStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
}
globalThis.AppSideService = (svc) => {
  globalThis.__sideService = svc
  return svc
}
await import("../app-side/index.js")
const svc = globalThis.__sideService

function polar(handler) {
  const calls = []
  svc.fetch = async (req) => {
    const body = JSON.parse(req.body)
    calls.push({ url: req.url, body })
    return handler(req.url, body)
  }
  return calls
}

const getConfig = (params) =>
  new Promise((resolve) =>
    svc.onRequest({ method: MSG.GET_CONFIG, params }, (_, r) => resolve(r)),
  )

test("GET_CONFIG returns the built config and remembers the watch", async () => {
  store.clear()
  store.set(
    "layout_json",
    JSON.stringify({ slots: { r2c: "power" }, updated_at: 3 }),
  )
  const r = await getConfig({ device_uuid: "abc123", trial_used: 2 })
  assert.equal(r.code, 0)
  assert.equal(r.config.layout.slots.r2c, "power")
  assert.equal(r.licensed, false)
  assert.equal(r.trial_used, 2)
  assert.equal(store.get("device_uuid"), "abc123")
  assert.match(store.get("license_status_text"), /3 of 5 runs left/)
})

test("entering a key activates it and pushes the unlock", async () => {
  store.clear()
  store.set("device_uuid", "watch-uuid-1")
  svc.call = (msg) => pushes.push(msg)
  const pushes = []
  const calls = polar(() => ({
    status: 200,
    body: { id: "act_9", license_key: { status: "granted" } },
  }))
  await svc.onSettingsChange({ key: "license_key", newValue: "abcd-1234" })
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /activate$/)
  assert.equal(calls[0].body.label, "watch-watch-uuid-1")
  const lic = JSON.parse(store.get("license_state"))
  assert.equal(lic.licensed, true)
  assert.equal(lic.activation_id, "act_9")
  assert.equal(pushes.at(-1).params.licensed, true)
  assert.match(store.get("license_status_text"), /Unlocked/)
  assert.equal((await getConfig({})).licensed, true)
})

test("a rejected key explains why and stays locked", async () => {
  store.clear()
  svc.call = () => {}
  polar(() => ({ status: 403, body: {} }))
  await svc.onSettingsChange({ key: "license_key", newValue: "used-key" })
  const lic = JSON.parse(store.get("license_state"))
  assert.equal(lic.licensed, false)
  assert.match(
    store.get("license_status_text"),
    /^Key not activated: it is already active on another watch.*Trial: 5 of 5 runs left$/,
  )
  // the reason survives later status refreshes (a trial report from the watch)
  svc.onCall({ method: MSG.TRIAL_REPORT, params: { trial_used: 1 } })
  assert.match(store.get("license_status_text"), /^Key not activated: .*4 of 5/)
  // the same key again is retried, not skipped
  const calls = polar(() => ({
    status: 200,
    body: { id: "act_2", license_key: { status: "granted" } },
  }))
  await svc.onSettingsChange({ key: "license_key", newValue: "used-key" })
  assert.equal(calls.length, 1)
  assert.match(store.get("license_status_text"), /^Unlocked/)
})

test("clearing the key frees the activation", async () => {
  store.clear()
  svc.call = () => {}
  store.set(
    "license_state",
    JSON.stringify({
      key: "K1",
      activation_id: "act_1",
      licensed: true,
      checked_at: Date.now(),
    }),
  )
  const calls = polar(() => ({ status: 204, body: null }))
  await svc.onSettingsChange({ key: "license_key", newValue: "" })
  assert.match(calls[0].url, /deactivate$/)
  assert.equal(calls[0].body.activation_id, "act_1")
  assert.equal((await getConfig({})).licensed, false)
})

test("stale license is re-validated; offline keeps it", async () => {
  store.clear()
  const old = Date.now() - 8 * 24 * 3600 * 1000
  store.set(
    "license_state",
    JSON.stringify({
      key: "K1",
      activation_id: "act_1",
      licensed: true,
      checked_at: old,
    }),
  )
  svc.fetch = async () => {
    throw new Error("offline")
  }
  assert.equal((await getConfig({})).licensed, true)
  await new Promise((r) => setImmediate(r))
  assert.equal(JSON.parse(store.get("license_state")).licensed, true)

  svc.call = () => {}
  polar(() => ({ status: 200, body: { status: "revoked" } }))
  await svc.revalidate(JSON.parse(store.get("license_state")))
  assert.equal(JSON.parse(store.get("license_state")).licensed, false)
})

test("settings changes push a new config", async () => {
  store.clear()
  const pushes = []
  svc.call = (msg) => pushes.push(msg)
  await svc.onSettingsChange({ key: "layout_json", newValue: "{}" })
  await svc.onSettingsChange({ key: "unrelated", newValue: "x" })
  assert.equal(pushes.length, 1)
  assert.equal(pushes[0].method, MSG.CONFIG_PUSH)
})

test("watch trial reports only ever raise the phone count", () => {
  store.clear()
  svc.onCall({ method: MSG.TRIAL_REPORT, params: { trial_used: 4 } })
  svc.onCall({ method: MSG.TRIAL_REPORT, params: { trial_used: 1 } })
  assert.equal(store.get("trial_used"), "4")
})

test("watch layout edits are kept only when newer", () => {
  store.clear()
  store.set(
    "layout_json",
    JSON.stringify({ slots: { r2c: "pace" }, updated_at: 100 }),
  )
  svc.onCall({
    method: MSG.LAYOUT_UPDATE,
    params: { layout: { slots: { r2c: "power" }, updated_at: 50 } },
  })
  assert.equal(JSON.parse(store.get("layout_json")).slots.r2c, "pace")
  svc.onCall({
    method: MSG.LAYOUT_UPDATE,
    params: { layout: { slots: { r2c: "power" }, updated_at: 200 } },
  })
  const saved = JSON.parse(store.get("layout_json"))
  assert.equal(saved.slots.r2c, "power")
  assert.equal(saved.updated_at, 200)
})

// Polar with an activation limit of 1: the first activation of a key wins,
// every later one is refused with 403
function polarLimit1() {
  const active = new Set()
  return polar(async (url, body) => {
    await new Promise((r) => setTimeout(r, 5)) // network latency
    if (/activate$/.test(url)) {
      if (active.has(body.key)) return { status: 403, body: {} }
      active.add(body.key)
      return {
        status: 200,
        body: { id: `act_${active.size}`, license_key: { status: "granted" } },
      }
    }
    return { status: 200, body: {} }
  })
}

test("the settings page saving the key twice activates it once", async () => {
  store.clear()
  svc.call = () => {}
  const calls = polarLimit1()
  // TextInput writes the raw paste (settingsKey) and the trimmed value
  // (onChange): two change events while the first activation is in flight
  await Promise.all([
    svc.onSettingsChange({ key: "license_key", newValue: "abcd-1234 \n" }),
    svc.onSettingsChange({ key: "license_key", newValue: "abcd-1234" }),
  ])
  assert.equal(calls.filter((c) => /activate$/.test(c.url)).length, 1)
  assert.equal(JSON.parse(store.get("license_state")).licensed, true)
  assert.match(store.get("license_status_text"), /Unlocked/)
})
