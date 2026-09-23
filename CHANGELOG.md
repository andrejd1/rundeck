# Changelog

## 0.2.0 — customizable screen

- 13 slots, 25 fields: pick what goes where, in the phone settings or on the watch (open
  RunDeck from the app list). The newer layout wins in both directions.
- Zone bar: HR, pace, power or off, per layout.
- HR zones default to the watch's own zones (Zepp OS 4.2+), else 220 - age, else 190.
- Pace or power target, colored wherever that live value is on screen.
- New fields: max HR, last lap pace, speed, clock, lap count, altitude, avg cadence,
  calories, HR zone.
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
