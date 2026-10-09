// RunDeck: a dense one-screen running dashboard as a Connect IQ data field.
// Put it on a one-field data screen of the native Run activity: the watch
// keeps GPS, recording, laps and the activity file; RunDeck lays out the
// numbers.
//
// Every number is the watch's own. Each value is read from the native
// activity (Activity.Info), the user profile or the system and only
// converted to the watch's units; RunDeck smooths, estimates and averages
// nothing. Connect IQ has no lap values, so lap fields are the watch's own
// totals taken at the watch's own lap marks (the lap key, auto lap, a
// workout step): lap distance and lap time are the difference of two
// native totals, lap pace their ratio, the same arithmetic the watch uses
// for the lap record.

import Toybox.Activity;
import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;
import Toybox.UserProfile;
import Toybox.Weather;
import Toybox.WatchUi;

class RunDeckField extends WatchUi.DataField {
    // totals a lap is measured in: timer (ms), distance (m), ascent (m),
    // descent (m), calories (kcal)
    const T_TIME = 0;
    const T_DIST = 1;
    const T_ASC = 2;
    const T_DESC = 3;
    const T_CAL = 4;

    var cfg as Config;
    var fonts as FontCache;
    var trial as TrialSession;
    var tracker as TargetTracker;
    var info as Activity.Info?;
    var mode as Number = TrialSession.PENDING;
    var status as Number = Target.NONE;

    // the watch's laps
    var lapStart as Array<Numeric> = [0, 0, 0, 0, 0];
    var lastLap as Array<Numeric>? = null;
    var lapCount as Number = 0;

    // values read now and then, not every second
    var vo2max as Number? = null;
    var vo2Read as Boolean = false;
    var temperature as Numeric? = null;
    var sun as Array<Time.Moment?>? = null;
    var slowReadAt as Number = -1;

    // screen
    var full as Boolean = true;
    var sc as Float = 1.0; // 480-px design -> this screen
    var ts as Float = 1.0; // text sizes (a little larger on small screens)
    var dark as Boolean = true;
    var fitCache as Dictionary<String, Number> = {} as Dictionary<String, Number>;

    function initialize(licensed as Boolean) {
        DataField.initialize();
        cfg = new Config();
        fonts = new FontCache();
        trial = new TrialSession(licensed);
        tracker = new TargetTracker(cfg.target);
    }

    // Settings changed (phone or the on-watch editor).
    function reload() as Void {
        cfg = new Config();
        tracker.setTarget(cfg.target);
        fonts.reset();
        fitCache = {} as Dictionary<String, Number>;
        vo2Read = false;
        slowReadAt = -1; // a slot may show a slow value now
        WatchUi.requestUpdate();
    }

    function setLicensed(licensed as Boolean) as Void {
        trial.setLicensed(licensed);
    }

    // ------------------------------------------------------------- the watch

    function compute(i as Activity.Info) as Void {
        info = i;
        var start = i.startTime;
        var used = trial.used;
        mode = trial.tick(start != null ? start.value() : null, i.timerTime);
        if (trial.used != used) {
            // a run was counted: the phone's status line says so
            getApp().updateStatus();
        }
        status = tracker.update(targetValue());
        var now = Time.now().value();
        if (now - slowReadAt >= 30) {
            slowReadAt = now;
            readSlow();
        }
    }

    // A lap mark (the lap key, auto lap): the lap record is written, so the
    // totals now are the lap's end.
    function onTimerLap() as Void {
        markLap();
    }

    // A workout step ends a lap too.
    function onWorkoutStepComplete() as Void {
        markLap();
    }

    function markLap() as Void {
        var i = Activity.getActivityInfo();
        if (i == null) {
            return;
        }
        var t = totals(i);
        // one transition reported twice (step end + lap): count it once
        if (lapCount > 0 && t[T_TIME] - lapStart[T_TIME] < 1000) {
            return;
        }
        var last = new Array<Numeric>[t.size()];
        for (var k = 0; k < t.size(); k++) {
            last[k] = t[k] - lapStart[k];
        }
        lastLap = last;
        lapStart = t;
        lapCount += 1;
    }

