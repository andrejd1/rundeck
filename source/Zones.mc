// Training zones for the zone bar, the HR zone label and the target band.
//
// Zones are a bounds array of six numbers in the metric's unit (bpm, m/s,
// W): the watch's own format from UserProfile.getHeartRateZones(),
// [min zone 1, max zone 1, max zone 2, max zone 3, max zone 4, max zone 5].
// Zone i (1..5) runs from bounds[i - 1] up to and including bounds[i], the
// watch's own rule, so the zone RunDeck names is the one the watch names.
// The bar has five equal segments; the marker sits proportionally inside
// its zone.

import Toybox.Lang;
import Toybox.Math;
import Toybox.UserProfile;

module Zones {

    const COUNT = 5;

    // Z1..Z5: blue, teal, green, amber, red
    const COLORS as Array<Number> = [0x3b82f6, 0x14b8a6, 0x22c55e, 0xf59e0b, 0xef4444];
    const NO_ZONE_COLOR = 0x8a97a8;

    // %max HR: 50/60/70/80/90/100
    const MAX_HR_FRACTIONS as Array<Float> = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    // %LTHR, Friel running zones
    const LTHR_FRACTIONS as Array<Float> = [0.7, 0.85, 0.9, 0.95, 1.0, 1.06];
    // % of threshold speed
    const PACE_FRACTIONS as Array<Float> = [0.7, 0.78, 0.88, 0.95, 1.02, 1.15];
    // % FTP, Stryd-style running power zones
    const POWER_FRACTIONS as Array<Float> = [0.65, 0.8, 0.9, 1.0, 1.15, 1.3];

    function isValid(b as Array<Numeric>?) as Boolean {
        if (b == null || b.size() != COUNT + 1) {
            return false;
        }
        for (var i = 0; i < b.size(); i++) {
            if (b[i] <= 0) {
                return false;
            }
            if (i > 0 && b[i] <= b[i - 1]) {
                return false;
            }
        }
        return true;
    }

    function scale(base as Numeric?, fractions as Array<Float>) as Array<Numeric>? {
        if (base == null || base <= 0) {
            return null;
        }
        var out = new Array<Numeric>[fractions.size()];
        for (var i = 0; i < fractions.size(); i++) {
            out[i] = base * fractions[i];
        }
        return out;
    }

    function rounded(b as Array<Numeric>?) as Array<Numeric>? {
        if (b == null) {
            return null;
        }
        for (var i = 0; i < b.size(); i++) {
            b[i] = Math.round(b[i]).toNumber();
        }
        return b;
    }

    // The watch's zones for the current sport (running zones when the user
    // set sport-specific zones).
    function watchHrZones() as Array<Numeric>? {
        try {
            var sport = UserProfile.HR_ZONE_SPORT_GENERIC;
            if (UserProfile has :getCurrentSport) {
                sport = UserProfile.getCurrentSport();
            }
            var z = UserProfile.getHeartRateZones(sport) as Array<Numeric>?;
            if (isValid(z)) {
                return z;
            }
            z = UserProfile.getHeartRateZones(UserProfile.HR_ZONE_SPORT_GENERIC) as Array<Numeric>?;
            if (isValid(z)) {
                return z;
            }
        } catch (e) {
            // no zones on this device: the caller falls back
        }
        return null;
    }

    // "120,140,155,168,180" (Z1..Z5 lower bounds) + optional top; without a
    // top, Z5 gets the width of Z4. Lower bounds become the watch's format:
    // zone i ends one below zone i + 1's lower bound.
    function parseCustom(str as String?) as Array<Numeric>? {
        var nums = Text.numbers(str);
        if (nums.size() == COUNT) {
            var w = nums[4] - nums[3];
            nums.add(nums[4] + (w > 0 ? w : 10));
        }
        if (nums.size() != COUNT + 1 || !isValid(nums)) {
            return null;
        }
        var out = new Array<Numeric>[COUNT + 1];
        out[0] = nums[0];
        for (var i = 1; i < COUNT; i++) {
            out[i] = nums[i] - 1;
        }
        out[COUNT] = nums[COUNT];
        return isValid(out) ? out : null;
    }

    // method: 0 the watch's zones, 1 % max HR, 2 % threshold HR, 3 custom
    function hrZones(method as Number, maxHr as Number, lthr as Number, custom as String) as Array<Numeric> {
        var z = null;
        if (method == 3) {
            z = parseCustom(custom);
        } else if (method == 2 && lthr > 0) {
            z = rounded(scale(lthr, LTHR_FRACTIONS));
        } else if (method == 1 && maxHr > 0) {
            z = rounded(scale(maxHr, MAX_HR_FRACTIONS));
        }
        if (z == null) {
            z = watchHrZones();
        }
        if (z == null) {
            z = rounded(scale(maxHr > 0 ? maxHr : 190, MAX_HR_FRACTIONS));
        }
        return z as Array<Numeric>;
    }

    function paceZones(thresholdMps as Float?) as Array<Numeric>? {
        return scale(thresholdMps, PACE_FRACTIONS);
    }

    function powerZones(ftp as Number) as Array<Numeric>? {
        return rounded(scale(ftp, POWER_FRACTIONS));
    }

    // Zone 1..5 of a value (the watch's rule), 0 below zone 1, -1 without
    // a value or zones.
    function zoneOf(value as Numeric?, b as Array<Numeric>?) as Number {
        if (value == null || value <= 0 || b == null) {
            return -1;
        }
        if (value < b[0]) {
            return 0;
        }
        for (var i = 1; i <= COUNT; i++) {
            if (value <= b[i]) {
                return i;
            }
        }
        return COUNT;
    }

    // Heart rate zone to name, or 0: no reading, or below zone 1 (warming
    // up, standing), where there is no zone to name.
    function hrZone(hr as Numeric?, b as Array<Numeric>?) as Number {
        var z = zoneOf(hr, b);
        return z >= 1 ? z : 0;
    }

    // Where a value sits along the whole bar, 0..1, or -1.
    function position(value as Numeric?, b as Array<Numeric>?) as Float {
        var z = zoneOf(value, b);
        if (z < 0 || b == null || value == null) {
            return -1.0;
        }
        if (z == 0) {
            return 0.0;
        }
        if (value >= b[COUNT]) {
            return 1.0;
        }
        var lo = b[z - 1];
        var inZone = (value - lo).toFloat() / (b[z] - lo);
        if (inZone < 0) {
            inZone = 0.0;
        }
        return ((z - 1 + inZone) / COUNT.toFloat()).toFloat();
    }

    function color(zone as Number) as Number {
        return zone >= 1 && zone <= COUNT ? COLORS[zone - 1] : NO_ZONE_COLOR;
    }
}
