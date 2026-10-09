# Changelog

## 0.1.0 — first Garmin build (unreleased, not yet run on a watch)

- RunDeck as a Connect IQ data field for the native Run activity: top row plus five rows
  and the zone bar, column counts per row (top 1–2, rows 1/4 2–3, rows 2/3 1–3, bottom 1–2),
  any of 45 fields in any spot, field names as text, short text or icons, the Amazfit layout scaled to every
  round screen from 218 to 454 px.
- Every value is the watch's own (`Activity.Info`, user profile, system), in the watch's
  units. Lap values are the watch's totals at its own lap marks (lap key, auto lap, workout
  steps).
- HR zone suffix and "HR Z3" labels from the watch's own zones; five-zone bar (auto / HR /
  pace / power / off) with the target range; pace, power or HR target colors.
- Settings in Garmin Connect and on the watch (Menu2 editor); 4 presets.
- One field in smaller data screen spots; white background support.
- 5-run trial, basic mode afterwards; Polar license key activated by a background service.
- Scalable Roboto Condensed where the watch has scalable fonts, generated bitmap fonts
  elsewhere.
- Tooling: field catalog generator, preview renderer with a layout check, stand-in device
  files for CI builds, build/package script, GitHub Actions build of all 67 watches.