    // The activity ended (saved or discarded).
    function onTimerReset() as Void {
        lapStart = [0, 0, 0, 0, 0];
        lastLap = null;
        lapCount = 0;
        trial.reset();
    }

    function totals(i as Activity.Info) as Array<Numeric> {
        return [
            i.timerTime != null ? i.timerTime : 0,
            i.elapsedDistance != null ? i.elapsedDistance : 0,
            i.totalAscent != null ? i.totalAscent : 0,
            i.totalDescent != null ? i.totalDescent : 0,
            i.calories != null ? i.calories : 0,
        ] as Array<Numeric>;
    }

    // current lap total k, or null without the native total
    function lapValue(k as Number) as Numeric? {
        var i = info;
        if (i == null) {
            return null;
        }
        var t = totals(i);
        var raw = [i.timerTime, i.elapsedDistance, i.totalAscent, i.totalDescent, i.calories];
        if (raw[k] == null) {
            return null;
        }
        return t[k] - lapStart[k];
    }

    function lastLapValue(k as Number) as Numeric? {
        var l = lastLap;
        return l == null ? null : l[k];
    }

    // lap speed: lap distance over lap time, as the watch's lap record
    function lapSpeed(dist as Numeric?, ms as Numeric?) as Numeric? {
        if (dist == null || ms == null || ms <= 0) {
            return null;
        }
        return dist * 1000.0 / ms;
    }

    // The live value the target colors by (the bar uses the same).
    function liveValue(metric as Number) as Numeric? {
        var i = info;
        if (i == null) {
            return null;
        }
        if (metric == Target.PACE) {
            return i.currentSpeed;
        }
        if (metric == Target.POWER) {
            return i.currentPower;
        }
        return i.currentHeartRate;
    }

    function targetValue() as Numeric? {
        var t = cfg.target;
        return t == null ? null : liveValue(t[0] as Number);
    }

    // VO2 max, temperature, sunrise/sunset: the watch updates them slowly.
    function readSlow() as Void {
        if (!vo2Read) {
            vo2Read = true;
            try {
                var p = UserProfile.getProfile();
                if (p has :vo2maxRunning && p.vo2maxRunning != null) {
                    vo2max = p.vo2maxRunning;
                }
            } catch (e) {
                vo2max = null;
            }
        }
        if (uses(FieldTable.F_TEMPERATURE)) {
            temperature = readTemperature();
        }
        if (uses(FieldTable.F_SUNRISE) || uses(FieldTable.F_SUNSET)) {
            sun = readSun();
        }
    }

    function readTemperature() as Numeric? {
        if (!(Toybox has :SensorHistory) || !(SensorHistory has :getTemperatureHistory)) {
            return null;
        }
        try {
            var it = SensorHistory.getTemperatureHistory({:period => 1});
            var s = it != null ? it.next() : null;
            return s != null ? s.data : null;
        } catch (e) {
            return null;
        }
    }

    // the watch's sunrise and sunset where its weather was last observed
    function readSun() as Array<Time.Moment?>? {
        if (!(Toybox has :Weather) || !(Weather has :getSunrise)) {
            return null;
        }
        try {
            var c = Weather.getCurrentConditions();
            var loc = c != null ? c.observationLocationPosition : null;
            if (loc == null) {
                return null;
            }
            var now = Time.now();
            return [Weather.getSunrise(loc, now), Weather.getSunset(loc, now)];
        } catch (e) {
            return null;
        }
    }

    function uses(fieldId as Number) as Boolean {
        for (var r = 0; r < cfg.cols.size(); r++) {
            var ids = Layout.rowSlots(r, cfg.cols[r]);
            for (var k = 0; k < ids.size(); k++) {
                if (cfg.slots[ids[k]] == fieldId) {
                    return true;
                }
            }
        }
        return cfg.compact == fieldId;
    }

    // ---------------------------------------------------------- field values

