// The app: the data field, its on-watch settings, and the background
// service that talks to Polar for the license.

import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

(:background)
class RunDeckApp extends Application.AppBase {
    var field as RunDeckField? = null;

    function initialize() {
        AppBase.initialize();
    }

    (:typecheck(false))
    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        Presets.runAction();
        var f = new RunDeckField(License.isLicensed());
        field = f;
        updateStatus();
        scheduleLicenseJob();
        return [f];
    }

    // The data field's settings on the watch (activity settings, data
    // screens, RunDeck).
    (:typecheck(false))
    function getSettingsView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] or Null {
        var menu = new EditorMenu();
        return [menu, new EditorDelegate(menu)];
    }

    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new LicenseService()];
    }

    // Settings saved in Garmin Connect (phone).
    (:typecheck(false))
    function onSettingsChanged() as Void {
        Presets.runAction();
        reload();
        var f = field;
        if (f != null) {
            f.setLicensed(License.isLicensed());
        }
        updateStatus();
        scheduleLicenseJob();
    }

    // Settings changed on the watch or the phone: redraw with them.
    (:typecheck(false))
    function reload() as Void {
        var f = field;
        if (f != null) {
            f.reload();
        }
    }

    // ------------------------------------------------------------- license

    function scheduleLicenseJob() as Void {
        if (License.pendingJob() == null) {
            return;
        }
        try {
            var at = Time.now();
            var last = Background.getLastTemporalEventTime();
            if (last != null) {
                var earliest = last.add(new Time.Duration(5 * 60 + 1));
                if (earliest.greaterThan(at)) {
                    at = earliest;
                }
            }
            Background.registerForTemporalEvent(at);
        } catch (e) {
            // too soon after the last run: the next start schedules it
        }
    }

    // The background service's answer from Polar.
    (:typecheck(false))
    function onBackgroundData(data as Application.PersistableType) as Void {
        if (data instanceof Dictionary) {
            LicenseState.apply(data as LicState);
        }
        var f = field;
        if (f != null) {
            f.setLicensed(License.isLicensed());
            WatchUi.requestUpdate();
        }
        updateStatus();
        scheduleLicenseJob();
    }

    // The status line in the Garmin Connect settings.
    (:typecheck(false))
    function updateStatus() as Void {
        var used = 0;
        var t = Storage.getValue("trial");
        if (t instanceof Array && t.size() > 0 && t[0] instanceof Number) {
            used = t[0] as Number;
        }
        var s = LicenseState.statusText(used);
        if (!s.equals(Config.str("license_status"))) {
            Config.set("license_status", s);
        }
    }
}

function getApp() as RunDeckApp {
    return Application.getApp() as RunDeckApp;
}
