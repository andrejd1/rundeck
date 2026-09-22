// Phone side service: builds the screen config from the settings page,
// activates / re-validates the Polar license key, and mirrors the trial
// counter. The watch pulls with GET_CONFIG when the RunDeck screen opens;
// settings and license changes are pushed with CONFIG_PUSH.

import { BaseSideService } from "@zeppos/zml/base-side"
import { buildConfig } from "../shared/config.js"
import {
  activateLicense,
  deactivateLicense,
  normalizeKey,
  REVALIDATE_AFTER_MS,
  stillLicensed,
  validateLicense,
} from "../shared/license.js"
import { MSG } from "../shared/messages.js"
import { TRIAL_RUNS } from "../shared/trial.js"

// Settings that change what the watch renders: a change is pushed right away.
const CONFIG_KEYS = [
  "pace_unit",
  "primary_metric",
  "bar_metric",
  "hr_zone_method",
  "max_hr",
  "lthr",
  "hr_zones_custom",
  "threshold_pace",
  "ftp",
  "target_range",
  "auto_lap",
]

function getItem(key) {
  try {
    const v = settings.settingsStorage.getItem(key)
    return v == null ? "" : v
  } catch (e) {
    return ""
  }
}

function setItem(key, value) {
  try {
    settings.settingsStorage.setItem(key, value)
  } catch (e) {
    /* settings storage unavailable */
  }
}

// {key, activation_id, licensed, checked_at}
function readLicense() {
  try {
    const raw = getItem("license_state")
    const obj = raw ? JSON.parse(raw) : null
    return obj && typeof obj === "object" ? obj : null
  } catch (e) {
    return null
  }
}

function writeLicense(state) {
  setItem("license_state", state ? JSON.stringify(state) : "")
}

function trialUsed() {
  const n = parseInt(getItem("trial_used"), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Status line the settings page shows under the key field.
function refreshStatusText(message) {
  const lic = readLicense()
  let text
  if (lic && lic.licensed) text = "Unlocked - thank you for supporting RunDeck!"
  else {
    const left = Math.max(0, TRIAL_RUNS - trialUsed())
    text = left
      ? `Trial: ${left} of ${TRIAL_RUNS} runs left`
      : "Trial over - enter your key to unlock the full screen"
  }
  setItem("license_status_text", message ? `${message}. ${text}` : text)
}

AppSideService(
  BaseSideService({
    onInit() {},

    onRun() {
      refreshStatusText()
    },

    onDestroy() {},

    // JSON POST through the side-service fetch (response body may arrive as
    // a string or an object depending on the Zepp app version).
    http(url, json) {
      return this.fetch({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      })
    },

    onRequest(req, res) {
      if (req.method === MSG.GET_CONFIG) {
        this.handleGetConfig(req.params || {}, res)
        return
      }
      res(null, { code: 1, error: `unknown method ${req.method}` })
    },

    onCall(data) {
      if (!data || typeof data !== "object") return
      if (data.method === MSG.TRIAL_REPORT)
        this.mergeTrial(data.params && data.params.trial_used)
    },

    async onSettingsChange({ key, newValue }) {
      if (key === "license_key") {
        await this.onLicenseKeyChange(newValue)
        return
      }
      if (CONFIG_KEYS.indexOf(key) >= 0) this.push()
    },

    handleGetConfig(params, res) {
      if (params.device_uuid) setItem("device_uuid", String(params.device_uuid))
      this.mergeTrial(params.trial_used)
      const lic = readLicense()
      res(null, {
        code: 0,
        config: buildConfig(getItem),
        licensed: !!(lic && lic.licensed),
        trial_used: trialUsed(),
      })
      // re-check a granted key in the background, weekly at most
      if (
        lic &&
        lic.licensed &&
        Date.now() - (lic.checked_at || 0) > REVALIDATE_AFTER_MS
      )
        this.revalidate(lic)
    },

    mergeTrial(used) {
      const n = Number(used)
      if (Number.isFinite(n) && n > trialUsed()) {
        setItem("trial_used", String(Math.floor(n)))
        refreshStatusText()
      }
    },

    push() {
      const lic = readLicense()
      try {
        this.call({
          method: MSG.CONFIG_PUSH,
          params: {
            config: buildConfig(getItem),
            licensed: !!(lic && lic.licensed),
          },
        })
      } catch (e) {
        /* watch out of range: it pulls on the next run */
      }
    },

    async onLicenseKeyChange(value) {
      const key = normalizeKey(value)
      const prev = readLicense()
      if (prev && prev.key === key && prev.licensed) return
      if (prev && prev.activation_id && prev.key !== key) {
        // key removed or replaced: free the old activation slot
        await deactivateLicense(this.http.bind(this), {
          key: prev.key,
          activationId: prev.activation_id,
        })
        writeLicense(null)
      }
      if (!key) {
        refreshStatusText()
        this.push()
        return
      }
      setItem("license_status_text", "Checking key...")
      const deviceUuid = getItem("device_uuid")
      const result = await activateLicense(this.http.bind(this), {
        key,
        label: deviceUuid ? `watch-${deviceUuid.slice(0, 16)}` : "RunDeck",
      })
      if (result.ok) {
        writeLicense({
          key,
          activation_id: result.activationId,
          licensed: true,
          checked_at: Date.now(),
        })
        refreshStatusText()
      } else {
        writeLicense(null)
        refreshStatusText(result.message)
      }
      this.push()
    },

    async revalidate(lic) {
      const result = await validateLicense(this.http.bind(this), {
        key: lic.key,
        activationId: lic.activation_id,
      })
      const licensed = stillLicensed(result)
      writeLicense({
        ...lic,
        licensed,
        // a failed network check is retried on the next run, not in a week
        checked_at: result.ok || !licensed ? Date.now() : lic.checked_at,
      })
      if (!licensed) {
        refreshStatusText(result.message)
        this.push()
      }
    },
  }),
)
