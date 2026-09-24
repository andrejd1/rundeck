import assert from "node:assert/strict"
import { test } from "node:test"
import {
  activateLicense,
  deactivateLicense,
  stillLicensed,
  validateLicense,
} from "../shared/license.js"

const reply = (status, body) => async () => ({ status, body })

test("activate: granted key returns the activation id", async () => {
  const calls = []
  const http = async (url, body) => {
    calls.push({ url, body })
    return {
      status: 200,
      body: JSON.stringify({ id: "act_1", license_key: { status: "granted" } }),
    }
  }
  const r = await activateLicense(http, { key: " abc-def ", label: "watch-1" })
  assert.deepEqual(r, { ok: true, activationId: "act_1", status: "granted" })
  assert.match(calls[0].url, /\/activate$/)
  assert.equal(calls[0].body.key, "ABC-DEF")
  assert.equal(calls[0].body.label, "watch-1")
  assert.ok(calls[0].body.organization_id)
})

test("activate: body wrapped in {data} is accepted", async () => {
  const r = await activateLicense(
    reply(200, { data: { id: "a", license_key: { status: "granted" } } }),
    { key: "K" },
  )
  assert.equal(r.ok, true)
})

test("activate: error mapping", async () => {
  assert.equal(
    (await activateLicense(reply(404, {}), { key: "K" })).error,
    "invalid_key",
  )
  assert.equal(
    (await activateLicense(reply(500, {}), { key: "K" })).error,
    "server",
  )
  assert.equal(
    (
      await activateLicense(
        reply(200, { id: "a", license_key: { status: "revoked" } }),
        { key: "K" },
      )
    ).error,
    "revoked",
  )
  const offline = async () => {
    throw new Error("offline")
  }
  assert.equal((await activateLicense(offline, { key: "K" })).error, "network")
  assert.equal(
    (await activateLicense(offline, { key: "  " })).error,
    "invalid_key",
  )
})

test("validate: granted, revoked, unknown", async () => {
  const ok = await validateLicense(reply(200, { status: "granted" }), {
    key: "K",
    activationId: "a",
  })
  assert.equal(ok.ok, true)
  const revoked = await validateLicense(reply(200, { status: "revoked" }), {
    key: "K",
    activationId: "a",
  })
  assert.equal(stillLicensed(revoked), false)
  const gone = await validateLicense(reply(404, {}), {
    key: "K",
    activationId: "a",
  })
  assert.equal(stillLicensed(gone), false)
  const offline = await validateLicense(
    async () => {
      throw new Error("x")
    },
    { key: "K", activationId: "a" },
  )
  assert.equal(stillLicensed(offline), true)
})

test("deactivate reports success", async () => {
  assert.deepEqual(
    await deactivateLicense(reply(204, null), { key: "K", activationId: "a" }),
    { ok: true },
  )
})

// Polar answers 403 on /activate both for "limit reached" and for keys whose
// benefit has no activation limit ("does not require activation")
const polar403 = (validateBody, validateStatus = 200) => {
  const calls = []
  const http = async (url, body) => {
    calls.push({ url, body })
    if (/activate$/.test(url))
      return {
        status: 403,
        body: { detail: "License key does not require activation." },
      }
    return { status: validateStatus, body: validateBody }
  }
  return { http, calls }
}

test("activate: a key without activation limit unlocks via validate", async () => {
  const { http, calls } = polar403({
    status: "granted",
    limit_activations: null,
  })
  const r = await activateLicense(http, { key: "k1" })
  assert.deepEqual(r, { ok: true, activationId: null, status: "granted" })
  assert.match(calls[1].url, /\/validate$/)
  assert.equal(calls[1].body.key, "K1")
  assert.equal("activation_id" in calls[1].body, false)
})

test("activate: limit reached stays refused", async () => {
  const { http } = polar403({ status: "granted", limit_activations: 1 })
  const r = await activateLicense(http, { key: "k1" })
  assert.equal(r.ok, false)
  assert.equal(r.error, "limit")
})

test("activate: 403 for a revoked or unknown key", async () => {
  assert.equal(
    (await activateLicense(polar403({ status: "revoked" }).http, { key: "k" }))
      .error,
    "revoked",
  )
  assert.equal(
    (await activateLicense(polar403({}, 404).http, { key: "k" })).error,
    "invalid_key",
  )
})

test("validate without an activation id (no-limit keys)", async () => {
  const calls = []
  const r = await validateLicense(
    async (url, body) => {
      calls.push(body)
      return { status: 200, body: { status: "granted" } }
    },
    { key: "K", activationId: null },
  )
  assert.equal(r.ok, true)
  assert.equal("activation_id" in calls[0], false)
})
