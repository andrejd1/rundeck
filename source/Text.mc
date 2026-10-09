// Text in and out: parsing what the user typed in the settings, and the
// display format of every value. Formatting only converts units (the
// watch's own: km or mi, m or ft, °C or °F, 12 or 24 h); it never
// smooths, rounds up or estimates anything.

import Toybox.Lang;
import Toybox.Math;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;

(:background)
module Text {

    const METERS_PER_MILE = 1609.344;
    const FEET_PER_METER = 3.28084;

    // Every run of digits (with an optional decimal point) in a string.
    function numbers(str as String?) as Array<Numeric> {
        var out = [] as Array<Numeric>;
        if (str == null) {
            return out;
        }
        var chars = str.toCharArray();
        var cur = "";
        for (var i = 0; i <= chars.size(); i++) {
            var c = i < chars.size() ? chars[i] : ' ';
            if ((c >= '0' && c <= '9') || (c == '.' && cur.length() > 0)) {
                cur += c.toString();
            } else if (cur.length() > 0) {
                var n = cur.toFloat();
                if (n != null) {
                    out.add(n == n.toNumber() ? n.toNumber() : n);
                }
                cur = "";
            }
        }
        return out;
    }

    function trim(s as String) as String {
        var chars = s.toCharArray();
        var a = 0;
        var b = chars.size();
        while (a < b && (chars[a] == ' ' || chars[a] == '\t')) {
            a++;
        }
        while (b > a && (chars[b - 1] == ' ' || chars[b - 1] == '\t')) {
            b--;
        }
        return s.substring(a, b) as String;
    }

    // "4:30" / "4'30" / "4.30" per km or mi -> seconds, or null
    function parsePaceSec(str as String?) as Number? {
        if (str == null) {
            return null;
        }
        var s = trim(str);
        var sep = -1;
        var chars = s.toCharArray();
        for (var i = 0; i < chars.size(); i++) {
            var c = chars[i];
            if (c == ':' || c == '\'' || c == '.') {
                if (sep >= 0) {
                    return null;
                }
                sep = i;
            } else if (c < '0' || c > '9') {
                return null;
            }
        }
        if (sep < 1 || sep > 2 || chars.size() - sep - 1 < 1 || chars.size() - sep - 1 > 2) {
            return null;
        }
        var m = (s.substring(0, sep) as String).toNumber();
        var sec = (s.substring(sep + 1, s.length()) as String).toNumber();
        if (m == null || sec == null || sec > 59) {
            return null;
        }
        var total = m * 60 + sec;
        return total > 0 ? total : null;
    }

    // meters per pace unit: the watch's pace setting
    function paceMeters(statute as Boolean) as Float {
        return statute ? METERS_PER_MILE : 1000.0;
    }

    // ------------------------------------------------------------ display

    function int(v as Numeric) as String {
        return Math.round(v).toNumber().toString();
    }

    function two(n as Number) as String {
        return n < 10 ? "0" + n : n.toString();
    }

    // seconds -> m:ss, or h:mm:ss from an hour on
    function duration(sec as Number) as String {
        if (sec < 0) {
            sec = 0;
        }
        var h = sec / 3600;
        var m = (sec % 3600) / 60;
        var s = sec % 60;
        if (h > 0) {
            return h + ":" + two(m) + ":" + two(s);
        }
        return m + ":" + two(s);
    }

    // m/s -> m:ss per km or mi; "--" when standing or slower than 59:59
    function pace(mps as Numeric?, statute as Boolean) as String {
        if (mps == null || mps <= 0) {
            return "--";
        }
        var sec = (paceMeters(statute) / mps).toNumber();
        if (sec >= 3600) {
            return "--";
        }
        return sec / 60 + ":" + two(sec % 60);
    }

    // m/s -> km/h or mph, one decimal
    function speed(mps as Numeric, statute as Boolean) as String {
        var v = mps * 3.6;
        if (statute) {
            v = mps * 3600 / METERS_PER_MILE;
        }
        return v.format("%.1f");
    }

    // meters -> km or mi, cut (not rounded) like the watch's own distance:
    // 2 decimals below 100, 1 below 1000
    function distance(m as Numeric, statute as Boolean) as String {
        var v = m / (statute ? METERS_PER_MILE : 1000.0);
        if (v < 100) {
            return (Math.floor(v * 100) / 100.0).format("%.2f");
        }
        if (v < 1000) {
            return (Math.floor(v * 10) / 10.0).format("%.1f");
        }
        return v.toNumber().toString();
    }

    // meters -> m or ft
    function elevation(m as Numeric, statute as Boolean) as String {
        return int(statute ? m * FEET_PER_METER : m);
    }

    function clock(hour as Number, min as Number, is24 as Boolean) as String {
        if (is24) {
            return two(hour) + ":" + two(min);
        }
        var h = hour % 12;
        return (h == 0 ? 12 : h) + ":" + two(min);
    }

    function timeOfDay(t as Time.Moment, is24 as Boolean) as String {
        var g = Gregorian.info(t, Time.FORMAT_SHORT);
        return clock(g.hour as Number, g.min as Number, is24);
    }

    function celsius(c as Numeric, fahrenheit as Boolean) as String {
        return int(fahrenheit ? c * 1.8 + 32 : c);
    }
}
