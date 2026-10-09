// Polar.sh license keys (merchant of record: Polar sells RunDeck, handles EU
// VAT and e-mails the key). The activate / validate / deactivate endpoints
// are public: they need the organization id, never an access token, so the
// watch calls them itself (through the phone's connection) from a
// background service, and no RunDeck server exists.
//
// The key is typed into the Garmin Connect settings. The data field asks
// for a background run whenever the key changed, or a granted key is due
// for its weekly check; the background service talks to Polar and hands the
// answer back (onBackgroundData). Offline, a granted key simply stays.
//
// Storage "lic": {"key", "act" (activation id), "ok", "at" (epoch s of the
// last answer), "err" (why a key doesn't unlock), "net" (the last try got
// no answer)}

import Toybox.Application;
import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.System;
import Toybox.Time;

typedef LicState as Dictionary<String, PropertyValueType>;

(:background)
module License {
    const ORG_ID = "129d1276-7133-4b9f-959a-1a464c8edf67";
    const API = "https://api.polar.sh/v1/customer-portal/license-keys/";
    const BUY_URL = "https://buy.polar.sh/polar_cl_H7Jc9kI2f1kridvcgvMAEXvoRCfqc4eWYb4IR1pEELc";

    // re-check a granted key at most weekly
    const REVALIDATE_SEC = 7 * 24 * 3600;
    // retry a key that got no answer (no connection) after this
    const RETRY_SEC = 15 * 60;

    function stored() as LicState {
        var v = Storage.getValue("lic");
        return v instanceof Dictionary ? v as LicState : {} as LicState;
    }

    function str(d as LicState, k as String) as String {
        var v = d[k];
        return v instanceof String ? v : "";
    }

    function flag(d as LicState, k as String) as Boolean {
        var v = d[k];
        return v instanceof Boolean && v;
    }

    function normalizeKey(k as String?) as String {
        if (k == null) {
            return "";
        }
        return Text.trim(k).toUpper();
    }

    function currentKey() as String {
        var k = null;
        try {
            k = Properties.getValue("license_key");
        } catch (e) {
            k = null;
        }
        return normalizeKey(k instanceof String ? k : null);
    }

    function isLicensed() as Boolean {
        var lic = stored();
        var key = currentKey();
        return key.length() > 0 && License.flag(lic, "ok") && key.equals(str(lic, "key"));
    }

    // What the background service should do now: "activate", "validate",
    // "deactivate" (then activate the new key, if any) or null.
    function pendingJob() as String? {
        var lic = stored();
        var key = currentKey();
        var hasAct = str(lic, "act").length() > 0;
        var now = Time.now().value();
        var atV = lic["at"];
        var at = atV instanceof Number ? atV : 0;
        if (hasAct && !key.equals(str(lic, "key"))) {
            return "deactivate";
        }
        if (key.length() == 0) {
            return null;
        }
        if (!key.equals(str(lic, "key"))) {
            return "activate";
        }
        if (License.flag(lic, "net") && now - at >= RETRY_SEC) {
            return hasAct ? "validate" : "activate";
        }
        if (License.flag(lic, "ok") && hasAct && now - at >= REVALIDATE_SEC) {
            return "validate";
        }
        return null;
    }
}