    // The raw native value of a field (Numeric, Moment) or null.
    function raw(id as Number) as Object? {
        var i = info;
        if (id == FieldTable.F_CLOCK) {
            return -1; // drawn from the clock below
        }
        if (id == FieldTable.F_BATTERY) {
            return System.getSystemStats().battery;
        }
        if (id == FieldTable.F_VO2MAX) {
            return vo2max;
        }
        if (id == FieldTable.F_TEMPERATURE) {
            return temperature;
        }
        if (id == FieldTable.F_SUNRISE || id == FieldTable.F_SUNSET) {
            var s = sun;
            return s == null ? null : s[id == FieldTable.F_SUNRISE ? 0 : 1];
        }
        if (id == FieldTable.F_LAPS) {
            return lapCount + 1;
        }
        if (i == null) {
            return null;
        }
        switch (id) {
            case FieldTable.F_HR: return i.currentHeartRate;
            case FieldTable.F_HR_ZONE: return i.currentHeartRate;
            case FieldTable.F_AVG_HR: return i.averageHeartRate;
            case FieldTable.F_MAX_HR: return i.maxHeartRate;
            case FieldTable.F_PACE: return i.currentSpeed;
            case FieldTable.F_AVG_PACE: return i.averageSpeed;
            case FieldTable.F_MAX_PACE: return i.maxSpeed;
            case FieldTable.F_SPEED: return i.currentSpeed;
            case FieldTable.F_AVG_SPEED: return i.averageSpeed;
            case FieldTable.F_MAX_SPEED: return i.maxSpeed;
            case FieldTable.F_LAP_PACE:
            case FieldTable.F_LAP_SPEED:
                return lapSpeed(lapValue(T_DIST), lapValue(T_TIME));
            case FieldTable.F_LAST_LAP_PACE:
            case FieldTable.F_LAST_LAP_SPEED:
                return lapSpeed(lastLapValue(T_DIST), lastLapValue(T_TIME));
            case FieldTable.F_POWER: return i.currentPower;
            case FieldTable.F_AVG_POWER: return i.averagePower;
            case FieldTable.F_MAX_POWER: return i.maxPower;
            case FieldTable.F_TIMER: return i.timerTime;
            case FieldTable.F_ELAPSED: return i.elapsedTime;
            case FieldTable.F_LAP_TIME: return lapValue(T_TIME);
            case FieldTable.F_LAST_LAP_TIME: return lastLapValue(T_TIME);
            case FieldTable.F_DISTANCE: return i.elapsedDistance;
            case FieldTable.F_LAP_DISTANCE: return lapValue(T_DIST);
            case FieldTable.F_LAST_LAP_DISTANCE: return lastLapValue(T_DIST);
            case FieldTable.F_DIST_TO_DEST: return i.distanceToDestination;
            case FieldTable.F_ASCENT: return i.totalAscent;
            case FieldTable.F_DESCENT: return i.totalDescent;
            case FieldTable.F_LAP_ASCENT: return lapValue(T_ASC);
            case FieldTable.F_LAP_DESCENT: return lapValue(T_DESC);
            case FieldTable.F_LAST_LAP_ASCENT: return lastLapValue(T_ASC);
            case FieldTable.F_LAST_LAP_DESCENT: return lastLapValue(T_DESC);
            case FieldTable.F_ALTITUDE: return i.altitude;
            case FieldTable.F_CADENCE: return i.currentCadence;
            case FieldTable.F_AVG_CADENCE: return i.averageCadence;
            case FieldTable.F_MAX_CADENCE: return i.maxCadence;
            case FieldTable.F_CALORIES: return i.calories;
            case FieldTable.F_LAP_CALORIES: return lapValue(T_CAL);
            case FieldTable.F_AEROBIC_TE: return i.trainingEffect;
        }
        return null;
    }

    // The text a field shows: the native value in the watch's units.
    function text(id as Number) as String {
        var kind = FieldTable.KIND[id];
        if (kind == FieldTable.K_NONE) {
            return "";
        }
        if (kind == FieldTable.K_CLOCK) {
            var c = System.getClockTime();
            return Text.clock(c.hour, c.min, cfg.is24);
        }
        var v = raw(id);
        if (v == null) {
            return "--";
        }
        if (kind == FieldTable.K_TOD) {
            return Text.timeOfDay(v as Time.Moment, cfg.is24);
        }
        if (!(v instanceof Number || v instanceof Float || v instanceof Double || v instanceof Long)) {
            return "--";
        }
        var n = v as Numeric;
        switch (kind) {
            case FieldTable.K_INT: return Text.int(n);
            case FieldTable.K_PACE: return Text.pace(n, cfg.statutePace);
            case FieldTable.K_SPEED: return Text.speed(n, cfg.statuteDist);
            case FieldTable.K_DUR: return Text.duration((n / 1000).toNumber());
            case FieldTable.K_DIST: return Text.distance(n, cfg.statuteDist);
            case FieldTable.K_ELEV: return Text.elevation(n, cfg.statuteElev);
            case FieldTable.K_DEC1: return n.toFloat().format("%.1f");
            case FieldTable.K_TEMP: return Text.celsius(n, cfg.fahrenheit);
            case FieldTable.K_PCT: return Text.int(n) + "%";
            case FieldTable.K_ZONE: {
                var z = Zones.hrZone(n, cfg.hrZones);
                return z > 0 ? "Z" + z : "--";
            }
        }
        return "--";
    }

