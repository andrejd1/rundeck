// Presets: named snapshots of what changes from run to run, the screen
// layout and the target. Zones, FTP, threshold pace and units describe the
// runner, not the run, so they stay out: applying an old preset never rolls
// back an updated FTP.
//
// A preset is the values of those settings, kept on the watch
// (Application.Storage "preset1".."preset4"); its name is a setting
// (preset_name_N, "Preset N" when empty). Saving and applying happen on the
// watch (the data field's settings, Presets) or from the phone through the
// one-shot "Action" setting, which the watch carries out and sets back to
// None.

import Toybox.Application;
import Toybox.Lang;

module Presets {
    const COUNT = 4;

    const TARGET_KEYS as Array<String> = [
        "labels", "bar", "compact", "target_metric",
        "target_pace_low", "target_pace_high",
        "target_power_low", "target_power_high",
        "target_hr_low", "target_hr_high",
    ];

    function keys() as Array<String> {
        var out = [] as Array<String>;
        out.addAll(FieldTable.ROW_KEY);
        out.addAll(FieldTable.SLOT_KEY);
        out.addAll(TARGET_KEYS);
        return out;
    }

    function name(n as Number) as String {
        var s = Text.trim(Config.str("preset_name_" + n));
        return s.length() > 0 ? s : "Preset " + n;
    }

    function exists(n as Number) as Boolean {
        return Storage.getValue("preset" + n) instanceof Dictionary;
    }

    function save(n as Number) as Void {
        var p = {} as Dictionary<String, PropertyValueType>;
        var ks = keys();
        for (var i = 0; i < ks.size(); i++) {
            try {
                p[ks[i]] = Properties.getValue(ks[i]);
            } catch (e) {
                // a key this build doesn't have
            }
        }
        Storage.setValue("preset" + n, p as Dictionary<PropertyKeyType, PropertyValueType>);
    }

    function apply(n as Number) as Boolean {
        var p = Storage.getValue("preset" + n);
        if (!(p instanceof Dictionary)) {
            return false;
        }
        var ks = keys();
        for (var i = 0; i < ks.size(); i++) {
            var v = p[ks[i]];
            if (v != null) {
                Config.set(ks[i], v as PropertyValueType);
            }
        }
        return true;
    }

    // The phone's one-shot action: 1..4 apply, 11..14 save.
    function runAction() as Void {
        var a = Config.num("preset_action", 0);
        if (a == 0) {
            return;
        }
        if (a >= 1 && a <= COUNT) {
            apply(a);
        } else if (a >= 11 && a <= 10 + COUNT) {
            save(a - 10);
        }
        Config.set("preset_action", 0);
    }
}
