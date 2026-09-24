// Polar.sh license keys (merchant of record: Polar sells RunDeck, handles EU
// VAT and emails the key). The activate/validate endpoints are public — they
// need the organization id, never an access token — so the phone side service
// can call them directly and no RunDeck server exists.
//
// Platform-free: the HTTP call is injected (`http(url, jsonBody)` resolving to
// {status, body}), so this runs under Node tests and in the side service.

export const POLAR_ORG_ID = "129d1276-7133-4b9f-959a-1a464c8edf67"
export const POLAR_API = "https://api.polar.sh/v1/customer-portal/license-keys"
export const POLAR_SANDBOX_API =
  "https://sandbox-api.polar.sh/v1/customer-portal/license-keys"
export const BUY_URL =
  "https://buy.polar.sh/polar_cl_H7Jc9kI2f1kridvcgvMAEXvoRCfqc4eWYb4IR1pEELc"

export const PRIVACY_URL = "https://andrejd1.github.io/rundeck/privacy.html"

// Re-check a granted license at most weekly; offline it simply stays granted.
export const REVALIDATE_AFTER_MS = 7 * 24 * 3600 * 1000

export function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toUpperCase()
}

function parseBody(body) {
  if (body && typeof body === "object" && body.data !== undefined)
    body = body.data
  if (typeof body === "string") {
    try {
      return JSON.parse(body)
    } catch (e) {
      return null
    }
  }
  return body && typeof body === "object" ? body : null
}

function errorFor(status, body) {
  if (status === 404)
    return { error: "invalid_key", message: "unknown key, check for typos" }
  if (status === 403)
    return {
      error: "limit",
      message:
        "it is already active on another watch. Clear the key in RunDeck's settings for that watch first",
    }
  if (status === 422) return { error: "invalid_key", message: "invalid key" }
  const detail = body && (body.detail || body.error)
  return {
    error: "server",
    message: `Polar HTTP ${status}${typeof detail === "string" ? `: ${detail}` : ""}`,
  }
}

/**
 * Activate a key for one device. Returns
 * {ok:true, activationId, status} or {ok:false, error, message}
 * (error: invalid_key | limit | revoked | server | network).
 */
export async function activateLicense(
  http,
  { key, label, orgId = POLAR_ORG_ID, api = POLAR_API },
) {
  const k = normalizeKey(key)
  if (!k) return { ok: false, error: "invalid_key", message: "Enter a key" }
  let resp
  try {
    resp = await http(`${api}/activate`, {
      key: k,
      organization_id: orgId,
      label: String(label || "RunDeck").slice(0, 60),
    })
  } catch (e) {
    return { ok: false, error: "network", message: "no connection, try again" }
  }
  const body = parseBody(resp && resp.body)
  const status = resp && (resp.status || resp.statusCode)
  if (status !== 200 && status !== 201)
    return { ok: false, ...errorFor(status, body) }
  const lk = body && body.license_key
  const keyStatus = lk && lk.status
  if (keyStatus && keyStatus !== "granted")
    return { ok: false, error: "revoked", message: `key is ${keyStatus}` }
  if (!body || !body.id)
    return {
      ok: false,
      error: "server",
      message: "unexpected reply from Polar",
    }
  return { ok: true, activationId: body.id, status: keyStatus || "granted" }
}

/**
 * Validate an activated key. Returns {ok:true} while granted,
 * {ok:false, error} otherwise; error "network"/"server" means "unknown",
 * callers keep the previous state for those.
 */
export async function validateLicense(
  http,
  { key, activationId, orgId = POLAR_ORG_ID, api = POLAR_API },
) {
  let resp
  try {
    resp = await http(`${api}/validate`, {
      key: normalizeKey(key),
      organization_id: orgId,
      activation_id: activationId,
    })
  } catch (e) {
    return { ok: false, error: "network", message: "no connection, try again" }
  }
  const body = parseBody(resp && resp.body)
  const status = resp && (resp.status || resp.statusCode)
  if (status !== 200) return { ok: false, ...errorFor(status, body) }
  if (body && body.status && body.status !== "granted")
    return { ok: false, error: "revoked", message: `key is ${body.status}` }
  return { ok: true }
}

/** Release an activation (key removed in settings) so it can move watches. */
export async function deactivateLicense(
  http,
  { key, activationId, orgId = POLAR_ORG_ID, api = POLAR_API },
) {
  try {
    const resp = await http(`${api}/deactivate`, {
      key: normalizeKey(key),
      organization_id: orgId,
      activation_id: activationId,
    })
    const status = resp && (resp.status || resp.statusCode)
    return { ok: status === 200 || status === 204 }
  } catch (e) {
    return { ok: false }
  }
}

/** Should a stored license be treated as unlocked after this check result? */
export function stillLicensed(result) {
  if (result.ok) return true
  return result.error === "network" || result.error === "server"
}