    // widest typical value: sizes the digits so they don't jump
    function sample(id as Number) as String {
        if (id == FieldTable.F_TIMER || id == FieldTable.F_ELAPSED) {
            var i = info;
            var ms = i == null ? null : (id == FieldTable.F_TIMER ? i.timerTime : i.elapsedTime);
            if (ms != null && ms >= 3600000) {
                return "0:00:00";
            }
        }
        if (FieldTable.KIND[id] == FieldTable.K_PACE && cfg.statutePace) {
            return "00:00";
        }
        return FieldTable.SAMPLE[id];
    }

    // ---------------------------------------------------------------- screen

    function onLayout(dc as Dc) as Void {
        var ds = System.getDeviceSettings();
        var w = dc.getWidth();
        var h = dc.getHeight();
        full = w >= ds.screenWidth && h >= ds.screenHeight;
        sc = w / 480.0;
        // small screens: text a bit larger than the scaled design (it
        // still shrinks to fit its box)
        ts = sc * (w < 360 ? 1.0 + (360 - w) / 360.0 * 0.45 : 1.0);
        fitCache = {} as Dictionary<String, Number>;
    }

    function px(v as Numeric) as Number {
        return Math.round(v * sc).toNumber();
    }

    function onUpdate(dc as Dc) as Void {
        dark = getBackgroundColor() != Graphics.COLOR_WHITE;
        var bg = Theme.bg(dark);
        dc.setColor(bg, bg);
        dc.clear();
        if (dc has :setAntiAlias) {
            dc.setAntiAlias(true);
        }
        if (!full) {
            drawCompact(dc);
            return;
        }
        var locked = mode == TrialSession.LOCKED;
        var zone = Zones.hrZone(info != null ? info.currentHeartRate : null, cfg.hrZones);

        // basic mode keeps the top row and one big value from rows 2 and 3
        for (var r = 0; r < cfg.cols.size(); r++) {
            var cols = cfg.cols[r];
            var ids = Layout.rowSlots(r, cols);
            var geo = LayoutTable.rowGeometry(r, cols);
            for (var k = 0; k < ids.size(); k++) {
                if (locked && r > 0 && !(r == 2 || r == 3)) {
                    continue;
                }
                if (locked && r > 0 && ids.size() > 1 && k != (ids.size() == 3 ? 1 : 0)) {
                    continue;
                }
                drawSlot(dc, ids[k], geo, k * 10, zone);
            }
        }
        drawRules(dc, locked);
        if (!locked) {
            drawBar(dc);
        } else {
            drawNotice(dc);
        }
    }

