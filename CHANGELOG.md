# Changelog

## 0.2.0 — customizable screen

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
