# Changelog

## 0.2.0 — customizable screen

- License keys without an activation limit (Polar refuses to activate them with 403) unlock via
  validation instead of being reported as "already active on another watch".
- License key: activated once even when the settings page saves it twice (a second activation
  in flight was refused by Polar and overwrote the unlock); a key that doesn't unlock shows why in
  red ("Key not activated: ...") until it changes, instead of the reason vanishing behind the trial
  line.

- Battery: while another data page is on screen, or the screen is off without the always-on
  display (raise to wake), RunDeck draws nothing and
  reads only what the lap/average stats need (time, distance, HR, power, altitude), so averages
  still include that time. Raising the wrist redraws at once. With the always-on display it keeps
  drawing, as the screen may still show it.

- Every round screen size: the HR graph, icons and bottom row scale correctly from 480 down to 360 px
  (icons ship in five pixel sizes, graph bars are placed from the scaled width, the bottom row sits
  clear of the bezel); tests render every layout style at 480, 466, 454, 416, 390 and 360 px.

- Units after values (km/mi, /km or /mi, W; m/ft on altitude; none on heart rate, cadence, calories,
  speed or ascent, as the watch-drawn descent can't carry one), following the pace
  unit; never shrink the value (a unit that doesn't fit beside it is left off, and stays off for
  the run); not on the big center numbers; can be hidden (phone and watch).

- Full privacy statement (PRIVACY.md), published at
  https://andrejd1.github.io/rundeck/privacy.html and linked from the settings page and the site.

- 16 native-only fields drawn by the watch itself (SPORT_DATA): descent, lap
  ascent/descent, max altitude, vertical speed, max speed, stride length, steps, % max HR,
  % HR reserve, aerobic/anaerobic TE, training load, temperature, sunset.
- Heart rate target; targets entered as From / To, kept per metric.
- No trial text on the run screen (trial status stays in the phone settings).

- Configurable slots, 41 fields: pick what goes where, in the phone settings or on the watch (open
  RunDeck from the app list). The newer layout wins in both directions.
- Zone bar: HR, pace, power or off, per layout.
- HR zones default to the watch's own zones (Zepp OS 4.2+), else 220 - age, else 190.
- Pace or power target, colored wherever that live value is on screen.
- New fields: max HR, last lap pace, speed, clock, lap count, altitude, avg cadence,
  calories, HR zone.
- Column count per row (top: 1-2, rows 1/4: 2-3, rows 2/3: 1-3, bottom: 1-2); a
  two-column top row shows HR with its zone in the label; row 4 matches row 1's height
  and sizes; field names as text, short text or icons; both editable on the phone and the watch.
- Row 2 left label/value aligned with the right one.
- Phone settings rebuilt: chips instead of dropdowns (the Zepp app's Select showed no
  value), saved values printed above every input, one block per line, cards.
- Zone bar "Auto" (default): follows the target's metric when its threshold is set (FTP,
  LT pace), else HR; the target range is marked under the bar.
- App id, Polar organization and checkout link set; new "RD" monogram icon (six options in docs/icons).

## 0.1.0 — first build

- One-screen dashboard modeled on a dense running data page: HR + zone + 6-minute HR graph,
  lap/avg HR, lap pace | big pace or power | avg pace, five-zone bar (HR, pace or power),
  lap time | elapsed | cadence, lap distance | grade, distance | total ascent.
- Target range for the center metric (pace or power): green inside, blue below, red above.
- RunDeck laps (lap key + configurable auto-lap) with a lap summary flash.
- 5-run trial, basic mode afterwards, €6 unlock via Polar.sh license keys.