    // A slot: its label and its value.
    function drawSlot(dc as Dc, slot as Number, geo as Array<Number>, o as Number, zone as Number) as Void {
        var id = cfg.slots[slot];
        if (id == FieldTable.F_NONE) {
            return;
        }
        var value = text(id);
        var color = valueColor(id);
        var key = slot + ":" + value.length();
        var size = fitted(dc, key, sample(id), value, geo[o + 8], geo[o + 7]);
        var vx = px(geo[o + 5]);
        var vy = px(geo[o + 6]);
        var vw = px(geo[o + 7]);
        var vh = Math.round((geo[o + 8] + 6) * sc).toNumber();
        drawText(dc, vx, vy, vw, vh, geo[o + 9], fonts.get(size), value, color);

        // a single top value showing heart rate: its zone after it
        if (slot == Layout.SLOT_HEADER && id == FieldTable.F_HR && zone > 0) {
            var tw = dc.getTextWidthInPixels(value, fonts.get(size));
            var sx = vx + (vw + tw) / 2 + px(LayoutTable.SUFFIX[0]);
            var ssize = Math.round(LayoutTable.SUFFIX[2] * ts).toNumber();
            dc.setColor(Zones.color(zone), Graphics.COLOR_TRANSPARENT);
            dc.drawText(sx, vy + vh / 2, fonts.get(ssize), "Z" + zone,
                Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        }

        if (geo[o + 3] == 0) {
            return; // big center values carry no label
        }
        var label = cfg.shortLabels ? FieldTable.SHORT[id] : FieldTable.LABEL[id];
        var lcolor = Theme.group(FieldTable.GROUP[id], dark);
        // heart rate anywhere but the single top value: the zone rides in
        // the label, in the zone's color (none below zone 1)
        if (id == FieldTable.F_HR && slot != Layout.SLOT_HEADER && zone > 0) {
            label = "HR Z" + zone;
            lcolor = Zones.color(zone);
        }
        var lsize = fitted(dc, "l" + slot + label, label, label, geo[o + 3], geo[o + 2]);
        drawText(dc, px(geo[o]), px(geo[o + 1]), px(geo[o + 2]),
            Math.round((geo[o + 3] + 6) * sc).toNumber(), geo[o + 4],
            fonts.get(lsize), label, lcolor);
    }

    function valueColor(id as Number) as Number {
        var t = cfg.target;
        if (t != null && status != Target.NONE && id == Target.fieldOf(t[0] as Number)) {
            return Theme.target(status, dark);
        }
        return Theme.fg(dark);
    }

    // Text size (px) that fits both the sample and the text in a box width;
    // never above the design size. Cached per slot and text length.
    function fitted(dc as Dc, key as String, sampleText as String, value as String, designSize as Number, designW as Number) as Number {
        var cached = fitCache[key];
        if (cached != null) {
            return cached;
        }
        var w = px(designW);
        var size = Math.round(designSize * ts).toNumber();
        var guard = 0;
        while (size > 6 && guard < 40) {
            guard++;
            var f = fonts.get(size);
            var tw = dc.getTextWidthInPixels(sampleText, f);
            var tv = dc.getTextWidthInPixels(value, f);
            if (tv > tw) {
                tw = tv;
            }
            if (tw <= w) {
                break;
            }
            var next = fonts.smaller(size);
            if (fonts.vector) {
                var guess = (size * w / tw).toNumber();
                next = guess < next ? guess : next;
            }
            if (next <= 0) {
                break;
            }
            size = next;
        }
        if (fitCache.size() > 80) {
            fitCache = {} as Dictionary<String, Number>;
        }
        fitCache[key] = size;
        return size;
    }

    // Text in a box, aligned (0 left, 1 center, 2 right), centered vertically.
    function drawText(dc as Dc, x as Number, y as Number, w as Number, h as Number, align as Number, font as FontType, s as String, color as Number) as Void {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        var jx = x;
        var just = Graphics.TEXT_JUSTIFY_LEFT;
        if (align == 1) {
            jx = x + w / 2;
            just = Graphics.TEXT_JUSTIFY_CENTER;
        } else if (align == 2) {
            jx = x + w;
            just = Graphics.TEXT_JUSTIFY_RIGHT;
        }
        dc.drawText(jx, y + h / 2, font, s, just | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    function fillBox(dc as Dc, b as Array<Number>, o as Number) as Void {
        var w = px(b[o + 2]);
        var h = px(b[o + 3]);
        dc.fillRectangle(px(b[o]), px(b[o + 1]), w > 1 ? w : 1, h > 1 ? h : 1);
    }

    // Rules between rows and column separators; basic mode keeps the top one.
    function drawRules(dc as Dc, locked as Boolean) as Void {
        dc.setColor(Theme.divider(dark), Graphics.COLOR_TRANSPARENT);
        var d = LayoutTable.DIVIDERS;
        for (var o = 0; o < d.size(); o += 4) {
            if (!locked || o == 0) {
                fillBox(dc, d, o);
            }
        }
        if (locked) {
            return;
        }
        for (var r = 0; r < cfg.cols.size(); r++) {
            var lines = LayoutTable.rowDividers(r, cfg.cols[r]);
            for (var o = 0; o < lines.size(); o += 4) {
                fillBox(dc, lines, o);
            }
        }
    }

    // Five equal zone segments, the live value's marker, and the target
    // range under the bar when the bar shows the target's metric.
    function drawBar(dc as Dc) as Void {
        var metric = cfg.barMetric();
        if (metric == 0) {
            return;
        }
        var bounds = cfg.zonesFor(metric);
        var b = LayoutTable.BAR;
        var x = px(b[0]);
        var y = px(b[1]);
        var w = px(b[2]);
        var h = px(b[3]) > 2 ? px(b[3]) : 2;
        var gap = px(b[4]) > 1 ? px(b[4]) : 1;
        var segW = (w - gap * (Zones.COUNT - 1)) / Zones.COUNT.toFloat();
        for (var i = 0; i < Zones.COUNT; i++) {
            dc.setColor(Zones.COLORS[i], Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(Math.round(x + i * (segW + gap)).toNumber(), y,
                Math.round(segW).toNumber(), h, h / 2);
        }
        var t = cfg.target;
        if (t != null && t[0] == metric) {
            var a = Zones.position(t[1], bounds);
            var c = Zones.position(t[2], bounds);
            if (a >= 0 && c >= 0) {
                var bx = x + Math.round((a < c ? a : c) * w).toNumber();
                var bw = Math.round((a < c ? c - a : a - c) * w).toNumber();
                var minW = px(b[10]);
                if (bw < minW) {
                    bw = minW;
                }
                if (bx > x + w - bw) {
                    bx = x + w - bw;
                }
                var bh = px(b[9]) > 2 ? px(b[9]) : 2;
                dc.setColor(Theme.fg(dark), Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(bx, px(b[8]), bw, bh, bh / 2);
            }
        }
        var pos = Zones.position(liveValue(metric), bounds);
        if (pos >= 0) {
            var mw = px(b[5]) > 3 ? px(b[5]) : 3;
            var mx = x + Math.round(pos * (w - mw)).toNumber();
            dc.setColor(Theme.fg(dark), Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(mx, px(b[6]), mw, px(b[7]), mw / 2);
        }
    }

    // Basic mode (trial over): never a dead end mid-run, the three main
    // values stay.
    function drawNotice(dc as Dc) as Void {
        var color = Theme.notice(dark);
        var lines = [
            [LayoutTable.NOTICE_SUB, "Trial ended (" + TrialSession.RUNS + " runs)"],
            [LayoutTable.NOTICE, "Unlock in Garmin Connect"],
        ];
        for (var k = 0; k < lines.size(); k++) {
            var n = lines[k][0] as Array<Number>;
            var s = lines[k][1] as String;
            var size = fitted(dc, "n" + k, s, s, n[3], n[2]);
            drawText(dc, px(n[0]), px(n[1]), px(n[2]), Math.round((n[3] + 6) * sc).toNumber(), 1,
                fonts.get(size), s, color);
        }
    }

    // Smaller data screen spots: one field, its label above.
    function drawCompact(dc as Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var id = cfg.compact;
        var value = mode == TrialSession.LOCKED && id != FieldTable.F_PACE && id != FieldTable.F_HR
            && id != FieldTable.F_TIMER ? "--" : text(id);
        var label = FieldTable.LABEL[id];
        var lsize = (h * 0.16).toNumber();
        var vsize = (h * 0.5).toNumber();
        var maxW = (w * 0.8).toNumber();
        var size = vsize;
        for (var guard = 0; guard < 30 && size > 6; guard++) {
            var tw = dc.getTextWidthInPixels(value.length() > sample(id).length() ? value : sample(id), fonts.get(size));
            if (tw <= maxW) {
                break;
            }
            var next = fonts.smaller(size);
            if (next <= 0) {
                break;
            }
            size = next;
        }
        dc.setColor(Theme.group(FieldTable.GROUP[id], dark), Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, (h * 0.22).toNumber(), fonts.get(lsize), label,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(valueColor(id), Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, (h * 0.6).toNumber(), fonts.get(size), value,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}
