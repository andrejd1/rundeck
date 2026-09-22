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
  store.set("primary_metric", "power")
  const r = await getConfig({ device_uuid: "abc123", trial_used: 2 })
  assert.equal(r.code, 0)
  assert.equal(r.config.primary, "power")
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
  assert.equal(store.get("license_state"), "")
  assert.match(store.get("license_status_text"), /maximum number of watches/)
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
  await svc.onSettingsChange({ key: "bar_metric", newValue: "hr" })
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
