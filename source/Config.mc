// The user's settings, read from the app properties. Garmin Connect (phone)
// and the on-watch editor both write the same properties on the watch, so
// there is one copy and nothing to merge.

import Toybox.Application;
import Toybox.Lang;
import Toybox.System;

class Config {
    var cols as Array<Number>;
    var slots as Array<Number>;
    var labels as Number = 0; // 0 text, 1 short text, 2 icons
    var bar as Number = 0; // 0 auto, 1 hr, 2 pace, 3 power, 4 off
    var compact as Number = FieldTable.F_PACE;
    var target as Array<Numeric>?; // [metric, min, max]
    var hrZones as Array<Numeric>;
    var paceZones as Array<Numeric>?;
    var powerZones as Array<Numeric>?;
    // the watch's units
    var statutePace as Boolean = false;
    var statuteDist as Boolean = false;
    var statuteElev as Boolean = false;
    var fahrenheit as Boolean = false;
    var is24 as Boolean = true;

    function initialize() {
        var ds = System.getDeviceSettings();
        statutePace = ds.paceUnits == System.UNIT_STATUTE;
        statuteDist = ds.distanceUnits == System.UNIT_STATUTE;
        statuteElev = ds.elevationUnits == System.UNIT_STATUTE;
        fahrenheit = ds.temperatureUnits == System.UNIT_STATUTE;
        is24 = ds.is24Hour;

        cols = new Array<Number>[FieldTable.ROW_KEY.size()];
        for (var r = 0; r < cols.size(); r++) {
            var n = Config.num(FieldTable.ROW_KEY[r], FieldTable.ROW_DEFAULT[r]);
            cols[r] = FieldTable.ROW_COLS[r].indexOf(n) >= 0 ? n : FieldTable.ROW_DEFAULT[r];
        }
        slots = new Array<Number>[FieldTable.SLOT_KEY.size()];
        for (var s = 0; s < slots.size(); s++) {
            var f = Config.num(FieldTable.SLOT_KEY[s], FieldTable.DEFAULT_SLOT[s]);
            slots[s] = f >= 0 && f < FieldTable.COUNT ? f : FieldTable.DEFAULT_SLOT[s];
        }
        labels = Config.num("labels", 0);
        if (labels < 0 || labels > 2) {
            labels = 0;
        }
        bar = Config.num("bar", 0);
        compact = Config.num("compact", FieldTable.F_PACE);
        if (compact < 0 || compact >= FieldTable.COUNT) {
            compact = FieldTable.F_PACE;
        }

        var metric = Config.num("target_metric", Target.PACE);
        var key = metric == Target.POWER ? "power" : metric == Target.HR ? "hr" : "pace";
        target = Target.parse(
            metric,
            Config.str("target_" + key + "_low"),
            Config.str("target_" + key + "_high"),
            statutePace
        );

        hrZones = Zones.hrZones(
            Config.num("hr_zone_method", 0),
            Config.num("max_hr", 0),
            Config.num("lthr", 0),
            Config.str("hr_zones_custom")
        );
        var tp = Text.parsePaceSec(Config.str("threshold_pace"));
        paceZones = tp == null ? null : Zones.paceZones(Text.paceMeters(statutePace) / tp);
        powerZones = Zones.powerZones(Config.num("ftp", 0));
    }

    // ------------------------------------------------------- property access

    static function num(key as String, def as Number) as Number {
        try {
            var v = Properties.getValue(key);
            if (v instanceof Number) {
                return v;
            }
            if (v instanceof Float || v instanceof Double || v instanceof Long) {
                return v.toNumber();
            }
            if (v instanceof String) {
                var n = v.toNumber();
                return n != null ? n : def;
            }
        } catch (e) {
            // missing key (older settings): the default
        }
        return def;
    }

    static function str(key as String) as String {
        try {
            var v = Properties.getValue(key);
            if (v != null) {
                return v.toString();
            }
        } catch (e) {
            // missing key
        }
        return "";
    }

    static function set(key as String, value as PropertyValueType) as Void {
        try {
            Properties.setValue(key, value);
        } catch (e) {
            // a property the build doesn't know: nothing to keep
        }
    }

    // ------------------------------------------------------------ zone bar

    function zonesFor(metric as Number) as Array<Numeric>? {
        if (metric == Target.PACE) {
            return paceZones;
        }
        if (metric == Target.POWER) {
            return powerZones;
        }
        return hrZones;
    }

    // Which zones the bar shows: [metric] or null when off.
    //   auto: the target's metric when its zones are known (pace: threshold
    //         pace, power: FTP), else heart rate
    //   hr / pace / power: that metric, heart rate when its zones are missing
    function barMetric() as Number {
        if (bar == 4) {
            return 0;
        }
        var metric = Target.HR;
        if (bar == 0) {
            var t = target;
            if (t != null && zonesFor(t[0] as Number) != null) {
                metric = t[0] as Number;
            }
        } else if (bar == 2) {
            metric = Target.PACE;
        } else if (bar == 3) {
            metric = Target.POWER;
        }
        if (zonesFor(metric) == null) {
            metric = Target.HR;
        }
        return metric;
    }
}