// The background half: one Polar call (two when a replaced key is released
// first), then the answer goes to the data field.
(:background)
class LicenseService extends System.ServiceDelegate {
    var key as String = "";
    var result as LicState = {} as LicState;

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        var job = License.pendingJob();
        key = License.currentKey();
        var lic = License.stored();
        if (job == null) {
            Background.exit(null);
        } else if (job.equals("deactivate")) {
            post("deactivate", {
                "key" => License.str(lic, "key"),
                "organization_id" => License.ORG_ID,
                "activation_id" => License.str(lic, "act"),
            }, method(:onDeactivated));
        } else if (job.equals("validate")) {
            post("validate", {
                "key" => key,
                "organization_id" => License.ORG_ID,
                "activation_id" => License.str(lic, "act"),
            }, method(:onValidated));
        } else {
            activate();
        }
    }

    function activate() as Void {
        var label = "RunDeck Garmin";
        var id = System.getDeviceSettings().uniqueIdentifier;
        if (id != null && id.length() >= 8) {
            label = label + " " + id.substring(0, 8);
        }
        post("activate", {
            "key" => key,
            "organization_id" => License.ORG_ID,
            "label" => label,
        }, method(:onActivated));
    }

    function post(op as String, body as Dictionary<String, String>,
            cb as Method(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void) as Void {
        Communications.makeWebRequest(License.API + op, body as Dictionary<Object, Object>, {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => {"Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON},
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
        }, cb);
    }

    // The old key is released (or Polar no longer knows it): go on with the
    // new key, if there is one.
    function onDeactivated(code as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        result["released"] = true;
        if (key.length() > 0) {
            activate();
        } else {
            finish();
        }
    }

    function onActivated(code as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        result["op"] = "activate";
        result["code"] = code;
        if ((code == 200 || code == 201) && data instanceof Dictionary) {
            var lk = data["license_key"];
            var status = lk instanceof Dictionary ? lk["status"] : null;
            var id = data["id"];
            if (status instanceof String && !status.equals("granted")) {
                result["err"] = "key is " + status;
            } else if (id instanceof String) {
                result["act"] = id;
                result["ok"] = true;
            } else {
                result["err"] = "unexpected reply from Polar";
            }
        }
        finish();
    }

    function onValidated(code as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        result["op"] = "validate";
        result["code"] = code;
        if (code == 200) {
            var status = data instanceof Dictionary ? data["status"] : null;
            if (status instanceof String && !status.equals("granted")) {
                result["err"] = "key is " + status;
            } else {
                result["ok"] = true;
            }
        }
        finish();
    }

    function finish() as Void {
        result["key"] = key;
        Background.exit(result as PropertyValueType);
    }
}

// Main-process half: keep the answer, word the status.
module LicenseState {
    function message(code as Number) as String {
        if (code == 404) {
            return "unknown key, check for typos";
        }
        if (code == 403) {
            return "already active on another watch. Clear the key in RunDeck's settings for that watch first";
        }
        if (code == 422) {
            return "invalid key";
        }
        return "Polar HTTP " + code;
    }

    // No answer from Polar (no phone connection, timeout) or a server error:
    // the previous state stays.
    function isNetwork(code as Number) as Boolean {
        return code <= 0 || code >= 500;
    }

    function apply(data as LicState) as Void {
        var lic = License.stored();
        var now = Time.now().value();
        if (License.flag(data, "released")) {
            lic = {"key" => ""} as LicState;
        }
        var op = data["op"];
        var code = data["code"];
        var key = data["key"];
        if (op != null && code instanceof Number && key instanceof String) {
            if (License.flag(data, "ok")) {
                var act = data["act"];
                if (!(act instanceof String)) {
                    act = License.str(lic, "act");
                }
                lic = {"key" => key, "act" => act, "ok" => true, "at" => now} as LicState;
            } else if (isNetwork(code)) {
                lic["net"] = true;
                lic["at"] = now;
            } else {
                var err = data["err"];
                lic = {
                    "key" => key,
                    "ok" => false,
                    "err" => err instanceof String ? err : message(code),
                    "at" => now,
                } as LicState;
            }
        }
        Storage.setValue("lic", lic as Dictionary<PropertyKeyType, PropertyValueType>);
    }

    function statusText(used as Number) as String {
        if (License.isLicensed()) {
            return "Unlocked. Thank you!";
        }
        var key = License.currentKey();
        var lic = License.stored();
        if (key.length() > 0) {
            var err = License.str(lic, "err");
            if (key.equals(License.str(lic, "key")) && err.length() > 0) {
                return "Key not activated: " + err;
            }
            return "Key saved: it activates the next time RunDeck runs with the phone connected";
        }
        var left = TrialSession.RUNS - used;
        if (left <= 0) {
            return "Trial over (" + TrialSession.RUNS + " runs). Buy a key: " + License.BUY_URL;
        }
        return "Trial: " + left + " of " + TrialSession.RUNS + " free runs left. Buy a key: " + License.BUY_URL;
    }
}
