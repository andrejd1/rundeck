// Trial accounting: 5 free runs, then the full screen needs a license.
//
// A run counts once the watch's timer passes 5 minutes, once per activity:
// the activity is known by its start time (Activity.Info.startTime), so a
// data field reloaded mid-run (data screens edited) never costs a second
// run. The access mode is latched when the activity starts: a run that
// starts on the trial finishes on it, even the one that uses the trial up,
// and a license arriving mid-run unlocks at once. Before the timer starts
// the screen already shows what the run will get.
//
// The count lives on the watch (Application.Storage). It is not
// tamper-proof and doesn't try to be: the goal is "paying is easier than
// cracking", not DRM.

import Toybox.Application;
import Toybox.Lang;

class TrialSession {
    static const RUNS = 5;
    static const COUNT_AFTER_MS = 5 * 60 * 1000;

    static const PENDING = 0;
    static const FULL = 1;
    static const TRIAL = 2;
    static const LOCKED = 3;

    var used as Number = 0;
    var lastStart as Number? = null; // start time (epoch s) of the run counted last
    var licensed as Boolean = false;
    var mode as Number = PENDING;
    var counted as Boolean = false;

    function initialize(isLicensed as Boolean) {
        licensed = isLicensed;
        var t = Storage.getValue("trial");
        if (t instanceof Array && t.size() == 2) {
            var u = t[0];
            var s = t[1];
            if (u instanceof Number && u > 0) {
                used = u;
            }
            if (s instanceof Number) {
                lastStart = s;
            }
        }
    }

    function runsLeft() as Number {
        return used >= RUNS ? 0 : RUNS - used;
    }

    function setLicensed(isLicensed as Boolean) as Void {
        licensed = isLicensed;
        if (isLicensed) {
            mode = FULL;
        } else if (mode == FULL) {
            mode = PENDING; // decided again for this activity
        }
    }

    // The activity ended (saved or discarded): the next one is decided anew.
    function reset() as Void {
        mode = PENDING;
        counted = false;
    }

    // One tick: the activity's start (epoch s, null before the timer first
    // starts) and the watch's timer (ms). Returns the mode to draw.
    function tick(startSec as Number?, timerMs as Number?) as Number {
        if (licensed) {
            return FULL;
        }
        if (mode == PENDING || mode == FULL) {
            if (startSec == null) {
                // not started: show what this run will get, latch nothing
                return used < RUNS ? TRIAL : LOCKED;
            }
            counted = lastStart != null && lastStart == startSec;
            mode = counted || used < RUNS ? TRIAL : LOCKED;
        }
        if (mode == TRIAL && !counted && timerMs != null && timerMs >= COUNT_AFTER_MS) {
            counted = true;
            used += 1;
            lastStart = startSec;
            Storage.setValue("trial", [used, startSec]);
        }
        return mode;
    }
}
