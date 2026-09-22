// Polar.sh license keys (merchant of record: Polar sells RunDeck, handles EU
// VAT and emails the key). The activate/validate endpoints are public — they
// need the organization id, never an access token — so the phone side service
// can call them directly and no RunDeck server exists.
//
// Platform-free: the HTTP call is injected (`http(url, jsonBody)` resolving to
// {status, body}), so this runs under Node tests and in the side service.

export const POLAR_ORG_ID = "00000000-0000-0000-0000-000000000000" // TODO: your Polar organization id
export const POLAR_API = "https://api.polar.sh/v1/customer-portal/license-keys"
export const POLAR_SANDBOX_API =
  "https://sandbox-api.polar.sh/v1/customer-portal/license-keys"
export const BUY_URL = "https://buy.polar.sh/REPLACE_WITH_CHECKOUT_LINK" // TODO: checkout link

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
  if (status === 404) return { error: "invalid_key", message: "Unknown key" }
  if (status === 403)
    return {
      error: "limit",
      message: "This key is already active on the maximum number of watches",
    }
  if (status === 422) return { error: "invalid_key", message: "Invalid key" }
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
    return { ok: false, error: "network", message: "No connection" }
  }
  const body = parseBody(resp && resp.body)
  const status = resp && (resp.status || resp.statusCode)
  if (status !== 200 && status !== 201)
    return { ok: false, ...errorFor(status, body) }
  const lk = body && body.license_key
  const keyStatus = lk && lk.status
  if (keyStatus && keyStatus !== "granted")
    return { ok: false, error: "revoked", message: `Key is ${keyStatus}` }
  if (!body || !body.id)
    return { ok: false, error: "server", message: "Unexpected Polar reply" }
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
    return { ok: false, error: "network", message: "No connection" }
  }
  const body = parseBody(resp && resp.body)
  const status = resp && (resp.status || resp.statusCode)
  if (status !== 200) return { ok: false, ...errorFor(status, body) }
  if (body && body.status && body.status !== "granted")
    return { ok: false, error: "revoked", message: `Key is ${body.status}` }
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
