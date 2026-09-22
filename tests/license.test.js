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
    (await activateLicense(reply(403, {}), { key: "K" })).error,
    "limit",
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
