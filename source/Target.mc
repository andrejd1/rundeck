// Optional pace, power or heart rate target. Every slot showing that live
// value is colored: green inside the range, blue below, red above. The
// target is {metric, min, max} in the watch's units (m/s, W, bpm), entered
// as From / To in the settings; one end alone is a single value widened by
// the metric's tolerance (pace ±5 s, power ±3%, heart rate ±5 bpm).
//
// Data fields can't read the watch's planned workout (Activity.
// getCurrentWorkoutStep throws in a data field), so the target comes from
// the settings.

import Toybox.Lang;
import Toybox.Math;

module Target {

    const PACE = 1;
    const POWER = 2;
    const HR = 3;

    // status
    const NONE = 0;
    const BELOW = 1;
    const INSIDE = 2;
    const ABOVE = 3;

    // the field a metric's live value is shown in
    function fieldOf(metric as Number) as Number {
        if (metric == PACE) {
            return FieldTable.F_PACE;
        }
        if (metric == POWER) {
            return FieldTable.F_POWER;
        }
        return FieldTable.F_HR;
    }

    // [metric, min, max] or null
    function parse(metric as Number, low as String, high as String, statute as Boolean) as Array<Numeric>? {
        low = Text.trim(low);
        high = Text.trim(high);
        if (low.length() == 0 && high.length() == 0) {
            return null;
        }
        if (metric == PACE) {
            var meters = Text.paceMeters(statute);
            var a = Text.parsePaceSec(low);
            var b = Text.parsePaceSec(high);
            if ((low.length() > 0 && a == null) || (high.length() > 0 && b == null)) {
                return null;
            }
            if (a == null || b == null) {
                var sec = (a != null ? a : b) as Number;
                if (sec <= 5) {
                    return null;
                }
                a = sec + 5;
                b = sec - 5;
            }
            var s1 = meters / a;
            var s2 = meters / b;
            return [metric, s1 < s2 ? s1 : s2, s1 < s2 ? s2 : s1];
        }
        var x = Text.numbers(low);
        var y = Text.numbers(high);
        if (x.size() > 1 || y.size() > 1) {
            return null;
        }
        if (x.size() == 0 || y.size() == 0) {
            var v = (x.size() > 0 ? x[0] : y[0]).toFloat();
            if (v <= 0) {
                return null;
            }
            if (metric == HR) {
                return [metric, v - 5, v + 5];
            }
            return [metric, Math.round(v * 0.97), Math.round(v * 1.03)];
        }
        var lo = x[0];
        var hi = y[0];
        if (lo <= 0 || hi <= 0) {
            return null;
        }
        return [metric, lo < hi ? lo : hi, lo < hi ? hi : lo];
    }
}

// A few seconds of smoothing so GPS pace jitter doesn't flicker the color.
// It only decides the color; the number shown is always the watch's.
class TargetTracker {
    const WINDOW = 3;

    var target as Array<Numeric>?;
    var samples as Array<Numeric> = [];

    function initialize(t as Array<Numeric>?) {
        target = t;
    }

    function setTarget(t as Array<Numeric>?) as Void {
        target = t;
        samples = [];
    }

    // one sample a second (null on signal loss) -> Target status
    function update(value as Numeric?) as Number {
        var t = target;
        if (t == null) {
            return Target.NONE;
        }
        if (value == null || value <= 0) {
            samples = [];
            return Target.NONE;
        }
        samples.add(value);
        if (samples.size() > WINDOW) {
            samples = samples.slice(1, null);
        }
        var sum = 0.0;
        for (var i = 0; i < samples.size(); i++) {
            sum += samples[i];
        }
        var avg = sum / samples.size();
        if (avg < t[1]) {
            return Target.BELOW;
        }
        if (avg > t[2]) {
            return Target.ABOVE;
        }
        return Target.INSIDE;
    }
}
